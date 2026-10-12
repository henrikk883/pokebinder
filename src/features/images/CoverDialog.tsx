import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { de } from '../../i18n/de'
import { useAssetUrl } from '../../store/assetStore'
import type { BinderCover } from '../../types/binder'
import { ACCEPTED_IMAGE_TYPES } from './upload'
import { uploadErrorText, uploadImages } from './uploadActions'

interface CoverDialogProps {
  cover: BinderCover
  onSave: (cover: BinderCover) => void
  onCancel: () => void
}

const buttonClass = 'h-10 rounded-control border border-line bg-raised px-4 text-sm hover:border-accent'

/** Title and picture of the binder's cover. */
export function CoverDialog({ cover, onSave, onCancel }: CoverDialogProps) {
  const [title, setTitle] = useState(cover.title)
  const [assetId, setAssetId] = useState(cover.assetId)
  const [message, setMessage] = useState<string | null>(null)
  const imageUrl = useAssetUrl(assetId)
  const fileInput = useRef<HTMLInputElement>(null)

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setMessage(null)
    try {
      const [asset] = await uploadImages([file])
      if (asset) setAssetId(asset.id)
    } catch (error) {
      setMessage(uploadErrorText(error))
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    onSave(assetId === undefined ? { title: trimmed } : { title: trimmed, assetId })
  }

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 p-4"
      onKeyDown={(event) => {
        if (event.key === 'Escape') onCancel()
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="cover-title"
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-5 rounded-panel border border-line bg-panel p-6 shadow-lg"
      >
        <h2 id="cover-title" className="text-xl font-semibold">
          {de.images.cover.title}
        </h2>

        <label className="block space-y-2 text-sm">
          <span>{de.images.cover.name}</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            autoFocus
            className="h-10 w-full rounded-control border border-line bg-raised px-3 focus:border-accent focus:outline-none"
          />
        </label>

        <div className="space-y-2 text-sm">
          <p>{de.images.cover.image}</p>
          <div className="flex items-center gap-4">
            <div className="flex aspect-[3/4] w-24 shrink-0 items-center justify-center overflow-hidden rounded-pocket border border-line bg-raised text-xs text-muted">
              {imageUrl ? (
                <img src={imageUrl} alt="" className="size-full object-cover" />
              ) : (
                de.images.cover.none
              )}
            </div>
            <div className="flex flex-col items-start gap-2">
              <button type="button" onClick={() => fileInput.current?.click()} className={buttonClass}>
                {de.images.cover.choose}
              </button>
              {assetId !== undefined && (
                <button
                  type="button"
                  onClick={() => setAssetId(undefined)}
                  className="h-10 rounded-control border border-danger/70 px-4 text-sm text-danger hover:bg-danger/10"
                >
                  {de.images.cover.remove}
                </button>
              )}
            </div>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(',')}
            aria-label={de.images.cover.chooseInput}
            onChange={handleFile}
            className="hidden"
          />
          {message && (
            <p role="alert" className="text-muted">
              {message}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={onCancel} className={buttonClass}>
            {de.images.cover.cancel}
          </button>
          <button
            type="submit"
            className="h-10 rounded-control bg-accent px-4 text-sm font-medium text-white hover:bg-accent-hover"
          >
            {de.images.cover.save}
          </button>
        </div>
      </form>
    </div>
  )
}
