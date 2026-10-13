import { useEffect, useState } from 'react'
import { de } from '../../i18n/de'
import { tcgdexFor } from '../../lib/tcgdex'
import type { CardLang, CardVariant } from '../../types/binder'
import { cardmarketUrl } from './shopping'

interface CardmarketLinkProps {
  cardId: string
  /** The finish the price is shown for; Cardmarket lists the finishes of a card as one product. */
  variant: CardVariant
  lang: CardLang
  /** Looked for at Cardmarket where the number of its product is not known. */
  name: string
  className?: string
}

/**
 * A link that opens the card at Cardmarket, in a tab of its own: its product page where
 * TCGdex passes on the number of the product, otherwise a search for its name. The app
 * itself asks Cardmarket nothing; the page is only opened when the collector follows it.
 */
export function CardmarketLink({ cardId, variant, lang, name, className = '' }: CardmarketLinkProps) {
  const key = `${lang}:${cardId}:${variant}`
  const [found, setFound] = useState<{ key: string; productId: number | undefined }>()

  useEffect(() => {
    let cancelled = false
    // the same answer the price comes from; kept, so this asks nothing anew
    tcgdexFor(lang)
      .getPrice(cardId, variant)
      .then(
        (price) => {
          if (!cancelled) setFound({ key, productId: price?.productId })
        },
        () => {
          if (!cancelled) setFound({ key, productId: undefined })
        },
      )
    return () => {
      cancelled = true
    }
  }, [cardId, variant, lang, key])

  const productId = found?.key === key ? found.productId : undefined
  return (
    <a
      href={cardmarketUrl(productId === undefined ? { name } : { name, cardmarketId: productId })}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="cardmarket-link"
      title={productId === undefined ? de.cardmarketLink.searchHint : de.cardmarketLink.productHint}
      className={`inline-flex items-center gap-1 text-sm text-accent-hover underline-offset-2 hover:underline ${className}`}
    >
      {de.cardmarketLink.label}
      <svg viewBox="0 0 20 20" className="size-3.5" aria-hidden="true">
        <path d="M8 5h7v7M15 5l-9 9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </a>
  )
}
