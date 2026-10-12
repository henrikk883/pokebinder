import { useState } from 'react'
import { de } from '../../i18n/de'
import { setIdOfCard } from '../../lib/tcgdex'
import { useBinderStore } from '../../store/binderStore'
import { useEditorStore } from '../../store/editorStore'
import {
  BASE_VARIANTS,
  compareVariants,
  DEFAULT_LANG,
  OPENING_SIDES,
  type OpeningSide,
  type Page,
  type Slot,
} from '../../types/binder'
import { CoverDialog } from '../images/CoverDialog'
import { ImageControls } from '../images/ImageControls'
import { CardImage } from '../search/CardImage'
import { LanguageSelect } from '../search/LanguageSelect'
import { useReadyCatalog } from '../search/useCatalog'
import { canCloseGap } from './binderModel'
import { spreadOfPage } from './spreads'
import { useCard, useCardDetail, useCardLangs, usePrice } from './useCard'

const fieldClass =
  'flex h-10 items-center rounded-control border border-line bg-raised px-3 text-sm'
const pageButtonClass =
  'flex h-10 w-full items-center justify-center rounded-control border border-line bg-raised px-2 text-sm hover:border-accent disabled:cursor-not-allowed disabled:text-muted disabled:hover:border-line'
const outlineButtonClass =
  'flex h-10 w-full items-center justify-center rounded-control border border-line bg-raised text-sm hover:border-accent'

function SelectedCard({ page, slot }: { page: Page; slot: Slot }) {
  const setOwned = useBinderStore((state) => state.setOwned)
  const lang = slot.cardRef?.lang ?? DEFAULT_LANG
  const card = useCard(slot.cardRef?.cardId, lang)
  const catalog = useReadyCatalog(lang)
  const set = card ? catalog?.setsById.get(setIdOfCard(card)) : undefined
  const position = { pageId: page.id, slotIndex: slot.index }
  const setVariant = useBinderStore((state) => state.setVariant)
  const setCardLang = useBinderStore((state) => state.setCardLang)
  const detail = useCardDetail(slot.cardRef?.cardId, lang)
  const langs = useCardLangs(slot.cardRef?.cardId, lang)
  const price = usePrice(slot.cardRef?.cardId, slot.cardRef?.variant, lang)
  // offer the finishes the card exists in; the current one stays selectable in any case
  const variants = [
    ...new Set([...(detail?.variants ?? BASE_VARIANTS), ...(slot.cardRef ? [slot.cardRef.variant] : [])]),
  ].sort(compareVariants)

  if (!slot.cardRef) return <p className="text-sm text-muted">{de.selection.emptyPocket}</p>

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <div className="w-24 shrink-0">
          {card ? (
            <CardImage card={card} set={set} size="small" missing={!slot.owned} />
          ) : (
            <div className="aspect-[63/88] w-full rounded-pocket bg-raised" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-base font-medium">
            {card ? card.name : card === null ? de.binder.unknownCard : ''}
          </p>
          {card && (
            <p className="mt-1 text-sm text-muted">
              {set ? `${set.name} · ${card.localId}/${set.cardCount.official}` : card.localId}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-1 text-sm">
        <p className="text-muted">{de.selection.language}</p>
        <LanguageSelect
          label={de.selection.language}
          value={lang}
          options={langs}
          onChange={(next) => setCardLang(position, next)}
        />
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="space-y-1">
          <dt className="text-muted">
            <label htmlFor="selected-variant">{de.selection.variant}</label>
          </dt>
          <dd>
            <select
              id="selected-variant"
              value={slot.cardRef.variant}
              onChange={(event) => setVariant(position, event.target.value)}
              className={`${fieldClass} w-full`}
            >
              {variants.map((variant) => (
                <option key={variant} value={variant}>
                  {de.variantLabel(variant)}
                </option>
              ))}
            </select>
          </dd>
        </div>
        <div className="space-y-1">
          <dt className="text-muted">{de.selection.rarity}</dt>
          <dd data-testid="selected-rarity" className={`${fieldClass} truncate`} title={detail?.rarity}>
            {detail?.rarity ?? de.selection.unknown}
          </dd>
        </div>
      </dl>

      <p className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-muted">{de.price.label}</span>
        <span data-testid="selected-price" className="font-medium">
          {price === undefined ? de.price.loading : price === null ? de.price.none : de.price.amount(price)}
        </span>
      </p>

      <div role="group" aria-label={de.selection.ownedState} className="flex rounded-control bg-raised p-0.5 text-sm">
        {[true, false].map((owned) => (
          <button
            key={String(owned)}
            type="button"
            aria-pressed={slot.owned === owned}
            onClick={() => setOwned(position, owned)}
            className={`h-9 flex-1 rounded-control font-medium ${
              slot.owned === owned ? 'bg-accent text-white' : 'text-muted hover:text-text'
            }`}
          >
            {owned ? de.selection.owned : de.selection.missing}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Right column: what is selected, and settings for the page it is on. */
export function SelectionPanel() {
  const binder = useBinderStore((state) => state.binder)
  const clearSlot = useBinderStore((state) => state.clearSlot)
  const setOpeningSide = useBinderStore((state) => state.setOpeningSide)
  const setCover = useBinderStore((state) => state.setCover)
  const movePage = useBinderStore((state) => state.movePage)
  const insertPage = useBinderStore((state) => state.insertPage)
  const duplicatePage = useBinderStore((state) => state.duplicatePage)
  const insertGap = useBinderStore((state) => state.insertGap)
  const closeGap = useBinderStore((state) => state.closeGap)
  const showSpread = useEditorStore((state) => state.showSpread)
  const select = useEditorStore((state) => state.select)
  const collecting = useEditorStore((state) => state.mode === 'collection')
  const selection = useEditorStore((state) => state.selection)
  const [editingCover, setEditingCover] = useState(false)

  const page = selection ? binder?.pages.find((entry) => entry.id === selection.pageId) : undefined
  const slot = selection ? page?.slots[selection.slotIndex] : undefined

  /** Turns to where the selected page lies after it moved, and keeps its pocket selected. */
  function follow(toIndex: number) {
    if (!selection) return
    showSpread(spreadOfPage(toIndex))
    select(selection)
  }

  return (
    <section className="space-y-6 p-4">
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">{de.selection.title}</h2>
        {page && slot ? (
          <SelectedCard page={page} slot={slot} />
        ) : (
          <p className="text-sm text-muted">{de.selection.empty}</p>
        )}
      </div>

      {page && slot && (
        <>
          <div className="space-y-3 border-t border-line pt-5">
            <h3 className="text-lg font-semibold">{de.selection.pocket}</h3>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div className="space-y-1">
                <dt className="text-muted">{de.selection.page}</dt>
                <dd className={fieldClass}>{page.index + 1}</dd>
              </div>
              <div className="space-y-1">
                <dt className="text-muted">{de.selection.position}</dt>
                <dd className={fieldClass}>{slot.index + 1}</dd>
              </div>
            </dl>
            <button
              type="button"
              disabled={!slot.cardRef}
              onClick={() => clearSlot({ pageId: page.id, slotIndex: slot.index })}
              className="flex h-10 w-full items-center justify-center rounded-control border border-danger/70 text-sm text-danger hover:bg-danger/10 disabled:cursor-not-allowed disabled:border-line disabled:text-muted disabled:hover:bg-transparent"
            >
              {de.selection.clear}
            </button>
            {binder && !collecting && (
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={!slot.cardRef}
                  title={de.selection.insertGapHint}
                  onClick={() => insertGap({ pageId: page.id, slotIndex: slot.index })}
                  className={pageButtonClass}
                >
                  {de.selection.insertGap}
                </button>
                <button
                  type="button"
                  disabled={!canCloseGap(binder, { pageId: page.id, slotIndex: slot.index })}
                  title={de.selection.closeGapHint}
                  onClick={() => closeGap({ pageId: page.id, slotIndex: slot.index })}
                  className={pageButtonClass}
                >
                  {de.selection.closeGap}
                </button>
              </div>
            )}
          </div>

          <div className="space-y-3 border-t border-line pt-5">
            <h3 className="text-lg font-semibold">{de.selection.design}</h3>
            <select
              aria-label={de.selection.opening}
              value={page.openingSide}
              onChange={(event) => setOpeningSide(page.id, event.target.value as OpeningSide)}
              className={`${fieldClass} w-full`}
            >
              {OPENING_SIDES.map((side) => (
                <option key={side} value={side}>
                  {de.openingSides[side]}
                </option>
              ))}
            </select>
            {page.openingSide === 'mixed' && (
              <p className="text-xs text-muted">{de.openingMixedHint}</p>
            )}
            {binder && <ImageControls binder={binder} page={page} slot={slot} />}
          </div>

          {binder && !collecting && (
            <div className="space-y-3 border-t border-line pt-5">
              <h3 className="text-lg font-semibold">{de.selection.pageActions(page.index + 1)}</h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={page.index === 0}
                  onClick={() => {
                    movePage(page.id, page.index - 1)
                    follow(page.index - 1)
                  }}
                  className={pageButtonClass}
                >
                  {de.selection.movePageEarlier}
                </button>
                <button
                  type="button"
                  disabled={page.index >= binder.pages.length - 1}
                  onClick={() => {
                    movePage(page.id, page.index + 1)
                    follow(page.index + 1)
                  }}
                  className={pageButtonClass}
                >
                  {de.selection.movePageLater}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    duplicatePage(page.id)
                    follow(page.index)
                  }}
                  className={pageButtonClass}
                >
                  {de.selection.duplicatePage}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    insertPage(page.index)
                    // the selected page moved back by one
                    follow(page.index + 1)
                  }}
                  className={pageButtonClass}
                >
                  {de.selection.insertPageBefore}
                </button>
              </div>
              <p className="text-xs text-muted">{de.selection.pageMoveHint}</p>
            </div>
          )}
        </>
      )}

      {binder && (
        <div className="border-t border-line pt-5">
          <button type="button" onClick={() => setEditingCover(true)} className={outlineButtonClass}>
            {de.selection.editCover}
          </button>
        </div>
      )}
      {binder && editingCover && (
        <CoverDialog
          cover={binder.cover}
          onCancel={() => setEditingCover(false)}
          onSave={(cover) => {
            setCover(cover)
            setEditingCover(false)
          }}
        />
      )}
    </section>
  )
}
