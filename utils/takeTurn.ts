import { Server, Socket } from "socket.io"
import {
  addTurnsBuffedToCardsOfSameElement,
  compareAttackValuesAndDetermineWinner,
} from ".."
import { BoardCard, Match, MatchBoard, MatchPlayer } from "../utils/types"
import { Card } from "./types"

export async function takeTurn(
  player: MatchPlayer,
  opponent: MatchPlayer,
  match: Match,
  board: MatchBoard,
  x: number,
  y: number,
  isMagicAttackRanged: boolean = false,
  from: string,
  socket: Socket,
  flippedCardSlots: string[],
  io: Server
) {
  if (board[x][y] === null) {
    // Look for the card on the initial deck
    const cardExists = player?.deckInitialCards.find((card) => card.id === from)

    // Look for the card on the current deck
    const isCardAvailable = player?.deck.find((id) => id === from)

    if (!cardExists || !isCardAvailable) {
      throw new Error(
        "The player is trying to move a card that doesn't exist in the starting deck"
      )
    }

    const cardProps: BoardCard = {
      id: from,
      color: player.color,
      turnsBuffed: [],
      turnsOnBoard: 0,
    }

    // Place the card on the board
    match.board[x][y] = cardProps

    const oldDeck = player.deck

    // Remove the card from the player's current deck
    player.deck = oldDeck.filter((cardId) => cardId !== from)

    // Make sure the player's current deck got updated
    const newDeck = player.deck

    if (oldDeck.length === newDeck.length)
      throw new Error(
        "The board changed but the player's deck didn't get updated"
      )

    // Increment the player's score to account for the initial card placement
    player.score++

    // Compare attack values from adjacent cards
    await compareAttackValuesAndDetermineWinner(
      player,
      opponent,
      match.board,
      x,
      y,
      match.allPlayerCards,
      isMagicAttackRanged,
      flippedCardSlots,
      socket
    )

    if (cardExists) {
    }
    const attackSoundToSend =
      cardExists.class === "archangel"
        ? "archangel"
        : cardExists.class === "assassin"
        ? "assassin"
        : cardExists.class === "bard"
        ? "bard"
        : cardExists.class === "demonHunter"
        ? "demonHunter"
        : cardExists.class === "necromancer"
        ? "necromancer"
        : cardExists.class === "pirate"
        ? "pirate"
        : cardExists.class === "justicar"
        ? "justicar"
        : cardExists.type === "magic"
        ? "magic"
        : cardExists.class === "ranged"
        ? "ranged"
        : "melee"
    io.to(match.matchId).emit("playSound", attackSoundToSend)

    // Check for AoE ability and apply it
    if (cardExists.specialAbility2 && cardExists.specialAbility2 !== "none") {
      await addTurnsBuffedToCardsOfSameElement(
        player,
        match.board,
        x,
        y,
        match.allPlayerCards
      )
    }
  }

  // Calculate the turn time and add it to the player's turnTimes array

  const turnTime = Math.floor((Date.now() - match.lastTurnTimestamp) / 1000)
  match.lastTurnTimestamp = Date.now()
  player.turnTimes.push(turnTime)

  // Decrement turnsBuffed for all cards on the board
  board.forEach((nestedArray) => {
    nestedArray = nestedArray.filter((card) => card !== null)
    nestedArray.forEach((card) => {
      if (card !== null) {
        card.turnsOnBoard++
      }
      if (card !== null && card.turnsBuffed.length > 0) {
        for (let i = 0; i < card.turnsBuffed.length; i++) {
          card.turnsBuffed[i]--
          if (card.turnsBuffed[i] < 1) {
            card.turnsBuffed.splice(i, 1)
          }
        }
      }
    })
  })
  console.log(
    `Turn number: ${match.turnNumber} ${player.color}: ${player.score} ${opponent.color}: ${opponent.score}`
  )
}
