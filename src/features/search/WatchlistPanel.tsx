import { de } from '../../i18n/de'
import { setIdOfCard } from '../../lib/tcgdex'
import { useBinderStore } from '../../store/binderStore'
import { confirmDialog, promptDialog } from '../../store/dialogStore'
import { useEditorStore } from '../../store/editorStore'
import { useActiveList, useWatchlistStore } from '../../store/watchlistStore'
import { useCard } from '../binder/useCard'
import { CardTile } from './CardTile'
import { listName } from './listName'
import { ListWorth } from './ListWorth'
import { TapHint } from './TapHint'
import { useReadyCatalog } from './useCatalog'
import { QUICK_LIST_ID, type SavedCard } from './watchlist'

interface SavedTileProps {
  saved: SavedCard
  draggable: boolean
  dragIdPrefix: string
  browsing: boolean
}

function SavedTile({ saved, draggable, dragIdPrefix, browsing }: SavedTileProps) {
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

/** The "Merklisten": cards noted while browsing, ready to be dragged into a binder. */
export function WatchlistPanel({ wide = false, gridClass = 'grid grid-cols-2 gap-x-3 gap-y-4' }: WatchlistPanelProps) {
  const active = useActiveList()
  const editing = useEditorStore((state) => state.mode === 'edit')
  const binderOpen = useBinderStore((state) => state.binder !== null) && editing
  const draggable = binderOpen && !wide
  const { cards } = active

  return (
    <div className={wide ? '' : 'flex min-h-0 flex-1 flex-col'}>
      <ListChooser wide={wide} />
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
                {de.watchlist.count(cards.length)}
              </p>
              {/* on the wide page beside the count; beside the binder at the bottom, like the binder's value */}
              {wide && <ListWorth key={active.id} cards={cards} name={listName(active)} />}
            </div>
            <ul className={gridClass}>
              {cards.map((saved) => (
                <SavedTile
                  key={`${active.id}:${saved.lang}:${saved.cardId}`}
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
