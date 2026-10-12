import { de } from '../../i18n/de'
import { setIdOfCard } from '../../lib/tcgdex'
import type { CardLang } from '../../types/binder'
import { CardTile } from '../search/CardTile'
import { useReadyCatalog } from '../search/useCatalog'
import { useSimilarCards } from './useSimilarCards'

interface SimilarCardsSectionProps {
  cardId: string
  /** Language of the card asked about; the cards found are shown in it where they exist in it. */
  lang: CardLang
}

/** Below a card's info: the cards of the high rarities that look most like it. */
export function SimilarCardsSection({ cardId, lang }: SimilarCardsSectionProps) {
  const similar = useSimilarCards(cardId, lang)
  const ownSets = useReadyCatalog(lang)?.setsById
  const englishSets = useReadyCatalog('en')?.setsById

  return (
    <section aria-labelledby="similar-colours-title" className="w-full border-t border-line pt-5">
      <h3 id="similar-colours-title" className="text-sm font-semibold">
        {de.similar.title}
      </h3>
      <p className="mt-1 mb-4 text-xs text-muted">{de.similar.hint}</p>
      {similar.status === 'loading' && (
        <p role="status" className="text-sm text-muted">
          {de.similar.loading}
        </p>
      )}
      {similar.status === 'error' && (
        <p role="alert" className="text-sm text-muted">
          {de.similar.error}
        </p>
      )}
      {similar.status === 'unknown' && <p className="text-sm text-muted">{de.similar.unknown}</p>}
      {similar.status === 'ready' && (
        <ul data-testid="similar-cards" className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {similar.cards.map(({ card, lang: cardLang }) => (
            <CardTile
              key={card.id}
              card={card}
              set={(cardLang === lang ? ownSets : englishSets)?.get(setIdOfCard(card))}
              lang={cardLang}
              draggable={false}
              dragIdPrefix={`similar:${cardId}`}
              browsing
            />
          ))}
        </ul>
      )}
    </section>
  )
}
