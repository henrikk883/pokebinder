import { useState, type ReactNode } from 'react'
import { de } from '../../i18n/de'
import { cardImageAt, cardImageUrl } from '../../lib/tcgdex'
import { useBinderStore } from '../../store/binderStore'
import { useEditorStore } from '../../store/editorStore'

// What lies in the binder beside the headline: cards everybody knows, from the set "151".
// `null` is a pocket still waiting for its card.
const SHOWCASE_SET = { lang: 'de', seriesId: 'sv', setId: 'sv03.5' } as const
const SHOWCASE_PAGES: readonly (readonly (string | null)[])[] = [
  ['025', '133', '006', '003', '009', '150', '052', '094', '143'],
  ['001', '007', '016', '004', null, null, '131', '149', '054'],
]

function ShowcaseCard({ localId }: { localId: string | null }) {
  // without a connection the pocket simply stays empty
  const [failed, setFailed] = useState(false)
  const { lang, seriesId, setId } = SHOWCASE_SET

  return (
    <div className="aspect-[63/88] overflow-hidden rounded-pocket border border-line bg-bg">
      {localId !== null && !failed && (
        <img
          src={cardImageUrl(cardImageAt(lang, seriesId, setId, localId), 'small')}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
      )}
    </div>
  )
}

/** An open binder, drawn like the one in the editor; decoration only. */
function ShowcaseBinder() {
  return (
    <div
      aria-hidden="true"
      data-testid="landing-binder"
      className="flex w-full items-stretch gap-1.5 rounded-panel border border-line bg-panel p-3 shadow-2xl max-xl:mx-auto max-xl:max-w-2xl max-md:p-2"
    >
      {SHOWCASE_PAGES.map((cards, pageIndex) => (
        <div key={pageIndex} className="contents">
          {pageIndex > 0 && (
            <div className="flex flex-col justify-around py-6">
              {[0, 1, 2, 3].map((ring) => (
                <span key={ring} className="h-2.5 w-4 rounded-full border-2 border-line bg-bg max-md:w-2.5" />
              ))}
            </div>
          )}
          <div className="grid min-w-0 flex-1 grid-cols-3 gap-1.5 rounded-control border border-line bg-raised p-2 max-md:gap-1 max-md:p-1">
            {cards.map((localId, index) => (
              <ShowcaseCard key={index} localId={localId} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

const ICONS: Record<keyof typeof de.landing.features, ReactNode> = {
  masterSet: <path d="M4 5h12v14H4zM8 3h12v14" />,
  images: <path d="M3 5h18v14H3zM3 15l5-5 4 4 3-3 6 6" />,
  missing: <path d="M4 6h3v3H4zM4 13h3v3H4zM11 7.5h9M11 14.5h9M4.5 7.5l1 1 2-2.5" />,
  sync: <path d="M7 4v14m0 0-4-4m4 4 4-4M17 20V6m0 0-4 4m4-4 4 4" />,
}
const FEATURES = ['masterSet', 'images', 'missing', 'sync'] as const

/**
 * Where a visit begins: what the app is for, and the two ways into it. The header above
 * stays the same as everywhere; its logo leads back here.
 */
export function LandingPage() {
  const lastBinderName = useBinderStore((state) => state.binder?.name)
  const closeBinder = useBinderStore((state) => state.closeBinder)
  const showView = useEditorStore((state) => state.showView)

  return (
    <div className="bg-[radial-gradient(60rem_30rem_at_15%_0%,color-mix(in_srgb,var(--color-accent)_16%,transparent),transparent)]">
      <div className="mx-auto max-w-6xl px-5 py-12 max-md:px-3 max-md:py-6">
        <section className="grid items-center gap-10 xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
          <div>
            <p className="inline-block rounded-full border border-line px-3 py-1 text-xs font-medium tracking-widest text-muted uppercase">
              {de.landing.badge}
            </p>
            <h1 className="mt-5 text-5xl leading-tight font-bold tracking-tight max-md:text-4xl">
              {de.landing.headline.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </h1>
            <p className="mt-4 max-w-md text-lg text-muted">{de.landing.intro}</p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  // to the shelf, also when the binder of last time lies open
                  closeBinder()
                  showView('binders')
                }}
                className="rounded-panel bg-accent p-5 text-left text-white hover:bg-accent-hover"
              >
                <span className="block text-xl font-semibold">{de.header.myBinders}</span>
                <span className="mt-1 block text-sm opacity-90">{de.landing.bindersHint}</span>
              </button>
              <button
                type="button"
                onClick={() => showView('cards')}
                className="rounded-panel border border-line bg-raised p-5 text-left hover:border-accent"
              >
                <span className="block text-xl font-semibold">{de.header.cards}</span>
                <span className="mt-1 block text-sm text-muted">{de.landing.cardsHint}</span>
              </button>
            </div>
            {lastBinderName !== undefined && (
              <button
                type="button"
                onClick={() => showView('binders')}
                className="mt-4 max-w-full truncate text-sm text-accent-hover hover:underline"
              >
                {de.landing.continueWith(lastBinderName)}
              </button>
            )}
            <p className="mt-4 text-sm text-muted">{de.landing.note}</p>
          </div>
          <ShowcaseBinder />
        </section>

        <section className="mt-16 max-md:mt-10">
          <h2 className="text-center text-3xl font-semibold max-md:text-2xl">{de.landing.featuresTitle}</h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {FEATURES.map((feature) => (
              <li key={feature} className="rounded-panel border border-line bg-panel p-5">
                <svg
                  viewBox="0 0 24 24"
                  className="size-7 text-muted"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  {ICONS[feature]}
                </svg>
                <h3 className="mt-4 text-lg font-semibold">{de.landing.features[feature].title}</h3>
                <p className="mt-1 text-sm text-muted">{de.landing.features[feature].text}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
