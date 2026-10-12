import { useEffect, useState } from 'react'
import { de } from '../../i18n/de'
import { isPhone } from '../../lib/phone'
import { mapWithConcurrency, tcgdexFor } from '../../lib/tcgdex'
import { useDismiss } from '../../lib/useDismiss'
import { useEditorStore } from '../../store/editorStore'
import type { Binder } from '../../types/binder'
import { findCards, placedRefs, type FindEntry } from './cardFinder'
import { spreadOfPage } from './spreads'

/** Names and numbers of the cards of a binder; one lookup per set, kept by the app. */
async function loadEntries(binder: Binder): Promise<FindEntry[]> {
  const found = await mapWithConcurrency(placedRefs(binder), 8, async (placed): Promise<FindEntry[]> => {
    const card = await tcgdexFor(placed.cardRef.lang)
      .getCard(placed.cardRef.cardId)
      .catch(() => undefined)
    return card ? [{ ...placed, name: card.name, localId: card.localId }] : []
  })
  return found.flat()
}

/**
 * "Karte finden": a field to type a name or number into, and the places in the binder
 * where such a card lies. Choosing one turns the binder to its page and selects its pocket.
 */
export function BinderFind({ binder, buttonClass }: { binder: Binder; buttonClass: string }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [entries, setEntries] = useState<{ binder: Binder; found: FindEntry[] }>()
  const box = useDismiss<HTMLDivElement>(open, () => setOpen(false))

  // the cards are looked up when the search is opened, and again after the binder changed
  useEffect(() => {
    if (!open || entries?.binder === binder) return
    let cancelled = false
    loadEntries(binder).then((found) => {
      if (!cancelled) setEntries({ binder, found })
    })
    return () => {
      cancelled = true
    }
  }, [open, binder, entries])

  const ready = entries?.binder === binder
  const hits = ready ? findCards(entries.found, query) : []

  function go(entry: FindEntry) {
    const editor = useEditorStore.getState()
    editor.showSpread(spreadOfPage(entry.pageIndex, isPhone()))
    // after the page is turned to, which lets go of the selection
    editor.select(entry.position)
    editor.showPane('binder')
    setOpen(false)
  }

  return (
    <div
      ref={box}
      className="relative"
      onKeyDown={(event) => {
        if (event.key === 'Escape') setOpen(false)
      }}
    >
      <button
        type="button"
        aria-label={de.find.button}
        title={de.find.button}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={buttonClass}
      >
        <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <circle cx="8.5" cy="8.5" r="5" />
          <path d="m12.5 12.5 4 4" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={de.find.button}
          className="absolute top-full left-0 z-20 mt-2 w-80 rounded-panel border border-line bg-panel p-2 shadow-lg max-md:fixed max-md:inset-x-2 max-md:top-auto max-md:bottom-20 max-md:z-40 max-md:mt-0 max-md:w-auto"
        >
          <input
            type="search"
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              const [first] = hits
              if (event.key === 'Enter' && first) go(first)
            }}
            placeholder={de.find.placeholder}
            aria-label={de.find.placeholder}
            className="h-10 w-full rounded-control border border-line bg-raised px-3 text-sm placeholder:text-muted focus:border-accent focus:outline-none"
          />
          {query.trim() !== '' && (
            <div className="mt-2 max-h-72 overflow-y-auto max-md:max-h-[40vh]">
              {!ready && (
                <p role="status" className="px-2 py-1 text-sm text-muted">
                  {de.find.loading}
                </p>
              )}
              {ready && hits.length === 0 && <p className="px-2 py-1 text-sm text-muted">{de.find.none}</p>}
              <ul>
                {hits.map((entry) => (
                  <li key={`${entry.position.pageId}:${entry.slotIndex}`}>
                    <button
                      type="button"
                      data-testid="find-hit"
                      onClick={() => go(entry)}
                      className="flex w-full items-baseline justify-between gap-3 rounded-control px-2 py-1.5 text-left text-sm hover:bg-raised"
                    >
                      <span className="min-w-0 truncate">
                        {entry.name} <span className="text-muted">· {entry.localId}</span>
                      </span>
                      <span className="shrink-0 text-xs text-muted">
                        {de.find.place(entry.pageIndex + 1, entry.slotIndex + 1)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
