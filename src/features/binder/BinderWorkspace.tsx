import { useEffect } from 'react'
import { useBinderStore } from '../../store/binderStore'
import { useEditorStore } from '../../store/editorStore'
import { BinderEditor } from './BinderEditor'
import { BinderList } from './BinderList'

/** Centre column: the editor for the open binder, otherwise the list of binders. */
export function BinderWorkspace() {
  const binder = useBinderStore((state) => state.binder)
  const binderId = binder?.id
  const binderLang = binder?.lang

  // a freshly opened binder starts on its first page, searching in its own language
  useEffect(() => {
    useEditorStore.getState().reset(binderLang)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when another binder is opened
  }, [binderId])

  return binder ? <BinderEditor binder={binder} /> : <BinderList />
}
