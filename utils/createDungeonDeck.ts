import fs from "fs"
import { Card, DungeonDeck } from "../utils/types"

// Read JSON files
const decksJson = fs.readFileSync("./decks/dungeonsDecks.json", "utf8")
const equipmentJson = fs.readFileSync("./decks/equippedHeroes.json", "utf8")
const heroesJson = fs.readFileSync("./decks/heroes.json", "utf8")

// Parse JSON files
const decks = JSON.parse(decksJson)
const equipment = JSON.parse(equipmentJson)
const heroes = JSON.parse(heroesJson)

// Card value variables
let helm: string,
  shoulder: string,
  neck: string,
  hands: string,
  legs: string,
  ring: string,
  weapon: string,
  chest: string,
  topAttack,
  rightAttack,
  bottomAttack,
  leftAttack,
  type,
  baseElement,
  hasEpicSet,
  className: string,
  specialAbility2: string

// Function to get gear ranking

function getGearRanking(gear: string) {
  if (gear && gear.includes("epic")) {
    return 2
  } else if (gear && gear.includes("rare")) {
    return 1
  } else {
    return 0
  }
}

// Function to check if gear is epic

function isEpic(gear: string) {
  return getGearRanking(gear) === 2
}

// Function to get gear element

function getGearElement(gear: string) {
  if (gear) {
    if (gear.includes("earth")) {
      return "earth"
    } else if (gear.includes("wind")) {
      return "wind"
    } else if (gear.includes("fire")) {
      return "fire"
    } else if (gear.includes("lightning")) {
      return "lightning"
    } else if (gear.includes("light")) {
      return "light"
    } else if (gear.includes("dark")) {
      return "dark"
    } else if (gear.includes("ice")) {
      return "ice"
    } else if (gear.includes("water")) {
      return "water"
    }
  }
  return "none"
}

// Function to get all gear

function getAllGear() {
  return [helm, neck, shoulder, chest, hands, legs, weapon, ring]
}
// Function to create cards
export async function createDungeonDeck(pveID: string): Promise<DungeonDeck> {
  const deck = decks.find((deck: { pveID: string }) => deck.pveID === pveID)
  if (!deck) throw new Error(`Deck with pveID ${pveID} not found`)

  // Create cards

  const cards: Card[] = []
  for (let i = 1; i <= 7; i++) {
    // Get cardID from deck

    const cardID = deck[`slot_${i}`]

    // Get hero and equipment from cardID

    const equip = equipment.find(
      (equip: { cardID: string }) => equip.cardID === cardID
    )

    // Get hero from equipment

    const hero = heroes.find(
      (hero: { classID: string }) => hero.classID === equip.classID
    )

    // Get hero stats
    const classAndRank =
      hero.classID === "demonHunterLord"
        ? ["demonHunter", "Lord"]
        : hero.classID === "demonHunterKnight"
        ? ["demonHunter", "Knight"]
        : hero.classID === "demonHunterSoldier"
        ? ["demonHunter", "Soldier"]
        : hero.classID.split(/(?=[A-Z])/)

    className = classAndRank[0]
    topAttack = hero.topAttack
    rightAttack = hero.rightAttack
    bottomAttack = hero.bottomAttack
    leftAttack = hero.leftAttack
    type = hero.type
    baseElement = hero.element
    helm = equip.helm
    shoulder = equip.shoulders
    neck = equip.neck
    hands = equip.hands
    legs = equip.legs
    ring = equip.ring
    weapon = equip.weapon
    chest = equip.chest

    // Get gear sets

    let gearSets = [
      { gear1: weapon, gear2: ring, direction: "left" },
      { gear1: helm, gear2: neck, direction: "top" },
      { gear1: shoulder, gear2: hands, direction: "right" },
      { gear1: chest, gear2: legs, direction: "bottom" },
    ]

    // Get highest ranking gear set

    let highestRanking = 0
    let highestElement = baseElement
    type Direction = "left" | "top" | "right" | "bottom"

    // Function to check if direction is valid

    function isDirection(dir: string): dir is Direction {
      return (
        dir === "left" || dir === "top" || dir === "right" || dir === "bottom"
      )
    }

    // Get attack values

    let attackValues: Record<Direction, number> = {
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
    }

    // Get attack values for each gear set

    for (let set of gearSets) {
      if (getGearElement(set.gear1) === getGearElement(set.gear2)) {
        let ranking = Math.min(
          getGearRanking(set.gear1),
          getGearRanking(set.gear2)
        )
        if (isDirection(set.direction)) {
          attackValues[set.direction] += ranking
          if (ranking > highestRanking) {
            highestRanking = ranking
            highestElement = getGearElement(set.gear1)
          }
        } else {
          throw new Error(`Invalid direction: ${set.direction}`)
        }
      }
    }

    // Get special ability 2 if Hero has a full set of all same element gear

    type Element =
      | "earth"
      | "wind"
      | "fire"
      | "ice"
      | "lightning"
      | "water"
      | "dark"
      | "light"

    let abilities: Record<Element, string> = {
      earth: "earthquake",
      wind: "tornado",
      fire: "blaze",
      ice: "blizzard",
      lightning: "thunderstorm",
      water: "downpour",
      dark: "abyss",
      light: "aura",
    }

    let allGear = getAllGear()
    let allElements = allGear.map(getGearElement)
    let allSameElement = allElements.every(
      (element) => element === allElements[0]
    )

    if (allSameElement && allElements[0] in abilities) {
      specialAbility2 = abilities[allElements[0] as Element]
    } else {
      specialAbility2 = "none"
    }

    hasEpicSet = getAllGear().every(isEpic)

    // Create card and assign values

    const card: Card = {
      id: cardID,
      lootScore: hero.lootScore,
      class: className,
      sprite: hero.sprite,
      element: highestElement,
      type: type,
      topAttack: Number(topAttack) + attackValues["top"],
      rightAttack: Number(rightAttack) + attackValues["right"],
      bottomAttack: Number(bottomAttack) + attackValues["bottom"],
      leftAttack: Number(leftAttack) + attackValues["left"],
      specialAbility1: hero.specialAbility1 || "none",
      specialAbility2: specialAbility2,
      starRating: hero.starRating,
      helm: helm,
      shoulder: shoulder,
      neck: neck,
      hands: hands,
      legs: legs,
      ring: ring,
      weapon: weapon,
      chest: chest,
      topAttackBoost: attackValues["top"],
      rightAttackBoost: attackValues["right"],
      bottomAttackBoost: attackValues["bottom"],
      leftAttackBoost: attackValues["left"],
      hasEpicSet: hasEpicSet,
    }

    // Push card to cards array

    cards.push(card)
  }

  // Return cards
  console.log(`Created deck for ${pveID}`)
  return { name: pveID, deck: cards }
}
