import { useEffect, useState } from 'react'
import { de } from '../../i18n/de'
import type { Binder } from '../../types/binder'
import { createShare, findShare, signIn, useSyncStore, withdrawShare } from '../sync/syncStore'
import { shareUrl } from './sharedBinder'

type Share =
  | { status: 'loading' }
  | { status: 'none' }
  | { status: 'shared'; token: string }
  /** The server does not have the binder yet, or could not be reached. */
  | { status: 'failed' }

const buttonClass = 'h-10 rounded-control border border-line bg-raised px-4 text-sm hover:border-accent'
const primaryClass = 'h-10 rounded-control bg-accent px-4 text-sm font-medium text-white hover:bg-accent-hover'

/**
 * "Teilen": makes a link under which anybody who has it can look at this binder, and
 * withdraws it again. Needs the collector to be signed in: what is shared is the binder
 * as the server has it.
 */
export function ShareDialog({ binder, onClose }: { binder: Binder; onClose: () => void }) {
  const signedIn = useSyncStore((state) => state.email !== null)
  const available = useSyncStore((state) => state.status !== 'unavailable' && state.status !== 'unknown')
  const [share, setShare] = useState<Share>({ status: 'loading' })
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!signedIn) return
    let cancelled = false
    findShare(binder.id).then(
      (token) => {
        if (!cancelled) setShare(token === undefined ? { status: 'none' } : { status: 'shared', token })
      },
      () => {
        if (!cancelled) setShare({ status: 'failed' })
      },
    )
    return () => {
      cancelled = true
    }
  }, [binder.id, signedIn])

  async function handleCreate() {
    setShare({ status: 'loading' })
    const token = await createShare(binder.id).catch(() => undefined)
    setShare(token === undefined ? { status: 'failed' } : { status: 'shared', token })
  }

  async function handleWithdraw(token: string) {
    setShare({ status: 'loading' })
    await withdrawShare(token).catch(() => undefined)
    setShare({ status: 'none' })
    setCopied(false)
  }

  const link = share.status === 'shared' ? shareUrl(share.token, window.location.origin) : ''

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
        className="flex w-full max-w-lg flex-col gap-4 rounded-panel border border-line bg-panel p-6 shadow-lg"
      >
        <h2 id="share-title" className="text-xl font-semibold">
          {de.share.title(binder.name)}
        </h2>
        <p className="text-sm text-muted">{de.share.hint}</p>

        {!signedIn ? (
          <p className="text-sm">{available ? de.share.signInFirst : de.share.unavailable}</p>
        ) : share.status === 'loading' ? (
          <p role="status" className="text-sm text-muted">
            {de.share.working}
          </p>
        ) : share.status === 'shared' ? (
          <>
            <input
              readOnly
              value={link}
              aria-label={de.share.link}
              onFocus={(event) => event.target.select()}
              className="h-10 w-full rounded-control border border-line bg-raised px-3 text-sm focus:border-accent focus:outline-none"
            />
            <p className="text-xs text-muted">{de.share.live}</p>
          </>
        ) : (
          <p className="text-sm">{share.status === 'failed' ? de.share.failed : de.share.none}</p>
        )}

        <div className="flex flex-wrap justify-end gap-3">
          {signedIn && share.status === 'shared' && (
            <button
              type="button"
              onClick={() => void handleWithdraw(share.token)}
              className="mr-auto h-10 rounded-control border border-danger/70 px-4 text-sm font-medium text-danger hover:bg-danger/10"
            >
              {de.share.withdraw}
            </button>
          )}
          <button type="button" onClick={onClose} className={buttonClass}>
            {de.history.close}
          </button>
          {!signedIn && available && (
            <button type="button" onClick={signIn} className={primaryClass}>
              {de.sync.signIn}
            </button>
          )}
          {signedIn && (share.status === 'none' || share.status === 'failed') && (
            <button type="button" autoFocus onClick={() => void handleCreate()} className={primaryClass}>
              {de.share.create}
            </button>
          )}
          {signedIn && share.status === 'shared' && (
            <button
              type="button"
              autoFocus
              onClick={() => {
                void navigator.clipboard?.writeText(link).then(
                  () => setCopied(true),
                  () => undefined,
                )
              }}
              className={primaryClass}
            >
              {copied ? de.share.copied : de.share.copy}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
