import { useEffect } from 'react'
import { BinderWorkspace } from '../features/binder/BinderWorkspace'
import { CardDragLayer } from '../features/binder/CardDragLayer'
import { SelectionPanel } from '../features/binder/SelectionPanel'
import { LandingPage } from '../features/landing/LandingPage'
import { DeckEditor } from '../features/decks/DeckEditor'
import { CardBrowser } from '../features/search/CardBrowser'
import { SharedBinderPage } from '../features/share/SharedBinderPage'
import { startSync } from '../features/sync/syncStore'
import { SearchPanel } from '../features/search/SearchPanel'
import { TrayPanel } from '../features/binder/TrayPanel'
import { assetStore } from '../store/assetStore'
import { restoreLastBinder, useBinderStore } from '../store/binderStore'
import { useDeckStore } from '../store/deckStore'
import { sharedToken, useEditorStore } from '../store/editorStore'
import { AppFooter } from './AppFooter'
import { AppHeader } from './AppHeader'
import { AppLayout } from './AppLayout'
import { DialogHost } from './DialogHost'

/**
 * Beside the binder: the search, or the tray while cards are laid aside. The search stays
 * mounted behind the tray, so that it is as it was when the collector comes back to it.
 */
function LeftColumn() {
  const showTray = useEditorStore((state) => state.showTray)
  const binderOpen = useBinderStore((state) => state.binder !== null)
  const tray = showTray && binderOpen
  return (
    <>
      <div className={tray ? 'hidden' : 'contents'}>
        <SearchPanel />
      </div>
      {tray && <TrayPanel />}
    </>
  )
}

export function App() {
  const view = useEditorStore((state) => state.view)
  const deck = useDeckStore((state) => state.deck)
  // an open deck takes the place of the shelf it was taken from
  const page =
    view === 'shared' && sharedToken !== undefined ? (
      <SharedBinderPage token={sharedToken} />
    ) : view === 'home' ? (
      <LandingPage />
    ) : view === 'cards' ? (
      <CardBrowser />
    ) : deck ? (
      <DeckEditor key={deck.id} deck={deck} />
    ) : undefined

  useEffect(() => {
    // Without storage the app still works, it just starts empty.
    restoreLastBinder().catch(() => undefined)
    assetStore.getState().load().catch(() => undefined)
    return startSync()
  }, [])

  return (
    <CardDragLayer>
      <AppLayout
        header={<AppHeader />}
        left={<LeftColumn />}
        center={<BinderWorkspace />}
        right={<SelectionPanel />}
        footer={<AppFooter />}
        {...(page ? { page } : {})}
      />
      <DialogHost />
    </CardDragLayer>
  )
}
