/** Numbers per card in the colour signatures; what `scripts/colours.mjs` writes. */
export const SIGNATURE_LENGTH = 52

/**
 * The colours of the card pictures, worked out ahead by `scripts/colours.mjs`: per card how
 * much of its picture is of which colour.
 */
export interface ColourIndex {
  /** Card ids; the signature of the card at `n` starts at `n * SIGNATURE_LENGTH`. */
  ids: readonly string[]
  /**
   * So many cards at the start are of the high rarities (illustration rares and above).
   * Only they are offered as similar cards: beside such a card, a common one with the same
   * colours does not look alike.
   */
  rare: number
  signatures: Uint8Array
}

/**
 * How far apart the colours of two pictures are: 0 for the same colours in the same
 * amounts, 1 for pictures that share no colour.
 */
export function colourDistance(signatures: Uint8Array, a: number, b: number): number {
  const startA = a * SIGNATURE_LENGTH
  const startB = b * SIGNATURE_LENGTH
  let shared = 0
  let sumA = 0
  let sumB = 0
  for (let i = 0; i < SIGNATURE_LENGTH; i++) {
    const valueA = signatures[startA + i] ?? 0
    const valueB = signatures[startB + i] ?? 0
    shared += Math.min(valueA, valueB)
    sumA += valueA
    sumB += valueB
  }
  const smaller = Math.min(sumA, sumB)
  return smaller === 0 ? 1 : 1 - shared / smaller
}

/**
 * The cards of the high rarities whose pictures are nearest in colour to that of `cardId`
 * (any card), the nearest first. `undefined` where the colours of that card are not known.
 */
export function similarColours(index: ColourIndex, cardId: string, count: number): string[] | undefined {
  const own = index.ids.indexOf(cardId)
  if (own === -1) return undefined
  const others: { id: string; distance: number }[] = []
  index.ids.slice(0, index.rare).forEach((id, position) => {
    if (position !== own) others.push({ id, distance: colourDistance(index.signatures, own, position) })
  })
  // equally near cards stay in the order of the index, so the answer is always the same
  others.sort((a, b) => a.distance - b.distance)
  return others.slice(0, count).map((entry) => entry.id)
}

/** Hues per signature: twelve, each with four levels, followed by four greys. */
const HUES = 12
/** A picture with less of it in colour than this counts as grey. */
const COLOURED_SHARE = 0.25

/**
 * Where a picture stands on the colour wheel, from red (0) over yellow, green and blue to
 * purple (just below 1), by the middle of its colours. `undefined` for pictures that are
 * mostly black, grey or white.
 */
function hueOf(signatures: Uint8Array, position: number): number | undefined {
  const start = position * SIGNATURE_LENGTH
  let x = 0
  let y = 0
  let coloured = 0
  let total = 0
  for (let i = 0; i < SIGNATURE_LENGTH; i++) {
    const amount = signatures[start + i] ?? 0
    total += amount
    if (i >= HUES * 4) continue
    const angle = (Math.floor(i / 4) / HUES) * 2 * Math.PI
    x += amount * Math.cos(angle)
    y += amount * Math.sin(angle)
    coloured += amount
  }
  if (total === 0 || coloured / total < COLOURED_SHARE) return undefined
  return (Math.atan2(y, x) / (2 * Math.PI) + 1) % 1
}

/** How light the grey of a picture is: 0 for black, 1 for white. */
function lightnessOf(signatures: Uint8Array, position: number): number {
  const start = position * SIGNATURE_LENGTH + HUES * 4
  let light = 0
  let total = 0
  for (let grey = 0; grey < 4; grey++) {
    const amount = signatures[start + grey] ?? 0
    light += amount * grey
    total += amount
  }
  return total === 0 ? 0 : light / (total * 3)
}

/**
 * Cards put in the order of the colour wheel, so that cards of alike colours lie beside
 * each other: red, orange, yellow, green, blue, purple, then the grey ones from dark to
 * light, then those whose colours are not known. Equal ones keep their order.
 */
export function sortByColour(index: ColourIndex, cardIds: readonly string[]): string[] {
  const positionOf = new Map(index.ids.map((id, position) => [id, position]))
  // half a hue step back, so that the reds on both sides of 0 stay together
  const turn = 1 / (HUES * 2)
  const keyed = cardIds.map((id) => {
    const position = positionOf.get(id)
    if (position === undefined) return { id, key: 3 }
    const hue = hueOf(index.signatures, position)
    return { id, key: hue === undefined ? 1 + lightnessOf(index.signatures, position) : (hue + turn) % 1 }
  })
  return keyed.sort((a, b) => a.key - b.key).map((entry) => entry.id)
}
