import { de } from '../../i18n/de'
import type { CardSummary, SetSummary } from '../../lib/tcgdex'
import { compareVariants, type CardLang, type CardVariant } from '../../types/binder'
import { useCardDetail, useCardLangs, usePrice } from '../binder/useCard'
import { CardImage } from './CardImage'

interface CardInfoDialogProps {
  card: CardSummary
  set: SetSummary | undefined
  /** Language the card was found in. */
  lang: CardLang
  onClose: () => void
}

function VariantPrice({ cardId, variant, lang }: { cardId: string; variant: CardVariant; lang: CardLang }) {
  const price = usePrice(cardId, variant, lang)
  return (
    <li data-testid="card-info-variant" className="flex items-baseline justify-between gap-3">
      <span>{de.variantLabel(variant)}</span>
      <span className={price ? 'font-medium' : 'text-muted'}>
        {price === undefined ? de.price.loading : price === null ? de.price.none : de.price.amount(price)}
      </span>
    </li>
  )
}

/**
 * A closer look at a card from the search before it goes into the binder: its picture in
 * large, the languages and finishes it exists in, its rarity and what it costs.
 */
export function CardInfoDialog({ card, set, lang, onClose }: CardInfoDialogProps) {
  const detail = useCardDetail(card.id, lang)
  const langs = useCardLangs(card.id, lang)
  // nothing is listed until TCGdex has said which finishes the card really exists in
  const variants = [...(detail?.variants ?? [])].sort(compareVariants)
  const number = set ? `${card.localId}/${set.cardCount.official}` : card.localId

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4"
      onClick={onClose}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="card-info-title"
        onClick={(event) => event.stopPropagation()}
        className="m-auto flex w-full max-w-2xl flex-col gap-6 rounded-panel border border-line bg-panel p-6 shadow-lg sm:flex-row"
      >
        <div className="mx-auto w-full max-w-64 shrink-0 sm:w-64">
          <CardImage card={card} set={set} size="large" />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-5 text-sm">
          <div>
            <h2 id="card-info-title" className="text-xl font-semibold">
              {card.name}
            </h2>
            <p className="mt-1 text-muted">{set ? `${set.name} · ${number}` : number}</p>
          </div>

          <dl className="space-y-4">
            <div className="space-y-1">
              <dt className="text-muted">{de.selection.rarity}</dt>
              <dd data-testid="card-info-rarity">{detail?.rarity ?? de.selection.unknown}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-muted">{de.cardInfo.languages}</dt>
              <dd data-testid="card-info-languages">{langs.map((entry) => de.languages[entry]).join(', ')}</dd>
            </div>
            <div className="space-y-1">
              <dt className="flex items-baseline justify-between gap-3 text-muted">
                <span>{de.cardInfo.variants}</span>
                <span>{de.price.label}</span>
              </dt>
              <dd>
                {variants.length === 0 ? (
                  <p className="text-muted">{detail ? de.selection.unknown : de.price.loading}</p>
                ) : (
                  <ul className="space-y-1">
                    {variants.map((variant) => (
                      <VariantPrice key={variant} cardId={card.id} variant={variant} lang={lang} />
                    ))}
                  </ul>
                )}
              </dd>
            </div>
          </dl>

          <div className="mt-auto flex justify-end">
            <button
              type="button"
              autoFocus
              onClick={onClose}
              className="h-10 rounded-control border border-line bg-raised px-4 text-sm hover:border-accent"
            >
              {de.cardInfo.close}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
