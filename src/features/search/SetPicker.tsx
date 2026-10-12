import { useState } from 'react'
import { de } from '../../i18n/de'
import { setLogoUrl, type Catalog, type SetSummary } from '../../lib/tcgdex'
import { useDismiss } from '../../lib/useDismiss'

interface SetPickerProps {
  catalog: Catalog | undefined
  /** Shown instead of the list while the sets cannot be offered. */
  unavailableText: string | undefined
  value: string | undefined
  onChange: (setId: string | undefined) => void
}

const rowClass =
  'flex w-full items-center gap-3 rounded-control px-2 py-1.5 text-left text-sm hover:bg-raised'

const LOGO_FORMATS = ['webp', 'png'] as const

/** Not every logo exists in every format; shows nothing when none can be loaded. */
function SetLogo({ logo }: { logo: string }) {
  const [attempt, setAttempt] = useState(0)
  const format = LOGO_FORMATS[attempt]
  if (!format) return null

  return (
    <img
      src={setLogoUrl(logo, format)}
      alt=""
      loading="lazy"
      onError={() => setAttempt(attempt + 1)}
      className="max-h-full max-w-full object-contain"
    />
  )
}

function SetRow({ set, selected, onSelect }: { set: SetSummary; selected: boolean; onSelect: () => void }) {
  return (
    <li>
      <button
        type="button"
        role="option"
        aria-selected={selected}
        onClick={onSelect}
        className={`${rowClass} ${selected ? 'bg-raised text-accent-hover' : ''}`}
      >
        <span className="flex h-6 w-14 shrink-0 items-center justify-center">
          {set.logo && <SetLogo logo={set.logo} />}
        </span>
        <span className="min-w-0 flex-1 truncate">{set.name}</span>
        <span className="shrink-0 text-xs text-muted">{set.cardCount.total}</span>
      </button>
    </li>
  )
}

/** Set selection grouped by series, with logo and card count. */
export function SetPicker({ catalog, unavailableText, value, onChange }: SetPickerProps) {
  const [open, setOpen] = useState(false)
  const menu = useDismiss<HTMLDivElement>(open, () => setOpen(false))
  const [filter, setFilter] = useState('')

  const selected = value ? catalog?.setsById.get(value) : undefined
  const needle = filter.trim().toLowerCase()
  const groups = (catalog?.series ?? [])
    .map((series) => ({
      ...series,
      sets: needle
        ? series.sets.filter(
            (set) => set.name.toLowerCase().includes(needle) || set.id.toLowerCase() === needle,
          )
        : series.sets,
    }))
    .filter((series) => series.sets.length > 0)

  function select(setId: string | undefined) {
    onChange(setId)
    setOpen(false)
    setFilter('')
  }

  return (
    <div
      ref={menu}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setOpen(false)
      }}
    >
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={de.search.setFilter}
        onClick={() => setOpen((isOpen) => !isOpen)}
        className={`flex h-10 w-full items-center justify-between gap-2 rounded-control border bg-raised px-3 text-sm ${open ? 'border-accent' : 'border-line'}`}
      >
        <span className="truncate">{selected ? selected.name : de.search.allSets}</span>
        <svg viewBox="0 0 20 20" className="size-4 shrink-0 text-muted" aria-hidden="true">
          <path d="m5 8 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>

      {open && (
        <div className="mt-2 rounded-panel border border-line bg-bg p-2">
          {unavailableText !== undefined ? (
            <p className="px-2 py-1.5 text-sm text-muted">{unavailableText}</p>
          ) : (
            <>
              <input
                type="search"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder={de.search.findSet}
                aria-label={de.search.findSet}
                autoFocus
                className="mb-2 h-9 w-full rounded-control border border-line bg-raised px-3 text-sm placeholder:text-muted focus:border-accent focus:outline-none"
              />
              <div role="listbox" aria-label={de.search.setFilter} className="max-h-96 overflow-y-auto">
                {!needle && (
                  <button
                    type="button"
                    role="option"
                    aria-selected={value === undefined}
                    onClick={() => select(undefined)}
                    className={`${rowClass} ${value === undefined ? 'bg-raised text-accent-hover' : ''}`}
                  >
                    {de.search.allSets}
                  </button>
                )}
                {groups.map((series) => (
                  <section key={series.id} aria-label={series.name}>
                    <h3 className="px-2 pt-3 pb-1 text-xs font-semibold tracking-wide text-muted uppercase">
                      {series.name}
                    </h3>
                    <ul>
                      {series.sets.map((set) => (
                        <SetRow
                          key={set.id}
                          set={set}
                          selected={set.id === value}
                          onSelect={() => select(set.id)}
                        />
                      ))}
                    </ul>
                  </section>
                ))}
                {groups.length === 0 && (
                  <p className="px-2 py-1.5 text-sm text-muted">{de.search.noSets}</p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
