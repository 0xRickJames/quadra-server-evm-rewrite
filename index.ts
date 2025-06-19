import { createServer } from "http"
import { Server, Socket } from "socket.io"
import customParser from "socket.io-msgpack-parser"
import https from "https"
import fs from "fs"
import { defaultDeck } from "./decks/defaultDeck"
import {
  addDefaultDeckValue,
  decrementEnergy,
  fetchDeck,
  fetchEnergy,
  fetchHighestLevelAndEnergy,
  fetchPlayerStats,
  replenishHourlyEnergy,
  replenishDailyEnergy,
  resetDungeonLevels,
  resetLostRenown,
  updateGwenRewards,
} from "./utils/databaseFunctions"
import createCardFromMetadata from "./utils/createCardFromMetadata"
import AiOpponent from "./classes/aiOpponent"
import { createDungeonDeck } from "./utils/createDungeonDeck"
import {
  dungeonMatchOver,
  pvpMatchOver,
  rewardWinnerWithRetry,
} from "./utils/matchOverFunctions"
import { takeTurn } from "./utils/takeTurn"
import { startTimer } from "./utils/turnTimer"
import {
  Match,
  MatchPlayer,
  MatchBoard,
  Card,
  BoardCard,
  AiPlayer,
  DungeonDeck,
} from "./utils/types"
import cron from "node-cron"
import dayjs from "dayjs"
import utc from "dayjs/plugin/utc"
import { appendFileSync } from "fs"
import { promises as fsPromises } from "fs"
import { join } from "path"
import sendRewards from "./utils/sendRewards"

//resetLostRenown()

//addDefaultDeckValue()

// SSL Certificates

const options = {
  key: fs.readFileSync("/home/rick/ssl/privkey.pem"),
  cert: fs.readFileSync("/home/rick/ssl/fullchain.pem"),
}

const httpServer = https.createServer(options)

//const httpServer = createServer()

function calculateRewardMultiplier(ranks: string[]): number {
  let rewardMultiplier = 1
  // Increment rewardMultiplier based on rank occurrences
  const rankCounts = ranks.reduce((counts, rank) => {
    counts[rank] = (counts[rank] || 0) + 1
    switch (rank) {
      case "Soldier":
        rewardMultiplier += 0.1
        break
      case "Knight":
        rewardMultiplier += 0.25
        break
      case "Lord":
        rewardMultiplier += 0.5
        break
    }
    return counts
  }, {} as Record<string, number>)

  // Determine the maximum allowed value for rewardMultiplier
  if (rankCounts["Lord"] >= 1) {
    rewardMultiplier = Math.min(rewardMultiplier, 3)
  } else if (rankCounts["Knight"] >= 1) {
    rewardMultiplier = Math.min(rewardMultiplier, 2)
  } else if (rankCounts["Soldier"] >= 1) {
    rewardMultiplier = Math.min(rewardMultiplier, 1.6)
  }

  return rewardMultiplier
}

async function getDungeonDeck(name: string): Promise<DungeonDeck | undefined> {
  try {
    const data = await fsPromises.readFile(
      join(__dirname, "dungeonDecks.json"),
      "utf8"
    )
    const decks: DungeonDeck[] = JSON.parse(data)
    return decks.find((deck) => deck.name === name)
  } catch (err) {
    console.log(err)
    return undefined
  }
}

dayjs.extend(utc)

let openDungeon: string

function setOpenDungeon() {
  const day = dayjs.utc().day()
  switch (day) {
    case 1:
      openDungeon = "Wind"
      break
    case 2:
      openDungeon = "Fire"
      break
    case 3:
      openDungeon = "Ice"
      break
    case 4:
      openDungeon = "Water"
      break
    case 5:
      openDungeon = "Earth"
      break
    case 6:
      openDungeon = "Lightning"
      break
    case 0:
      openDungeon = "LightDark"
      break
  }
}

setOpenDungeon()

// Schedule task to run at 00:00 UTC every day
cron.schedule(
  "0 0 * * *",
  function () {
    const day = dayjs.utc().day()
    switch (day) {
      case 1:
        openDungeon = "Wind"
        break
      case 2:
        openDungeon = "Fire"
        break
      case 3:
        openDungeon = "Ice"
        break
      case 4:
        openDungeon = "Water"
        break
      case 5:
        openDungeon = "Earth"
        break
      case 6:
        openDungeon = "Lightning"
        break
      case 0:
        openDungeon = "LightDark"
        break
    }
    resetDungeonLevels()
    replenishDailyEnergy()
  },
  {
    scheduled: true,
    timezone: "UTC",
  }
)
// Schedule a task to refill energy every hour
cron.schedule(
  "0 * * * *",
  function () {
    replenishHourlyEnergy()
  },
  {
    scheduled: true,
    timezone: "UTC",
  }
)
const addresses = new Map<string, string>()
const deckNames = new Map()

//Create the socket.io server with binary data parser
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  parser: customParser,
})

const port = 3000

export async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function incrementString(str: string): string {
  const num = str.match(/\d+$/) // Find the number at the end of the string
  if (!num) {
    return str // If there's no number, return the original string
  }
  const numStr = num[0]
  const prefix = str.slice(0, -numStr.length) // The part of the string before the number
  const incrementedNum = parseInt(numStr, 10) + 1 // Increment the number
  return prefix + incrementedNum // Merge them back together
}

function getNumberFromString(str: string): number {
  const num = str.match(/\d+$/)
  if (!num) {
    return 1 // If there's no number, return the original string
  }
  const numStr = num[0]
  const realNum = parseInt(numStr, 10)
  return realNum
}

// Match data for ongoing matches
const matches: {
  [matchId: string]: Match
} = {}

const waitingTournamentPlayers: Socket[] = []
const waitingNormalPlayers: Socket[] = []

//   On Connection

io.on("connection", (socket: Socket) => {
  console.log("New player connected:", socket.id)
  console.log(`Waiting Normal Players: ${waitingNormalPlayers.length}`)
  console.log(`Waiting Tournament Players: ${waitingTournamentPlayers.length}`)
  socket.emit("matches", matches)
  io.emit("connectedPlayersLength", io.sockets.sockets.size)

  socket.emit("openDungeon", openDungeon)

  //  When a player makes a move

  socket.on(
    "move",
    async (data: {
      matchId: string
      from: string
      to: { x: number; y: number }
      isMagicAttackRanged: boolean
    }) => {
      // Create player and opponent variables an check whose turn it is
      // and send board data to the client
      const match = matches[data.matchId]
      const socketId = socket.id
      const player = matches[data.matchId].players[socket.id]
      if (match.timer) {
        clearTimeout(match.timer)
        match.timer = null
      }
      if (
        (matches[data.matchId].turnNumber % 2 === 0 &&
          match.isRedFirst &&
          player.color === "blue") ||
        (matches[data.matchId].turnNumber % 2 !== 0 &&
          !match.isRedFirst &&
          player.color === "blue") ||
        (matches[data.matchId].turnNumber % 2 === 0 &&
          !match.isRedFirst &&
          player.color === "red") ||
        (matches[data.matchId].turnNumber % 2 !== 0 &&
          match.isRedFirst &&
          player.color === "red")
      ) {
        return true
      }
      matches[data.matchId].turnNumber++
      const board = matches[data.matchId].board
      const opponent = Object.values(matches[data.matchId].players).find(
        (player) => player.socketId !== socket.id
      )

      const flippedCardSlots: string[] = []

      // Make sure there is a player and an opponent

      if (!player) {
        console.warn("A client tried to push a card to a match they are not in")
        return true
      }
      if (!opponent) {
        console.warn("There is no opponent in this match")
        return true
      }

      await takeTurn(
        player,
        opponent,
        match,
        board,
        data.to.x,
        data.to.y,
        data.isMagicAttackRanged,
        data.from,
        socket,
        flippedCardSlots,
        io
      )

      // Emit the match object to the socket match room
      io.to(data.matchId).emit("match", matches[data.matchId])

      // Check scores to see if the match is over and determine the winner
      if (
        player.score + opponent.score === 14 &&
        matches[data.matchId].matchType !== "dungeon"
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

        io.to(data.matchId).emit(
          "matchOver",
          winnerName,
          winnerPfp,
          loserName,
          loserPfp,
          matchDraw
        )
      } else if (
        player.score + opponent.score === 14 &&
        matches[data.matchId].matchType === "dungeon"
      ) {
        const renownRewards: number = await dungeonMatchOver(
          player,
          opponent.name,
          match,
          socketId,
          player.hasDungeonTicket || false
        )
        console.log(renownRewards)
        const winnerName =
          player.score > opponent.score
            ? player.name
            : player.score === opponent.score
            ? player.name
            : opponent.name
        const matchDraw = player.score === opponent.score ? true : false
        console.log("Dungeon match over")
        const dungeonLevel = getNumberFromString(opponent.name)
        let gwenRewards: number =
          dungeonLevel === 10
            ? 5 * player.rewardMultiplier
            : dungeonLevel > 3 && dungeonLevel < 7
            ? 2 * player.rewardMultiplier
            : dungeonLevel > 6 && dungeonLevel < 10
            ? 3 * player.rewardMultiplier
            : 1 * player.rewardMultiplier

        if (player.score > opponent.score) {
          console.log("Player won")
          console.log(`GWEN rewards: ${gwenRewards}`)
          //updateGwenRewards(player.address, gwenRewards)
          //sendRewards(gwenRewards, player.address)
          rewardWinnerWithRetry(player.address, gwenRewards.toString())
        } else if (player.score < opponent.score) {
          console.log("Player lost")
        } else if (player.score === opponent.score) {
          console.log("It's a draw")
        }
        await delay(5000)

        io.to(data.matchId).emit(
          "dungeonMatchOver",
          winnerName,
          player.name,
          player.pfp,
          matchDraw,
          opponent.name,
          incrementString(opponent.name),
          player.energy,
          gwenRewards,
          renownRewards,
          player.hasDungeonTicket
        )
      }

      // Set timer for the next turn
      if (matches[data.matchId].matchType !== "dungeon") {
        await startTimer(
          player,
          opponent,
          board,
          socketId,
          match,
          flippedCardSlots,
          io,
          socket
        )
      }
      // If it is a dungeon match, the ai opponent takes its turn
      if (
        matches[data.matchId].matchType === "dungeon" &&
        opponent.address === "000000000"
      ) {
        // AI opponents turn
        const aiOpponent = matches[data.matchId].aiOpponent
        const aiFlippedCardSlots: string[] = []
        if (!aiOpponent) throw new Error("AI opponent not found")
        matches[data.matchId].turnNumber++

        const allMoves = aiOpponent.getAllMoves(
          opponent,
          matches[data.matchId].board,
          matches[data.matchId].allPlayerCards,
          aiOpponent.aiDeck
        )
        const bestMove = aiOpponent.getBestMove(allMoves)
        const randomMove = aiOpponent.getRandomMove(allMoves)

        if (!bestMove) console.log("AI opponent didn't find a move")
        else {
          // Determine which move to use based on flipped cards
          const move = bestMove.flippedCards > 0 ? bestMove : randomMove

          // Find the card in the initial deck based on the selected move
          const aiCardExists = opponent.deckInitialCards.find(
            (card) => card.id === move.cardId
          )
          if (!aiCardExists) {
            throw new Error(
              "The ai opponent is trying to move a card that doesn't exist in the starting deck"
            )
          }
          if (aiCardExists) {
          }
          const attackSoundToSend =
            aiCardExists.class === "archangel"
              ? "archangel"
              : aiCardExists.class === "assassin"
              ? "assassin"
              : aiCardExists.class === "bard"
              ? "bard"
              : aiCardExists.class === "demonHunter"
              ? "demonHunter"
              : aiCardExists.class === "necromancer"
              ? "necromancer"
              : aiCardExists.class === "pirate"
              ? "pirate"
              : aiCardExists.class === "justicar"
              ? "justicar"
              : aiCardExists.type === "magic"
              ? "magic"
              : aiCardExists.class === "ranged"
              ? "ranged"
              : "melee"

          const aiCardProps: BoardCard = {
            id: move.cardId,
            color: opponent.color,
            turnsBuffed: [],
            turnsOnBoard: 0,
          }
          await delay(2000)

          io.to(data.matchId).emit("playSound", attackSoundToSend)
          console.log(aiCardExists.class)
          console.log("sound sent")
          // Place the card on the board
          matches[data.matchId].board[move.x][move.y] = aiCardProps

          const oldAiDeck =
            matches[data.matchId].players[opponent.socketId].deck
          // Remove the card from the ai opponent's current deck
          matches[data.matchId].players[opponent.socketId].deck =
            oldAiDeck.filter((cardId) => cardId !== aiCardExists?.id)

          aiOpponent.aiDeck = aiOpponent.aiDeck.filter(
            (card) => card.id !== aiCardExists?.id
          )

          // Make sure the opponent's current deck got updated
          const newAiDeck =
            matches[data.matchId].players[opponent.socketId].deck

          if (oldAiDeck.length === newAiDeck.length)
            throw new Error(
              "The board changed but the player's deck didn't get updated"
            )

          // Increment the ai opponent's score to account for the initial card placement
          opponent.score++
          // Compare attack values from adjacent cards
          compareAttackValuesAndDetermineWinner(
            opponent,
            player,
            matches[data.matchId].board,
            move.x,
            move.y,
            matches[data.matchId].allPlayerCards,
            move.isMagicAttackRanged ? move.isMagicAttackRanged : false,
            aiFlippedCardSlots,
            socket
          )

          // Check for AoE ability and apply it
          if (
            aiCardExists.specialAbility2 &&
            aiCardExists.specialAbility2 !== "none"
          ) {
            addTurnsBuffedToCardsOfSameElement(
              opponent,
              matches[data.matchId].board,
              move.x,
              move.y,
              matches[data.matchId].allPlayerCards
            )
          }

          // Decrement turnsBuffed for all cards on the board
          board.forEach((nestedArray) => {
            nestedArray = nestedArray.filter((card) => card !== null)
            nestedArray.forEach((card) => {
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
            `Turn number: ${matches[data.matchId].turnNumber} ${
              player.color
            }: ${player.score} ${opponent.color}: ${opponent.score}`
          )

          // Emit the match object to the socket match room
          io.to(data.matchId).emit("match", matches[data.matchId])
          if (
            player.score + opponent.score === 14 &&
            matches[data.matchId].matchType === "dungeon"
          ) {
            const renownRewards: number = await dungeonMatchOver(
              player,
              opponent.name,
              match,
              socketId,
              player.hasDungeonTicket || false
            )
            console.log(renownRewards)
            const winnerName =
              player.score > opponent.score
                ? player.name
                : player.score === opponent.score
                ? player.name
                : opponent.name
            const matchDraw = player.score === opponent.score ? true : false
            console.log("Dungeon match over")
            const dungeonLevel = getNumberFromString(opponent.name)
            let gwenRewards: number =
              dungeonLevel === 10
                ? 5 * player.rewardMultiplier
                : dungeonLevel > 3 && dungeonLevel < 7
                ? 2 * player.rewardMultiplier
                : dungeonLevel > 6 && dungeonLevel < 10
                ? 3 * player.rewardMultiplier
                : 1 * player.rewardMultiplier

            if (player.score > opponent.score) {
              console.log("Player won")
              //updateGwenRewards(player.address, gwenRewards)
              //sendRewards(gwenRewards, player.address)
              rewardWinnerWithRetry(player.address, gwenRewards.toString())
              console.log(`GWEN rewards: ${gwenRewards}`)
            } else if (player.score < opponent.score) {
              console.log("Player lost")
            } else if (player.score === opponent.score) {
              console.log("It's a draw")
            }

            await delay(5000)

            io.to(data.matchId).emit(
              "dungeonMatchOver",
              winnerName,
              player.name,
              player.pfp,
              matchDraw,
              opponent.name,
              incrementString(opponent.name),
              player.energy,
              gwenRewards,
              renownRewards,
              player.hasDungeonTicket
            )
          }
        }
      }
    }
  )

  // When a player clicks the find match button

  socket.on("findMatch", async (data) => {
    // Add normal players to the normal waiting list
    // and tournament players to the tournament waiting list
    if (data.matchType === "tournament") {
      waitingTournamentPlayers.push(socket)
    } else {
      waitingNormalPlayers.push(socket)
    }
    addresses.set(socket.id, data.address)
    deckNames.set(socket.id, data.deckName)
    console.log(
      `Player ${socket.id} is using wallet: ${data.address} and deck: ${data.deckName}`
    )

    socket.emit("findingMatch")

    console.log(
      `Waiting Players: Normal - ${waitingNormalPlayers.length}, Tournament - ${waitingTournamentPlayers.length}`
    )
    const player1 = socket

    // Check if there are enough waiting players to start a match
    const player2 =
      data.matchType === "tournament"
        ? waitingTournamentPlayers.find((player) => player.id !== socket.id)
        : waitingNormalPlayers.find((player) => player.id !== socket.id)

    // If there is an opponent, start a match
    if (player2) {
      // Remove the players from the waiting list first
      const prevWaiting =
        data.matchType === "tournament"
          ? waitingTournamentPlayers.length
          : waitingNormalPlayers.length
      if (data.matchType === "tournament") {
        waitingTournamentPlayers.splice(
          waitingTournamentPlayers.indexOf(player1),
          1
        )
        waitingTournamentPlayers.splice(
          waitingTournamentPlayers.indexOf(player2),
          1
        )
      } else {
        waitingNormalPlayers.splice(waitingNormalPlayers.indexOf(player1), 1)
        waitingNormalPlayers.splice(waitingNormalPlayers.indexOf(player2), 1)
      }

      if (
        data.matchType === "tournament" &&
        waitingTournamentPlayers.length === prevWaiting
      )
        throw new Error("Waiting players length didn't change")
      else if (
        data.matchType === "normal" &&
        waitingNormalPlayers.length === prevWaiting
      )
        throw new Error("Waiting players length didn't change")

      const matchId = player1.id + "-" + player2.id

      // Join the players to the match room
      player1.join(matchId)
      player2.join(matchId)
      const isRedFirst = Math.random() < 0.5
      console.log("isRedFirst", isRedFirst)
      const playerOnePubKey = addresses.get(player1.id)
      const playerOneDeckName = deckNames.get(player1.id)
      let playerOneDeck: Card[] = []

      if (!playerOnePubKey) throw new Error("Player one public key not found")

      // Load player one's deck

      if (playerOneDeckName === "Default Deck") {
        playerOneDeck = defaultDeck
      } else {
        await fetchDeck(playerOnePubKey, playerOneDeckName).then(
          async (deck) => {
            if (deck) {
              for (let i = 0; i < deck.cards.length; i++) {
                const card = await createCardFromMetadata(deck.cards[i])
                playerOneDeck.push(card)
              }
              //playerOneDeck = deck.cards
            } else {
              // @TODO
              throw new Error(
                `Deck not found. ${playerOneDeckName} (${playerOnePubKey})`
              )
            }
          }
        )
      }
      addresses.delete(player1.id)
      deckNames.delete(player1.id)

      const playerTwoaddress = addresses.get(player2.id)
      const playerTwoDeckName = deckNames.get(player2.id)
      let playerTwoDeck: Card[] = []

      if (!playerTwoaddress) throw new Error("Player two public key not found")

      // Load player two's deck

      if (playerTwoDeckName === "Default Deck") {
        playerTwoDeck = defaultDeck
      } else {
        await fetchDeck(playerTwoaddress, playerTwoDeckName).then(
          async (deck) => {
            if (deck) {
              for (let i = 0; i < deck.cards.length; i++) {
                const card = await createCardFromMetadata(deck.cards[i])
                playerTwoDeck.push(card)
              }
              //playerTwoDeck = deck.cards
            } else {
              throw new Error(
                `Deck not found. ${playerTwoDeck} (${playerTwoaddress})`
              )
            }
          }
        )
      }
      addresses.delete(player2.id)
      deckNames.delete(player2.id)

      const playerOneStats = await fetchPlayerStats(playerOnePubKey)
      const playerOneName = playerOneStats.playerName
      const playerOnePfp = playerOneStats.playerPfp

      const playerTwoStats = await fetchPlayerStats(playerTwoaddress)
      const playerTwoName = playerTwoStats.playerName
      const playerTwoPfp = playerTwoStats.playerPfp

      const playerOneEnergy = await fetchEnergy(playerOnePubKey)
      const playerTwoEnergy = await fetchEnergy(playerTwoaddress)

      // Init the match object with an empty board
      matches[matchId] = {
        players: {
          [player1.id]: {
            socketId: player1.id,
            name: playerOneName,
            pfp: playerOnePfp,
            deck: playerOneDeck.map((card) => card.id),
            deckInitialCards: playerOneDeck,
            color: "red",
            score: 0,
            address: playerOnePubKey,
            turnTimes: [],
            timeouts: 0,
            energy: playerOneEnergy,
            rewardMultiplier: 0,
          },
          [player2.id]: {
            socketId: player2.id,
            name: playerTwoName,
            pfp: playerTwoPfp,
            deck: playerTwoDeck.map((card) => card.id),
            deckInitialCards: playerTwoDeck,
            color: "blue",
            score: 0,
            address: playerTwoaddress,
            turnTimes: [],
            timeouts: 0,
            energy: playerTwoEnergy,
            rewardMultiplier: 0,
          },
        },
        board: [
          [null, null, null, null],
          [null, null, null, null],
          [null, null, null, null],
          [null, null, null, null],
        ],
        matchId,
        playerOneaddress: playerOnePubKey,
        playerTwoaddress: playerTwoaddress,
        turnNumber: 0,
        allPlayerCards: [...playerOneDeck, ...playerTwoDeck],
        lastTurnTimestamp: Date.now(),
        matchType: data.matchType,
        timer: null,
        aiOpponent: new AiOpponent("normal", []),
        isRedFirst: isRedFirst,
      }
      const voidSquareOne: BoardCard = {
        id: "blackCardOne",
        color: "black",
        turnsBuffed: [],
        isVoid: true,
        turnsOnBoard: 0,
      }

      const voidSquareTwo: BoardCard = {
        id: "blackCardTwo",
        color: "black",
        turnsBuffed: [],
        isVoid: true,
        turnsOnBoard: 0,
      }

      // Void squares
      placeRandomBlackCard(matches[matchId].board, voidSquareOne)
      placeRandomBlackCard(matches[matchId].board, voidSquareTwo)

      console.log("Match started:", matchId)

      // @TODO: Here we can't send the whole match object because it contains the player's both decks.
      // Instead we should only send the player's own decks individually.
      // Otherwise the player could see the opponent's cards.

      io.to(matchId).emit(
        "matchFound",
        playerOneName,
        playerOnePfp,
        playerTwoName,
        playerTwoPfp
      )

      // Emit the match event to the socket room after a delay of 2 seconds
      await delay(2000)
      io.to(matchId).emit("match", matches[matchId])
      // Emit all the matches to all the clients
      io.emit("matches", matches)
    }
  })

  // AI opponent dugeons
  socket.on("startDungeon", async (data) => {
    addresses.set(socket.id, data.address)
    deckNames.set(socket.id, data.deckName)

    const energy = await fetchEnergy(data.address)

    if (energy < 1) {
      socket.emit("outOfEnergy")
    } else {
      await decrementEnergy(data.address)
      console.log(
        `Player ${socket.id} is using wallet: ${data.address} and deck: ${data.deckName}`
      )

      const isRedFirst = Math.random() < 0.5

      console.log("isRedFirst", isRedFirst)
      socket.emit("startingDungeon", isRedFirst)
      console.log(`Player ${data.address} is starting dungeon: ${data.aiDeck}`)
      const player1 = socket
      // initialize AI opponent
      const aiDeck = await getDungeonDeck(data.aiDeck)
      const aiOpponent = new AiOpponent(data.aiDeck, aiDeck!.deck)

      const matchId = `${player1.id}-${aiOpponent.id}`

      // Join the player to the match room
      player1.join(matchId)
      const playerOnePubKey = addresses.get(player1.id)
      const playerOneDeckName = deckNames.get(player1.id)
      let playerOneDeck: Card[] = []
      let heroTitles: string[] = []

      if (!playerOnePubKey) throw new Error("Player one public key not found")

      // Load player one's deck

      if (playerOneDeckName === "Default Deck") {
        playerOneDeck = defaultDeck
      } else {
        await fetchDeck(playerOnePubKey, playerOneDeckName).then(
          async (deck) => {
            if (deck) {
              for (let i = 0; i < deck.cards.length; i++) {
                const card = await createCardFromMetadata(deck.cards[i])
                playerOneDeck.push(card)
                heroTitles.push(card.title)
                console.log(`Logged 1 ${card.title} for muliptier purposes`)
              }
              console.log(`Title array ${heroTitles}`)
              //playerOneDeck = deck.cards
            } else {
              // @TODO
              throw new Error(
                `Deck not found. ${playerOneDeckName} (${playerOnePubKey})`
              )
            }
          }
        )
      }
      addresses.delete(player1.id)
      deckNames.delete(player1.id)
      const rewardMultiplier = calculateRewardMultiplier(heroTitles)

      const playerOneStats = await fetchPlayerStats(playerOnePubKey)
      const playerOneName = playerOneStats.playerName
      const playerOnePfp = playerOneStats.playerPfp

      const dungeonName = data.aiDeck
      let dungeonElement = dungeonName.match(/^[a-zA-Z]+/)
      const dungeonPfp = dungeonElement

      const playerOneEnergy = await fetchEnergy(playerOnePubKey)

      // Init the match object with an empty board
      matches[matchId] = {
        players: {
          [player1.id]: {
            socketId: player1.id,
            name: playerOneName,
            pfp: playerOnePfp,
            deck: playerOneDeck.map((card) => card.id),
            deckInitialCards: playerOneDeck,
            color: "blue",
            score: 0,
            address: playerOnePubKey,
            turnTimes: [],
            timeouts: 0,
            energy: playerOneEnergy,
            rewardMultiplier: rewardMultiplier,
          },
          [aiOpponent.id]: {
            socketId: aiOpponent.id,
            name: data.aiDeck,
            pfp: "img/game/pfp.png",
            deck: aiDeck!.deck.map((card) => card.id),
            deckInitialCards: aiDeck!.deck,
            color: "red",
            score: 0,
            address: aiOpponent.address,
            turnTimes: [],
            timeouts: 0,
            energy: 0,
            rewardMultiplier: rewardMultiplier,
          },
        },
        board: [
          [null, null, null, null],
          [null, null, null, null],
          [null, null, null, null],
          [null, null, null, null],
        ],
        matchId,
        playerOneaddress: playerOnePubKey,
        playerTwoaddress: aiOpponent.address,
        turnNumber: 0,
        allPlayerCards: [...playerOneDeck, ...aiDeck!.deck],
        lastTurnTimestamp: Date.now(),
        matchType: data.matchType,
        aiOpponent: aiOpponent,
        timer: null,
        isRedFirst: isRedFirst,
      }
      const voidSquareOne: BoardCard = {
        id: "blackCardOne",
        color: "black",
        turnsBuffed: [],
        isVoid: true,
        turnsOnBoard: 0,
      }

      const voidSquareTwo: BoardCard = {
        id: "blackCardTwo",
        color: "black",
        turnsBuffed: [],
        isVoid: true,
        turnsOnBoard: 0,
      }

      // Void squares
      placeRandomBlackCard(matches[matchId].board, voidSquareOne)
      placeRandomBlackCard(matches[matchId].board, voidSquareTwo)

      console.log("Match started:", matchId)

      // @TODO: Here we can't send the whole match object because it contains the player's both decks.
      // Instead we should only send the player's own decks individually.
      // Otherwise the player could see the opponent's cards.

      // Emit the match event to the socket room after a delay of 2 seconds
      await delay(2000)

      // Emit the match event to the socket room
      io.to(matchId).emit("match", matches[matchId])

      // Emit all the matches to all the clients
      io.emit("matches", matches)
      if (isRedFirst) {
        // AI opponents turn
        const aiOpponent = matches[matchId].aiOpponent
        const opponent = matches[matchId].players[aiOpponent.id]
        const player = matches[matchId].players[player1.id]
        const match = matches[matchId]
        const board = match.board
        const aiFlippedCardSlots: string[] = []
        if (!aiOpponent) throw new Error("AI opponent not found")
        matches[matchId].turnNumber++

        const allMoves = aiOpponent.getAllMoves(
          opponent,
          matches[matchId].board,
          matches[matchId].allPlayerCards,
          aiOpponent.aiDeck
        )
        const bestMove = aiOpponent.getBestMove(allMoves)
        const randomMove = aiOpponent.getRandomMove(allMoves)

        if (!bestMove) console.log("AI opponent didn't find a move")
        else {
          // Determine which move to use based on flipped cards
          const move = bestMove.flippedCards > 0 ? bestMove : randomMove

          // Find the card in the initial deck based on the selected move
          const aiCardExists = opponent.deckInitialCards.find(
            (card) => card.id === move.cardId
          )
          if (!aiCardExists) {
            throw new Error(
              "The ai opponent is trying to move a card that doesn't exist in the starting deck"
            )
          }
          if (aiCardExists) {
          }
          const attackSoundToSend =
            aiCardExists.class === "archangel"
              ? "archangel"
              : aiCardExists.class === "assassin"
              ? "assassin"
              : aiCardExists.class === "bard"
              ? "bard"
              : aiCardExists.class === "demonHunter"
              ? "demonHunter"
              : aiCardExists.class === "necromancer"
              ? "necromancer"
              : aiCardExists.class === "pirate"
              ? "pirate"
              : aiCardExists.class === "justicar"
              ? "justicar"
              : aiCardExists.type === "magic"
              ? "magic"
              : aiCardExists.class === "ranged"
              ? "ranged"
              : "melee"

          const aiCardProps: BoardCard = {
            id: move.cardId,
            color: opponent.color,
            turnsBuffed: [],
            turnsOnBoard: 0,
          }
          await delay(5000)

          io.to(matchId).emit("playSound", attackSoundToSend)
          console.log(aiCardExists.class)
          console.log("sound sent")
          // Place the card on the board
          matches[matchId].board[move.x][move.y] = aiCardProps

          const oldAiDeck = matches[matchId].players[opponent.socketId].deck
          // Remove the card from the ai opponent's current deck
          matches[matchId].players[opponent.socketId].deck = oldAiDeck.filter(
            (cardId) => cardId !== aiCardExists?.id
          )

          aiOpponent.aiDeck = aiOpponent.aiDeck.filter(
            (card) => card.id !== aiCardExists?.id
          )

          // Make sure the opponent's current deck got updated
          const newAiDeck = matches[matchId].players[opponent.socketId].deck

          if (oldAiDeck.length === newAiDeck.length)
            throw new Error(
              "The board changed but the player's deck didn't get updated"
            )

          // Increment the ai opponent's score to account for the initial card placement
          opponent.score++
          // Compare attack values from adjacent cards
          compareAttackValuesAndDetermineWinner(
            opponent,
            player,
            matches[matchId].board,
            move.x,
            move.y,
            matches[matchId].allPlayerCards,
            move.isMagicAttackRanged ? move.isMagicAttackRanged : false,
            aiFlippedCardSlots,
            socket
          )

          // Check for AoE ability and apply it
          if (
            aiCardExists.specialAbility2 &&
            aiCardExists.specialAbility2 !== "none"
          ) {
            addTurnsBuffedToCardsOfSameElement(
              opponent,
              matches[matchId].board,
              move.x,
              move.y,
              matches[matchId].allPlayerCards
            )
          }

          // Decrement turnsBuffed for all cards on the board
          board.forEach((nestedArray) => {
            nestedArray = nestedArray.filter((card) => card !== null)
            nestedArray.forEach((card) => {
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
            `Turn number: ${matches[matchId].turnNumber} ${player.color}: ${player.score} ${opponent.color}: ${opponent.score}`
          )

          // Emit the match object to the socket match room
          io.to(matchId).emit("match", matches[matchId])
        }
      }
    }
  })

  socket.on("cleanUpDungeonMatch", () => {
    const matchId = Object.keys(matches).find(
      (key) => matches[key].players[socket.id]
    )

    if (matchId) {
      console.log("Closing Dungeon Match:", matchId)
      socket.leave(matchId)
      delete matches[matchId]
    }
  })

  // When a player disconnects, remove them from the waiting list
  // Delete the match if the player is in a match
  // Notify the opponent if the player is in a match
  socket.on("disconnect", () => {
    console.log("Player disconnected:", socket.id)

    // Check if the player is in the normal or tournament waiting list and remove them

    if (waitingNormalPlayers.includes(socket)) {
      waitingNormalPlayers.splice(waitingNormalPlayers.indexOf(socket), 1)
    } else if (waitingTournamentPlayers.includes(socket)) {
      waitingTournamentPlayers.splice(
        waitingTournamentPlayers.indexOf(socket),
        1
      )
    }

    const matchId = Object.keys(matches).find(
      (key) => matches[key].players[socket.id]
    )

    if (matchId) {
      // If the player is in a match, notify the opponent and delete the match
      const opponentPlayerKey = Object.keys(matches[matchId].players).find(
        (playerSocketId) => playerSocketId !== socket.id
      )

      if (opponentPlayerKey) {
        const opponentSocket = io.sockets.sockets.get(opponentPlayerKey)

        opponentSocket?.emit("opponentDisconnect")
        opponentSocket?.leave(matchId)
      }

      socket.leave(matchId)
      delete matches[matchId]
    }
  })
})

httpServer.listen(port, () => {
  console.log(`Server listening on port ${port}`)
})

// Function to compare attack values from cardinal directions of adjacent cards
// @TODO right now this is only working because all players start with the same deck.
// Later we have to use a variable to store all cards from both players and
// use it here to compare the attack values
export async function compareAttackValuesAndDetermineWinner(
  player: MatchPlayer | AiPlayer,
  opponent: MatchPlayer | AiPlayer,
  board: MatchBoard,
  x: number,
  y: number,
  deck: Card[],
  isMagicAttackRanged: boolean,
  flippedCardSlots: string[],
  socket: Socket
) {
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

  const attackedCards: string[] = []

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
    attackedCards.push(`top`)
    let opponentAttackValue =
      cardTopProps.turnsBuffed.length > 0
        ? cardTop.bottomAttack + cardTopProps.turnsBuffed.length
        : cardTop.bottomAttack
    let playerAttackValue = deckCard.topAttack
    console.log("Top card, Bottom attack", opponentAttackValue)
    console.log("Bottom card, Top attack", playerAttackValue)
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
      cardTopProps.color = player.color
      player.score = player.score + 1
      opponent.score = opponent.score - 1
    }
    console.log(
      `Card ${deckCard.id} ${winOrLose} against card ${cardTop.id} on top`
    )
  }

  if (cardRight && cardRightProps && cardRightProps.color != boardCard.color) {
    attackedCards.push("right")
    let playerAttackValue = deckCard.rightAttack
    let opponentAttackValue =
      cardRightProps.turnsBuffed.length > 0
        ? cardRight.leftAttack + cardRightProps.turnsBuffed.length
        : cardRight.leftAttack
    console.log("Right card, Left attack", opponentAttackValue)
    console.log("Left card, Right attack", playerAttackValue)
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
      cardRightProps.color = player.color
      player.score = player.score + 1
      opponent.score = opponent.score - 1
    }
    console.log(
      `Card ${deckCard.id} ${winOrLose} against card ${cardRight.id} on right`
    )
  }

  if (
    cardBottom &&
    cardBottomProps &&
    cardBottomProps.color != boardCard.color
  ) {
    attackedCards.push("bottom")
    let opponentAttackValue =
      cardBottomProps.turnsBuffed.length > 0
        ? cardBottom.topAttack + cardBottomProps.turnsBuffed.length
        : cardBottom.topAttack
    let playerAttackValue = deckCard.bottomAttack
    console.log("Bottom card, Top attack", opponentAttackValue)
    console.log("Top card, Bottom attack", playerAttackValue)
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
      cardBottomProps.color = player.color
      player.score = player.score + 1
      opponent.score = opponent.score - 1
    }
    console.log(
      `Card ${deckCard.id} ${winOrLose} against card ${cardBottom.id} on bottom`
    )
  }

  if (cardLeft && cardLeftProps && cardLeftProps.color != boardCard.color) {
    attackedCards.push("left")
    let playerAttackValue = deckCard.leftAttack
    let opponentAttackValue =
      cardLeftProps.turnsBuffed.length > 0
        ? cardLeft.rightAttack + cardLeftProps.turnsBuffed.length
        : cardLeft.rightAttack
    console.log("Left card, Right attack", opponentAttackValue)
    console.log("Right card, Left attack", playerAttackValue)
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
      cardLeftProps.color = player.color
      player.score = player.score + 1
      opponent.score = opponent.score - 1
    }
    console.log(
      `Card ${deckCard.id} ${winOrLose} against card ${cardLeft.id} on left`
    )
  }
  console.log(attackedCards)
  socket.emit(
    `${
      deckCard.type === "magic"
        ? "magic"
        : deckCard.type === "ranged"
        ? "ranged"
        : "melee"
    }-attack`,
    deckCard.id,
    attackedCards,
    isMagicAttackRanged,
    deckCard.element
  )
}

// Function to compare elements types of cards

export function isElementStronger(element1: string, element2: string) {
  if (
    (element1 === "dark" && element2 === "light") ||
    (element1 === "light" && element2 === "dark") ||
    (element1 === "fire" && element2 === "ice") ||
    (element1 === "ice" && element2 === "wind") ||
    (element1 === "wind" && element2 === "earth") ||
    (element1 === "earth" && element2 === "lightning") ||
    (element1 === "lightning" && element2 === "water") ||
    (element1 === "water" && element2 === "fire")
  ) {
    return true
  } else {
    return false
  }
}

export function checkDamageResistance(
  attackType: string,
  resistanceType: string
) {
  if (
    (attackType === "melee" || attackType === "ranged") &&
    resistanceType === "sturdy"
  ) {
    return 1
  } else if (attackType === "magic" && resistanceType === "magic-resist") {
    return 2
  } else {
    return 0
  }
}

// Function to apply a buff to cards of the same element and

export async function addTurnsBuffedToCardsOfSameElement(
  player: MatchPlayer,
  board: MatchBoard,
  x: number,
  y: number,
  deck: Card[]
) {
  const card = deck.find((card) => card.id === board[x][y]?.id)
  const cardsToBuff: BoardCard[] = []
  const cardElement = card?.element
  const cardColor = player.color
  const cardHasEpicSet = card?.hasEpicSet
  let cardTopProps: BoardCard | null = null
  let cardUpperRightProps: BoardCard | null = null
  let cardRightProps: BoardCard | null = null
  let cardLowerRightProps: BoardCard | null = null
  let cardBottomProps: BoardCard | null = null
  let cardLowerLeftProps: BoardCard | null = null
  let cardLeftProps: BoardCard | null = null
  let cardUpperLeftProps: BoardCard | null = null
  let cardTop: Card | null = null
  let cardUpperRight: Card | null = null
  let cardRight: Card | null = null
  let cardLowerRight: Card | null = null
  let cardBottom: Card | null = null
  let cardLowerLeft: Card | null = null
  let cardLeft: Card | null = null
  let cardUpperLeft: Card | null = null

  if (cardElement && cardColor) {
    cardTopProps = board[x + 1]?.[y]
    cardTop = cardTopProps
      ? deck.find((card) => card.id === cardTopProps!.id) || null
      : null

    cardUpperRightProps = board[x + 1]?.[y + 1]
    cardUpperRight = cardUpperRightProps
      ? deck.find((card) => card.id === cardUpperRightProps!.id) || null
      : null

    cardRightProps = board[x]?.[y + 1]
    cardRight = cardRightProps
      ? deck.find((card) => card.id === cardRightProps!.id) || null
      : null

    cardLowerRightProps = board[x - 1]?.[y + 1]
    cardLowerRight = cardLowerRightProps
      ? deck.find((card) => card.id === cardLowerRightProps!.id) || null
      : null

    cardBottomProps = board[x - 1]?.[y]
    cardBottom = cardBottomProps
      ? deck.find((card) => card.id === cardBottomProps!.id) || null
      : null

    cardLowerLeftProps = board[x - 1]?.[y - 1]
    cardLowerLeft = cardLowerLeftProps
      ? deck.find((card) => card.id === cardLowerLeftProps!.id) || null
      : null

    cardLeftProps = board[x]?.[y - 1]
    cardLeft = cardLeftProps
      ? deck.find((card) => card.id === cardLeftProps!.id) || null
      : null

    cardUpperLeftProps = board[x + 1]?.[y - 1]
    cardUpperLeft = cardUpperLeftProps
      ? deck.find((card) => card.id === cardUpperLeftProps!.id) || null
      : null
  }

  if (
    cardTop &&
    cardTopProps &&
    cardTopProps.color === cardColor &&
    cardTop.element === cardElement
  ) {
    cardsToBuff.push(cardTopProps)
  }
  if (
    cardUpperRight &&
    cardUpperRightProps &&
    cardUpperRightProps.color === cardColor &&
    cardUpperRight.element === cardElement
  ) {
    cardsToBuff.push(cardUpperRightProps)
  }
  if (
    cardRight &&
    cardRightProps &&
    cardRightProps.color === cardColor &&
    cardRight.element === cardElement
  ) {
    cardsToBuff.push(cardRightProps)
  }
  if (
    cardLowerRight &&
    cardLowerRightProps &&
    cardLowerRightProps.color === cardColor &&
    cardLowerRight.element === cardElement
  ) {
    cardsToBuff.push(cardLowerRightProps)
  }
  if (
    cardBottom &&
    cardBottomProps &&
    cardBottomProps.color === cardColor &&
    cardBottom.element === cardElement
  ) {
    cardsToBuff.push(cardBottomProps)
  }
  if (
    cardLowerLeft &&
    cardLowerLeftProps &&
    cardLowerLeftProps.color === cardColor &&
    cardLowerLeft.element === cardElement
  ) {
    cardsToBuff.push(cardLowerLeftProps)
  }
  if (
    cardLeft &&
    cardLeftProps &&
    cardLeftProps.color === cardColor &&
    cardLeft.element === cardElement
  ) {
    cardsToBuff.push(cardLeftProps)
  }
  if (
    cardUpperLeft &&
    cardUpperLeftProps &&
    cardUpperLeftProps.color === cardColor &&
    cardUpperLeft.element === cardElement
  ) {
    cardsToBuff.push(cardUpperLeftProps)
  }

  cardsToBuff.forEach((cardProps) => {
    cardProps.turnsBuffed.push(cardHasEpicSet ? 5 : 3)
    console.log(
      `Card ${cardProps.id} has been buffed for ${cardHasEpicSet ? 4 : 2} turns`
    )
  })
}

function placeRandomBlackCard(board: (BoardCard | null)[][], card: BoardCard) {
  let row: number
  let col: number

  do {
    row = Math.floor(Math.random() * board.length)
    col = Math.floor(Math.random() * board[0].length)
  } while (board[row][col] !== null)

  board[row][col] = card
}
