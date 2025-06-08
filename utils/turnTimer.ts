import { Socket } from "socket.io"
import { Match, MatchPlayer, MatchBoard } from "../utils/types"
import { pvpMatchOver } from "./matchOverFunctions"
import { takeTurn } from "./takeTurn"

export async function startTimer(
  player: MatchPlayer,
  opponent: MatchPlayer,
  board: MatchBoard,
  socketId: string,
  match: Match,
  flippedCardSlots: string[],
  io: any,
  socket: Socket
) {
  // Variables for turn type and timeout max
  let turnType: string = "worst"
  let timeoutMax: number = 3
  let timerMax: number = 60000 // milliseconds

  // Clear the timer if it exists
  if (match.timer) {
    clearTimeout(match.timer)
    match.timer = null
  }

  // Start the timer for the current player
  match.timer = setTimeout(async () => {
    opponent.timeouts++
    if (player.score + opponent.score < 14) {
      // If the player has not timed out the maximum number of times, take the turn for them
      if (opponent.timeouts < timeoutMax) {
        const allMoves = match.aiOpponent.getAllMoves(
          opponent,
          board,
          match.allPlayerCards,
          opponent.deckInitialCards
        )
        // Depending on the turn type, get the best, worst, or random move
        const aiMove =
          turnType === "best"
            ? match.aiOpponent.getBestMove(allMoves)
            : turnType === "random"
            ? match.aiOpponent.getRandomMove(allMoves)
            : match.aiOpponent.getWorstMove(allMoves)

        if (aiMove) {
          match.turnNumber++
          await takeTurn(
            opponent,
            player,
            match,
            board,
            aiMove.x,
            aiMove.y,
            aiMove.isMagicAttackRanged,
            aiMove.cardId,
            socket,
            flippedCardSlots,
            io
          )
          // Check scores to see if the match is over and determine the winner
          if (
            player.score + opponent.score === 14 &&
            match.matchType !== "dungeon"
          ) {
            pvpMatchOver(player, opponent, match, socketId)
            const winnerName =
              player.score > opponent.score
                ? player.name
                : player.score === opponent.score
                ? player.name
                : opponent.name
            const winnerPfp =
              player.score > opponent.score
                ? player.pfp
                : player.score === opponent.score
                ? player.pfp
                : opponent.pfp
            const loserName =
              player.score < opponent.score
                ? player.name
                : player.score === opponent.score
                ? opponent.name
                : opponent.name
            const loserPfp =
              player.score < opponent.score
                ? player.pfp
                : player.score === opponent.score
                ? opponent.pfp
                : opponent.pfp
            const matchDraw = player.score === opponent.score ? true : false

            // Emit the match object to the socket match room
            io.to(match.matchId).emit("match", match)
            io.to(match.matchId).emit(
              "matchOver",
              winnerName,
              winnerPfp,
              loserName,
              loserPfp,
              matchDraw
            )
          }
        }
      } else {
        const remainingScore = 14 - (player.score + opponent.score)
        player.score += remainingScore

        // Emit the match object to the socket match room
        io.to(match.matchId).emit("match", match)
        io.to(match.matchId).emit(
          "matchOver",
          player.name,
          player.pfp,
          opponent.name,
          opponent.pfp,
          false
        )
      }

      // Emit the match object to the socket match room
      io.to(match.matchId).emit("match", match)

      // Switch to the next player and start the timer again
      startTimer(
        opponent,
        player,
        board,
        socketId,
        match,
        flippedCardSlots,
        io,
        socket
      )
    }
  }, timerMax)
}
