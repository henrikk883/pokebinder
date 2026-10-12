import type { CSSProperties } from 'react'
import { de } from '../../i18n/de'
import { useBinderStore } from '../../store/binderStore'
import { confirmDialog } from '../../store/dialogStore'
import type { Binder, Page } from '../../types/binder'
import { useAssetUrl } from '../../store/assetStore'
import { imageAt } from '../images/imageModel'
import { PlacedImageLayer } from '../images/PlacedImageLayer'
import { layoutDimensions, pocketOpening } from './binderModel'
import { Pocket } from './Pocket'
import type { Spread } from './spreads'

/** Width of the open binder at 100 % zoom. */
const BASE_WIDTH_PX = 980

const sideClass = 'flex min-w-0 flex-1 flex-col'
// Spacing inside the binder is given in --u (one pixel at 100 % zoom), so it scales with the zoom.
const sheetClass =
  'flex-1 rounded-control border border-line bg-raised/60 p-[calc(var(--u)*12)]'

function PageSide({ binder, page }: { binder: Binder; page: Page }) {
  const removePage = useBinderStore((state) => state.removePage)
  const { cols } = layoutDimensions(binder.layout)
  const pageNumber = page.index + 1
  const hasCards = page.slots.some((slot) => slot.cardRef)

  return (
    <section
      className={sideClass}
      aria-label={de.binder.page(pageNumber)}
      data-testid="binder-page"
      data-export={`page-${pageNumber}`}
    >
      <div className={sheetClass}>
        <div className="relative">
          <PlacedImageLayer binder={binder} pageIndex={page.index} />
          <div
            className="relative grid gap-[calc(var(--u)*8)]"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          >
            {page.slots.map((slot) => {
              const assetId = imageAt(binder, page.index, slot.index)?.image.assetId
              return (
                <Pocket
                  key={slot.index}
                  pageId={page.id}
                  pageNumber={pageNumber}
                  slot={slot}
                  opening={pocketOpening(page.openingSide, page.index, slot.index, binder.layout)}
                  {...(assetId === undefined ? {} : { imageAssetId: assetId })}
                />
              )
            })}
          </div>
        </div>
      </div>
      <p className="mt-2 flex items-center justify-center gap-3 text-xs text-muted">
        <span>{de.binder.pageCaption(pageNumber, de.openingSides[page.openingSide])}</span>
        <button
          type="button"
          aria-label={de.binder.deletePageLabel(pageNumber)}
          data-export-hide
          disabled={binder.pages.length <= 1}
          onClick={async () => {
            // an empty page goes without a question
            const agreed =
              !hasCards ||
              (await confirmDialog({
                title: de.binder.deletePageTitle(pageNumber),
                text: de.binder.confirmDeletePage(pageNumber),
                confirmLabel: de.binder.deletePage,
                danger: true,
              }))
            if (agreed) removePage(page.id)
          }}
          className="text-danger hover:underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline disabled:opacity-50"
        >
          {de.binder.deletePage}
        </button>
      </p>
    </section>
  )
}

function CoverInside({ binder }: { binder: Binder }) {
  const imageUrl = useAssetUrl(binder.cover.assetId)

  return (
    <section className={sideClass} aria-label={de.binder.coverInside}>
      <div className={`${sheetClass} relative flex items-center justify-center overflow-hidden border-dashed`}>
        {imageUrl && (
          <img
            src={imageUrl}
            alt=""
            data-testid="cover-image"
            draggable={false}
            className="absolute inset-0 size-full object-cover"
          />
        )}
        <p
          className={`relative px-4 text-center text-lg font-semibold ${
            imageUrl ? 'rounded-control bg-bg/75 py-2 text-text' : 'text-muted'
          }`}
        >
          {binder.cover.title}
        </p>
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
}

/** The open binder: two facing sides in a dark frame with the rings in between. */
export function BinderSpread({ binder, spread, zoom }: BinderSpreadProps) {
  function side(content: Spread['left']) {
    if (content === 'cover') return <CoverInside binder={binder} />
    const page = content === null ? undefined : binder.pages[content]
    return page ? <PageSide binder={binder} page={page} /> : <NoPage />
  }

  return (
    <div
      role="group"
      aria-label={de.binder.spread}
      data-testid="binder-spread"
      data-export="spread"
      className="mx-auto flex shrink-0 gap-[calc(var(--u)*10)] rounded-panel border border-line bg-panel p-[calc(var(--u)*14)] shadow-lg"
      style={{ width: `${(BASE_WIDTH_PX * zoom) / 100}px`, '--u': `${zoom / 100}px` } as CSSProperties}
    >
      {side(spread.left)}
      <Rings />
      {side(spread.right)}
    </div>
  )
}
