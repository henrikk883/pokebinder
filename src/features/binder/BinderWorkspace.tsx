import { useEffect } from 'react'
import { useBinderStore } from '../../store/binderStore'
import { useEditorStore } from '../../store/editorStore'
import { BinderEditor } from './BinderEditor'
import { BinderList } from './BinderList'

/** Centre column: the editor for the open binder, otherwise the list of binders. */
export function BinderWorkspace() {
  const binder = useBinderStore((state) => state.binder)
  const binderId = binder?.id

  useEffect(() => {
    useEditorStore.getState().reset()
  }, [binderId])

  return binder ? <BinderEditor binder={binder} /> : <BinderList />
}
