import { useEffect, useState } from 'react'
import { de } from '../../i18n/de'
import { setIdOfCard, tcgdexFor, type SetSummary } from '../../lib/tcgdex'
import type { CardLang } from '../../types/binder'
import { BinderPicker } from '../binder/BinderPicker'
import { layIntoBinder, type BinderName } from '../binder/trayTransfer'
import { loadColourIndex } from '../similar/colourIndex'
import { sortByColour, type ColourIndex } from '../similar/similarColours'
import { useBinderStore } from '../../store/binderStore'
import { confirmDialog, promptDialog } from '../../store/dialogStore'
import { useEditorStore } from '../../store/editorStore'
import { useActiveList, useWatchlistStore } from '../../store/watchlistStore'
import { useCard, useCards } from '../binder/useCard'
import { CardTile } from './CardTile'
import { listName } from './listName'
import { LIST_ORDERS, matchesListSearch, sortListed, type ListedCard, type ListOrder } from './listView'
import { ListWorth } from './ListWorth'
import { TapHint } from './TapHint'
import { useReadyCatalog } from './useCatalog'
import { QUICK_LIST_ID, type SavedCard } from './watchlist'
import { WishPrice } from './WishPriceLine'

interface SavedTileProps {
  listId: string
  saved: SavedCard
  draggable: boolean
  dragIdPrefix: string
  browsing: boolean
}

function SavedTile({ listId, saved, draggable, dragIdPrefix, browsing }: SavedTileProps) {
  const card = useCard(saved.cardId, saved.lang)
  const catalog = useReadyCatalog(saved.lang)

  if (!card) {
    // still being looked up, or TCGdex does not know the card (any more)
    return (
      <li data-testid="saved-card" data-card-id={saved.cardId} className="min-w-0">
        <div className="flex aspect-[63/88] w-full items-center justify-center rounded-pocket bg-raised p-1 text-center text-xs text-muted">
          {card === null ? de.binder.unknownCard : ''}
        </div>
        <p className="mt-1.5 truncate text-xs text-muted">{saved.cardId}</p>
      </li>
    )
  }
  return (
    <CardTile
      card={card}
      set={catalog?.setsById.get(setIdOfCard(card))}
      lang={saved.lang}
      draggable={draggable}
      dragIdPrefix={dragIdPrefix}
      browsing={browsing}
      footer={<WishPrice listId={listId} saved={saved} name={card.name} />}
    />
  )
}

const smallButtonClass =
  'h-8 rounded-control border border-line bg-raised px-2.5 text-xs hover:border-accent disabled:cursor-not-allowed disabled:text-muted disabled:hover:border-line'

/** Which list is shown, and the way to make, rename and remove lists. */
function ListChooser({ wide }: { wide: boolean }) {
  const lists = useWatchlistStore((state) => state.lists)
  const showList = useWatchlistStore((state) => state.showList)
  const create = useWatchlistStore((state) => state.create)
  const rename = useWatchlistStore((state) => state.rename)
  const remove = useWatchlistStore((state) => state.remove)
  const active = useActiveList()
  const own = active.id !== QUICK_LIST_ID

  async function handleCreate() {
    const name = await promptDialog({
      title: de.watchlist.newList,
      label: de.watchlist.listName,
      value: '',
      confirmLabel: de.watchlist.create,
    })
    if (name === null) return
    const id = create(name)
    if (id) showList(id)
  }

  async function handleRename() {
    const name = await promptDialog({
      title: de.watchlist.renameList,
      label: de.watchlist.listName,
      value: active.name,
      confirmLabel: de.watchlist.rename,
    })
    if (name !== null) rename(active.id, name)
  }

  async function handleRemove() {
    const agreed = await confirmDialog({
      title: de.watchlist.deleteTitle(active.name),
      text: de.watchlist.deleteText,
      confirmLabel: de.watchlist.delete,
      danger: true,
    })
    if (agreed) remove(active.id)
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${wide ? '' : 'px-4 pb-3'}`}>
      <select
        aria-label={de.watchlist.choose}
        value={active.id}
        onChange={(event) => showList(event.target.value)}
        className={`h-10 min-w-0 rounded-control border border-line bg-raised px-3 text-sm focus:border-accent focus:outline-none ${
          wide ? 'w-72' : 'w-full'
        }`}
      >
        {lists.map((list) => (
          <option key={list.id} value={list.id}>
            {de.watchlist.option(listName(list), list.cards.length)}
          </option>
        ))}
      </select>
      <button type="button" onClick={handleCreate} className={smallButtonClass}>
        {de.watchlist.newList}
      </button>
      <button type="button" disabled={!own} onClick={handleRename} className={smallButtonClass}>
        {de.watchlist.rename}
      </button>
      <button
        type="button"
        disabled={!own}
        onClick={handleRemove}
        className="h-8 rounded-control border border-danger/60 px-2.5 text-xs text-danger hover:bg-danger/10 disabled:cursor-not-allowed disabled:border-line disabled:text-muted disabled:hover:bg-transparent"
      >
        {de.watchlist.delete}
      </button>
    </div>
  )
}

interface WatchlistPanelProps {
  /** On the page "Karten": over the whole width, to look at, not to drag from. */
  wide?: boolean
  gridClass?: string
}

/** The names of the sets of the languages given, as far as they are loaded: language → set id → name. */
function useSetNames(langs: readonly CardLang[]): (lang: CardLang, setId: string) => string | undefined {
  const [names, setNames] = useState<ReadonlyMap<CardLang, ReadonlyMap<string, SetSummary>>>(new Map())
  const wanted = [...new Set(langs)].sort().join(',')

  useEffect(() => {
    let cancelled = false
    for (const lang of wanted === '' ? [] : (wanted.split(',') as CardLang[])) {
      tcgdexFor(lang)
        .getCatalog()
        .then(
          (catalog) => {
            if (!cancelled) setNames((before) => new Map(before).set(lang, catalog.setsById))
          },
          () => undefined,
        )
    }
    return () => {
      cancelled = true
    }
  }, [wanted])

  return (lang, setId) => names.get(lang)?.get(setId)?.name
}

/** The colours of the card pictures, once they are asked for. */
function useColours(wanted: boolean): ColourIndex | undefined {
  const [colours, setColours] = useState<ColourIndex>()

  useEffect(() => {
    if (!wanted) return
    let cancelled = false
    loadColourIndex().then(
      (index) => {
        if (!cancelled) setColours(index)
      },
      () => undefined,
    )
    return () => {
      cancelled = true
    }
  }, [wanted])

  return colours
}

const fieldClass =
  'h-10 w-full min-w-0 rounded-control border border-line bg-raised px-3 text-sm placeholder:text-muted focus:border-accent focus:outline-none'

/** The "Merklisten": cards noted while browsing, ready to be dragged into a binder. */
export function WatchlistPanel({ wide = false, gridClass = 'grid grid-cols-[repeat(auto-fill,minmax(7.25rem,1fr))] gap-x-3 gap-y-4' }: WatchlistPanelProps) {
  const active = useActiveList()
  const editing = useEditorStore((state) => state.mode === 'edit')
  const binderOpen = useBinderStore((state) => state.binder !== null) && editing
  const draggable = binderOpen && !wide
  const { cards } = active
  const [typed, setTyped] = useState('')
  const [order, setOrder] = useState<ListOrder>('added')
  const [notice, setNotice] = useState<string>()

  // what is on the cards, for finding and ordering them
  const cardOf = useCards(cards)
  const setNameOf = useSetNames(cards.map((saved) => saved.lang))
  const colours = useColours(order === 'colour')
  const listedOf = (saved: SavedCard): ListedCard | undefined => {
    const card = cardOf(saved.cardId, saved.lang)
    if (!card) return undefined
    const setName = setNameOf(saved.lang, setIdOfCard(card))
    return setName === undefined ? { card } : { card, setName }
  }
  const found = cards.filter((saved) => matchesListSearch(typed, saved.cardId, listedOf(saved)))
  let shown = sortListed(found, order, listedOf)
  if (order === 'colour' && colours) {
    // by the colour of the pictures; the same card in two languages lies side by side
    const rank = new Map(sortByColour(colours, [...new Set(shown.map((saved) => saved.cardId))]).map((id, index) => [id, index]))
    shown = [...shown].sort((a, b) => (rank.get(a.cardId) ?? 0) - (rank.get(b.cardId) ?? 0))
  }

  async function handleToBinder(binder: BinderName) {
    const agreed = await confirmDialog({
      title: de.watchlist.toBinderTitle(binder.name),
      text: de.watchlist.toBinderText(shown.length, listName(active), binder.name),
      confirmLabel: de.watchlist.toBinderConfirm,
    })
    if (!agreed) return
    try {
      await layIntoBinder(binder.id, shown)
      setNotice(de.watchlist.toBinderDone(shown.length, binder.name))
    } catch {
      setNotice(de.tray.addFailed)
    }
  }

  return (
    <div className={wide ? '' : 'flex min-h-0 flex-1 flex-col'}>
      <ListChooser wide={wide} />
      {cards.length > 0 && (
        <div className={`grid gap-2 ${wide ? 'mt-3 max-w-3xl grid-cols-2 md:grid-cols-3' : 'grid-cols-2 px-4 pb-3'}`}>
          <input
            type="search"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder={de.watchlist.search}
            aria-label={de.watchlist.search}
            className={`${fieldClass} ${wide ? 'max-md:col-span-2' : 'col-span-2'}`}
          />
          <select
            aria-label={de.watchlist.order}
            value={order}
            onChange={(event) => setOrder(LIST_ORDERS.find((option) => option === event.target.value) ?? 'added')}
            className={fieldClass}
          >
            {LIST_ORDERS.map((option) => (
              <option key={option} value={option}>
                {de.watchlist.orders[option]}
              </option>
            ))}
          </select>
          <BinderPicker
            label={de.watchlist.toBinder}
            disabled={shown.length === 0}
            onPick={(binder) => void handleToBinder(binder)}
            className="w-full"
          />
        </div>
      )}
      {notice && (
        <p role="status" className={`text-xs text-muted ${wide ? 'mt-2' : 'px-4 pb-3'}`}>
          {notice}
        </p>
      )}
      <div
        className={wide ? 'mt-5' : 'min-h-0 flex-1 overflow-y-auto px-4 pb-4 max-md:flex-none max-md:overflow-visible'}
        data-testid={wide ? 'browse-watchlist' : 'watchlist'}
      >
        {cards.length === 0 ? (
          <p className="text-sm text-muted">
            {active.id === QUICK_LIST_ID ? de.watchlist.emptyQuick : de.watchlist.emptyList}
          </p>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <p role="status" className="text-xs text-muted">
                {shown.length === cards.length ? de.watchlist.count(cards.length) : de.watchlist.found(shown.length, cards.length)}
              </p>
              {/* on the wide page beside the count; beside the binder at the bottom, like the binder's value */}
              {wide && <ListWorth key={active.id} cards={cards} name={listName(active)} />}
            </div>
            <ul className={gridClass}>
              {shown.map((saved) => (
                <SavedTile
                  key={`${active.id}:${saved.lang}:${saved.cardId}`}
                  listId={active.id}
                  saved={saved}
                  draggable={draggable}
                  // the same card may be shown by several lists that are mounted at once
                  dragIdPrefix={wide ? 'browse-saved' : 'saved'}
                  browsing={wide}
                />
              ))}
            </ul>
          </>
        )}
      </div>
      {!wide && cards.length > 0 && (
        <div
          data-testid="list-worth"
          className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-line px-4 py-2 text-sm"
        >
          <ListWorth key={active.id} cards={cards} name={listName(active)} />
        </div>
      )}
      {draggable && cards.length > 0 && (
        <p className="shrink-0 border-t border-line px-4 py-2 text-xs text-muted max-md:hidden">{de.search.dragHint}</p>
      )}
      {draggable && cards.length > 0 && <TapHint />}
    </div>
  )
}
