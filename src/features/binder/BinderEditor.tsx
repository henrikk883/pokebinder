import { useEffect } from 'react'
import { binderStore } from '../../store/binderStore'
import { useEditorStore } from '../../store/editorStore'
import type { Binder } from '../../types/binder'
import { BinderSpread } from './BinderSpread'
import { BinderToolbar } from './BinderToolbar'
import { PageControls } from './PageControls'
import { ProgressBar } from './ProgressBar'
import { buildSpreads, clampSpread } from './spreads'
import { ThumbnailStrip } from './ThumbnailStrip'

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.closest('input, textarea, select') !== null
}

/** Arrow keys turn the pages, Delete empties the selected pocket. */
function useEditorKeys(spreadCount: number) {
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (isTyping(event.target) || event.ctrlKey || event.metaKey || event.altKey) return
      const editor = useEditorStore.getState()
      const current = clampSpread(editor.spreadIndex, spreadCount)
      if (event.key === 'ArrowLeft') editor.showSpread(clampSpread(current - 1, spreadCount))
      else if (event.key === 'ArrowRight') editor.showSpread(clampSpread(current + 1, spreadCount))
      else if (event.key === 'Delete' && editor.selection) {
        binderStore.getState().clearSlot(editor.selection)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [spreadCount])
}

export function BinderEditor({ binder }: { binder: Binder }) {
  const zoom = useEditorStore((state) => state.zoom)
  const spreadIndex = useEditorStore((state) => state.spreadIndex)
  const notice = useEditorStore((state) => state.notice)

  const spreads = buildSpreads(binder.pages.length)
  const current = clampSpread(spreadIndex, spreads.length)
  const spread = spreads[current]
  useEditorKeys(spreads.length)

  if (!spread) return null

  return (
    <section className="flex h-full flex-col gap-4 p-5">
      <BinderToolbar binder={binder} spread={spread} />
      <PageControls spread={spread} spreadCount={spreads.length} />
      {notice && (
        <p role="alert" className="rounded-control border border-line bg-raised px-3 py-2 text-sm">
          {notice}
        </p>
      )}
      <div className="min-h-0 flex-1 overflow-auto">
        <BinderSpread binder={binder} spread={spread} zoom={zoom} />
      </div>
      <ThumbnailStrip binder={binder} spreads={spreads} current={current} />
      <ProgressBar binder={binder} />
    </section>
  )
}
