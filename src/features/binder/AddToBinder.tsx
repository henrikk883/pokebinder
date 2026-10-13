import { useEffect, useState } from 'react'
import { binderRepository } from '../../db/binderRepository'
import { de } from '../../i18n/de'
import { binderStore } from '../../store/binderStore'
import { useEditorStore } from '../../store/editorStore'
import type { CardLang } from '../../types/binder'
import { requestSync } from '../sync/syncStore'
import { addToTray } from './binderModel'
import { baseVariantOf } from './placeCard'

interface AddToBinderProps {
  cardId: string
  /** Language the card is looked at in; it goes into the binder in that language. */
  lang: CardLang
  /** Told after the card was added, e.g. to count it in what is shown beside. */
  onAdded?: () => void
}

/**
 * In a card's info: puts the card into one of the binders, picked from a list. It lands in
 * the tray of that binder, to be given its pocket when the binder is next arranged.
 */
export function AddToBinder({ cardId, lang, onAdded }: AddToBinderProps) {
  const [binders, setBinders] = useState<{ id: string; name: string }[]>()
  const [message, setMessage] = useState<{ text: string; failed: boolean }>()

  useEffect(() => {
    let cancelled = false
    binderStore
      .getState()
      .whenSaved()
      .then(() => binderRepository.listBinders())
      .then(
        (stored) => {
          if (!cancelled) setBinders(stored.map(({ id, name }) => ({ id, name })))
        },
        () => {
          if (!cancelled) setBinders([])
        },
      )
    return () => {
      cancelled = true
    }
  }, [])

  async function add(binderId: string) {
    const name = binders?.find((binder) => binder.id === binderId)?.name ?? ''
    try {
      const cardRef = { cardId, lang, variant: await baseVariantOf(cardId, lang) }
      const store = binderStore.getState()
      if (store.binder?.id === binderId) {
        // the binder on the table: through the store, so that it can be taken back
        store.addToTray(cardRef)
        await binderStore.getState().whenSaved()
      } else {
        const stored = await binderRepository.loadBinder(binderId)
        if (!stored) throw new Error('binder is gone')
        await binderRepository.saveBinder(addToTray(stored, cardRef))
        useEditorStore.getState().refreshBinderList()
        requestSync()
      }
      setMessage({ text: de.tray.added(name), failed: false })
      onAdded?.()
    } catch {
      setMessage({ text: de.tray.addFailed, failed: true })
    }
  }

  return (
    <div className="space-y-2">
      <select
        aria-label={de.tray.addTo}
        // always back on the first entry: picking a binder is the action
        value=""
        disabled={!binders || binders.length === 0}
        onChange={(event) => {
          if (event.target.value !== '') void add(event.target.value)
        }}
        className="h-10 w-full min-w-0 rounded-control border border-line bg-raised px-3 text-sm focus:border-accent focus:outline-none disabled:text-muted"
      >
        <option value="">{binders && binders.length === 0 ? de.tray.addToNone : `${de.tray.addTo} …`}</option>
        {(binders ?? []).map((binder) => (
          <option key={binder.id} value={binder.id}>
            {binder.name}
          </option>
        ))}
      </select>
      {message && (
        <p role={message.failed ? 'alert' : 'status'} className="text-xs text-muted">
          {message.text}
        </p>
      )}
    </div>
  )
}
