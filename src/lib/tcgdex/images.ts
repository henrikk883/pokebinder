export type CardImageSize = 'small' | 'large'

const QUALITY: Record<CardImageSize, string> = { small: 'low', large: 'high' }

/** Full card image URL: small for search tiles, large for the binder. */
export function cardImageUrl(image: string, size: CardImageSize): string {
  return `${image}/${QUALITY[size]}.webp`
}

export function setLogoUrl(logo: string, format: 'webp' | 'png' = 'webp'): string {
  return `${logo}.${format}`
}
