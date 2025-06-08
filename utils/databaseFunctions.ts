import { MongoClient, ObjectId, WithId } from "mongodb"
import { match } from "assert"

const mongodbUri = process.env.MONGODB_URI || ""

export async function fetchPlayerAverageTurnTime(playerName: string) {
  const client = await MongoClient.connect(mongodbUri)
  const db = client.db("games")
  const collection = db.collection("games")

  // Fetching the records having player name in playerOne or playerTwo
  const playerOneGames = await collection
    .find({ playerOne: playerName })
    .toArray()
  const playerTwoGames = await collection
    .find({ playerTwo: playerName })
    .toArray()

  // Extracting average turn times
  const playerOneAverageTurnTimes = playerOneGames.map(
    (game) => game.playerOneAverageTurnTime
  )
  const playerTwoAverageTurnTimes = playerTwoGames.map(
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

export async function updateGameDatabase(
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
  const client = await MongoClient.connect(mongodbUri)
  const db = client.db(`games`)
  const collection = db.collection(`games`)

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

export async function updateDungeonGameDatabase(
  matchId: string,
  timestamp: number,
  playerOne: string,
  playerOneScore: number,
  playerTwo: string,
  playerTwoScore: number
) {
  const client = await MongoClient.connect(mongodbUri)
  const db = client.db(`games`)
  const collection = db.collection(`games`)

  const result = await collection.insertOne({
    matchId: matchId,
    timestamp: timestamp,
    playerOne: playerOne,
    playerOneScore: playerOneScore,
    playerTwo: playerTwo,
    playerTwoScore: playerTwoScore,
  })

  await client.close()

  return result
}
export async function resetDungeonLevels() {
  const client = await MongoClient.connect(mongodbUri)
  const db = client.db("players")
  const collection = db.collection("players")

  await collection.updateMany(
    {},
    {
      $set: {
        highestDungeonLevel: 0,
        highestDarkDungeonLevel: 0,
      },
    },
    {
      upsert: true,
    }
  )
  console.log("Daily Dungeon Levels reset")

  await client.close()
}
export async function setHighestDungeonLevel(
  player: string,
  currentHighestLevel: number
) {
  const client = await MongoClient.connect(mongodbUri)
  const db = client.db("players")
  const collection = db.collection("players")

  await collection.updateOne(
    { player: player },
    {
      $set: {
        highestDungeonLevel: currentHighestLevel,
      },
    },
    {
      upsert: true,
    }
  )

  await client.close()
}
export async function setHighestDarkDungeonLevel(
  player: string,
  currentHighestDarkLevel: number
) {
  const client = await MongoClient.connect(mongodbUri)
  const db = client.db("players")
  const collection = db.collection("players")

  await collection.updateOne(
    { player: player },
    {
      $set: {
        highestDarkDungeonLevel: currentHighestDarkLevel,
      },
    },
    {
      upsert: true,
    }
  )

  await client.close()
}
export async function resetLostRenown() {
  const client = await MongoClient.connect(mongodbUri)
  const db = client.db("players")
  const collection = db.collection("players")

  await collection.updateMany(
    {},
    {
      $set: {
        unclaimedGwen: 0,
        lastClaimTimestamp: 0,
      },
    },
    {
      upsert: true,
    }
  )
  console.log("Everything Reset")
  await client.close()
}

export async function replenishHourlyEnergy() {
  const client = await MongoClient.connect(mongodbUri)
  const db = client.db("players")
  const collection = db.collection("players")

  // Fetch all players
  const players = await collection.find().toArray()

  // Loop through each player
  for (const player of players) {
    // Check if energy is less than 10
    if (player.energy < 10) {
      // Increment energy by 1
      await collection.updateOne({ _id: player._id }, { $inc: { energy: 1 } })
    }
  }
  console.log("Hourly Energy replenished")
  await client.close()
}
export async function replenishDailyEnergy() {
  const client = await MongoClient.connect(mongodbUri)
  const db = client.db("players")
  const collection = db.collection("players")

  // Fetch all players
  const players = await collection.find().toArray()

  // Loop through each player
  for (const player of players) {
    // Check if energy is less than 10
    if (player.energy < 10) {
      await collection.updateOne({ _id: player._id }, { $set: { energy: 10 } })
    }
  }
  console.log("Daily Energy replenished")
  await client.close()
}
export async function addDefaultDeckValue() {
  const client = await MongoClient.connect(mongodbUri)
  const db = client.db("players")
  const collection = db.collection("players")

  await collection.updateMany(
    {},
    {
      $set: {
        renown: 0,
        winsDungeon: 0,
        lossesDungeon: 0,
        tiesDungeon: 0,
      },
    },
    {
      upsert: true,
    }
  )
  console.log("added value to db")
  await client.close()
}
export async function updateDungeonPlayerDatabase(
  player: string,
  playerName: string,
  playerRenown: number,
  playerLostRenown: number,
  playerWinsDungeon: number,
  playerLossesDungeon: number,
  playerTiesDungeon: number,
  playerHighestLevel: number,
  playerHighestDarkLevel: number
) {
  const client = await MongoClient.connect(mongodbUri)
  const db = client.db("players")
  const collection = db.collection("players")

  const result1 = await collection.updateOne(
    { player: player },
    {
      $set: {
        player: player,
        playerName: playerName,
        renown: playerRenown,
        lostRenown: playerLostRenown,
        winsDungeon: playerWinsDungeon,
        lossesDungeon: playerLossesDungeon,
        tiesDungeon: playerTiesDungeon,
        highestDungeonLevel: playerHighestLevel,
        highestDarkDungeonLevel: playerHighestDarkLevel,
      },
    },
    {
      upsert: true,
    }
  )

  await client.close()

  return { playerOneResult: result1 }
}
export async function updateDungeonTournamentFourPlayerDatabase(
  player: string,
  playerName: string,
  playerRenown: number,
  playerWinsDungeon: number,
  playerLossesDungeon: number,
  playerTiesDungeon: number
) {
  const client = await MongoClient.connect(mongodbUri)
  const db = client.db("dungeonTournaments")
  const collection = db.collection("tournamentFour")

  const result1 = await collection.updateOne(
    { player: player },
    {
      $set: {
        player: player,
        playerName: playerName,
        renown: playerRenown,
        winsDungeon: playerWinsDungeon,
        lossesDungeon: playerLossesDungeon,
        tiesDungeon: playerTiesDungeon,
      },
    },
    {
      upsert: true,
    }
  )

  await client.close()

  return { playerOneResult: result1 }
}
export async function updatePlayerDatabase(
  playerOne: string,
  playerOneName: string,
  playerOneEloNormal: number,
  playerOneOverallAverageTurnTime: number,
  playerOneWinsNormal: number,
  playerOneLossesNormal: number,
  playerOneTiesNormal: number,
  playerOneEloTournament: number,
  playerOneWinsTournament: number,
  playerOneLossesTournament: number,
  playerOneTiesTournament: number,
  playerTwo: string,
  playerTwoName: string,
  playerTwoEloTournament: number,
  playerTwoOverallAverageTurnTime: number,
  playerTwoWinsTournament: number,
  playerTwoLossesTournament: number,
  playerTwoTiesTournament: number,
  playerTwoEloNormal: number,
  playerTwoWinsNormal: number,
  playerTwoLossesNormal: number,
  playerTwoTiesNormal: number
) {
  const client = await MongoClient.connect(mongodbUri)
  const db = client.db("players")
  const collection = db.collection("players")

  if (playerOne !== null && playerOne !== "000000000") {
    const result1 = await collection.updateOne(
      { player: playerOne },
      {
        $set: {
          player: playerOne,
          playerName: playerOneName,
          eloNormal: playerOneEloNormal,
          averageTurnTime: +playerOneOverallAverageTurnTime,
          winsNormal: playerOneWinsNormal,
          lossesNormal: playerOneLossesNormal,
          tiesNormal: playerOneTiesNormal,
          eloTournament: playerOneEloTournament,
          winsTournament: playerOneWinsTournament,
          lossesTournament: playerOneLossesTournament,
          tiesTournament: playerOneTiesTournament,
        },
      },
      {
        upsert: true,
      }
    )
  }

  if (playerTwo !== null && playerTwo !== "000000000") {
    const result2 = await collection.updateOne(
      { player: playerTwo },
      {
        $set: {
          player: playerTwo,
          playerName: playerTwoName,
          eloNormal: playerTwoEloNormal,
          averageTurnTime: +playerTwoOverallAverageTurnTime,
          winsNormal: playerTwoWinsNormal,
          lossesNormal: playerTwoLossesNormal,
          tiesNormal: playerTwoTiesNormal,
          eloTournament: playerTwoEloTournament,
          winsTournament: playerTwoWinsTournament,
          lossesTournament: playerTwoLossesTournament,
          tiesTournament: playerTwoTiesTournament,
        },
      },
      {
        upsert: true,
      }
    )
  }

  await client.close()
}

export async function fetchHighestLevelAndEnergy(player: string) {
  const client = await MongoClient.connect(mongodbUri)
  const db = client.db("players")
  const collection = db.collection("players")

  let playerStats = await collection.findOne({ player: player })
  //console.log(playerStats)

  if (!playerStats) {
    const defaultValues = {
      _id: new ObjectId(),
      player: player,
      playerName: player,
      eloNormal: 1000,
      averageTurnTime: 0,
      winsNormal: 0,
      lossesNormal: 0,
      tiesNormal: 0,
      eloTournament: 1000,
      winsTournament: 0,
      lossesTournament: 0,
      tiesTournament: 0,
      renown: 0,
      lostRenown: 0,
      winsDungeon: 0,
      lossesDungeon: 0,
      tiesDungeon: 0,
      highestDungeonLevel: 0,
      highestDarkDungeonLevel: 0,
      energy: 10,
      playerPfp: "/img/game/pfp.png",
    }

    await collection.insertOne(defaultValues)
    playerStats = defaultValues
  }

  await client.close()

  let highestDungeonLevel = playerStats.highestDungeonLevel
  let highestDarkDungeonLevel = playerStats.highestDarkDungeonLevel
  let energy = playerStats.energy
  console.log("Highest Dungeon Level: " + highestDungeonLevel)
  console.log("Energy: " + energy)

  return {
    highestDungeonLevel: highestDungeonLevel,
    highestDarkDungeonLevel: highestDarkDungeonLevel,
    energy: energy,
  }
}

export async function fetchEnergy(player: string) {
  const client = await MongoClient.connect(mongodbUri)
  const db = client.db("players")
  const collection = db.collection("players")

  let playerStats = await collection.findOne({ player: player })

  if (!playerStats) {
    const defaultValues = {
      _id: new ObjectId(),
      player: player,
      playerName: player,
      eloNormal: 1000,
      averageTurnTime: 0,
      winsNormal: 0,
      lossesNormal: 0,
      tiesNormal: 0,
      eloTournament: 1000,
      winsTournament: 0,
      lossesTournament: 0,
      tiesTournament: 0,
      renown: 0,
      lostRenown: 0,
      winsDungeon: 0,
      lossesDungeon: 0,
      tiesDungeon: 0,
      highestDungeonLevel: 0,
      energy: 10,
      playerPfp: "/img/game/pfp.png",
    }

    await collection.insertOne(defaultValues)
    playerStats = defaultValues
  }

  await client.close()

  let energy = playerStats.energy

  return energy
}

export async function decrementEnergy(player: string) {
  let energy = await fetchEnergy(player)
  energy = energy - 1

  const client = await MongoClient.connect(mongodbUri)

  const db = client.db("players")
  const collection = db.collection("players")

  await collection.updateOne(
    { player: player },
    {
      $set: {
        energy: energy,
      },
    },
    {
      upsert: true,
    }
  )

  await client.close()
}
export async function fetchDungeonTournamentFourPlayerStats(player: string) {
  const client = await MongoClient.connect(mongodbUri)
  const db = client.db("dungeonTournaments")
  const collection = db.collection("tournamentFour")

  let playerStats = await collection.findOne({ player: player })

  if (!playerStats) {
    const defaultValues = {
      _id: new ObjectId(),
      player: player,
      playerName: player,
      renown: 0,
      winsDungeon: 0,
      lossesDungeon: 0,
      tiesDungeon: 0,
    }

    await collection.insertOne(defaultValues)
    playerStats = defaultValues
  }

  await client.close()

  return playerStats
}

export async function fetchPlayerStats(player: string) {
  const client = await MongoClient.connect(mongodbUri)
  const db = client.db("players")
  const collection = db.collection("players")

  let playerStats = await collection.findOne({ player: player })

  if (!playerStats) {
    const defaultValues = {
      _id: new ObjectId(),
      player: player,
      playerName: player,
      eloNormal: 1000,
      averageTurnTime: 0,
      winsNormal: 0,
      lossesNormal: 0,
      tiesNormal: 0,
      eloTournament: 1000,
      winsTournament: 0,
      lossesTournament: 0,
      tiesTournament: 0,
      renown: 0,
      lostRenown: 0,
      winsDungeon: 0,
      lossesDungeon: 0,
      tiesDungeon: 0,
      highestDungeonLevel: 0,
      highestDarkDungeonLevel: 0,
      energy: 10,
      playerPfp: "/img/game/pfp.png",
      unclaimedGwen: 0,
      lastClaimTimestamp: 0,
    }

    await collection.insertOne(defaultValues)
    playerStats = defaultValues
  }

  await client.close()

  return playerStats
}

export async function updateGwenRewards(player: string, gwenAmount: number) {
  const playerStats = await fetchPlayerStats(player)
  const oldUnclaimedRewards: number = playerStats.unclaimedGwen
  const newUnclaimedRewards: number = oldUnclaimedRewards + gwenAmount
  const client = await MongoClient.connect(mongodbUri)

  const db = client.db("players")
  const collection = db.collection("players")

  await collection.updateOne(
    { player: player },
    {
      $set: {
        unclaimedGwen: newUnclaimedRewards,
      },
    },
    {
      upsert: true,
    }
  )

  await client.close()
}

export async function fetchDeck(owner: string, name: string) {
  const client = await MongoClient.connect(mongodbUri)
  const db = client.db("decks")
  const collection = db.collection("decks")
  let deckCardProps = await collection.findOne({ owner: owner, name: name })

  if (!deckCardProps && name !== "Default Deck") {
    console.log("Deck not found")
  }
  await client.close()
  return deckCardProps
}
