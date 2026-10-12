import { BackupMenu } from '../features/export/BackupMenu'
import { SyncButton } from '../features/sync/SyncButton'
import { de } from '../i18n/de'
import { useBinderStore } from '../store/binderStore'
import { useDeckStore } from '../store/deckStore'
import { useEditorStore } from '../store/editorStore'
import { SaveStatusBadge } from './SaveStatusBadge'

const linkClass = 'hover:text-text'

// a phone has no room for the two words
const cardsLabel = (
  <>
    <span className="max-md:hidden">{de.header.cards}</span>
    <span className="md:hidden">{de.header.cardsShort}</span>
  </>
)

export function AppHeader() {
  const openBinderName = useBinderStore((state) => state.binder?.name)
  const deckName = useDeckStore((state) => state.deck?.name)
  // what lies open: a binder or a deck, never both
  const binderName = openBinderName ?? deckName
  const closeBinder = useBinderStore((state) => state.closeBinder)
  const closeDeck = () => {
    useDeckStore.getState().closeDeck()
    // the shelf shows the deck as it now is
    useEditorStore.getState().refreshBinderList()
  }
  const view = useEditorStore((state) => state.view)
  const showView = useEditorStore((state) => state.showView)
  const onShelf = view === 'binders' && binderName === undefined

  return (
    <header className="flex h-header shrink-0 items-center gap-6 border-b border-line bg-panel px-5 max-md:gap-3 max-md:px-3">
      <button
        type="button"
        aria-label={de.header.home}
        aria-current={view === 'home' ? 'page' : undefined}
        onClick={() => showView('home')}
        className="flex shrink-0 items-center gap-3"
      >
        <svg viewBox="0 0 24 24" className="size-7" aria-hidden="true">
          <rect x="3" y="2" width="4" height="20" rx="1.5" className="fill-accent-hover" />
          <rect x="8" y="2" width="13" height="20" rx="2.5" className="fill-accent" />
          <circle cx="14.5" cy="12" r="2.5" className="fill-bg" />
        </svg>
        <span className="text-xl font-semibold tracking-tight max-md:hidden">{de.app.name}</span>
      </button>
      <nav className="flex min-w-0 items-center gap-3 border-l border-line pl-6 text-sm whitespace-nowrap text-muted max-md:gap-2 max-md:pl-3">
        {onShelf ? (
          <span aria-current="page" className="text-text">
            {de.header.myBinders}
          </span>
        ) : (
          <button
            type="button"
            onClick={() => {
              // to the shelf, from the open binder or deck as well as from another page
              closeBinder()
              closeDeck()
              showView('binders')
            }}
            className={linkClass}
          >
            {de.header.myBinders}
          </button>
        )}
        {binderName !== undefined && (
          <>
            <span aria-hidden="true">/</span>
            {view === 'binders' ? (
              <span aria-current="page" className="truncate text-text">
                {binderName}
              </span>
            ) : (
              // back to the binder that lies open underneath
              <button type="button" onClick={() => showView('binders')} className={`truncate ${linkClass}`}>
                {binderName}
              </button>
            )}
          </>
        )}
        <span aria-hidden="true" className="h-5 border-l border-line" />
        {view === 'cards' ? (
          <span aria-current="page" className="text-text">
            {cardsLabel}
          </span>
        ) : (
          <button type="button" onClick={() => showView('cards')} className={linkClass}>
            {cardsLabel}
          </button>
        )}
      </nav>
      <div className="ml-auto flex shrink-0 items-center gap-5 max-md:gap-2">
        <SaveStatusBadge />
        <SyncButton />
        <BackupMenu />
      </div>
    </header>
  )
}
