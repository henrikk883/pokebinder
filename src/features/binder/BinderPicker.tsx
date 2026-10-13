import { useEffect, useState } from 'react'
import { de } from '../../i18n/de'
import { listBinderNames, type BinderName } from './trayTransfer'

interface BinderPickerProps {
  /** What picking a binder does, e.g. "Zu Binder hinzufügen"; shown as the first entry. */
  label: string
  disabled?: boolean
  onPick: (binder: BinderName) => void
  className?: string
}

/**
 * A list of the binders to pick one from, for something that is then done with it. It
 * always stands on its first entry, which says what picking does: picking is the action.
 */
export function BinderPicker({ label, disabled = false, onPick, className = '' }: BinderPickerProps) {
  const [binders, setBinders] = useState<BinderName[]>()

  useEffect(() => {
    let cancelled = false
    listBinderNames().then(
      (stored) => {
        if (!cancelled) setBinders(stored)
      },
      () => {
        if (!cancelled) setBinders([])
      },
    )
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <select
      aria-label={label}
      value=""
      disabled={disabled || !binders || binders.length === 0}
      onChange={(event) => {
        const binder = binders?.find((entry) => entry.id === event.target.value)
        if (binder) onPick(binder)
      }}
      className={`h-10 min-w-0 rounded-control border border-line bg-raised px-3 text-sm focus:border-accent focus:outline-none disabled:text-muted ${className}`}
    >
      <option value="">{binders && binders.length === 0 ? de.tray.addToNone : `${label} …`}</option>
      {(binders ?? []).map((binder) => (
        <option key={binder.id} value={binder.id}>
          {binder.name}
        </option>
      ))}
    </select>
  )
}
