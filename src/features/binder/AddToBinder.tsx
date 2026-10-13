import { useState } from 'react'
import { de } from '../../i18n/de'
import type { CardLang } from '../../types/binder'
import { BinderPicker } from './BinderPicker'
import { layIntoBinder, type BinderName } from './trayTransfer'

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
  const [message, setMessage] = useState<{ text: string; failed: boolean }>()

  async function add(binder: BinderName) {
    try {
      await layIntoBinder(binder.id, [{ cardId, lang }])
      setMessage({ text: de.tray.added(binder.name), failed: false })
      onAdded?.()
    } catch {
      setMessage({ text: de.tray.addFailed, failed: true })
    }
  }

  return (
    <div className="space-y-2">
      <BinderPicker label={de.tray.addTo} onPick={(binder) => void add(binder)} className="w-full" />
      {message && (
        <p role={message.failed ? 'alert' : 'status'} className="text-xs text-muted">
          {message.text}
        </p>
      )}
    </div>
  )
}
