import { useRef, useState, type PointerEvent } from 'react'
import { de } from '../../i18n/de'
import { useAssetUrl } from '../../store/assetStore'
import type { ImageCrop, PlacedImage } from '../../types/binder'
import { clampCrop, DEFAULT_CROP, MAX_CROP_ZOOM, MIN_CROP_ZOOM } from './imageModel'
import { cropStyle } from './imageStyle'

interface CropDialogProps {
  image: PlacedImage
  onApply: (crop: ImageCrop) => void
  onCancel: () => void
}

/** Shape of the area the image fills: pockets are 63 × 88, with a narrow gap between them. */
function areaAspect(image: PlacedImage): number {
  const gap = 5
  return (image.spanCols * 63 + (image.spanCols - 1) * gap) / (image.spanRows * 88 + (image.spanRows - 1) * gap)
}

const buttonClass = 'h-10 rounded-control border border-line bg-raised px-4 text-sm hover:border-accent'

/** Choose which part of an image shows: drag to move it, slider to magnify. */
export function CropDialog({ image, onApply, onCancel }: CropDialogProps) {
  const url = useAssetUrl(image.assetId)
  const [crop, setCrop] = useState<ImageCrop>(image.crop)
  const drag = useRef<{ x: number; y: number } | null>(null)

  function handleMove(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return
    const box = event.currentTarget.getBoundingClientRect()
    const dx = (event.clientX - drag.current.x) / box.width
    const dy = (event.clientY - drag.current.y) / box.height
    drag.current = { x: event.clientX, y: event.clientY }
    // pulling the image to the right brings its left part into view
    setCrop((current) => clampCrop({ ...current, x: current.x - dx, y: current.y - dy }))
  }

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 p-4"
      onKeyDown={(event) => {
        if (event.key === 'Escape') onCancel()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="crop-title"
        className="w-full max-w-xl space-y-4 rounded-panel border border-line bg-panel p-6 shadow-lg"
      >
        <h2 id="crop-title" className="text-xl font-semibold">
          {de.images.crop.title}
        </h2>
        <p className="text-sm text-muted">{de.images.crop.hint}</p>

        <div className="flex justify-center">
          <div
            role="img"
            aria-label={de.images.crop.preview}
            data-testid="crop-preview"
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId)
              drag.current = { x: event.clientX, y: event.clientY }
            }}
            onPointerMove={handleMove}
            onPointerUp={() => {
              drag.current = null
            }}
            className="max-h-[50vh] w-full cursor-move touch-none overflow-hidden rounded-pocket bg-raised"
            style={{ aspectRatio: areaAspect(image), maxWidth: `calc(50vh * ${areaAspect(image)})` }}
          >
            {url && (
              <img src={url} alt="" draggable={false} className="size-full" style={cropStyle(crop)} />
            )}
          </div>
        </div>

        <label className="flex items-center gap-3 text-sm">
          <span className="shrink-0">{de.images.crop.zoom}</span>
          <input
            type="range"
            min={MIN_CROP_ZOOM}
            max={MAX_CROP_ZOOM}
            step={0.05}
            value={crop.zoom}
            onChange={(event) => setCrop(clampCrop({ ...crop, zoom: Number(event.target.value) }))}
            className="flex-1 accent-accent"
          />
        </label>

        <div className="flex justify-between gap-3 pt-1">
          <button type="button" onClick={() => setCrop(DEFAULT_CROP)} className={buttonClass}>
            {de.images.crop.reset}
          </button>
          <div className="flex gap-3">
            <button type="button" onClick={onCancel} className={buttonClass}>
              {de.images.crop.cancel}
            </button>
            <button
              type="button"
              onClick={() => onApply(crop)}
              className="h-10 rounded-control bg-accent px-4 text-sm font-medium text-white hover:bg-accent-hover"
            >
              {de.images.crop.apply}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
