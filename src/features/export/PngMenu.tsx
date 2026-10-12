import { useState } from 'react'
import { de } from '../../i18n/de'
import { useEditorStore } from '../../store/editorStore'
import type { PngTarget } from './pngExport'

interface PngMenuProps {
  binderName: string
  /** Numbers of the pages that lie open, left to right. */
  pages: number[]
  buttonClass: string
}

const menuItemClass = 'block w-full rounded-control px-3 py-2 text-left text-sm hover:bg-raised'

/** "Als PNG": the open double page or one of its pages as an image. */
export function PngMenu({ binderName, pages, buttonClass }: PngMenuProps) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  async function exportPng(target: PngTarget) {
    setOpen(false)
    setFailed(false)
    setBusy(true)
    // the image shows the binder, not what happens to be selected in it
    useEditorStore.getState().select(null)
    try {
      await new Promise((resolve) => requestAnimationFrame(resolve))
      const { downloadPng } = await import('./pngExport')
      await downloadPng(binderName, target)
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="relative"
      onKeyDown={(event) => {
        if (event.key === 'Escape') setOpen(false)
      }}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={busy}
        onClick={() => setOpen((isOpen) => !isOpen)}
        className={buttonClass}
      >
        {busy ? de.png.busy : de.png.button}
      </button>
      {open && (
        <div role="menu" className="absolute top-full left-0 z-10 mt-2 w-56 rounded-panel border border-line bg-panel p-1 shadow-lg">
          <button
            type="button"
            role="menuitem"
            onClick={() => exportPng({ kind: 'spread', pages })}
            className={menuItemClass}
          >
            {de.png.spread}
          </button>
          {pages.map((page) => (
            <button
              key={page}
              type="button"
              role="menuitem"
              onClick={() => exportPng({ kind: 'page', page })}
              className={menuItemClass}
            >
              {de.png.page(page)}
            </button>
          ))}
        </div>
      )}
      {failed && (
        <p role="alert" className="absolute top-full left-0 z-10 mt-2 w-64 rounded-panel border border-line bg-panel p-3 text-sm text-muted shadow-lg">
          {de.png.failed}
        </p>
      )}
    </div>
  )
}
