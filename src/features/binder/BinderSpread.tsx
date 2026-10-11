import type { CSSProperties } from 'react'
import { de } from '../../i18n/de'
import type { Catalog } from '../../lib/tcgdex'
import { useBinderStore } from '../../store/binderStore'
import type { Binder, Page } from '../../types/binder'
import { layoutDimensions } from './binderModel'
import { Pocket } from './Pocket'
import type { Spread } from './spreads'

/** Width of the open binder at 100 % zoom. */
const BASE_WIDTH_PX = 980

const sideClass = 'flex min-w-0 flex-1 flex-col'
// Spacing inside the binder is given in --u (one pixel at 100 % zoom), so it scales with the zoom.
const sheetClass =
  'flex-1 rounded-control border border-line bg-raised/60 p-[calc(var(--u)*12)]'

function PageSide({ binder, page, catalog }: { binder: Binder; page: Page; catalog: Catalog | undefined }) {
  const removePage = useBinderStore((state) => state.removePage)
  const { cols } = layoutDimensions(binder.layout)
  const pageNumber = page.index + 1
  const hasCards = page.slots.some((slot) => slot.cardRef)

  return (
    <section className={sideClass} aria-label={de.binder.page(pageNumber)} data-testid="binder-page">
      <div className={sheetClass}>
        <div
          className="grid gap-[calc(var(--u)*8)]"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {page.slots.map((slot) => (
            <Pocket
              key={slot.index}
              pageId={page.id}
              pageNumber={pageNumber}
              slot={slot}
              openingSide={page.openingSide}
              catalog={catalog}
            />
          ))}
        </div>
      </div>
      <p className="mt-2 flex items-center justify-center gap-3 text-xs text-muted">
        <span>{de.binder.pageCaption(pageNumber, page.openingSide)}</span>
        <button
          type="button"
          aria-label={de.binder.deletePageLabel(pageNumber)}
          disabled={binder.pages.length <= 1}
          onClick={() => {
            if (!hasCards || window.confirm(de.binder.confirmDeletePage(pageNumber))) removePage(page.id)
          }}
          className="text-danger hover:underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline disabled:opacity-50"
        >
          {de.binder.deletePage}
        </button>
      </p>
    </section>
  )
}

function CoverInside({ title }: { title: string }) {
  return (
    <section className={sideClass} aria-label={de.binder.coverInside}>
      <div className={`${sheetClass} flex items-center justify-center border-dashed`}>
        <p className="px-4 text-center text-lg font-semibold text-muted">{title}</p>
      </div>
      <p className="mt-2 text-center text-xs text-muted">{de.binder.coverInside}</p>
    </section>
  )
}

function NoPage() {
  return (
    <section className={sideClass} aria-label={de.binder.noPage}>
      <div className={`${sheetClass} border-dashed opacity-40`} />
      <p className="mt-2 text-center text-xs text-muted">&nbsp;</p>
    </section>
  )
}

function Rings() {
  return (
    <div
      aria-hidden="true"
      className="flex w-[calc(var(--u)*26)] shrink-0 flex-col items-center justify-around py-[calc(var(--u)*60)]"
    >
      {[0, 1, 2, 3].map((ring) => (
        <span
          key={ring}
          className="h-[calc(var(--u)*16)] w-full rounded-full border-2 border-line bg-bg"
        />
      ))}
    </div>
  )
}

interface BinderSpreadProps {
  binder: Binder
  spread: Spread
  zoom: number
  catalog: Catalog | undefined
}

/** The open binder: two facing sides in a dark frame with the rings in between. */
export function BinderSpread({ binder, spread, zoom, catalog }: BinderSpreadProps) {
  function side(content: Spread['left']) {
    if (content === 'cover') return <CoverInside title={binder.cover.title} />
    const page = content === null ? undefined : binder.pages[content]
    return page ? <PageSide binder={binder} page={page} catalog={catalog} /> : <NoPage />
  }

  return (
    <div
      role="group"
      aria-label={de.binder.spread}
      data-testid="binder-spread"
      className="mx-auto flex shrink-0 gap-[calc(var(--u)*10)] rounded-panel border border-line bg-panel p-[calc(var(--u)*14)] shadow-lg"
      style={{ width: `${(BASE_WIDTH_PX * zoom) / 100}px`, '--u': `${zoom / 100}px` } as CSSProperties}
    >
      {side(spread.left)}
      <Rings />
      {side(spread.right)}
    </div>
  )
}
