import { useAssetUrl } from '../../store/assetStore'
import type { Binder } from '../../types/binder'

/**
 * The front of a binder as it stands on the shelf of "Meine Binder": its cover picture,
 * or, without one, a plain cover carrying the cover title.
 */
export function BinderCover({ binder }: { binder: Binder }) {
  const imageUrl = useAssetUrl(binder.cover.assetId)

  return (
    <span
      data-testid="binder-cover"
      className="relative flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-panel border border-l-4 border-line bg-raised shadow-lg transition-transform group-hover:-translate-y-1"
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          data-testid="binder-cover-image"
          draggable={false}
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <span className="line-clamp-4 px-3 text-center text-base font-semibold text-muted">
          {binder.cover.title}
        </span>
      )}
    </span>
  )
}
