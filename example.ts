import * as http from "http"
import { Server } from "socket.io"

// Create a HTTP server
const server = http.createServer()
const port = 3000 // Change this to the desired port number

// Initialize Socket.io
const socketServer = new Server(server)

// Define the game state
interface Player {
  id: string
  name: string
  color: CardColor
  hand: Card[]
}

interface Card {
  rank: number
  element: string
}

enum CardColor {
  None,
  Red,
  Blue,
}

enum CardRank {
  One = 1,
  Two = 2,
  Three = 3,
  Four = 4,
  Five = 5,
  Six = 6,
  Seven = 7,
  Eight = 8,
  Nine = 9,
  Ten = 10,
}

enum CardElement {
  Fire = "fire",
  Water = "water",
  Earth = "earth",
  Wind = "wind",
}

enum RuleVariation {
  Open = "open",
  Random = "random",
  Same = "same",
  Plus = "plus",
}

enum TradeRules {
  None,
  One = "one",
  Multiple = "multiple",
}

interface GameState {
  players: {
    [id: string]: Player
  }
  board: CardColor[][]
  currentPlayerId: string | null
  coinTossWinnerId: string | null
  ruleVariation: RuleVariation
  tradeRules: TradeRules
}

interface GameRoom {
  gameState: GameState
  playerIds: string[]
}

const gameRooms: { [roomId: string]: GameRoom } = {}

// Utility function to generate random cards for a player's hand
function generateRandomCards(numCards: number): Card[] {
  const cards: Card[] = []
  for (let i = 0; i < numCards; i++) {
    const rank =
      Math.floor(Math.random() * (CardRank.Ten - CardRank.One + 1)) +
      CardRank.One
    const element = getRandomElement()
    cards.push({ rank, element })
  }
  return cards
}

// Utility function to get a random element
function getRandomElement(): CardElement {
  const elements = Object.values(CardElement)
  const randomIndex = Math.floor(Math.random() * elements.length)
  return elements[randomIndex]
}

// Utility function to get the adjacent cards for a given position
function getAdjacentCards(
  row: number,
  col: number,
  boardSize: number
): [number, number][] {
  const adjacentCards: [number, number][] = []
  if (row > 0) adjacentCards.push([row - 1, col])
  if (row < boardSize - 1) adjacentCards.push([row + 1, col])
  if (col > 0) adjacentCards.push([row, col - 1])
  if (col < boardSize - 1) adjacentCards.push([row, col + 1])
  return adjacentCards
}

// Utility function to get the rank of a card at the specified position
function getCardRank(row: number, col: number, player: Player): number {
  const card = player.hand[row]
  return card ? card.rank : 0
}

// Utility function to check for a winner
function getWinnerColor(board: CardColor[][]): CardColor {
  let redCount = 0
  let blueCount = 0

  for (const row of board) {
    for (const cardColor of row) {
      if (cardColor === CardColor.Red) {
        redCount++
      } else if (cardColor === CardColor.Blue) {
        blueCount++
      }
    }
  }

  if (redCount > blueCount) {
    return CardColor.Red
  } else if (blueCount > redCount) {
    return CardColor.Blue
  } else {
    return CardColor.None
  }
}

// Handle new connections
socketServer.on("connection", (socket) => {
  console.log("New player connected: ", socket.id)

  // Create a new game room for the player
  const gameId = socket.id
  gameRooms[gameId] = {
    gameState: createInitialGameState(),
    playerIds: [socket.id],
  }

  // Emit the game room ID to the player
  socket.emit("gameRoomId", gameId)

  // Handle joining a game room
  socket.on("joinGameRoom", (roomId: string, playerName: string) => {
    if (!gameRooms[roomId]) {
      socket.emit("gameError", "Invalid game room ID.")
      return
    }

    // Check if the game room already has two players
    if (gameRooms[roomId].playerIds.length >= 2) {
      socket.emit("gameError", "Game room is already full.")
      return
    }

    // Update the game room with the new player
    gameRooms[roomId].playerIds.push(socket.id)
    const playerColor =
      gameRooms[roomId].playerIds.length === 2 ? CardColor.Blue : CardColor.Red
    gameRooms[roomId].gameState.players[socket.id] = {
      id: socket.id,
      name: playerName,
      color: playerColor,
      hand: generateRandomCards(5),
    }

    // Emit the game start event to all players in the game room
    for (const playerId of gameRooms[roomId].playerIds) {
      socketServer.to(playerId).emit("gameStart", gameRooms[roomId].gameState)
    }

    const currentPlayerId = gameRooms[roomId].gameState.currentPlayerId

    if (!currentPlayerId) throw new Error("No current player ID")
    // Emit the first player's turn event
    socketServer.to(currentPlayerId).emit("playerTurn")
    socket.emit("playerTurn")
  })

  // Handle playing a card
  socket.on(
    "playCard",
    (roomId: string, cardIndex: number, row: number, col: number) => {
      const gameRoom = gameRooms[roomId]
      if (!gameRoom) {
        socket.emit("gameError", "Invalid game room ID.")
        return
      }

      const player = gameRoom.gameState.players[socket.id]

      // Check if it's the player's turn
      if (socket.id !== gameRoom.gameState.currentPlayerId) {
        socket.emit("gameError", "It's not your turn.")
        return
      }

      // Check if the card index is valid
      if (cardIndex < 0 || cardIndex >= player.hand.length) {
        socket.emit("gameError", "Invalid card index.")
        return
      }

      // Check if the target position is valid
      const boardSize = gameRoom.gameState.board.length
      if (row < 0 || row >= boardSize || col < 0 || col >= boardSize) {
        socket.emit("gameError", "Invalid target position.")
        return
      }

      // Check if the target position is already occupied
      if (gameRoom.gameState.board[row][col] !== CardColor.None) {
        socket.emit("gameError", "Target position is already occupied.")
        return
      }

      // Place the card on the board
      gameRoom.gameState.board[row][col] = player.color

      // Remove the played card from the player's hand
      const playedCard = player.hand.splice(cardIndex, 1)[0]

      // Update the adjacent cards if applicable
      const adjacentCards = getAdjacentCards(row, col, boardSize)
      const opponent = Object.values(gameRoom.gameState.players).find(
        (p) => p.id !== socket.id
      )!
      for (const [adjRow, adjCol] of adjacentCards) {
        const adjCardRank = getCardRank(adjRow, adjCol, opponent)
        const playedCardRank = playedCard.rank
        if (adjCardRank && playedCardRank) {
          if (adjCardRank > playedCardRank) {
            gameRoom.gameState.board[adjRow][adjCol] = opponent.color
          } else if (adjCardRank < playedCardRank) {
            gameRoom.gameState.board[adjRow][adjCol] = player.color
          }
        }
      }

      // Check if there is a winner
      const winnerColor = getWinnerColor(gameRoom.gameState.board)
      if (winnerColor !== CardColor.None) {
        // Emit the game over event to all players in the game room
        for (const playerId of gameRoom.playerIds) {
          socketServer.to(playerId).emit("gameOver", winnerColor)
        }
      } else {
        // Update the current player and emit the updated game state to all players
        const currentPlayerIndex = gameRoom.playerIds.indexOf(socket.id)
        const nextPlayerIndex =
          (currentPlayerIndex + 1) % gameRoom.playerIds.length
        gameRoom.gameState.currentPlayerId = gameRoom.playerIds[nextPlayerIndex]
        for (const playerId of gameRoom.playerIds) {
          socketServer.to(playerId).emit("gameState", gameRoom.gameState)
        }

        // Emit the next player's turn event
        socketServer.to(gameRoom.gameState.currentPlayerId).emit("playerTurn")
        socket.emit("playerTurn")
      }
    }
  )

  // Handle disconnecting
  socket.on("disconnect", () => {
    console.log("Player disconnected: ", socket.id)

    // Find the game room that the player belongs to
    const gameRoomId = Object.keys(gameRooms).find((roomId) =>
      gameRooms[roomId].playerIds.includes(socket.id)
    )

    if (gameRoomId) {
      const gameRoom = gameRooms[gameRoomId]

      // Remove the player from the game room
      const playerIndex = gameRoom.playerIds.indexOf(socket.id)
      gameRoom.playerIds.splice(playerIndex, 1)
      delete gameRoom.gameState.players[socket.id]

      // Check if the game room needs to be reset
      if (socket.id === gameRoom.gameState.coinTossWinnerId) {
        gameRoom.gameState = createInitialGameState()
      }

      // Emit the updated game state to all players in the game room
      for (const playerId of gameRoom.playerIds) {
        socketServer.to(playerId).emit("gameState", gameRoom.gameState)
      }
    }

    // Clean up the game room if there are no players left
    if (gameRoomId && gameRooms[gameRoomId].playerIds.length === 0) {
      delete gameRooms[gameRoomId]
    }
  })
})

// Utility function to create the initial game state
function createInitialGameState(): GameState {
  return {
    players: {},
    board: Array.from({ length: 4 }, () => Array(4).fill(CardColor.None)),
    currentPlayerId: null,
    coinTossWinnerId: null,
    ruleVariation: RuleVariation.Open,
    tradeRules: TradeRules.None,
  }
}

// Start the server
server.listen(port, () => {
  console.log(`Server listening on port ${port}`)
})
