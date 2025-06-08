import { Match, MatchPlayer } from "../utils/types"

import {
  fetchDungeonTournamentFourPlayerStats,
  fetchPlayerAverageTurnTime,
  fetchPlayerStats,
  updateDungeonPlayerDatabase,
  updateDungeonTournamentFourPlayerDatabase,
  updateGameDatabase,
  updatePlayerDatabase,
} from "./databaseFunctions"
import {
  fetchTournamentFourPlayerAverageTurnTime,
  updateTournamentFourGameDatabase,
  updateTournamentFourPlayerDatabase,
  fetchTournamentFourPlayerStats,
} from "./tournaments/tournamentDatabaseFunctions"

function calculateElo(
  rankA: number,
  rankB: number,
  scoreA: number,
  kFactor: number = 32
): number {
  // Convert ranks to a probability
  const expectedScoreA = 1.0 / (1.0 + Math.pow(10, (rankB - rankA) / 400))
  // Update the rank
  const newRankA = rankA + kFactor * (scoreA - expectedScoreA)
  return newRankA
}

export async function pvpMatchOver(
  player: MatchPlayer,
  opponent: MatchPlayer,
  match: Match,
  socketId: string
) {
  const timestamp = Date.now()
  const playerOneStats = await fetchPlayerStats(match.players[socketId].address)

  const playerTwoStats = await fetchPlayerStats(
    match.players[opponent.socketId].address
  )

  let playerOneName: string = playerOneStats!.playerName
  let playerTwoName: string = playerTwoStats!.playerName
  let playerOneEloNormal: number = playerOneStats!.eloNormal
  let playerTwoEloNormal: number = playerTwoStats!.eloNormal
  let playerOneWinsNormal: number = playerOneStats!.winsNormal
  let playerTwoWinsNormal: number = playerTwoStats!.winsNormal
  let playerOneLossesNormal: number = playerOneStats!.lossesNormal
  let playerTwoLossesNormal: number = playerTwoStats!.lossesNormal
  let playerOneTiesNormal: number = playerOneStats!.tiesNormal
  let playerTwoTiesNormal: number = playerTwoStats!.tiesNormal
  let playerOneEloTournament: number = playerOneStats!.eloTournament
  let playerTwoEloTournament: number = playerTwoStats!.eloTournament
  let playerOneWinsTournament: number = playerOneStats!.winsTournament
  let playerTwoWinsTournament: number = playerTwoStats!.winsTournament
  let playerOneLossesTournament: number = playerOneStats!.lossesTournament
  let playerTwoLossesTournament: number = playerTwoStats!.lossesTournament
  let playerOneTiesTournament: number = playerOneStats!.tiesTournament
  let playerTwoTiesTournament: number = playerTwoStats!.tiesTournament

  console.log(
    player.score > opponent.score
      ? `Player ${player.color} won`
      : player.score < opponent.score
      ? `Player ${opponent.color} won`
      : `It's a draw!`
  )
  if (player.score > opponent.score) {
    if (match.matchType === "normal") {
      playerOneWinsNormal++
      playerTwoLossesNormal++
      playerOneEloNormal = calculateElo(
        playerOneEloNormal,
        playerTwoEloNormal,
        1
      )
      playerTwoEloNormal = calculateElo(
        playerTwoEloNormal,
        playerOneEloNormal,
        0
      )
    } else if (match.matchType === "tournament") {
      playerOneWinsTournament++
      playerTwoLossesTournament++
      playerOneEloTournament = calculateElo(
        playerOneEloTournament,
        playerTwoEloTournament,
        1
      )
      playerTwoEloTournament = calculateElo(
        playerTwoEloTournament,
        playerOneEloTournament,
        0
      )
    }
  } else if (player.score < opponent.score) {
    if (match.matchType === "normal") {
      playerOneLossesNormal++
      playerTwoWinsNormal++
      playerOneEloNormal = calculateElo(
        playerOneEloNormal,
        playerTwoEloNormal,
        0
      )
      playerTwoEloNormal = calculateElo(
        playerTwoEloNormal,
        playerOneEloNormal,
        1
      )
    } else if (match.matchType === "tournament") {
      playerOneLossesTournament++
      playerTwoWinsTournament++
      playerOneEloTournament = calculateElo(
        playerOneEloTournament,
        playerTwoEloTournament,
        0
      )
      playerTwoEloTournament = calculateElo(
        playerTwoEloTournament,
        playerOneEloTournament,
        1
      )
    }
  } else if (player.score === opponent.score) {
    if (match.matchType === "normal") {
      playerOneTiesNormal++
      playerTwoTiesNormal++
      playerOneEloNormal = calculateElo(
        playerOneEloNormal,
        playerTwoEloNormal,
        0.5
      )
      playerTwoEloNormal = calculateElo(
        playerTwoEloNormal,
        playerOneEloNormal,
        0.5
      )
    } else if (match.matchType === "tournament") {
      playerOneTiesTournament++
      playerTwoTiesTournament++
      playerOneEloTournament = calculateElo(
        playerOneEloTournament,
        playerTwoEloTournament,
        0.5
      )
      playerTwoEloTournament = calculateElo(
        playerTwoEloTournament,
        playerOneEloTournament,
        0.5
      )
    }
  }

  const playerAverageTurnTime =
    player.turnTimes.reduce((a, b) => a + b, 0) / player.turnTimes.length

  const opponentAverageTurnTime =
    opponent.turnTimes.reduce((a, b) => a + b, 0) / opponent.turnTimes.length

  if (match.matchType === "normal") {
    await updateGameDatabase(
      match.matchId,
      match.matchType,
      timestamp,
      player.address,
      player.score,
      Math.round(playerAverageTurnTime),
      opponent.address,
      opponent.score,
      Math.round(opponentAverageTurnTime)
    )
  } else if (match.matchType === "tournament") {
    await updateTournamentFourGameDatabase(
      match.matchId,
      match.matchType,
      timestamp,
      player.address,
      player.score,
      Math.round(playerAverageTurnTime),
      opponent.address,
      opponent.score,
      Math.round(opponentAverageTurnTime)
    )
    const tournamentFourPlayerOneStats = await fetchTournamentFourPlayerStats(
      player.address
    )
    const tournamentFourPlayerTwoStats = await fetchTournamentFourPlayerStats(
      opponent.address
    )
    let tournamentFourPlayerOneName: string = playerOneStats!.playerName
    let tournamentFourPlayerTwoName: string = playerTwoStats!.playerName
    let tournamentFourPlayerOneElo: number = tournamentFourPlayerOneStats!.elo
    let tournamentFourPlayerTwoElo: number = tournamentFourPlayerTwoStats!.elo
    let tournamentFourPlayerOneWins: number = tournamentFourPlayerOneStats!.wins
    let tournamentFourPlayerTwoWins: number = tournamentFourPlayerTwoStats!.wins
    let tournamentFourPlayerOneLosses: number =
      tournamentFourPlayerOneStats!.losses
    let tournamentFourPlayerTwoLosses: number =
      tournamentFourPlayerTwoStats!.losses
    let tournamentFourPlayerOneTies: number = tournamentFourPlayerOneStats!.ties
    let tournamentFourPlayerTwoTies: number = tournamentFourPlayerTwoStats!.ties

    if (player.score > opponent.score) {
      tournamentFourPlayerOneWins++
      tournamentFourPlayerTwoLosses++
      tournamentFourPlayerOneElo = calculateElo(
        tournamentFourPlayerOneElo,
        tournamentFourPlayerTwoElo,
        1
      )
      tournamentFourPlayerTwoElo = calculateElo(
        tournamentFourPlayerTwoElo,
        tournamentFourPlayerOneElo,
        0
      )
    } else if (player.score < opponent.score) {
      tournamentFourPlayerOneLosses++
      tournamentFourPlayerTwoWins++
      tournamentFourPlayerOneElo = calculateElo(
        tournamentFourPlayerOneElo,
        tournamentFourPlayerTwoElo,
        0
      )
      tournamentFourPlayerTwoElo = calculateElo(
        tournamentFourPlayerTwoElo,
        tournamentFourPlayerOneElo,
        1
      )
    } else if (player.score === opponent.score) {
      tournamentFourPlayerOneTies++
      tournamentFourPlayerTwoTies++
      tournamentFourPlayerOneElo = calculateElo(
        tournamentFourPlayerOneElo,
        tournamentFourPlayerTwoElo,
        0.5
      )
      tournamentFourPlayerTwoElo = calculateElo(
        tournamentFourPlayerTwoElo,
        tournamentFourPlayerOneElo,
        0.5
      )
    }

    let tournamentFourOpponentOverallAverageTurnTime =
      await fetchTournamentFourPlayerAverageTurnTime(opponent.address)

    let tournamentFourPlayerOverallAverageTurnTime =
      await fetchTournamentFourPlayerAverageTurnTime(player.address)

    await updateTournamentFourPlayerDatabase(
      player.address,
      tournamentFourPlayerOneName,
      Math.round(tournamentFourPlayerOneElo),
      tournamentFourPlayerOverallAverageTurnTime,
      tournamentFourPlayerOneWins,
      tournamentFourPlayerOneLosses,
      tournamentFourPlayerOneTies,
      opponent.address,
      tournamentFourPlayerTwoName,
      Math.round(tournamentFourPlayerTwoElo),
      tournamentFourOpponentOverallAverageTurnTime,
      tournamentFourPlayerTwoWins,
      tournamentFourPlayerTwoLosses,
      tournamentFourPlayerTwoTies
    )
  }
  let playerOverallAverageTurnTime = await fetchPlayerAverageTurnTime(
    player.address
  )
  let opponentOverallAverageTurnTime = await fetchPlayerAverageTurnTime(
    opponent.address
  )

  // Update player stats in the Player database

  await updatePlayerDatabase(
    player.address,
    playerOneName,
    Math.round(playerOneEloNormal),
    playerOverallAverageTurnTime,
    playerOneWinsNormal,
    playerOneLossesNormal,
    playerOneTiesNormal,
    Math.round(playerOneEloTournament),
    playerOneWinsTournament,
    playerOneLossesTournament,
    playerOneTiesTournament,
    opponent.address,
    playerTwoName,
    Math.round(playerTwoEloTournament),
    opponentOverallAverageTurnTime,
    playerTwoWinsTournament,
    playerTwoLossesTournament,
    playerTwoTiesTournament,
    Math.round(playerTwoEloNormal),
    playerTwoWinsNormal,
    playerTwoLossesNormal,
    playerTwoTiesNormal
  )
}

export async function dungeonMatchOver(
  player: MatchPlayer,
  dungeonDeck: string,
  match: Match,
  socketId: string,
  hasDungeonTicket: boolean
) {
  const playerStats = await fetchPlayerStats(match.players[socketId].address)

  let tournamentRenown = 0
  let tournamentWins = 0
  let tournamentTies = 0
  let tournamentLosses = 0

  let playerRenown: number = playerStats.renown || 0
  let playerLostRenown: number = playerStats.lostRenown || 0
  let playerWinsDungeon: number = playerStats.winsDungeon || 0
  let playerLossesDungeon: number = playerStats.lossesDungeon || 0
  let playerTiesDungeon: number = playerStats.tiesDungeon || 0
  let playerHighestDungeonLevel: number = playerStats.highestDungeonLevel || 0
  let playerHighestDarkDungeonLevel: number =
    playerStats.highestDarkDungeonLevel || 0

  let dungeonLevel = dungeonDeck.match(/\d+$/)
  let dungeonElement = dungeonDeck.replace(/\d+$/, "")
  let level: number = dungeonLevel ? +dungeonLevel[0] : 0
  let renownRewards: number = 0

  console.log(
    player.score > 7
      ? `${player.name} won`
      : player.score < 7
      ? `${player.name} lost`
      : `It's a draw!`
  )
  if (player.score > 7) {
    renownRewards =
      Number(level) === 1
        ? 10
        : Number(level) === 2
        ? 22
        : Number(level) === 3
        ? 36
        : Number(level) === 4
        ? 54
        : Number(level) === 5
        ? 76
        : Number(level) === 6
        ? 106
        : Number(level) === 7
        ? 141
        : Number(level) === 8
        ? 183
        : Number(level) === 9
        ? 234
        : Number(level) === 10
        ? 300
        : 0
    tournamentRenown = renownRewards
    tournamentWins++
    playerWinsDungeon++
    console.log(dungeonElement)

    console.log(`Old highestLevel: ${playerHighestDungeonLevel}`)
    // update highest dungeon level if applicable
    if (level > playerHighestDungeonLevel && dungeonElement !== "dark") {
      playerHighestDungeonLevel = level

      console.log(`New highestLevel: ${playerHighestDungeonLevel}`)
    }
    if (level > playerHighestDarkDungeonLevel && dungeonElement === "dark") {
      playerHighestDarkDungeonLevel = level

      console.log(`New highestDarkLevel: ${playerHighestDarkDungeonLevel}`)
    }
  } else if (player.score < 7) {
    tournamentLosses++
    playerLossesDungeon++
  } else if (player.score === 7) {
    tournamentTies++
    playerTiesDungeon++
  }

  /*

  // If we want to track player turn times for dungeons

  const playerAverageTurnTime =
    player.turnTimes.reduce((a, b) => a + b, 0) / player.turnTimes.length

  let playerOverallAverageTurnTime = await fetchPlayerAverageTurnTime(
    player.address
  )

*/

  // Update player stats in the Player database
  //if (hasDungeonTicket) {
  const tournamentPlayerStats = await fetchDungeonTournamentFourPlayerStats(
    match.players[socketId].address
  )
  let tournamentPlayerRenown: number = tournamentPlayerStats.renown || 0
  let tournamentPlayerWinsDungeon: number =
    tournamentPlayerStats.winsDungeon || 0
  let tournamentPlayerLossesDungeon: number =
    tournamentPlayerStats.lossesDungeon || 0
  let tournamentPlayerTiesDungeon: number =
    tournamentPlayerStats.tiesDungeon || 0
  await updateDungeonTournamentFourPlayerDatabase(
    player.address,
    player.name,
    tournamentPlayerRenown + tournamentRenown,
    tournamentPlayerWinsDungeon + tournamentWins,
    tournamentPlayerLossesDungeon + tournamentLosses,
    tournamentPlayerTiesDungeon + tournamentTies
  )
  await updateDungeonPlayerDatabase(
    player.address,
    player.name,
    (playerRenown += renownRewards),
    playerLostRenown,
    playerWinsDungeon,
    playerLossesDungeon,
    playerTiesDungeon,
    playerHighestDungeonLevel,
    playerHighestDarkDungeonLevel
  )
  /*
  } else {
    await updateDungeonPlayerDatabase(
      player.address,
      player.name,
      playerRenown,
      (playerLostRenown += renownRewards),
      playerWinsDungeon,
      playerLossesDungeon,
      playerTiesDungeon,
      playerHighestDungeonLevel,
      playerHighestDarkDungeonLevel
    )
  }
  */
  return renownRewards
}
