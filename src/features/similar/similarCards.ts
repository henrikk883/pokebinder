import { colourDistance, type ColourIndex } from './similarColours'

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
 * The cards of the high rarities that fit `cardIds` best, the best first: by what the image
 * model sees and by their colours together, added up over the cards asked with. Asking
 * with several cards of one mood finds more of that mood than asking with one. Where the
 * model has not looked at a card asked with (a common card, or no `looks` at all) its
 * colours alone count. The cards asked with and those in `without` are left out.
 * `undefined` where nothing is known of any of the cards.
 */
export function cardsFitting(
  colours: ColourIndex,
  looks: LookIndex | undefined,
  cardIds: readonly string[],
  count: number,
  without: readonly string[] = [],
): string[] | undefined {
  const colourAt = new Map(colours.ids.map((id, position) => [id, position]))
  const lookAt = new Map((looks?.ids ?? []).map((id, position) => [id, position]))
  const asked = [...new Set(cardIds)].flatMap((id) => {
    const colour = colourAt.get(id)
    return colour === undefined ? [] : [{ colour, look: lookAt.get(id) }]
  })
  if (asked.length === 0) return undefined

  const left = new Set([...cardIds, ...without])
  const others: { id: string; likeness: number }[] = []
  colours.ids.slice(0, colours.rare).forEach((id, position) => {
    if (left.has(id)) return
    const look = lookAt.get(id)
    let likeness = 0
    for (const card of asked) {
      const byColour = 1 - colourDistance(colours.signatures, card.colour, position)
      if (!looks || card.look === undefined) {
        likeness += byColour
        continue
      }
      const byLook = look === undefined ? UNKNOWN_LIKENESS : lookLikeness(looks, card.look, look)
      likeness += byLook * (1 - COLOUR_WEIGHT) + byColour * COLOUR_WEIGHT
    }
    others.push({ id, likeness })
  })
  // equally fitting cards stay in the order of the index, so the answer is always the same
  others.sort((a, b) => b.likeness - a.likeness)
  return others.slice(0, count).map((entry) => entry.id)
}

/** The cards of the high rarities most like one card; see `cardsFitting`. */
export function similarCards(
  colours: ColourIndex,
  looks: LookIndex | undefined,
  cardId: string,
  count: number,
): string[] | undefined {
  return cardsFitting(colours, looks, [cardId], count)
}
