import { useDraggable } from '@dnd-kit/core'
import { useRef, useState, type ChangeEvent } from 'react'
import { de } from '../../i18n/de'
import { assetStore, assetUrl, useAssetStore } from '../../store/assetStore'
import { useBinderStore } from '../../store/binderStore'
import { useEditorStore } from '../../store/editorStore'
import type { Asset } from '../../types/binder'
import type { DragSource } from '../binder/dragDrop'
import { ACCEPTED_IMAGE_TYPES } from './upload'
import { uploadErrorText, uploadImages } from './uploadActions'

interface LibraryImageProps {
  asset: Asset
  number: number
  draggable: boolean
  onDelete: () => void
  /** Why the image was not deleted when that was asked for; shown right at it. */
  refusal?: string | undefined
}

function LibraryImage({ asset, number, draggable, onDelete, refusal }: LibraryImageProps) {
  const source: DragSource = { kind: 'asset', assetId: asset.id }
  const { setNodeRef, listeners, isDragging } = useDraggable({
    id: `asset:${asset.id}`,
    data: source,
    disabled: !draggable,
  })

  return (
    <li data-testid="library-image" data-asset-id={asset.id} className="group relative min-w-0">
      <div
        ref={setNodeRef}
        {...listeners}
        className={`${draggable ? 'cursor-grab' : ''} ${isDragging ? 'opacity-40' : ''}`}
      >
        <img
          src={assetUrl(asset)}
          alt={de.images.libraryImage(number)}
          draggable={false}
          className="aspect-square w-full rounded-pocket bg-raised object-cover"
        />
      </div>
      <button
        type="button"
        aria-label={de.images.deleteLabel(number)}
        onClick={onDelete}
        className="absolute top-1 right-1 rounded-control border border-danger/70 bg-bg/90 px-1.5 py-0.5 text-[0.65rem] font-medium text-danger opacity-0 group-hover:opacity-100 focus-visible:opacity-100 touch:px-2.5 touch:py-1.5 touch:text-xs touch:opacity-100"
      >
        {de.images.delete}
      </button>
      {refusal !== undefined && (
        <p role="alert" className="mt-1 text-xs text-muted">
          {refusal}
        </p>
      )}
    </li>
  )
}

/** Tab "Eigene Bilder": uploaded images, ready to be dragged into a binder. */
export function ImageLibrary() {
  const assets = useAssetStore((state) => state.assets)
  const editing = useEditorStore((state) => state.mode === 'edit')
  const binderOpen = useBinderStore((state) => state.binder !== null) && editing
  const [message, setMessage] = useState<string | null>(null)
  const [refused, setRefused] = useState<{ assetId: string; text: string }>()
  const fileInput = useRef<HTMLInputElement>(null)

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])]
    event.target.value = ''
    setMessage(null)
    try {
      await uploadImages(files)
    } catch (error) {
      setMessage(uploadErrorText(error))
    }
  }

  async function handleDelete(asset: Asset) {
    setMessage(null)
    setRefused(undefined)
    const uses = await assetStore.getState().remove(asset.id)
    // said at the image itself: in a long library the top of the column is out of view
    if (uses.length > 0) setRefused({ assetId: asset.id, text: de.images.inUseAt(uses.map(de.images.use)) })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 space-y-3 px-4 pb-3">
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="flex h-10 w-full items-center justify-center rounded-control border border-line bg-raised text-sm hover:border-accent"
        >
          {de.images.upload}
        </button>
        <input
          ref={fileInput}
          type="file"
          multiple
          accept={ACCEPTED_IMAGE_TYPES.join(',')}
          aria-label={de.images.uploadInput}
          onChange={handleFiles}
          className="hidden"
        />
        {message && (
          <p role="alert" className="text-sm text-muted">
            {message}
          </p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {assets.length === 0 ? (
          <p className="text-sm text-muted">{de.images.empty}</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3">
            {assets.map((asset, index) => (
              <LibraryImage
                key={asset.id}
                asset={asset}
                number={index + 1}
                draggable={binderOpen}
                onDelete={() => handleDelete(asset)}
                refusal={refused?.assetId === asset.id ? refused.text : undefined}
              />
            ))}
          </ul>
        )}
      </div>

      {binderOpen && assets.length > 0 && (
        <p className="shrink-0 border-t border-line px-4 py-2 text-xs text-muted">
          {de.images.dragHint}
        </p>
      )}
    </div>
  )
}
