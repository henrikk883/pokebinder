import { de } from '../i18n/de'
import { useBinderStore } from '../store/binderStore'

export function SaveStatusBadge() {
  const saveStatus = useBinderStore((state) => state.saveStatus)
  if (saveStatus === 'idle') return null

  return (
    <p role="status" className="flex items-center gap-2 text-sm text-muted">
      <span
        aria-hidden="true"
        className={`size-2.5 rounded-full ${saveStatus === 'saved' ? 'bg-success' : 'bg-muted'}`}
      />
      {de.saveStatus[saveStatus]}
    </p>
  )
}
