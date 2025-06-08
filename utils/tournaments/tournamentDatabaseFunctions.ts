import { MongoClient, ObjectId } from "mongodb"

export async function fetchTournamentFourPlayerAverageTurnTime(
  playerName: string
) {
  const client = await MongoClient.connect(
    "mongodb+srv://eduardorichardlootheroes:8qRqciAsDZUgZLxr@cluster0.8zqx2ia.mongodb.net/"
  )
  const db = client.db("tournamentGames")
  const collection = db.collection("tournamentFourGames")

  // Fetching the records having player name in playerOne or playerTwo
  const playerOneGames = await collection
    .find({ playerOne: playerName })
    .toArray()
  const playerTwoGames = await collection
    .find({ playerTwo: playerName })
    .toArray()

  // Extracting average turn times
  const playerOneAverageTurnTimes: number[] = playerOneGames.map(
    (game) => game.playerOneAverageTurnTime
  )
  const playerTwoAverageTurnTimes: number[] = playerTwoGames.map(
    (game) => game.playerTwoAverageTurnTime
  )

  await client.close()

  // Combining all average turn times
  const allAverageTurnTimes = [
    ...playerOneAverageTurnTimes,
    ...playerTwoAverageTurnTimes,
  ]

  // Calculating overall average turn time
  const totalTurnTime = allAverageTurnTimes.reduce(
    (total, value) => total + value,
    0
  )
  const overallAverageTurnTime = totalTurnTime / allAverageTurnTimes.length

  return overallAverageTurnTime.toFixed(0) as unknown as number
}

export async function updateTournamentFourGameDatabase(
  matchId: string,
  matchType: string,
  timestamp: number,
  playerOne: string,
  playerOneScore: number,
  playerOneAverageTurnTime: number,
  playerTwo: string,
  playerTwoScore: number,
  playerTwoAverageTurnTime: number
) {
  const client = await MongoClient.connect(
    "mongodb+srv://eduardorichardlootheroes:8qRqciAsDZUgZLxr@cluster0.8zqx2ia.mongodb.net/"
  )
  const db = client.db(`tournamentGames`)
  const collection = db.collection(`tournamentFourGames`)

  const result = await collection.insertOne({
    matchId: matchId,
    matchType: matchType,
    timestamp: timestamp,
    playerOne: playerOne,
    playerOneScore: playerOneScore,
    playerOneAverageTurnTime: playerOneAverageTurnTime,
    playerTwo: playerTwo,
    playerTwoScore: playerTwoScore,
    playerTwoAverageTurnTime: playerTwoAverageTurnTime,
  })

  await client.close()

  return result
}

export async function updateTournamentFourPlayerDatabase(
  playerOne: string,
  playerOneName: string,
  playerOneElo: number,
  playerOneOverallAverageTurnTime: number,
  playerOneWins: number,
  playerOneLosses: number,
  playerOneTies: number,
  playerTwo: string,
  playerTwoName: string,
  playerTwoElo: number,
  playerTwoOverallAverageTurnTime: number,
  playerTwoWins: number,
  playerTwoLosses: number,
  playerTwoTies: number
) {
  const client = await MongoClient.connect(
    "mongodb+srv://eduardorichardlootheroes:8qRqciAsDZUgZLxr@cluster0.8zqx2ia.mongodb.net/"
  )
  const db = client.db("tournamentPlayers")
  const collection = db.collection("tournamentFourPlayers")

  const result1 = await collection.updateOne(
    { player: playerOne },
    {
      $set: {
        player: playerOne,
        playerName: playerOneName,
        elo: playerOneElo,
        averageTurnTime: +playerOneOverallAverageTurnTime,
        wins: playerOneWins,
        losses: playerOneLosses,
        ties: playerOneTies,
      },
    },
    {
      upsert: true,
    }
  )

  const result2 = await collection.updateOne(
    { player: playerTwo },
    {
      $set: {
        player: playerTwo,
        playerName: playerTwoName,
        elo: playerTwoElo,
        averageTurnTime: +playerTwoOverallAverageTurnTime,
        wins: playerTwoWins,
        losses: playerTwoLosses,
        ties: playerTwoTies,
      },
    },
    {
      upsert: true,
    }
  )

  await client.close()

  return { playerOneResult: result1, playerTwoResult: result2 }
}

export async function fetchTournamentFourPlayerStats(player: string) {
  const client = await MongoClient.connect(
    "mongodb+srv://eduardorichardlootheroes:8qRqciAsDZUgZLxr@cluster0.8zqx2ia.mongodb.net/"
  )
  const db = client.db("tournamentPlayers")
  const collection = db.collection("tournamentFourPlayers")

  let playerStats = await collection.findOne({ player: player })

  if (!playerStats) {
    const defaultValues = {
      _id: new ObjectId(),
      player: player,
      playerName: player,
      elo: 1000,
      averageTurnTime: 0,
      wins: 0,
      losses: 0,
      ties: 0,
    }

    await collection.insertOne(defaultValues)
    playerStats = defaultValues
  }

  await client.close()

  return playerStats
}
