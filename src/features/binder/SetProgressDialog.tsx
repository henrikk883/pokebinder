import { useEffect, useState } from 'react'
import { de } from '../../i18n/de'
import { setIdOfCardId, tcgdexFor, type Catalog } from '../../lib/tcgdex'
import type { Binder, CardLang } from '../../types/binder'
import { cardLangs } from './binderModel'
import { progressBySet } from './setProgress'

interface SetProgressDialogProps {
  binder: Binder
  onClose: () => void
}

type Catalogs = Partial<Record<CardLang, Catalog>>

/**
 * How far each set in the binder is collected. Worth a look in binders that mix sets; for
 * a binder of one set it says the same as the bar under the binder.
 */
export function SetProgressDialog({ binder, onClose }: SetProgressDialogProps) {
  const [catalogs, setCatalogs] = useState<Catalogs>()
  const langs = cardLangs(binder)
  const langKey = langs.join(',')

  useEffect(() => {
    let cancelled = false
    // set names come from the catalog of each language the binder has cards of
    Promise.all(
      langs.map(async (lang) => {
        const catalog = await tcgdexFor(lang)
          .getCatalog()
          .catch(() => undefined)
        return [lang, catalog] as const
      }),
    ).then((loaded) => {
      if (cancelled) return
      const next: Catalogs = {}
      for (const [lang, catalog] of loaded) if (catalog) next[lang] = catalog
      setCatalogs(next)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `langs` is a new array on every render; its content is in `langKey`
  }, [langKey])

  const rows = catalogs
    ? progressBySet(binder, (cardId, lang) => {
        const sets = catalogs[lang]?.setsById
        const set = sets?.get(setIdOfCardId(cardId, sets) ?? '')
        return set ? { id: set.id, name: set.name } : undefined
      })
    : []
  const severalLangs = new Set(rows.map((row) => row.lang)).size > 1

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="set-progress-title"
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-full w-full max-w-xl flex-col gap-4 rounded-panel border border-line bg-panel p-6 text-left shadow-lg"
      >
        <div>
          <h2 id="set-progress-title" className="text-xl font-semibold text-text">
            {de.setProgress.title}
          </h2>
          <p className="mt-1 text-sm text-muted">{de.setProgress.hint}</p>
        </div>

        {!catalogs && (
          <p role="status" className="text-sm text-muted">
            {de.search.loading}
          </p>
        )}
        {catalogs && rows.length === 0 && <p className="text-sm text-muted">{de.setProgress.empty}</p>}

        <ul className="min-h-0 space-y-3 overflow-y-auto">
          {rows.map((row) => (
            <li key={row.key} data-testid="set-progress" data-set-id={row.setId} className="space-y-1.5 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate font-medium text-text">
                  {row.name || de.setProgress.unknownSet}
                  {severalLangs && <span className="ml-2 text-xs font-normal text-muted">{de.languageCodes[row.lang]}</span>}
                </span>
                <span className="shrink-0 text-muted">
                  <span className="text-text">{de.setProgress.count(row.owned, row.total)}</span>
                  {row.missing > 0 && ` · ${de.progress.missing(row.missing)}`}
                </span>
              </div>
              <div
                role="progressbar"
                aria-label={de.setProgress.bar(row.name || de.setProgress.unknownSet)}
                aria-valuemin={0}
                aria-valuemax={row.total}
                aria-valuenow={row.owned}
                className="h-2 overflow-hidden rounded-full bg-raised"
              >
                <div className="h-full rounded-full bg-accent" style={{ width: `${(row.owned / row.total) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>

        <div className="flex justify-end">
          <button
            type="button"
            autoFocus
            onClick={onClose}
            className="h-10 rounded-control border border-line bg-raised px-4 text-sm hover:border-accent"
          >
            {de.cardInfo.close}
          </button>
        </div>
      </div>
    </div>
  )
}
