import { Connection, address } from "@solana/web3.js"
import {
  getOrCreateAssociatedTokenAccount,
  createTransferInstruction,
} from "@solana/spl-token"
import {
  Keypair,
  ParsedAccountData,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js"
import * as bs58 from "bs58"
import axios from "axios"
import { MongoClient, ObjectId } from "mongodb"
import { time } from "console"
import dotenv from "dotenv"
dotenv.config()

const connection = new Connection(
  "https://lively-ultra-lambo.solana-mainnet.quiknode.pro/72c8ec506f45d1f495fcfe29fe00c039a322a863/"
)
const merchantPrivateKey = process.env.MERCHANT_PRIVATE_KEY || "0"

const mongodbUri = process.env.MONGODB_URI || ""

const merchantKeypair = Keypair.fromSecretKey(bs58.decode(merchantPrivateKey))
const merchantaddress = merchantKeypair.address
const gwenAddress =
  process.env.GWEN_ADDRESS || "AZhBUTBndtW21kM4gJochrXCA25nD258mjZCYJDQbiUg"

async function getNumberDecimals(mintAddress: string): Promise<number> {
  const info = await connection.getParsedAccountInfo(new address(mintAddress))

  if ("parsed" in info.value!.data) {
    const result = info.value?.data.parsed.info.decimals as number
    return result
  } else {
    throw new Error("Account data is not parsed data")
  }
}

export default async function sendRewards(amount: number, address: string) {
  console.log(
    `Sending ${amount} ${gwenAddress} from ${merchantaddress.toString()} to ${address}.`
  )
  // Send reward info to Gwen Rewards database
  const client = await MongoClient.connect(mongodbUri)
  const db = client.db("gwenRewards")
  const collection = db.collection("gwenRewards")
  const timestamp = Date.now()
  try {
    const defaultValues = {
      _id: new ObjectId(),
      timestamp: timestamp,
      address: address,
      amount: amount,
    }
    console.log("adding entry for rewards to db")
    await collection.insertOne(defaultValues)
  } catch (error) {
    console.log(error)
  }
  //Step 1
  console.log(`1 - Getting Source Token Account`)
  let sourceAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    merchantKeypair,
    new address(gwenAddress),
    merchantaddress
  )
  console.log(`    Source Account: ${sourceAccount.address.toString()}`)
  //Step 2
  console.log(`2 - Getting Destination Token Account`)
  let destinationAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    merchantKeypair,
    new address(gwenAddress),
    new address(address)
  )
  console.log(
    `    Destination Account: ${destinationAccount.address.toString()}`
  )
  console.log(`3 - Fetching Number of Decimals for Mint: ${gwenAddress}`)
  const numberDecimals = await getNumberDecimals(gwenAddress)
  console.log(`    Number of Decimals: ${numberDecimals}`)
  console.log(`4 - Creating Transaction`)
  const tx = new Transaction()
  console.log("adding amount intructions")
  tx.add(
    createTransferInstruction(
      sourceAccount.address,
      destinationAccount.address,
      merchantaddress,
      amount * Math.pow(10, numberDecimals)
    )
  )
  try {
    console.log("adding blockhash")
    tx.recentBlockhash = (
      await connection.getLatestBlockhash("confirmed")
    ).blockhash
    console.log(tx.recentBlockhash)

    console.log("trying to sign and confirm")
    const signature = await sendAndConfirmTransaction(connection, tx, [
      merchantKeypair,
    ])
    console.log(
      "\x1b[32m",
      `Transaction Success!🎉`,
      `\nhttps://explorer.solana.com/tx/${signature}?cluster=mainnet`
    )
    const filter = {
      timestamp: timestamp,
      address: address,
      amount: amount,
    }

    // delete the entry from the db
    const client = await MongoClient.connect(mongodbUri)
    const db = client.db("gwenRewards")
    const collection = db.collection("gwenRewards")
    console.log("deleting db entry after giving rewards")
    await collection.deleteOne(filter)
  } catch (err) {
    console.error("Error sending transaction:", err)
  }
}
