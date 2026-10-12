import { useState, type FormEvent } from 'react'
import { de } from '../../i18n/de'
import {
  LAYOUTS,
  OPENING_SIDES,
  type Binder,
  type BinderMode,
  type Layout,
  type OpeningSide,
} from '../../types/binder'
import { buildMasterSet, createMasterSetBinder } from '../masterset/masterSet'
import { MasterSetOptions, type MasterSetChoice } from '../masterset/MasterSetOptions'
import { useCatalog } from '../search/useCatalog'
import { createBinder } from './binderModel'

interface NewBinderDialogProps {
  onCreate: (binder: Binder) => void
  onCancel: () => void
}

const choiceClass =
  'flex h-10 flex-1 cursor-pointer items-center justify-center rounded-control border border-line bg-raised text-center text-sm whitespace-nowrap has-checked:border-accent has-checked:bg-accent has-checked:text-white'

const KINDS: readonly BinderMode[] = ['empty', 'masterSet']

/**
 * Assistant for a new binder: empty, or a master set that fills itself with every card
 * of a set.
 */
export function NewBinderDialog({ onCreate, onCancel }: NewBinderDialogProps) {
  const [kind, setKind] = useState<BinderMode>('empty')
  const [name, setName] = useState('')
  const [layout, setLayout] = useState<Layout>('3x3')
  const [openingSide, setOpeningSide] = useState<OpeningSide>('right')
  const [masterSet, setMasterSet] = useState<MasterSetChoice>()
  const catalog = useCatalog()

  const trimmedName = name.trim()
  // a master set may simply be named after its set
  const binderName = trimmedName || (kind === 'masterSet' ? (masterSet?.setName ?? '') : '')
  const ready = binderName !== '' && (kind === 'empty' || masterSet?.source !== undefined)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!ready) return
    const common = { name: binderName, layout, defaultOpeningSide: openingSide }
    if (kind === 'empty') {
      onCreate(createBinder(common))
    } else if (masterSet?.source) {
      onCreate(
        createMasterSetBinder(
          { ...common, setId: masterSet.setId, options: masterSet.options },
          buildMasterSet(masterSet.source, masterSet.options),
        ),
      )
    }
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
        aria-labelledby="new-binder-title"
        onSubmit={handleSubmit}
        className="max-h-full w-full max-w-md space-y-5 overflow-y-auto rounded-panel border border-line bg-panel p-6 shadow-lg"
      >
        <h2 id="new-binder-title" className="text-xl font-semibold">
          {de.newBinder.title}
        </h2>

        <fieldset className="text-sm">
          <legend className="sr-only">{de.masterSet.kind}</legend>
          <div className="flex gap-2">
            {KINDS.map((option) => (
              <label key={option} className={choiceClass}>
                <input
                  type="radio"
                  name="kind"
                  value={option}
                  checked={kind === option}
                  onChange={() => setKind(option)}
                  className="sr-only"
                />
                {option === 'empty' ? de.masterSet.empty : de.masterSet.masterSet}
              </label>
            ))}
          </div>
        </fieldset>

        {kind === 'masterSet' && (
          <MasterSetOptions
            catalog={catalog.status === 'ready' ? catalog.data : undefined}
            catalogUnavailableText={
              catalog.status === 'ready'
                ? undefined
                : catalog.status === 'loading'
                  ? de.search.setsLoading
                  : de.search.setsError
            }
            layout={layout}
            onChange={setMasterSet}
          />
        )}

        <label className="block space-y-2 text-sm">
          <span>{de.newBinder.name}</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={
              kind === 'masterSet' && masterSet ? masterSet.setName : de.newBinder.namePlaceholder
            }
            required={kind === 'empty'}
            autoFocus
            className="h-10 w-full rounded-control border border-line bg-raised px-3 placeholder:text-muted focus:border-accent focus:outline-none"
          />
        </label>

        <fieldset className="space-y-2 text-sm">
          <legend className="mb-2">{de.newBinder.layout}</legend>
          <div className="flex gap-2">
            {LAYOUTS.map((option) => (
              <label key={option} className={choiceClass}>
                <input
                  type="radio"
                  name="layout"
                  value={option}
                  checked={layout === option}
                  onChange={() => setLayout(option)}
                  className="sr-only"
                />
                {de.layouts[option]}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-2 text-sm">
          <legend className="mb-2">{de.newBinder.openingSide}</legend>
          <div className="flex gap-2">
            {OPENING_SIDES.map((option) => (
              <label key={option} className={choiceClass}>
                <input
                  type="radio"
                  name="openingSide"
                  value={option}
                  checked={openingSide === option}
                  onChange={() => setOpeningSide(option)}
                  className="sr-only"
                />
                {de.openingSides[option]}
              </label>
            ))}
          </div>
          {openingSide === 'mixed' && <p className="text-xs text-muted">{de.openingMixedHint}</p>}
        </fieldset>

        <div className="flex justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="h-10 rounded-control border border-line bg-raised px-4 text-sm hover:border-accent"
          >
            {de.newBinder.cancel}
          </button>
          <button
            type="submit"
            disabled={kind === 'masterSet' && !ready}
            className="h-10 rounded-control bg-accent px-4 text-sm font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {de.newBinder.create}
          </button>
        </div>
      </form>
    </div>
  )
}
