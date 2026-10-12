import { useRef, useState, type ChangeEvent } from 'react'
import { de } from '../../i18n/de'
import { useBinderStore } from '../../store/binderStore'
import { useEditorStore } from '../../store/editorStore'
import type { Binder, Page, Slot } from '../../types/binder'
import { layoutDimensions } from '../binder/binderModel'
import { CropDialog } from './CropDialog'
import {
  DIRECTIONS,
  imageAt,
  maxSpan,
  neighbourPocket,
  type Direction,
  type Placement,
  type PlacementError,
} from './imageModel'
import { ACCEPTED_IMAGE_TYPES } from './upload'
import { uploadErrorText, uploadImages } from './uploadActions'

const outlineButtonClass =
  'flex h-10 w-full items-center justify-center rounded-control border border-line bg-raised text-sm hover:border-accent disabled:cursor-not-allowed disabled:text-muted disabled:hover:border-line'
const selectClass = 'h-10 w-full rounded-control border border-line bg-raised px-3 text-sm'

const ARROWS: Record<Direction, string> = { left: '←', up: '↑', down: '↓', right: '→' }

function range(max: number): number[] {
  return Array.from({ length: max }, (_, index) => index + 1)
}

interface ImageControlsProps {
  binder: Binder
  /** The selected pocket; the controls act on the image behind it. */
  page: Page
  slot: Slot
}

/** Add an image behind the selected pocket, or resize, crop and remove the one that is there. */
export function ImageControls({ binder, page, slot }: ImageControlsProps) {
  const placeImage = useBinderStore((state) => state.placeImage)
  const changePlacement = useBinderStore((state) => state.changePlacement)
  const setImageCrop = useBinderStore((state) => state.setImageCrop)
  const removeImage = useBinderStore((state) => state.removeImage)
  const moveImage = useBinderStore((state) => state.moveImage)
  const select = useEditorStore((state) => state.select)
  const setNotice = useEditorStore((state) => state.setNotice)
  const [cropping, setCropping] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const placed = imageAt(binder, page.index, slot.index)

  function report(error: PlacementError | null) {
    setNotice(error ? de.images.errors[error] : null)
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const [asset] = await uploadImages([file])
      if (asset) report(placeImage(page.id, asset.id, { fromSlot: slot.index, spanCols: 1, spanRows: 1 }))
    } catch (error) {
      setNotice(uploadErrorText(error))
    }
  }

  if (!placed) {
    return (
      <>
        <button type="button" onClick={() => fileInput.current?.click()} className={outlineButtonClass}>
          {de.selection.addImage}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(',')}
          aria-label={de.selection.addImage}
          onChange={handleFile}
          className="hidden"
        />
        <button type="button" disabled className={outlineButtonClass}>
          {de.selection.cropImage}
        </button>
      </>
    )
  }

  const { image, page: owner } = placed
  const max = maxSpan(binder, owner.index, image.fromSlot)
  const { rows, cols } = layoutDimensions(binder.layout)
  const resize = (placement: Placement) => report(changePlacement(owner.id, image.id, placement))
  const here = { pageId: page.id, slotIndex: slot.index }

  /** One pocket on in a direction; the selection goes along, so that the next step follows on. */
  function move(direction: Direction) {
    const target = neighbourPocket(binder, here, direction)
    if (!target) return
    const error = moveImage(here, target)
    if (error) {
      report(error)
      return
    }
    // neighbours lie on the same spread, so the pocket stays in view
    select(target)
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <label className="space-y-1">
          <span className="text-muted">{de.images.width}</span>
          <select
            value={image.spanCols}
            onChange={(event) => resize({ ...image, spanCols: Number(event.target.value) })}
            className={selectClass}
          >
            {range(max.cols).map((count) => (
              <option key={count} value={count}>
                {de.images.pockets(count)}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-muted">{de.images.height}</span>
          <select
            value={image.spanRows}
            onChange={(event) => resize({ ...image, spanRows: Number(event.target.value) })}
            className={selectClass}
          >
            {range(max.rows).map((count) => (
              <option key={count} value={count}>
                {de.images.pockets(count)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button
        type="button"
        onClick={() => resize({ fromSlot: 0, spanCols: cols, spanRows: rows })}
        className={outlineButtonClass}
      >
        {de.images.fullPage}
      </button>
      <button type="button" onClick={() => setCropping(true)} className={outlineButtonClass}>
        {de.selection.cropImage}
      </button>
      <div role="group" aria-label={de.images.move} className="grid grid-cols-4 gap-2">
        {DIRECTIONS.map((direction) => (
          <button
            key={direction}
            type="button"
            aria-label={de.images.moveTo[direction]}
            title={de.images.moveTo[direction]}
            disabled={!neighbourPocket(binder, here, direction)}
            onClick={() => move(direction)}
            className={`${outlineButtonClass} disabled:cursor-not-allowed disabled:text-muted disabled:hover:border-line`}
          >
            <span aria-hidden="true">{ARROWS[direction]}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => removeImage(owner.id, image.id)}
        className="flex h-10 w-full items-center justify-center rounded-control border border-danger/70 text-sm text-danger hover:bg-danger/10"
      >
        {de.images.remove}
      </button>
      <p className="text-xs text-muted">{de.images.moveHint}</p>

      {cropping && (
        <CropDialog
          image={image}
          onCancel={() => setCropping(false)}
          onApply={(crop) => {
            setImageCrop(owner.id, image.id, crop)
            setCropping(false)
          }}
        />
      )}
    </>
  )
}
