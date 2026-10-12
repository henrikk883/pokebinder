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
