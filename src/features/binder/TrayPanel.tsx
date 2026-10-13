import { useDraggable, useDroppable } from '@dnd-kit/core'
import { useState } from 'react'
import { de } from '../../i18n/de'
import { useIsPhone } from '../../lib/phone'
import { setIdOfCard } from '../../lib/tcgdex'
import { binderStore, useBinderStore } from '../../store/binderStore'
import { useEditorStore } from '../../store/editorStore'
import type { Binder, TrayCard } from '../../types/binder'
import { CardImage } from '../search/CardImage'
import { LangFlag } from '../search/LanguageSelect'
import { matchesListSearch } from '../search/listView'
import { TapHint } from '../search/TapHint'
import { useReadyCatalog } from '../search/useCatalog'
import { copiesOf, trayOf } from './binderModel'
import type { DragSource, TrayTarget } from './dragDrop'
import { buildSpreads, clampSpread, pageNumbersOf, spreadOfPage } from './spreads'
import { nextEmptyAfter, tapTarget } from './tapPlacement'
import { useCard, useCards } from './useCard'

const buttonClass =
  'h-10 rounded-control border border-line bg-raised px-3 text-sm hover:border-accent disabled:cursor-not-allowed disabled:text-muted disabled:hover:border-line'

/**
 * Where nothing can be dragged (a phone), a tap puts a card of the tray into the selected
 * pocket or the next free one, as a tap on a card of the search does.
 */
function placeByTap(card: TrayCard, name: string) {
  const before = binderStore.getState().binder
  if (!before) return
  const editor = useEditorStore.getState()
  const target = tapTarget(before, editor.selection, clampSpread(editor.spreadIndex, before.pages.length))
  if (!target) {
    editor.noteTap({ kind: 'full' })
    return
  }
  binderStore.getState().fromTray(card.id, target.position)
  const after = binderStore.getState().binder
  const next = after ? nextEmptyAfter(after, target.position) : undefined
  const state = useEditorStore.getState()
  if (next) {
    state.showSpread(spreadOfPage(next.page - 1, true))
    state.select(next.position)
  } else {
    state.select(null)
  }
  state.noteTap({ kind: 'placed', name, page: target.page, pocket: target.pocket })
}

function TrayTile({ entry }: { entry: TrayCard }) {
  const { cardId, lang } = entry.cardRef
  const card = useCard(cardId, lang)
  const set = useReadyCatalog(lang)?.setsById.get(card ? setIdOfCard(card) : '')
  const removeFromTray = useBinderStore((state) => state.removeFromTray)
  const tappable = useIsPhone()
  const source: DragSource = { kind: 'tray', trayId: entry.id, cardId, lang }
  const { setNodeRef, listeners, isDragging } = useDraggable({ id: `tray:${entry.id}`, data: source })
  const name = card?.name ?? cardId
  const copies = copiesOf(entry)

  return (
    <li data-testid="tray-card" data-card-id={cardId} className="group relative min-w-0">
      <div
        ref={setNodeRef}
        {...(tappable
          ? { role: 'button', tabIndex: 0, 'aria-label': de.tap.place(name), onClick: () => placeByTap(entry, name) }
          : listeners)}
        className={`${tappable ? '' : 'cursor-grab'} ${isDragging ? 'opacity-40' : ''}`}
      >
        {card ? (
          <CardImage card={card} set={set} size="small" missing={!entry.owned} />
        ) : (
          <div className="flex aspect-[63/88] w-full items-center justify-center rounded-pocket bg-raised p-1 text-center text-[0.65rem] text-muted">
            {card === null ? de.binder.unknownCard : ''}
          </div>
        )}
      </div>
      {/* beside the picture, not in it: pressing this must not pick the card up */}
      <button
        type="button"
        aria-label={de.tray.remove(name)}
        title={de.tray.removeHint}
        onClick={() => removeFromTray(entry.id)}
        className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full border border-danger/70 bg-bg/90 text-xs text-danger opacity-0 group-hover:opacity-100 hover:bg-danger/10 focus-visible:opacity-100 touch:size-8 touch:opacity-100"
      >
        <span aria-hidden="true">✕</span>
      </button>
      <p className="mt-1.5 flex items-center gap-1.5 text-sm font-medium">
        <span className="inline-flex shrink-0 scale-75" title={de.languages[lang]}>
          <LangFlag lang={lang} />
        </span>
        <span className="min-w-0 truncate" title={name}>
          {name}
        </span>
      </p>
      <p className="truncate text-xs text-muted">{entry.owned ? de.tray.copies(copies) : de.tray.missing}</p>
    </li>
  )
}

function Tray({ binder }: { binder: Binder }) {
  const tray = trayOf(binder)
  const phone = useIsPhone()
  const spreadIndex = useEditorStore((state) => state.spreadIndex)
  const selection = useEditorStore((state) => state.selection)
  const multi = useEditorStore((state) => state.multi)
  const select = useEditorStore((state) => state.select)
  const toTray = useBinderStore((state) => state.toTray)
  const pageToTray = useBinderStore((state) => state.pageToTray)
  const [typed, setTyped] = useState('')
  const cardOf = useCards(tray.map((entry) => entry.cardRef))
  const found = tray.filter((entry) => {
    const card = cardOf(entry.cardRef.cardId, entry.cardRef.lang)
    return matchesListSearch(typed, entry.cardRef.cardId, card ? { card } : undefined)
  })
  const target: TrayTarget = { kind: 'tray' }
  const { setNodeRef, isOver } = useDroppable({ id: 'tray', data: target })

  const spreads = buildSpreads(binder.pages.length, phone)
  const spread = spreads[clampSpread(spreadIndex, spreads.length)]
  const openPages = (spread ? pageNumbersOf(spread) : []).flatMap((number) => {
    const page = binder.pages[number - 1]
    return page ? [{ number, page }] : []
  })
  // what is selected in the binder and holds a card
  const chosen = (multi.length > 0 ? multi : selection ? [selection] : []).filter(
    (position) => binder.pages.find((page) => page.id === position.pageId)?.slots[position.slotIndex]?.cardRef,
  )

  return (
    <section className="flex h-full flex-col max-md:h-auto">
      <div className="shrink-0 space-y-3 p-4 pb-3">
        <h2 className="text-lg font-semibold">{de.tray.title(tray.length)}</h2>
        <p className="text-xs text-muted">{phone ? de.tray.hintPhone : de.tray.hint}</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={chosen.length === 0}
            onClick={() => {
              toTray(chosen)
              select(null)
            }}
            className={buttonClass}
          >
            {de.tray.laySelected(chosen.length)}
          </button>
          {openPages.map(({ number, page }) => (
            <button
              key={page.id}
              type="button"
              disabled={page.slots.every((slot) => !slot.cardRef)}
              onClick={() => pageToTray(page.id)}
              className={buttonClass}
            >
              {de.tray.layPage(number)}
            </button>
          ))}
        </div>
        {tray.length > 0 && (
          <input
            type="search"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder={de.tray.search}
            aria-label={de.tray.search}
            className="h-10 w-full rounded-control border border-line bg-raised px-3 text-sm placeholder:text-muted focus:border-accent focus:outline-none"
          />
        )}
      </div>
      <div
        ref={setNodeRef}
        data-testid="tray"
        data-over={isOver}
        className={`min-h-40 flex-1 overflow-y-auto border-t px-4 py-4 max-md:flex-none max-md:overflow-visible ${
          isOver ? 'border-accent bg-accent/10' : 'border-line'
        }`}
      >
        {tray.length === 0 ? (
          <p className="text-sm text-muted">{de.tray.empty}</p>
        ) : found.length === 0 ? (
          <p className="text-sm text-muted">{de.tray.nothingFound}</p>
        ) : (
          <ul className="grid grid-cols-2 gap-x-3 gap-y-4">
            {found.map((entry) => (
              <TrayTile key={entry.id} entry={entry} />
            ))}
          </ul>
        )}
      </div>
      <TapHint />
    </section>
  )
}

/**
 * In the column beside the binder, in place of the search: the tray, where cards wait
 * while the binder is rearranged. Cards are dragged here out of their pockets and from
 * here back into one; they stay here when the binder is left.
 */
export function TrayPanel() {
  const binder = useBinderStore((state) => state.binder)
  return binder ? <Tray binder={binder} /> : null
}
