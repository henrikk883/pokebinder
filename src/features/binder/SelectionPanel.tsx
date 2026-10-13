import { useState } from 'react'
import { de } from '../../i18n/de'
import { setIdOfCard } from '../../lib/tcgdex'
import { useBinderStore } from '../../store/binderStore'
import { useEditorStore } from '../../store/editorStore'
import { useWatchlistStore } from '../../store/watchlistStore'
import {
  type CardLang,
  BASE_VARIANTS,
  compareVariants,
  DEFAULT_LANG,
  OPENING_SIDES,
  type OpeningSide,
  type Page,
  type Slot,
  type SlotPosition,
} from '../../types/binder'
import { CoverDialog } from '../images/CoverDialog'
import { ImageControls } from '../images/ImageControls'
import { CardImage } from '../search/CardImage'
import { LanguageSelect } from '../search/LanguageSelect'
import { listName } from '../search/listName'
import { useReadyCatalog } from '../search/useCatalog'
import { canCloseGap, copiesOf, MAX_COPIES } from './binderModel'
import { isPhone } from '../../lib/phone'
import { spreadOfPage } from './spreads'
import { useCard, useCardDetail, useCardLangs, usePrice } from './useCard'

const fieldClass =
  'flex h-10 items-center rounded-control border border-line bg-raised px-3 text-sm'
const stepClass =
  'flex size-9 items-center justify-center border border-line bg-raised hover:border-accent disabled:cursor-not-allowed disabled:text-muted disabled:hover:border-line'
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
  const setCount = useBinderStore((state) => state.setCount)
  const copies = copiesOf(slot)
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

      <div className="flex items-center justify-between gap-3 text-sm" title={de.selection.copiesHint}>
        <span className="text-muted">{de.selection.copies}</span>
        <div role="group" aria-label={de.selection.copies} className="flex items-center">
          <button
            type="button"
            aria-label={de.selection.fewerCopies}
            disabled={copies <= 1}
            onClick={() => setCount(position, copies - 1)}
            className={`${stepClass} rounded-l-control`}
          >
            <span aria-hidden="true">–</span>
          </button>
          <output data-testid="copies" className="flex h-9 w-12 items-center justify-center border-y border-line bg-raised">
            {copies}
          </output>
          <button
            type="button"
            aria-label={de.selection.moreCopies}
            disabled={!slot.owned || copies >= MAX_COPIES}
            onClick={() => setCount(position, copies + 1)}
            className={`${stepClass} rounded-r-control`}
          >
            <span aria-hidden="true">+</span>
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Notes the cards given on a watchlist picked from a list. It always stands on its first
 * entry, which says what picking does; cards that are on the list already stay as they are.
 */
function ToWatchlist({ cards }: { cards: readonly { cardId: string; lang: CardLang }[] }) {
  const lists = useWatchlistStore((state) => state.lists)
  const addMany = useWatchlistStore((state) => state.addMany)
  const [noted, setNoted] = useState<string>()

  return (
    <div className="space-y-1">
      <select
        aria-label={de.watchlist.toList}
        value=""
        disabled={cards.length === 0}
        onChange={(event) => {
          const list = lists.find((entry) => entry.id === event.target.value)
          if (!list) return
          addMany(list.id, cards)
          setNoted(de.watchlist.toListDone(cards.length, listName(list)))
        }}
        className="h-10 w-full min-w-0 rounded-control border border-line bg-raised px-3 text-sm focus:border-accent focus:outline-none disabled:text-muted"
      >
        <option value="">{`${de.watchlist.toList} …`}</option>
        {lists.map((list) => (
          <option key={list.id} value={list.id}>
            {listName(list)}
          </option>
        ))}
      </select>
      {noted && (
        <p role="status" className="text-xs text-muted">
          {noted}
        </p>
      )}
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
  const startMove = useEditorStore((state) => state.startMove)
  const insertGap = useBinderStore((state) => state.insertGap)
  const closeGap = useBinderStore((state) => state.closeGap)
  const showSpread = useEditorStore((state) => state.showSpread)
  const select = useEditorStore((state) => state.select)
  const collecting = useEditorStore((state) => state.mode === 'collection')
  const selection = useEditorStore((state) => state.selection)
  const multi = useEditorStore((state) => state.multi)
  const clearSlots = useBinderStore((state) => state.clearSlots)
  const toTray = useBinderStore((state) => state.toTray)
  const setOwnedMany = useBinderStore((state) => state.setOwnedMany)
  const [editingCover, setEditingCover] = useState(false)

  // several pockets have actions of their own; the details of a single one would mislead
  const several = multi.length > 1
  const page = selection && !several ? binder?.pages.find((entry) => entry.id === selection.pageId) : undefined
  const slot = selection && !several ? page?.slots[selection.slotIndex] : undefined
  const selectedCards = several
    ? multi.filter(
        (position) => binder?.pages.find((entry) => entry.id === position.pageId)?.slots[position.slotIndex]?.cardRef,
      ).length
    : 0

  /** The cards in the pockets given, for noting them on a list. */
  const cardsAt = (positions: readonly SlotPosition[]) =>
    positions.flatMap((position) => {
      const ref = binder?.pages.find((entry) => entry.id === position.pageId)?.slots[position.slotIndex]?.cardRef
      return ref ? [{ cardId: ref.cardId, lang: ref.lang }] : []
    })

  /** Turns to where the selected page lies after it moved, and keeps its pocket selected. */
  function follow(toIndex: number) {
    if (!selection) return
    showSpread(spreadOfPage(toIndex, isPhone()))
    select(selection)
  }

  return (
    <section className="space-y-6 p-4">
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">{de.selection.title}</h2>
        {several ? (
          <div data-testid="multi-selection" className="space-y-3">
            <p className="text-sm">{de.multi.count(multi.length, selectedCards)}</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={selectedCards === 0}
                onClick={() => setOwnedMany(multi, true)}
                className={pageButtonClass}
              >
                {de.multi.allOwned}
              </button>
              <button
                type="button"
                disabled={selectedCards === 0}
                onClick={() => setOwnedMany(multi, false)}
                className={pageButtonClass}
              >
                {de.multi.allMissing}
              </button>
            </div>
            <ToWatchlist cards={cardsAt(multi)} />
            <button
              type="button"
              disabled={selectedCards === 0}
              title={de.tray.layHint}
              onClick={() => {
                toTray(multi)
                select(null)
              }}
              className={pageButtonClass}
            >
              {de.tray.lay}
            </button>
            <button
              type="button"
              disabled={selectedCards === 0}
              onClick={() => clearSlots(multi)}
              className="flex h-10 w-full items-center justify-center rounded-control border border-danger/70 text-sm text-danger hover:bg-danger/10 disabled:cursor-not-allowed disabled:border-line disabled:text-muted disabled:hover:bg-transparent"
            >
              {de.multi.clear}
            </button>
            <button
              type="button"
              disabled={selectedCards === 0 || !selection}
              onClick={() => selection && startMove(selection)}
              className={pageButtonClass}
            >
              {de.move.start}
            </button>
            <button type="button" onClick={() => select(null)} className={outlineButtonClass}>
              {de.multi.deselect}
            </button>
            <p className="text-xs text-muted">{de.multi.moveHint}</p>
          </div>
        ) : page && slot ? (
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
            {!collecting && (
              <button
                type="button"
                disabled={!slot.cardRef}
                onClick={() => startMove({ pageId: page.id, slotIndex: slot.index })}
                className={pageButtonClass}
              >
                {de.move.start}
              </button>
            )}
            <ToWatchlist cards={cardsAt([{ pageId: page.id, slotIndex: slot.index }])} />
            {!collecting && (
              <button
                type="button"
                disabled={!slot.cardRef}
                title={de.tray.layHint}
                onClick={() => toTray([{ pageId: page.id, slotIndex: slot.index }])}
                className={pageButtonClass}
              >
                {de.tray.lay}
              </button>
            )}
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
