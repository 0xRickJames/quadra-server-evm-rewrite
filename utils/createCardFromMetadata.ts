// @ts-nocheck
import { defaultDeck } from "../decks/defaultDeck"
import { Card } from "."
import metadataJson from "./metadatas.json"
import { delay } from "../index"

// Create a metaplex instance and connect to custom RPC endpoint

// Interface for the base hero stats

interface BaseHero {
  leftAttack: number
  topAttack: number
  rightAttack: number
  bottomAttack: number
  element: string
  type: string
}

// Base hero stats for each class

const baseHeroes: Record<string, BaseHero> = {
  Archangel: {
    leftAttack: 4,
    topAttack: 2,
    rightAttack: 2,
    bottomAttack: 4,
    element: "light",
    type: "melee",
  },
  "Demon Hunter": {
    leftAttack: 2,
    topAttack: 4,
    rightAttack: 3,
    bottomAttack: 5,
    element: "lightning",
    type: "ranged",
  },
  Druid: {
    leftAttack: 4,
    topAttack: 3,
    rightAttack: 3,
    bottomAttack: 3,
    element: "earth",
    type: "magic",
  },
  Necromancer: {
    leftAttack: 3,
    topAttack: 2,
    rightAttack: 5,
    bottomAttack: 3,
    element: "dark",
    type: "magic",
  },
  Assassin: {
    leftAttack: 5,
    topAttack: 1,
    rightAttack: 1,
    bottomAttack: 3,
    element: "wind",
    type: "melee",
  },
  Barbarian: {
    leftAttack: 3,
    topAttack: 2,
    rightAttack: 3,
    bottomAttack: 3,
    element: "fire",
    type: "melee",
  },
  Bard: {
    leftAttack: 1,
    topAttack: 1,
    rightAttack: 4,
    bottomAttack: 3,
    element: "earth",
    type: "ranged",
  },
  Cleric: {
    leftAttack: 3,
    topAttack: 3,
    rightAttack: 1,
    bottomAttack: 2,
    element: "ice",
    type: "magic",
  },
  Justicar: {
    leftAttack: 3,
    topAttack: 3,
    rightAttack: 1,
    bottomAttack: 2,
    element: "fire",
    type: "melee",
  },
  Pirate: {
    leftAttack: 4,
    topAttack: 1,
    rightAttack: 2,
    bottomAttack: 2,
    element: "water",
    type: "ranged",
  },
  Shaman: {
    leftAttack: 1,
    topAttack: 4,
    rightAttack: 2,
    bottomAttack: 2,
    element: "lightning",
    type: "magic",
  },
  Amazon: {
    leftAttack: 1,
    topAttack: 3,
    rightAttack: 2,
    bottomAttack: 3,
    element: "earth",
    type: "melee",
  },
  Battlemage: {
    leftAttack: 2,
    topAttack: 3,
    rightAttack: 2,
    bottomAttack: 1,
    element: "ice",
    type: "melee",
  },
  Gladiator: {
    leftAttack: 2,
    topAttack: 2,
    rightAttack: 3,
    bottomAttack: 1,
    element: "wind",
    type: "melee",
  },
  Monk: {
    leftAttack: 3,
    topAttack: 1,
    rightAttack: 1,
    bottomAttack: 3,
    element: "water",
    type: "melee",
  },
  Ranger: {
    leftAttack: 1,
    topAttack: 1,
    rightAttack: 2,
    bottomAttack: 4,
    element: "fire",
    type: "ranged",
  },
  Samurai: {
    leftAttack: 2,
    topAttack: 1,
    rightAttack: 2,
    bottomAttack: 4,
    element: "lightning",
    type: "melee",
  },
  Sharpshooter: {
    leftAttack: 3,
    topAttack: 1,
    rightAttack: 3,
    bottomAttack: 1,
    element: "ice",
    type: "ranged",
  },
  Warrior: {
    leftAttack: 2,
    topAttack: 2,
    rightAttack: 2,
    bottomAttack: 2,
    element: "wind",
    type: "melee",
  },
  Wizard: {
    leftAttack: 2,
    topAttack: 3,
    rightAttack: 1,
    bottomAttack: 2,
    element: "water",
    type: "magic",
  },
}

// Hero metadata type

type HeroMetadata = {
  creators: { address: string; share: number; verified: boolean }[]
  name: string
  seller_fee_basis_points: number
  symbol: string
  uri: string
  mint: string
}

// Function to reference the mint address from the hero ID number

function findMintByHeroNumber(
  heroes: HeroMetadata[],
  heroNumber: string
): string | undefined {
  const hero = heroes.find((h) => {
    const match = h.name.match(/Loot Hero #(\d+)/)
    return match ? match[1] === heroNumber : false
  })

  return hero ? hero.mint : undefined
}

// Function to create a Hero Card from the NFT metadata

export default async function createCardFromMetadata(id: any): Promise<any> {
  let nftId,
    title,
    starRating,
    lootScore,
    helm,
    shoulder,
    neck,
    hands,
    legs,
    ring,
    weapon,
    chest,
    className,
    classId,
    topAttack,
    rightAttack,
    bottomAttack,
    leftAttack,
    type,
    baseElement,
    hasEpicSet

  // Function to get the gear ranking

  function getGearRanking(gear) {
    if (gear && gear.includes("Epic")) {
      return 2
    } else if (gear && gear.includes("Rare")) {
      return 1
    } else {
      return 0
    }
  }

  // Function to check if gear is epic

  function isEpic(gear) {
    return getGearRanking(gear) === 2
  }

  // Function to get the gear element from gear's name

  function getGearElement(gear) {
    if (gear) {
      if (gear.includes("Gaia")) {
        return "earth"
      } else if (gear.includes("Gale")) {
        return "wind"
      } else if (gear.includes("Molten")) {
        return "fire"
      } else if (gear.includes("Charged")) {
        return "lightning"
      } else if (gear.includes("Celestial")) {
        return "light"
      } else if (gear.includes("Chaotic")) {
        return "dark"
      } else if (gear.includes("Frigid")) {
        return "ice"
      } else if (gear.includes("Tidal")) {
        return "water"
      }
    }
    return "none"
  }

  // Function to get return all gear on a Hero

  function getAllGear() {
    return [helm, neck, shoulder, chest, hands, legs, weapon, ring]
  }

  // If the id is more than 1150, it is a default card, so we can just return it from the default deck

  if (id > 1150) {
    const card = defaultDeck.find((card) => card.id === id)
    if (card) return card
  } else {
    // If the id is less than 1150, it is an NFT, so we need to get the metadata from the metaplex API and create a card from it
    // Create a variable containing the metadata for the Hero
    const heroeMetadata: HeroMetadata[] = metadataJson
    await delay(100)
    const mint = new address(findMintByHeroNumber(heroeMetadata, id))
    const metadata = await metaplex.nfts().findByMint({ mintAddress: mint })
    // Assign all traits to variables
    if (metadata) {
      const attributes = metadata.json.attributes

      attributes.forEach((attribute) => {
        if (attribute.trait_type === "Class Name") {
          className = attribute.value
        } else if (attribute.trait_type === "Title") {
          title = attribute.value
        } else if (attribute.trait_type === "NFT ID") {
          nftId = attribute.value
        } else if (attribute.trait_type === "Star Rating") {
          starRating = attribute.value
        } else if (attribute.trait_type === "Loot Score") {
          lootScore = attribute.value as unknown as number
        } else if (attribute.trait_type === "Helm") {
          helm = attribute.value
        } else if (attribute.trait_type === "Shoulder") {
          shoulder = attribute.value
        } else if (attribute.trait_type === "Neck") {
          neck = attribute.value
        } else if (attribute.trait_type === "Hands") {
          hands = attribute.value
        } else if (attribute.trait_type === "Legs") {
          legs = attribute.value
        } else if (attribute.trait_type === "Ring") {
          ring = attribute.value
        } else if (attribute.trait_type === "Weapon") {
          weapon = attribute.value
        } else if (attribute.trait_type === "Chest") {
          chest = attribute.value
        }
      })
    }

    // Assign the base stats to variables based on class name

    const baseHero = baseHeroes[className]
    topAttack = baseHero.topAttack
    rightAttack = baseHero.rightAttack
    bottomAttack = baseHero.bottomAttack
    leftAttack = baseHero.leftAttack
    type = baseHero.type
    baseElement = baseHero.element

    // Create a gear set for each direction

    let gearSets = [
      { gear1: weapon, gear2: ring, direction: "left" },
      { gear1: helm, gear2: neck, direction: "top" },
      { gear1: shoulder, gear2: hands, direction: "right" },
      { gear1: chest, gear2: legs, direction: "bottom" },
    ]

    // Loop through each gear set and add the gear ranking to the attack values if the gear elements match

    let highestRanking = 0
    let highestElement = baseElement
    let attackValues = { left: 0, top: 0, right: 0, bottom: 0 }

    for (let set of gearSets) {
      if (getGearElement(set.gear1) === getGearElement(set.gear2)) {
        let ranking = Math.min(
          getGearRanking(set.gear1),
          getGearRanking(set.gear2)
        )
        attackValues[set.direction] += ranking
        if (ranking > highestRanking) {
          highestRanking = ranking
          highestElement = getGearElement(set.gear1)
        }
      }
    }

    // Check if all gear is the same element and assign the special ability if so

    let abilities = {
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

    const specialAbility2 = allSameElement ? abilities[allElements[0]] : "none"
    hasEpicSet = getAllGear().every(isEpic)

    // Create a class id for the card

    let firstChar = className.charAt(0).toLowerCase()
    let restOfString = className.slice(1)
    classId = firstChar + restOfString + title
    let classIdNoSpaces = classId.replace(/ /g, "")

    // Create the card object and assign all values

    const card: Card = {
      title: title,
      mint: mint.toString(),
      id: nftId,
      starRating: starRating,
      lootScore: Number(lootScore),
      sprite: `https://metadata-lootheroes-rose.vercel.app/common/hero/${classIdNoSpaces}-square.png`,
      class: className,
      type: type,
      topAttack: Number(topAttack) + attackValues["top"],
      rightAttack: Number(rightAttack) + attackValues["right"],
      bottomAttack: Number(bottomAttack) + attackValues["bottom"],
      leftAttack: Number(leftAttack) + attackValues["left"],
      element: highestElement,
      specialAbility1:
        className === "Pirate" || className === "Archangel"
          ? "magic-resist"
          : className === "Gladiator" || className === "Justicar"
          ? "sturdy"
          : "none",
      specialAbility2: specialAbility2,
      hasEpicSet: hasEpicSet,
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
    }

    // Return the card object

    return card
  }
}
