import type { CardSummary, SetSummary } from './types'

export type CardImageSize = 'small' | 'large'

const QUALITY: Record<CardImageSize, string> = { small: 'low', large: 'high' }

/** Full card image URL: small for search tiles, large for the binder. */
export function cardImageUrl(image: string, size: CardImageSize): string {
  return `${image}/${QUALITY[size]}.webp`
}

/**
 * Where the English scan of a card would be. TCGdex has no German scan for many promo and
 * subset cards; whether the English one exists only shows when loading it.
 */
export function englishCardImage(
  card: Pick<CardSummary, 'localId'>,
  set: Pick<SetSummary, 'id' | 'seriesId'>,
): string {
  return `https://assets.tcgdex.net/en/${set.seriesId}/${set.id}/${card.localId}`
}

/**
 * Sets whose id at pokemontcg.io does not follow the rule in `pokemontcgSetId`:
 * there, half sets are written `35` in some series and `pt5` in others.
 */
const POKEMONTCG_SET_IDS: Record<string, string> = {
  'swsh3.5': 'swsh35',
  'swsh4.5': 'swsh45',
  'swsh4.5sv': 'swsh45sv',
  'sm3.5': 'sm35',
  'sm7.5': 'sm75',
  'sm11.5': 'sm115',
}

/**
 * The id a TCGdex set has at pokemontcg.io: numbers without leading zeros, half sets
 * with `pt5` (`sv03.5` → `sv3pt5`, `swsh12.5gg` → `swsh12pt5gg`). A wrong guess does no
 * harm: the picture is then simply not found.
 */
export function pokemontcgSetId(setId: string): string {
  const known = POKEMONTCG_SET_IDS[setId]
  if (known) return known
  const match = /^([a-z]+)0*(\d+)(?:\.(\d))?(.*)$/.exec(setId)
  if (!match) return setId
  const [, prefix, number, half, rest] = match
  return `${prefix}${number}${half ? `pt${half}` : ''}${rest}`
}

const POKEMONTCG_IMAGES = 'https://images.pokemontcg.io'

/**
 * English scans of a card at pokemontcg.io, the second image source. It is asked only for
 * cards TCGdex has no picture of at all, mostly whole subsets (trainer galleries, shiny
 * vault). Numbers are written with and without leading zeros there, so both are offered.
 */
export function pokemontcgCardImages(
  card: Pick<CardSummary, 'localId'>,
  set: Pick<SetSummary, 'id'>,
  size: CardImageSize,
): string[] {
  // Japanese sets (SV2a, …) are not in that database
  if (set.id !== set.id.toLowerCase()) return []
  const suffix = size === 'large' ? '_hires' : ''
  const numbers = new Set([card.localId, card.localId.replace(/^0+(?=.)/, '')])
  return [...numbers].map(
    (number) => `${POKEMONTCG_IMAGES}/${pokemontcgSetId(set.id)}/${number}${suffix}.png`,
  )
}

export interface SubstituteImage {
  url: string
  /**
   * The address must be checked before it is shown. pokemontcg.io answers "not found"
   * together with a picture of a card back, which a browser would display as if it were
   * the card. TCGdex answers without a picture, so there a failed load is enough.
   */
  mustVerify: boolean
}

/**
 * Pictures to show for a card, best first: the scan in the card's language; without one,
 * the English scan of TCGdex and then those of pokemontcg.io. Which of the stand-ins exist
 * only shows when loading them.
 */
export function cardImageSources(
  card: Pick<CardSummary, 'localId' | 'image'>,
  set: Pick<SetSummary, 'id' | 'seriesId'> | undefined,
  size: CardImageSize,
): { own: string | undefined; substitutes: SubstituteImage[] } {
  if (card.image) return { own: cardImageUrl(card.image, size), substitutes: [] }
  if (!set) return { own: undefined, substitutes: [] }
  return {
    own: undefined,
    substitutes: [
      { url: cardImageUrl(englishCardImage(card, set), size), mustVerify: false },
      ...pokemontcgCardImages(card, set, size).map((url) => ({ url, mustVerify: true })),
    ],
  }
}

// Checked once per address; the answer does not change while the app is open.
const verified = new Map<string, Promise<boolean>>()

/**
 * Whether a picture really exists at an address, judged by the status of the answer and
 * not by whether something displayable came back. The picture is fetched in full, so the
 * browser has it at hand when it is shown, and a picture kept for offline use still counts.
 */
export function imageExists(url: string): Promise<boolean> {
  let answer = verified.get(url)
  if (!answer) {
    answer = fetch(url).then(
      (response) => response.ok,
      () => false,
    )
    verified.set(url, answer)
  }
  return answer
}

export function setLogoUrl(logo: string, format: 'webp' | 'png' = 'webp'): string {
  return `${logo}.${format}`
}
