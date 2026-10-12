import { useEffect, useRef } from 'react'
import { de } from '../../i18n/de'
import { useEditorStore } from '../../store/editorStore'
import type { Binder } from '../../types/binder'
import { layoutDimensions } from './binderModel'
import { pageNumbersOf, type Spread } from './spreads'

function MiniSide({ binder, content }: { binder: Binder; content: Spread['left'] }) {
  const { cols } = layoutDimensions(binder.layout)
  const page = typeof content === 'number' ? binder.pages[content] : undefined

  if (!page) {
    return <span className={`block h-full flex-1 rounded-sm ${content === 'cover' ? 'bg-line' : ''}`} />
  }
  return (
    <span
      className="grid h-full flex-1 gap-px"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {page.slots.map((slot) => (
        <span
          key={slot.index}
          className={`rounded-[1px] ${slot.cardRef ? 'bg-muted' : 'bg-line'}`}
        />
      ))}
    </span>
  )
}

interface ThumbnailStripProps {
  binder: Binder
  spreads: Spread[]
  current: number
}

/** All spreads in miniature, for jumping straight to one. */
export function ThumbnailStrip({ binder, spreads, current }: ThumbnailStripProps) {
  const showSpread = useEditorStore((state) => state.showSpread)
  const currentThumbnail = useRef<HTMLButtonElement>(null)

  // a master set has dozens of spreads; keep the open one in view
  useEffect(() => {
    currentThumbnail.current?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [current, spreads.length])

  return (
    <nav aria-label={de.binder.thumbnails} className="shrink-0 overflow-x-auto py-1">
      {/* centred while it fits, scrollable from the first thumbnail when it does not */}
      <div className="mx-auto flex w-max gap-3">
      {spreads.map((spread) => {
        const label = de.binder.thumbnailLabel(pageNumbersOf(spread))
        const active = spread.index === current
        return (
          <button
            key={spread.index}
            ref={active ? currentThumbnail : undefined}
            type="button"
            aria-label={de.binder.spreadLabel(pageNumbersOf(spread))}
            aria-current={active ? 'page' : undefined}
            onClick={() => showSpread(spread.index)}
            className="flex shrink-0 flex-col items-center gap-1"
          >
            <span
              className={`flex h-14 w-22 gap-1 rounded-control border-2 bg-panel p-1 ${
                active ? 'border-accent' : 'border-line hover:border-muted'
              }`}
            >
              <MiniSide binder={binder} content={spread.left} />
              <MiniSide binder={binder} content={spread.right} />
            </span>
            <span className={`text-xs ${active ? 'text-accent-hover' : 'text-muted'}`}>{label}</span>
          </button>
        )
      })}
      </div>
    </nav>
  )
}
