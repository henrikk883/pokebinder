import { useState } from 'react'
import { de } from '../../i18n/de'
import { useIsPhone } from '../../lib/phone'
import { setIdOfCard } from '../../lib/tcgdex'
import { useBinderStore } from '../../store/binderStore'
import { useEditorStore } from '../../store/editorStore'
import type { Binder } from '../../types/binder'
import { buildSpreads, clampSpread, pageNumbersOf } from '../binder/spreads'
import { CardTile } from '../search/CardTile'
import { TapHint } from '../search/TapHint'
import { useReadyCatalog } from '../search/useCatalog'
import { MoreButton } from './MoreButton'
import { FITTING_STEP, useFittingCards } from './useSimilarCards'

const cardIdsOf = (binder: Binder, pageIndices: readonly number[]) =>
  pageIndices.flatMap((index) => binder.pages[index]?.slots.flatMap((slot) => (slot.cardRef ? [slot.cardRef.cardId] : [])) ?? [])

function Fitting({ binder }: { binder: Binder }) {
  const phone = useIsPhone()
  const spreadIndex = useEditorStore((state) => state.spreadIndex)
  const editing = useEditorStore((state) => state.mode === 'edit')
  const [count, setCount] = useState(FITTING_STEP)
  const spreads = buildSpreads(binder.pages.length, phone)
  const spread = spreads[clampSpread(spreadIndex, spreads.length)]
  const pages = spread ? pageNumbersOf(spread) : []

  // asked with the cards of the open pages; what lies anywhere in the binder is not offered
  const onPages = [...new Set(cardIdsOf(binder, pages.map((page) => page - 1)))]
  const inBinder = [...new Set(cardIdsOf(binder, binder.pages.map((_, index) => index)))].sort()
  const found = useFittingCards(binder.id, onPages, inBinder, binder.lang, count)
  const ownSets = useReadyCatalog(binder.lang)?.setsById
  const englishSets = useReadyCatalog('en')?.setsById

  return (
    <>
      <div className="shrink-0 px-4 pb-3">
        <h3 className="text-sm font-semibold">{de.fitting.title(pages.join('–'))}</h3>
        <p className="mt-1 text-xs text-muted">{de.fitting.hint}</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 max-md:flex-none max-md:overflow-visible" data-testid="fitting-results">
        {onPages.length === 0 ? (
          <p className="text-sm text-muted">{de.fitting.noCards}</p>
        ) : (
          <>
            {found.status === 'loading' && (
              <p role="status" className="text-sm text-muted">
                {de.fitting.loading}
              </p>
            )}
            {found.status === 'error' && (
              <p role="alert" className="text-sm text-muted">
                {de.fitting.error}
              </p>
            )}
            {found.status === 'unknown' && <p className="text-sm text-muted">{de.fitting.unknown}</p>}
            {found.status === 'ready' && (
              <>
                <ul className="grid grid-cols-[repeat(auto-fill,minmax(7.25rem,1fr))] gap-x-3 gap-y-4">
                  {found.cards.map(({ card, lang }) => (
                    <CardTile
                      key={card.id}
                      card={card}
                      set={(lang === binder.lang ? ownSets : englishSets)?.get(setIdOfCard(card))}
                      lang={lang}
                      draggable={editing}
                      dragIdPrefix="fitting"
                    />
                  ))}
                </ul>
                <MoreButton found={found} onMore={() => setCount(count + FITTING_STEP)} />
              </>
            )}
          </>
        )}
      </div>
      {editing && <TapHint />}
    </>
  )
}

/**
 * In the column beside the binder: cards that fit the ones on the open pages, to fill a
 * page of one mood. They are dragged into the binder like the cards of the search.
 */
export function FittingPanel() {
  const binder = useBinderStore((state) => state.binder)
  if (!binder) return <p className="px-4 text-sm text-muted">{de.fitting.noBinder}</p>
  return <Fitting key={binder.id} binder={binder} />
}
