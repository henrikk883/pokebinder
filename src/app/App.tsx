import { useEffect } from 'react'
import { BinderWorkspace } from '../features/binder/BinderWorkspace'
import { CardDragLayer } from '../features/binder/CardDragLayer'
import { SelectionPanel } from '../features/binder/SelectionPanel'
import { LandingPage } from '../features/landing/LandingPage'
import { CardBrowser } from '../features/search/CardBrowser'
import { startSync } from '../features/sync/syncStore'
import { SearchPanel } from '../features/search/SearchPanel'
import { assetStore } from '../store/assetStore'
import { restoreLastBinder } from '../store/binderStore'
import { useEditorStore } from '../store/editorStore'
import { AppFooter } from './AppFooter'
import { AppHeader } from './AppHeader'
import { AppLayout } from './AppLayout'
import { DialogHost } from './DialogHost'

export function App() {
  const view = useEditorStore((state) => state.view)
  const page = view === 'home' ? <LandingPage /> : view === 'cards' ? <CardBrowser /> : undefined

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
        left={<SearchPanel />}
        center={<BinderWorkspace />}
        right={<SelectionPanel />}
        footer={<AppFooter />}
        {...(page ? { page } : {})}
      />
      <DialogHost />
    </CardDragLayer>
  )
}
