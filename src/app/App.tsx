import { BinderWorkspace } from '../features/binder/BinderWorkspace'
import { SearchPanel } from '../features/search/SearchPanel'
import { SelectionPanel } from '../features/binder/SelectionPanel'
import { AppFooter } from './AppFooter'
import { AppHeader } from './AppHeader'
import { AppLayout } from './AppLayout'

export function App() {
  return (
    <AppLayout
      header={<AppHeader />}
      left={<SearchPanel />}
      center={<BinderWorkspace />}
      right={<SelectionPanel />}
      footer={<AppFooter />}
    />
  )
}
