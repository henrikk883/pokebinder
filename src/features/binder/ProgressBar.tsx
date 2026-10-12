import { de } from '../../i18n/de'
import type { Binder } from '../../types/binder'
import { countProgress } from './binderModel'

/** How much of the binder is collected: "142 / 191 Karten gesammelt · 49 fehlen". */
export function ProgressBar({ binder }: { binder: Binder }) {
  const { total, owned, missing } = countProgress(binder)
  if (total === 0) return null

  return (
    <div data-testid="progress" className="flex items-center justify-center gap-4 text-sm">
      <span>{de.progress.collected(owned, total)}</span>
      <div
        role="progressbar"
        aria-label={de.progress.bar}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={owned}
        className="h-2 w-64 max-w-[40%] overflow-hidden rounded-full bg-raised"
      >
        <div className="h-full rounded-full bg-accent" style={{ width: `${(owned / total) * 100}%` }} />
      </div>
      <span className="text-muted">{de.progress.missing(missing)}</span>
    </div>
  )
}
