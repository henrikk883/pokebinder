import { useState, type FormEvent } from 'react'
import { de } from '../i18n/de'
import { useDialogStore, type DialogRequest } from '../store/dialogStore'

const cancelClass = 'h-10 rounded-control border border-line bg-raised px-4 text-sm hover:border-accent'
const primaryClass = 'h-10 rounded-control bg-accent px-4 text-sm font-medium text-white hover:bg-accent-hover'
const dangerClass = 'h-10 rounded-control border border-danger/70 px-4 text-sm font-medium text-danger hover:bg-danger/10'

function Dialog({ request }: { request: DialogRequest }) {
  const answer = useDialogStore((state) => state.answer)
  const [text, setText] = useState(request.kind === 'prompt' ? request.value : '')
  const cancelled = request.kind === 'confirm' ? false : null

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    answer(request.kind === 'confirm' ? true : text)
  }

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-4"
      onKeyDown={(event) => {
        if (event.key === 'Escape') answer(cancelled)
      }}
    >
      <form
        role={request.kind === 'confirm' ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby={request.kind === 'confirm' ? 'dialog-text' : undefined}
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-5 rounded-panel border border-line bg-panel p-6 shadow-lg"
      >
        <h2 id="dialog-title" className="text-xl font-semibold">
          {request.title}
        </h2>
        {request.kind === 'confirm' ? (
          <p id="dialog-text" className="text-sm text-muted">
            {request.text}
          </p>
        ) : (
          <label className="block space-y-2 text-sm">
            <span>{request.label}</span>
            <input
              value={text}
              onChange={(event) => setText(event.target.value)}
              required
              autoFocus
              onFocus={(event) => event.target.select()}
              className="h-10 w-full rounded-control border border-line bg-raised px-3 focus:border-accent focus:outline-none"
            />
          </label>
        )}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            // a question about deleting starts on "cancel", so that Enter does not delete
            autoFocus={request.kind === 'confirm'}
            onClick={() => answer(cancelled)}
            className={cancelClass}
          >
            {de.dialog.cancel}
          </button>
          <button
            type="submit"
            className={request.kind === 'confirm' && request.danger ? dangerClass : primaryClass}
          >
            {request.confirmLabel}
          </button>
        </div>
      </form>
    </div>
  )
}

/** Shows the question the app is currently asking; see `confirmDialog` and `promptDialog`. */
export function DialogHost() {
  const request = useDialogStore((state) => state.request)
  // a new question gets a fresh form
  return request ? <Dialog key={`${request.kind}:${request.title}`} request={request} /> : null
}
