import { colourDistance, similarColours, type ColourIndex } from './similarColours'

/**
 * What an image model sees in the cards of the high rarities, worked out ahead by
 * `scripts/looks/looks.mjs`: per card a row of numbers; cards with alike rows look alike in
 * motif and style. And the cards the model finds to fit each theme best.
 */
export interface LookIndex {
  ids: readonly string[]
  /** Numbers per card; the row of the card at `n` starts at `n * size`. */
  size: number
  rows: Int8Array
  themes: readonly Theme[]
}

export interface Theme {
  id: string
  /** Card ids, the best fitting first. */
  cards: readonly string[]
}

/**
 * How much the colours count beside what the model sees. Measured on a page of autumn
 * cards Henrik put together: with a quarter the cards of the page found each other best.
 */
const COLOUR_WEIGHT = 0.25
/** For a card the model has not looked at: as alike as two cards are on average. */
const UNKNOWN_LIKENESS = 0.6

/** How alike two cards look to the model: 1 for the same picture, around 0.5 for unlike ones. */
export function lookLikeness(looks: LookIndex, a: number, b: number): number {
  const startA = a * looks.size
  const startB = b * looks.size
  let dot = 0
  let lengthA = 0
  let lengthB = 0
  for (let i = 0; i < looks.size; i++) {
    const valueA = looks.rows[startA + i] ?? 0
    const valueB = looks.rows[startB + i] ?? 0
    dot += valueA * valueB
    lengthA += valueA * valueA
    lengthB += valueB * valueB
  }
  return lengthA === 0 || lengthB === 0 ? 0 : dot / Math.sqrt(lengthA * lengthB)
}

/**
 * The cards of the high rarities most like `cardId`, the most alike first: by what the
 * image model sees and by their colours together. Where the model has not looked at the
 * card asked about (a common card, or no `looks` at all) the colours alone decide.
 * `undefined` where nothing is known of that card.
 */
export function similarCards(
  colours: ColourIndex,
  looks: LookIndex | undefined,
  cardId: string,
  count: number,
): string[] | undefined {
  const ownLook = looks ? looks.ids.indexOf(cardId) : -1
  if (!looks || ownLook === -1) return similarColours(colours, cardId, count)
  const ownColour = colours.ids.indexOf(cardId)
  if (ownColour === -1) return undefined

  const lookAt = new Map(looks.ids.map((id, position) => [id, position]))
  const others: { id: string; likeness: number }[] = []
  colours.ids.slice(0, colours.rare).forEach((id, position) => {
    if (position === ownColour) return
    const look = lookAt.get(id)
    const byLook = look === undefined ? UNKNOWN_LIKENESS : lookLikeness(looks, ownLook, look)
    const byColour = 1 - colourDistance(colours.signatures, ownColour, position)
    others.push({ id, likeness: byLook * (1 - COLOUR_WEIGHT) + byColour * COLOUR_WEIGHT })
  })
  others.sort((a, b) => b.likeness - a.likeness)
  return others.slice(0, count).map((entry) => entry.id)
}
