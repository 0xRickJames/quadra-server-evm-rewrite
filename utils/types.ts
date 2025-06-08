import AiOpponent from "../classes/aiOpponent"

export type MatchBoard = (BoardCard | null)[][]

export type BoardCard = {
  id: string
  color: string
  turnsBuffed: number[]
  isVoid?: boolean
  turnsOnBoard: number
}

export type DungeonDeck = {
  name: string
  deck: Card[]
}

export type Card = {
  title?: string
  mint?: string
  id: string
  lootScore: number
  class: string
  sprite: string
  element: string
  type: string
  topAttack: number
  rightAttack: number
  bottomAttack: number
  leftAttack: number
  specialAbility1?: string
  specialAbility2?: string
  starRating: string
  hasEpicSet?: boolean
  helm?: string
  shoulder?: string
  neck?: string
  hands?: string
  legs?: string
  ring?: string
  weapon?: string
  chest?: string
  topAttackBoost?: number
  rightAttackBoost?: number
  bottomAttackBoost?: number
  leftAttackBoost?: number
}

export type MatchPlayer = {
  socketId: string
  // Cards that the player has in their hand
  name: string
  pfp: string
  deck: string[]
  // Initial cards that the player starts with, *only used for reference*
  deckInitialCards: Card[]
  // The players color and score
  color: string
  score: number
  address: string
  turnTimes: number[]
  timeouts: number
  energy: number
  rewardMultiplier: number
  hasDungeonTicket?: boolean
}
export type AiPlayer = {
  socketId: string
  // Cards that the player has in their hand
  name: string
  pfp: string
  deck: string[]
  // Initial cards that the player starts with, *only used for reference*
  deckInitialCards: Card[]
  // The players color and score
  color: string
  score: number
  address: string
  turnTimes: number[]
  timeouts: number
  energy: number
  rewardMultiplier: number
  hasDungeonTicket?: boolean
}
export type CardPlacementOutcome = {
  x: number
  y: number
  cardId: string
  isMagicAttackRanged?: boolean
  flippedCards: number
}

export type Match = {
  players: {
    [socketId: string]: MatchPlayer | AiPlayer
  }
  board: (BoardCard | null)[][]
  matchId: string
  playerOneaddress: string
  playerTwoaddress: string
  turnNumber: number
  allPlayerCards: Card[]
  lastTurnTimestamp: number
  matchType: string
  aiOpponent: AiOpponent
  timer: NodeJS.Timeout | null
  isRedFirst: boolean
}
