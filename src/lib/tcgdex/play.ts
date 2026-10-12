/** What TCGdex says about a card that matters for playing it. */
export interface RawPlayCard {
  category?: string | null
  energyType?: string | null
  legal?: { standard?: boolean | null; expanded?: boolean | null } | null
}

export type CardCategory = 'pokemon' | 'trainer' | 'energy' | 'unknown'

/** What a deck needs to know about a card beyond its name and picture. */
export interface PlayInfo {
  category: CardCategory
  /** Basic energy, which a deck may hold as often as one likes. */
  basicEnergy: boolean
  /** Whether the card may be played in the tournament formats; missing where TCGdex does not say. */
  legal?: { standard: boolean; expanded: boolean }
}

/** The kind of card from TCGdex's word for it, which comes in the language asked in. */
function categoryOf(raw: string | null | undefined): CardCategory {
  const word = (raw ?? '').toLowerCase()
  if (word.startsWith('pok')) return 'pokemon'
  if (word.startsWith('trainer') || word.startsWith('dresseur')) return 'trainer'
  if (word.startsWith('energ') || word.startsWith('énerg')) return 'energy'
  return 'unknown'
}

// "Normal" is what TCGdex calls basic energy in English; the other words are the same in
// the languages the app offers.
const BASIC_ENERGY = new Set(['normal', 'basic', 'basis'])

export function playInfoOf(raw: RawPlayCard): PlayInfo {
  const category = categoryOf(raw.category)
  const info: PlayInfo = {
    category,
    basicEnergy: category === 'energy' && BASIC_ENERGY.has((raw.energyType ?? '').toLowerCase()),
  }
  if (raw.legal) info.legal = { standard: raw.legal.standard === true, expanded: raw.legal.expanded === true }
  return info
}
