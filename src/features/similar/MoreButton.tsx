import { de } from '../../i18n/de'
import type { FoundCards } from './useSimilarCards'

interface MoreButtonProps {
  found: FoundCards
  onMore: () => void
}

/** Below a list of found cards: asks for more of them, where there are more. */
export function MoreButton({ found, onMore }: MoreButtonProps) {
  if (found.status !== 'ready') return null
  if (found.updating) {
    return (
      <p role="status" className="mt-4 text-center text-sm text-muted">
        {de.similar.loadingMore}
      </p>
    )
  }
  if (!found.hasMore) return null
  return (
    <button
      type="button"
      onClick={onMore}
      className="mt-4 h-10 w-full rounded-control border border-line bg-raised text-sm hover:border-accent"
    >
      {de.similar.more}
    </button>
  )
}
