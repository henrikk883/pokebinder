import { de } from '../../i18n/de'
import { useBinderStore } from '../../store/binderStore'
import { useEditorStore } from '../../store/editorStore'
import { clampSpread } from '../binder/spreads'
import { tapTarget } from '../binder/tapPlacement'

/**
 * On a phone, under the cards of the search: where a tapped card will go, and where the
 * last one went. The binder is not in view there, so this is how the collector knows.
 */
export function TapHint() {
  const binder = useBinderStore((state) => state.binder)
  const selection = useEditorStore((state) => state.selection)
  const spreadIndex = useEditorStore((state) => state.spreadIndex)
  const tapped = useEditorStore((state) => state.tapped)
  if (!binder) return null
  const target = tapTarget(binder, selection, clampSpread(spreadIndex, binder.pages.length))

  return (
    <div
      data-testid="tap-hint"
      className="sticky bottom-0 shrink-0 space-y-0.5 border-t border-line bg-panel px-4 py-2 text-xs md:hidden"
    >
      {tapped?.kind === 'placed' && (
        <p role="status" className="text-text">
          {de.tap.placed(tapped.name, tapped.page, tapped.pocket)}
        </p>
      )}
      <p className="text-muted">{target ? de.tap.next(target.page, target.pocket) : de.tap.full}</p>
    </div>
  )
}
