import { useEffect, useState, type CSSProperties } from 'react'
import { de } from '../../i18n/de'
import { useIsPhone } from '../../lib/phone'
import { setIdOfCard } from '../../lib/tcgdex'
import { assetStore, useAssetUrl } from '../../store/assetStore'
import type { Binder, Page, Slot } from '../../types/binder'
import { countProgress, layoutDimensions } from '../binder/binderModel'
import { buildSpreads, clampSpread, pageNumbersOf, type Spread } from '../binder/spreads'
import { useCard } from '../binder/useCard'
import { useSetLogo } from '../binder/useSetLogo'
import { PlacedImageLayer } from '../images/PlacedImageLayer'
import { CardImage } from '../search/CardImage'
import { useReadyCatalog } from '../search/useCatalog'
import { loadSharedBinder, SharedNotFoundError } from './sharedBinder'
import { TradeMatchDialog } from './TradeMatchDialog'

type Loaded = { status: 'loading' } | { status: 'ready'; binder: Binder } | { status: 'gone' } | { status: 'offline' }

const squareClass =
  'flex size-10 items-center justify-center rounded-control border border-line bg-raised hover:border-accent disabled:cursor-not-allowed disabled:text-muted disabled:hover:border-line'

/** A pocket to look at: its card, grey if the collector does not have it yet. */
function SharedPocket({ slot }: { slot: Slot }) {
  const card = useCard(slot.cardRef?.cardId, slot.cardRef?.lang ?? 'de')
  const catalog = useReadyCatalog(slot.cardRef?.lang ?? 'de')

  if (!slot.cardRef) {
    return <div data-testid="shared-pocket" className="aspect-[63/88] w-full rounded-pocket border border-line/60" />
  }
  return (
    <div data-testid="shared-pocket" data-card-id={slot.cardRef.cardId} data-owned={slot.owned}>
      {card ? (
        <CardImage card={card} set={catalog?.setsById.get(setIdOfCard(card))} size="large" missing={!slot.owned} />
      ) : (
        <div className="flex aspect-[63/88] w-full items-center justify-center rounded-pocket bg-raised p-1 text-center text-[0.65rem] text-muted">
          {card === null ? de.binder.unknownCard : ''}
        </div>
      )}
    </div>
  )
}

function SharedPage({ binder, page }: { binder: Binder; page: Page }) {
  const { cols } = layoutDimensions(binder.layout)

  return (
    <section className="flex min-w-0 flex-1 flex-col" aria-label={de.binder.page(page.index + 1)}>
      <div className="flex-1 rounded-control border border-line bg-raised/60 p-[calc(var(--u)*12)]">
        <div className="relative">
          <PlacedImageLayer binder={binder} pageIndex={page.index} />
          <div
            className="relative grid gap-[calc(var(--u)*8)]"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          >
            {page.slots.map((slot) => (
              <SharedPocket key={slot.index} slot={slot} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function SharedCover({ binder }: { binder: Binder }) {
  const imageUrl = useAssetUrl(binder.cover.assetId)
  const logoUrl = useSetLogo(binder)

  return (
    <div className="relative flex min-w-0 flex-1 items-center justify-center overflow-hidden rounded-control border border-dashed border-line">
      {imageUrl ? (
        <img src={imageUrl} alt="" className="absolute inset-0 size-full object-cover" />
      ) : logoUrl ? (
        <img src={logoUrl} alt="" className="max-h-[35%] w-3/4 object-contain" />
      ) : (
        <span className="px-3 text-center text-lg font-semibold text-muted">{binder.cover.title}</span>
      )}
    </div>
  )
}

function SharedSpread({ binder, spread, zoom }: { binder: Binder; spread: Spread; zoom: number }) {
  function side(content: Spread['left']) {
    if (content === 'cover') return <SharedCover binder={binder} />
    const page = content === null ? undefined : binder.pages[content]
    return page ? <SharedPage binder={binder} page={page} /> : <div className="min-w-0 flex-1" />
  }

  return (
    <div
      data-testid="shared-spread"
      className="mx-auto flex shrink-0 gap-[calc(var(--u)*10)] rounded-panel border border-line bg-panel p-[calc(var(--u)*14)] shadow-lg"
      style={{ width: `${((spread.single ? 500 : 980) * zoom) / 100}px`, '--u': `${zoom / 100}px` } as CSSProperties}
    >
      {!spread.single && side(spread.left)}
      {side(spread.right)}
    </div>
  )
}

/**
 * A binder somebody shared by link: to leaf through and look at, nothing in it can be
 * changed. Its pictures are held for the time it is shown and never stored on this device.
 */
export function SharedBinderPage({ token }: { token: string }) {
  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' })
  const [spreadIndex, setSpreadIndex] = useState(0)
  const [matching, setMatching] = useState(false)
  const phone = useIsPhone()

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const shared = await loadSharedBinder(token)
        // after the library of this device is read, which would put it in place of them
        await assetStore
          .getState()
          .load()
          .catch(() => undefined)
        if (cancelled) return
        const ids = new Set(shared.assets.map((asset) => asset.id))
        assetStore.setState((state) => ({
          assets: [...state.assets.filter((asset) => !ids.has(asset.id)), ...shared.assets],
        }))
        setLoaded({ status: 'ready', binder: shared.binder })
      } catch (error) {
        if (!cancelled) setLoaded({ status: error instanceof SharedNotFoundError ? 'gone' : 'offline' })
      }
    })()
    return () => {
      cancelled = true
      // the pictures of somebody else's binder do not belong into this device's library
      void assetStore
        .getState()
        .load()
        .catch(() => undefined)
    }
  }, [token])

  if (loaded.status !== 'ready') {
    return (
      <section className="mx-auto max-w-3xl p-5 max-md:p-3">
        <h2 className="text-2xl font-semibold">{de.share.viewTitle}</h2>
        <p role={loaded.status === 'loading' ? 'status' : 'alert'} className="mt-3 text-sm text-muted">
          {de.share.view[loaded.status]}
        </p>
      </section>
    )
  }

  const { binder } = loaded
  const spreads = buildSpreads(binder.pages.length, phone)
  const current = clampSpread(spreadIndex, spreads.length)
  const spread = spreads[current]
  const progress = countProgress(binder)

  return (
    <section className="mx-auto flex min-h-full max-w-[110rem] flex-col gap-4 p-5 max-md:gap-3 max-md:p-3">
      <div>
        <p className="inline-block rounded-full border border-line px-3 py-1 text-xs font-medium tracking-widest text-muted uppercase">
          {de.share.badge}
        </p>
        <h2 className="mt-3 truncate text-2xl font-semibold" title={binder.name}>
          {binder.name}
        </h2>
        {progress.total > 0 && (
          <p data-testid="shared-progress" className="mt-1 text-sm text-muted">
            {de.binderList.ownedOfAll(progress.owned, progress.total)}
          </p>
        )}
        <button
          type="button"
          title={de.trade.matchButtonHint}
          onClick={() => setMatching(true)}
          className="mt-3 h-10 rounded-control border border-line bg-raised px-4 text-sm hover:border-accent"
        >
          {de.trade.matchButton}
        </button>
      </div>
      {matching && <TradeMatchDialog shared={binder} onClose={() => setMatching(false)} />}
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          aria-label={de.binder.previous}
          disabled={current === 0}
          onClick={() => setSpreadIndex(current - 1)}
          className={squareClass}
        >
          <span aria-hidden="true">‹</span>
        </button>
        <span data-testid="shared-spread-label" className="min-w-28 text-center text-sm">
          {spread ? de.binder.spreadLabel(pageNumbersOf(spread)) : ''}
        </span>
        <button
          type="button"
          aria-label={de.binder.next}
          disabled={current >= spreads.length - 1}
          onClick={() => setSpreadIndex(current + 1)}
          className={squareClass}
        >
          <span aria-hidden="true">›</span>
        </button>
      </div>
      <div className="overflow-x-auto pb-2">{spread && <SharedSpread binder={binder} spread={spread} zoom={phone ? 68 : 80} />}</div>
    </section>
  )
}
