import { useState } from 'react'
import { useAssetUrl } from '../../store/assetStore'
import type { Binder } from '../../types/binder'
import { useSetLogo } from './useSetLogo'

/**
 * The front of a binder as it stands on the shelf of "Meine Karten": its cover picture; for
 * a master set without one, the logo of its set; otherwise a plain cover carrying the
 * cover title.
 */
export function BinderCover({ binder }: { binder: Binder }) {
  const imageUrl = useAssetUrl(binder.cover.assetId)
  const logoUrl = useSetLogo(binder)
  // a logo that cannot be loaded (no connection) gives way to the title
  const [failedLogo, setFailedLogo] = useState<string>()
  const logo = logoUrl !== undefined && logoUrl !== failedLogo ? logoUrl : undefined

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
      ) : logo ? (
        <img
          src={logo}
          alt=""
          data-testid="binder-cover-logo"
          draggable={false}
          onError={() => setFailedLogo(logo)}
          // a logo is a wide lettering: it stands on the cover, it does not fill it
          className="max-h-[45%] w-4/5 object-contain"
        />
      ) : (
        <span className="line-clamp-4 px-3 text-center text-base font-semibold text-muted">
          {binder.cover.title}
        </span>
      )}
    </span>
  )
}
