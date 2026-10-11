import { useState, type FormEvent } from 'react'
import { de } from '../../i18n/de'
import { LAYOUTS, OPENING_SIDES, type Layout, type OpeningSide } from '../../types/binder'
import type { NewBinderInput } from './binderModel'

interface NewBinderDialogProps {
  onCreate: (input: NewBinderInput) => void
  onCancel: () => void
}

const choiceClass =
  'flex h-10 flex-1 cursor-pointer items-center justify-center rounded-control border border-line bg-raised text-center text-sm whitespace-nowrap has-checked:border-accent has-checked:bg-accent has-checked:text-white'

export function NewBinderDialog({ onCreate, onCancel }: NewBinderDialogProps) {
  const [name, setName] = useState('')
  const [layout, setLayout] = useState<Layout>('3x3')
  const [openingSide, setOpeningSide] = useState<OpeningSide>('right')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (trimmed) onCreate({ name: trimmed, layout, defaultOpeningSide: openingSide })
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
        className="w-full max-w-md space-y-5 rounded-panel border border-line bg-panel p-6 shadow-lg"
      >
        <h2 id="new-binder-title" className="text-xl font-semibold">
          {de.newBinder.title}
        </h2>

        <label className="block space-y-2 text-sm">
          <span>{de.newBinder.name}</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={de.newBinder.namePlaceholder}
            required
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
            className="h-10 rounded-control bg-accent px-4 text-sm font-medium text-white hover:bg-accent-hover"
          >
            {de.newBinder.create}
          </button>
        </div>
      </form>
    </div>
  )
}
