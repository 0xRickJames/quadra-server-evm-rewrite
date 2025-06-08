import { Match, MatchPlayer } from "../../utils/types"

import {
  fetchTournamentFourPlayerAverageTurnTime,
  fetchTournamentFourPlayerStats,
  updateTournamentFourGameDatabase,
  updateTournamentFourPlayerDatabase,
} from "./tournamentDatabaseFunctions"

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

export async function tournamentFourMatchOver(
  player: MatchPlayer,
  opponent: MatchPlayer,
  match: Match,
  socketId: string
) {
  const timestamp = Date.now()
  const playerOneStats = await fetchTournamentFourPlayerStats(
    match.players[socketId].address
  )
  const playerTwoStats = await fetchTournamentFourPlayerStats(
    match.players[opponent.socketId].address
  )
  let playerOneName: string = playerOneStats!.playerName
  let playerTwoName: string = playerTwoStats!.playerName
  let playerOneElo: number = playerOneStats!.elo
  let playerTwoElo: number = playerTwoStats!.elo
  let playerOneWins: number = playerOneStats!.wins
  let playerTwoWins: number = playerTwoStats!.wins
  let playerOneLosses: number = playerOneStats!.losses
  let playerTwoLosses: number = playerTwoStats!.losses
  let playerOneTies: number = playerOneStats!.ties
  let playerTwoTies: number = playerTwoStats!.ties

  console.log(
    player.score > opponent.score
      ? `Player ${player.color} won`
      : player.score < opponent.score
      ? `Player ${opponent.color} won`
      : `It's a draw!`
  )
  if (player.score > opponent.score) {
    playerOneWins++
    playerTwoLosses++
    playerOneElo = calculateElo(playerOneElo, playerTwoElo, 1)
    playerTwoElo = calculateElo(playerTwoElo, playerOneElo, 0)
  } else if (player.score < opponent.score) {
    playerOneLosses++
    playerTwoWins++
    playerOneElo = calculateElo(playerOneElo, playerTwoElo, 0)
    playerTwoElo = calculateElo(playerTwoElo, playerOneElo, 1)
  } else if (player.score === opponent.score) {
    playerOneTies++
    playerTwoTies++
    playerOneElo = calculateElo(playerOneElo, playerTwoElo, 0.5)
    playerTwoElo = calculateElo(playerTwoElo, playerOneElo, 0.5)
  }

  const playerAverageTurnTime =
    player.turnTimes.reduce((a, b) => a + b, 0) / player.turnTimes.length

  const opponentAverageTurnTime =
    opponent.turnTimes.reduce((a, b) => a + b, 0) / opponent.turnTimes.length

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

  let playerOverallAverageTurnTime =
    await fetchTournamentFourPlayerAverageTurnTime(player.address)
  let opponentOverallAverageTurnTime =
    await fetchTournamentFourPlayerAverageTurnTime(opponent.address)

  // Update player stats in the Player database

  updateTournamentFourPlayerDatabase(
    player.address,
    playerOneName,
    Math.round(playerOneElo),
    playerOverallAverageTurnTime,
    playerOneWins,
    playerOneLosses,
    playerOneTies,
    opponent.address,
    playerTwoName,
    opponentOverallAverageTurnTime,
    Math.round(playerTwoElo),
    playerTwoWins,
    playerTwoLosses,
    playerTwoTies
  )
}
