import { useState, type FormEvent } from 'react'
import { de } from '../../i18n/de'
import { useEditorStore } from '../../store/editorStore'
import type { Binder, CardLang } from '../../types/binder'
import { LanguageSelect } from '../search/LanguageSelect'
import { parseCardmarketWants } from './cardmarketWants'
import { binderFromCards, type ResolvedEntry } from './importList'
import { importedCards, resolveWants } from './importTransfer'

interface ImportListDialogProps {
  onCancel: () => void
  onCreate: (binder: Binder) => void
}

type Check =
  | { status: 'idle' }
  | { status: 'working' }
  | { status: 'done'; text: string; lang: CardLang; resolved: ResolvedEntry[] }
  | { status: 'error' }

const buttonClass = 'h-10 rounded-control border border-line bg-raised px-4 text-sm hover:border-accent'
const primaryClass =
  'h-10 rounded-control bg-accent px-4 text-sm font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60'
const fieldClass =
  'w-full rounded-control border border-line bg-raised px-3 text-sm placeholder:text-muted focus:border-accent focus:outline-none'

/**
 * "Liste importieren": a wants list copied out of Cardmarket becomes a new binder. The
 * list is checked first – which entries the app found a card for, and which not and why –
 * and only then is the binder made, with the cards in the order of the list, as missing.
 */
export function ImportListDialog({ onCancel, onCreate }: ImportListDialogProps) {
  const [text, setText] = useState('')
  const [name, setName] = useState<string>(de.importList.defaultName)
  const [lang, setLang] = useState<CardLang>(useEditorStore.getState().searchLang)
  const [check, setCheck] = useState<Check>({ status: 'idle' })
  const [creating, setCreating] = useState(false)

  // a check is of the text and the language it was made with
  const current = check.status === 'done' && check.text === text && check.lang === lang ? check.resolved : undefined
  const found = current?.filter((entry) => 'card' in entry) ?? []
  const problems = current?.flatMap((entry) => ('problem' in entry ? [entry] : [])) ?? []

  async function handleCheck() {
    setCheck({ status: 'working' })
    try {
      const resolved = await resolveWants(parseCardmarketWants(text), lang)
      setCheck({ status: 'done', text, lang, resolved })
    } catch {
      setCheck({ status: 'error' })
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!current || found.length === 0) return
    setCreating(true)
    try {
      const cards = await importedCards(current, lang)
      onCreate(binderFromCards({ name: name.trim() || de.importList.defaultName, layout: '3x3', lang }, cards))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onKeyDown={(event) => {
        if (event.key === 'Escape') onCancel()
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-list-title"
        onSubmit={handleSubmit}
        className="flex max-h-full w-full max-w-2xl flex-col gap-4 overflow-y-auto rounded-panel border border-line bg-panel p-6 shadow-lg"
      >
        <h2 id="import-list-title" className="text-xl font-semibold">
          {de.importList.title}
        </h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
          {de.importList.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>

        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          aria-label={de.importList.list}
          placeholder={de.importList.placeholder}
          rows={7}
          autoFocus
          className={`${fieldClass} resize-y py-2 font-mono text-xs`}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span>{de.importList.name}</span>
            <input value={name} onChange={(event) => setName(event.target.value)} className={`${fieldClass} h-10`} />
          </label>
          <div className="space-y-1 text-sm">
            <span>{de.importList.language}</span>
            <LanguageSelect label={de.importList.language} value={lang} onChange={setLang} />
          </div>
        </div>

        {check.status === 'working' && (
          <p role="status" className="text-sm text-muted">
            {de.importList.working}
          </p>
        )}
        {check.status === 'error' && (
          <p role="alert" className="text-sm text-muted">
            {de.importList.failed}
          </p>
        )}
        {current && (
          <div data-testid="import-list-result" className="space-y-2 text-sm">
            <p className="font-medium">{de.importList.found(found.length, current.length)}</p>
            {problems.length > 0 && (
              <ul className="max-h-40 space-y-1 overflow-y-auto rounded-control border border-line bg-raised p-3 text-xs text-muted">
                {problems.map((entry, index) => (
                  <li key={index} data-testid="import-list-problem">
                    <span className="text-text">
                      {entry.entry.name}
                      {entry.entry.setCode ? ` (${entry.entry.setCode} ${entry.entry.number})` : ''}
                    </span>
                    {' – '}
                    {de.importList.problems[entry.problem]}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" onClick={onCancel} className={buttonClass}>
            {de.dialog.cancel}
          </button>
          {current ? (
            <button type="submit" disabled={found.length === 0 || creating} className={primaryClass}>
              {de.importList.create(found.length)}
            </button>
          ) : (
            <button
              type="button"
              disabled={text.trim() === '' || check.status === 'working'}
              onClick={() => void handleCheck()}
              className={primaryClass}
            >
              {de.importList.check}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
