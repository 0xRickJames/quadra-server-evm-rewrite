import {
  Match,
  MatchBoard,
  MatchPlayer,
  AiPlayer,
  CardPlacementOutcome,
  Card,
  BoardCard,
} from "../utils/types"
import { isElementStronger, checkDamageResistance } from "../index"
import { defaultDeck } from "../decks/defaultDeck"

function simulateCardPlacementAndCountFlipped(
  player: MatchPlayer | AiPlayer,
  cardToPlace: Card,
  x: number,
  y: number,
  board: MatchBoard,
  deck: Card[],
  isMagicAttackRanged: boolean
): number {
  let flippedCardSlots: string[] = []

  // Function to compare card values and determine the winner without altering scores
  function compareAttackValuesWithoutScoring() {
    let cardLeft: Card | null
    let cardBottom: Card | null
    let cardRight: Card | null
    let cardTop: Card | null
    let cardLeftProps: BoardCard | null
    let cardBottomProps: BoardCard | null
    let cardRightProps: BoardCard | null
    let cardTopProps: BoardCard | null
    let cardLeftSlot: string
    let cardBottomSlot: string
    let cardRightSlot: string
    let cardTopSlot: string

    const deckCard = deck.find((card) => card.id === board[x][y]?.id)
    const boardCard = board[x][y]

    if (!deckCard || !boardCard)
      throw new Error("Card not found from the board position")

    if (
      (deckCard.type === "magic" && isMagicAttackRanged) ||
      deckCard.type === "ranged"
    ) {
      cardLeftProps = board[x]?.[y - 2]
      cardLeftSlot = `cardslot-${x}-${y - 2}`
      cardLeft = cardLeftProps
        ? deck.find((card) => card.id === cardLeftProps!.id) || null
        : null

      cardBottomProps = board[x + 2]?.[y]
      cardBottomSlot = `cardslot-${x + 2}-${y}`
      cardBottom = cardBottomProps
        ? deck.find((card) => card.id === cardBottomProps!.id) || null
        : null

      cardRightProps = board[x]?.[y + 2]
      cardRightSlot = `cardslot-${x}-${y + 2}`
      cardRight = cardRightProps
        ? deck.find((card) => card.id === cardRightProps!.id) || null
        : null

      cardTopProps = board[x - 2]?.[y]
      cardTopSlot = `cardslot-${x - 2}-${y}`
      cardTop = cardTopProps
        ? deck.find((card) => card.id === cardTopProps!.id) || null
        : null
    } else {
      cardLeftProps = board[x]?.[y - 1]
      cardLeftSlot = `cardslot-${x}-${y - 1}`
      cardLeft = cardLeftProps
        ? deck.find((card) => card.id === cardLeftProps!.id) || null
        : null

      cardBottomProps = board[x + 1]?.[y]
      cardBottomSlot = `cardslot-${x + 1}-${y}`
      cardBottom = cardBottomProps
        ? deck.find((card) => card.id === cardBottomProps!.id) || null
        : null

      cardRightProps = board[x]?.[y + 1]
      cardRightSlot = `cardslot-${x}-${y + 1}`
      cardRight = cardRightProps
        ? deck.find((card) => card.id === cardRightProps!.id) || null
        : null

      cardTopProps = board[x - 1]?.[y]
      cardTopSlot = `cardslot-${x - 1}-${y}`
      cardTop = cardTopProps
        ? deck.find((card) => card.id === cardTopProps!.id) || null
        : null
    }

    if (cardTop && cardTopProps && cardTopProps.color != player.color) {
      let opponentAttackValue = cardTop.bottomAttack
      let playerAttackValue = deckCard.topAttack
      if (isElementStronger(deckCard.element!, cardTop.element!)) {
        opponentAttackValue = opponentAttackValue - 1
      } else if (
        isElementStronger(cardTop.element!, deckCard.element!) &&
        cardTop.element !== "dark" &&
        deckCard.element !== "light"
      ) {
        opponentAttackValue = opponentAttackValue + 1
      }
      const playerResistModifier: number = deckCard.specialAbility1
        ? checkDamageResistance(cardTop.type, deckCard.specialAbility1)
        : 0
      const opponentResistModifier: number = cardTop.specialAbility1
        ? checkDamageResistance(deckCard.type, cardTop.specialAbility1)
        : 0
      playerAttackValue = playerAttackValue + playerResistModifier
      opponentAttackValue = opponentAttackValue + opponentResistModifier
      const winOrLose =
        playerAttackValue > opponentAttackValue
          ? "won"
          : playerAttackValue === opponentAttackValue
          ? "tied"
          : "lost"
      if (winOrLose === "won") {
        flippedCardSlots.push(cardTopSlot)
      }
    }

    if (
      cardRight &&
      cardRightProps &&
      cardRightProps.color != boardCard.color
    ) {
      let playerAttackValue = deckCard.rightAttack
      let opponentAttackValue = cardRight.leftAttack
      if (isElementStronger(deckCard.element!, cardRight.element!)) {
        opponentAttackValue = opponentAttackValue - 1
      } else if (
        isElementStronger(cardRight.element!, deckCard.element!) &&
        cardRight.element !== "dark" &&
        cardRight.element !== "light"
      ) {
        opponentAttackValue = opponentAttackValue + 1
      }
      const playerResistModifier: number = deckCard.specialAbility1
        ? checkDamageResistance(cardRight.type, deckCard.specialAbility1)
        : 0
      const opponentResistModifier: number = cardRight.specialAbility1
        ? checkDamageResistance(deckCard.type, cardRight.specialAbility1)
        : 0
      playerAttackValue = playerAttackValue + playerResistModifier
      opponentAttackValue = opponentAttackValue + opponentResistModifier
      const winOrLose =
        playerAttackValue > opponentAttackValue
          ? "won"
          : playerAttackValue === opponentAttackValue
          ? "tied"
          : "lost"
      if (winOrLose === "won") {
        flippedCardSlots.push(cardRightSlot)
      }
    }

    if (
      cardBottom &&
      cardBottomProps &&
      cardBottomProps.color != boardCard.color
    ) {
      let opponentAttackValue = cardBottom.topAttack
      let playerAttackValue = deckCard.bottomAttack
      if (isElementStronger(deckCard.element!, cardBottom.element!)) {
        opponentAttackValue = opponentAttackValue - 1
      } else if (
        isElementStronger(cardBottom.element!, deckCard.element!) &&
        cardBottom.element !== "dark" &&
        cardBottom.element !== "light"
      ) {
        opponentAttackValue = opponentAttackValue + 1
      }
      const playerResistModifier: number = deckCard.specialAbility1
        ? checkDamageResistance(cardBottom.type, deckCard.specialAbility1)
        : 0
      const opponentResistModifier: number = cardBottom.specialAbility1
        ? checkDamageResistance(deckCard.type, cardBottom.specialAbility1)
        : 0
      playerAttackValue = playerAttackValue + playerResistModifier
      opponentAttackValue = opponentAttackValue + opponentResistModifier
      const winOrLose =
        playerAttackValue > opponentAttackValue
          ? "won"
          : playerAttackValue === opponentAttackValue
          ? "tied"
          : "lost"
      if (winOrLose === "won") {
        flippedCardSlots.push(cardBottomSlot)
      }
    }

    if (cardLeft && cardLeftProps && cardLeftProps.color != boardCard.color) {
      let playerAttackValue = deckCard.leftAttack
      let opponentAttackValue = cardLeft.rightAttack
      if (isElementStronger(deckCard.element!, cardLeft.element!)) {
        opponentAttackValue = opponentAttackValue - 1
      } else if (
        isElementStronger(cardLeft.element!, deckCard.element!) &&
        cardLeft.element !== "dark" &&
        cardLeft.element !== "light"
      ) {
        opponentAttackValue = opponentAttackValue + 1
      }
      const playerResistModifier: number = deckCard.specialAbility1
        ? checkDamageResistance(cardLeft.type, deckCard.specialAbility1)
        : 0
      const opponentResistModifier: number = cardLeft.specialAbility1
        ? checkDamageResistance(deckCard.type, cardLeft.specialAbility1)
        : 0
      playerAttackValue = playerAttackValue + playerResistModifier
      opponentAttackValue = opponentAttackValue + opponentResistModifier
      const winOrLose =
        playerAttackValue > opponentAttackValue
          ? "won"
          : playerAttackValue === opponentAttackValue
          ? "tied"
          : "lost"
      if (winOrLose === "won") {
        flippedCardSlots.push(cardLeftSlot)
      }
    }
  }

  // Create a copy of the board to simulate the card placement
  const simulatedBoard = [...board]

  const cardProps: BoardCard = {
    id: cardToPlace.id,
    color: player.color,
    turnsBuffed: [],
    turnsOnBoard: 0,
  }

  // Place the card on the board
  simulatedBoard[x][y] = cardProps

  // Call the modified comparison function with the simulated board
  compareAttackValuesWithoutScoring()

  // Return the number of flipped cards
  return flippedCardSlots.length
}

class AiOpponent {
  id: string
  address: string
  aiDeck: Card[]

  constructor(id: string, deck: Card[]) {
    this.id = id
    this.address = "000000000"
    this.aiDeck = deck
  }

  getAllMoves(
    player: AiPlayer,
    board: MatchBoard,
    deck: Card[],
    aiDeck: Card[]
  ): CardPlacementOutcome[] {
    const allOutcomes: CardPlacementOutcome[] = []
    // filter out cards that are not in the player.deck string array
    aiDeck = aiDeck.filter((card) => player.deck.includes(card.id))
    // for each spot on the board, try to place each card and see how many cards are flipped
    // Iterate through each card in the deck

    for (const card of aiDeck) {
      // Iterate through each position on the board
      for (let x = 0; x < board.length; x++) {
        for (let y = 0; y < board[x].length; y++) {
          // Make sure the board position is empty
          if (board[x][y] !== null) {
            continue
          }
          // Check if the card's type is "magic"
          if (card.type === "magic") {
            // Iterate through both isMagicAttackRanged values (true and false)
            for (const isMagicAttackRanged of [true, false]) {
              // Clone the board to simulate the placement
              const clonedBoard = JSON.parse(JSON.stringify(board))

              // Simulate the placement of the current card
              const numFlippedCards = simulateCardPlacementAndCountFlipped(
                player,
                card,
                x,
                y,
                clonedBoard,
                deck,
                isMagicAttackRanged
              )

              // Create the outcome object
              const outcome: CardPlacementOutcome = {
                x,
                y,
                cardId: card.id,
                isMagicAttackRanged,
                flippedCards: numFlippedCards,
              }

              allOutcomes.push(outcome)
            }
          } else {
            // If the card is not "magic," simulate with isMagicAttackRanged as false
            const clonedBoard = JSON.parse(JSON.stringify(board))
            const numFlippedCards = simulateCardPlacementAndCountFlipped(
              player,
              card,
              x,
              y,
              clonedBoard,
              deck,
              false
            )

            const outcome: CardPlacementOutcome = {
              x,
              y,
              cardId: card.id,
              isMagicAttackRanged: false,
              flippedCards: numFlippedCards,
            }

            allOutcomes.push(outcome)
          }
        }
      }
    }
    return allOutcomes
  }

  // Find best move based on highest numebr of flipped cards

  getBestMove(outcomes: CardPlacementOutcome[]): CardPlacementOutcome | null {
    if (outcomes.length === 0) {
      return null
    }

    let maxOutcome: CardPlacementOutcome | null = outcomes[0]
    let maxFlippedCards = outcomes[0].flippedCards

    for (const outcome of outcomes) {
      if (outcome.flippedCards > maxFlippedCards) {
        maxFlippedCards = outcome.flippedCards
        maxOutcome = outcome
      }
    }

    return maxOutcome
  }

  // Find worst move based on lowest number of flipped cards

  getWorstMove(outcomes: CardPlacementOutcome[]): CardPlacementOutcome | null {
    if (outcomes.length === 0) {
      return null
    }

    let minOutcome: CardPlacementOutcome | null = outcomes[0]
    let minFlippedCards = outcomes[0].flippedCards

    for (const outcome of outcomes) {
      if (outcome.flippedCards < minFlippedCards) {
        minFlippedCards = outcome.flippedCards
        minOutcome = outcome
      }
    }

    return minOutcome
  }

  // return a random move from the list of outcomes

  getRandomMove(outcomes: CardPlacementOutcome[]): CardPlacementOutcome {
    const randomIndex = Math.floor(Math.random() * outcomes.length)
    return outcomes[randomIndex]
  }
}

export default AiOpponent
