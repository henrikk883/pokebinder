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

export function setLogoUrl(logo: string, format: 'webp' | 'png' = 'webp'): string {
  return `${logo}.${format}`
}
