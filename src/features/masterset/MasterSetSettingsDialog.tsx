import { useEffect, useState, type FormEvent } from 'react'
import { de } from '../../i18n/de'
import { tcgdex, type CardDetail } from '../../lib/tcgdex'
import type { Binder } from '../../types/binder'
import { useCatalog } from '../search/useCatalog'
import { currentOptions, rebuildMasterSet, type MasterSetOptions as Options } from './masterSet'
import { MasterSetOptions, type MasterSetChoice } from './MasterSetOptions'

interface MasterSetSettingsDialogProps {
  binder: Binder
  setId: string
  onApply: (binder: Binder) => void
  onCancel: () => void
}

const buttonClass = 'h-10 rounded-control border border-line bg-raised px-4 text-sm hover:border-accent'

type Loaded = { status: 'loading' } | { status: 'ready'; cards: CardDetail[] } | { status: 'error' }

/** Change what an existing master set contains: holo variants, secret rares, promos. */
export function MasterSetSettingsDialog({ binder, setId, onApply, onCancel }: MasterSetSettingsDialogProps) {
  const catalog = useCatalog()
  const [details, setDetails] = useState<Loaded>({ status: 'loading' })
  const [choice, setChoice] = useState<MasterSetChoice>()

  // the options the binder has now can only be read once its set is known
  useEffect(() => {
    let cancelled = false
    tcgdex.getSetDetails(setId).then(
      (cards) => {
        if (!cancelled) setDetails({ status: 'ready', cards })
      },
      () => {
        if (!cancelled) setDetails({ status: 'error' })
      },
    )
    return () => {
      cancelled = true
    }
  }, [setId])

  const set = catalog.status === 'ready' ? catalog.data.setsById.get(setId) : undefined
  const initial: Options | undefined =
    details.status === 'ready' && set
      ? currentOptions(binder, {
          setId,
          cards: details.cards,
          officialCount: set.cardCount.official,
          promos: [],
          lang: tcgdex.lang,
        })
      : undefined
  const failed = details.status === 'error' || catalog.status === 'error' || (catalog.status === 'ready' && !set)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (choice?.source) onApply(rebuildMasterSet(binder, choice.source, choice.options))
  }

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 p-4"
      onKeyDown={(event) => {
        if (event.key === 'Escape') onCancel()
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="master-set-settings-title"
        onSubmit={handleSubmit}
        className="max-h-full w-full max-w-md space-y-5 overflow-y-auto rounded-panel border border-line bg-panel p-6 shadow-lg"
      >
        <h2 id="master-set-settings-title" className="text-xl font-semibold">
          {de.masterSet.adjust}
        </h2>
        {set && <p className="text-sm text-muted">{set.name}</p>}

        {failed && (
          <p role="alert" className="text-sm text-muted">
            {de.masterSet.loadFailed}
          </p>
        )}
        {!failed && !initial && (
          <p role="status" className="text-sm text-muted">
            {de.masterSet.loading}
          </p>
        )}
        {initial && catalog.status === 'ready' && (
          <MasterSetOptions
            catalog={catalog.data}
            catalogUnavailableText={undefined}
            layout={binder.layout}
            existing={{ setId, options: initial }}
            onChange={setChoice}
          />
        )}

        <p className="text-xs text-muted">
          {de.masterSet.adjustHint} {de.masterSet.adjustExtras}
        </p>

        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={onCancel} className={buttonClass}>
            {de.masterSet.cancel}
          </button>
          <button
            type="submit"
            disabled={!choice?.source}
            className="h-10 rounded-control bg-accent px-4 text-sm font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {de.masterSet.apply}
          </button>
        </div>
      </form>
    </div>
  )
}
