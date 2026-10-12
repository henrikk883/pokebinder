import { useState, type FormEvent } from 'react'
import { de } from '../../i18n/de'
import { useEditorStore } from '../../store/editorStore'
import { spreadOfPage } from '../binder/spreads'

interface PngMenuProps {
  binderName: string
  /** How many pages the binder has. */
  pageCount: number
  /** Numbers of the pages that lie open, left to right. */
  openPages: number[]
  buttonClass: string
}

const menuItemClass = 'block w-full rounded-control px-3 py-2 text-left text-sm hover:bg-raised'
const dialogButtonClass = 'h-10 rounded-control border border-line bg-raised px-4 text-sm hover:border-accent'

interface PageChoiceProps {
  pageCount: number
  preselected: number[]
  onExport: (pages: number[]) => void
  onCancel: () => void
}

/** Window to tick the pages that are to be exported, each as its own PNG. */
function PageChoiceDialog({ pageCount, preselected, onExport, onCancel }: PageChoiceProps) {
  const [chosen, setChosen] = useState<ReadonlySet<number>>(new Set(preselected))
  const pages = Array.from({ length: pageCount }, (_, index) => index + 1)

  function toggle(page: number, checked: boolean) {
    const next = new Set(chosen)
    if (checked) next.add(page)
    else next.delete(page)
    setChosen(next)
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (chosen.size > 0) onExport(pages.filter((page) => chosen.has(page)))
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
        aria-labelledby="png-pages-title"
        onSubmit={handleSubmit}
        className="flex max-h-full w-full max-w-lg flex-col gap-4 rounded-panel border border-line bg-panel p-6 shadow-lg"
      >
        <h2 id="png-pages-title" className="text-xl font-semibold">
          {de.png.choose}
        </h2>
        <p className="text-sm text-muted">{de.png.chooseHint}</p>

        <div className="flex gap-2">
          <button type="button" onClick={() => setChosen(new Set(pages))} className={`${dialogButtonClass} h-8 px-3 text-xs`}>
            {de.png.all}
          </button>
          <button type="button" onClick={() => setChosen(new Set())} className={`${dialogButtonClass} h-8 px-3 text-xs`}>
            {de.png.none}
          </button>
        </div>

        <fieldset className="min-h-0 overflow-y-auto">
          <legend className="sr-only">{de.png.choose}</legend>
          <div className="grid grid-cols-4 gap-2">
            {pages.map((page) => (
              <label
                key={page}
                className="flex h-10 cursor-pointer items-center gap-2 rounded-control border border-line bg-raised px-3 text-sm has-checked:border-accent"
              >
                <input
                  type="checkbox"
                  checked={chosen.has(page)}
                  onChange={(event) => toggle(page, event.target.checked)}
                  className="size-4 shrink-0 accent-accent"
                />
                {de.binder.page(page)}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={onCancel} className={dialogButtonClass}>
            {de.png.cancel}
          </button>
          <button
            type="submit"
            disabled={chosen.size === 0}
            className="h-10 rounded-control bg-accent px-4 text-sm font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {de.png.export(chosen.size)}
          </button>
        </div>
      </form>
    </div>
  )
}

/** "Als PNG": one of the open pages as an image, or any number of pages, one image each. */
export function PngMenu({ binderName, pageCount, openPages, buttonClass }: PngMenuProps) {
  const [open, setOpen] = useState(false)
  const [choosing, setChoosing] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [failed, setFailed] = useState(false)

  async function exportPages(pages: number[]) {
    setOpen(false)
    setChoosing(false)
    setFailed(false)
    setProgress({ done: 0, total: pages.length })
    const editor = useEditorStore.getState()
    const openBefore = editor.spreadIndex
    try {
      const { downloadPagePngs } = await import('./pngExport')
      await downloadPagePngs(
        binderName,
        pages,
        // turning the page also clears the selection: the image shows the binder, not what is selected
        (page) => useEditorStore.getState().showSpread(spreadOfPage(page - 1)),
        (done, total) => setProgress({ done, total }),
      )
    } catch {
      setFailed(true)
    } finally {
      // back to where the binder was open
      useEditorStore.getState().showSpread(openBefore)
      setProgress(null)
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
        disabled={progress !== null || pageCount === 0}
        onClick={() => setOpen((isOpen) => !isOpen)}
        className={buttonClass}
      >
        {progress ? de.png.busy(progress.done, progress.total) : de.png.button}
      </button>
      {open && (
        <div role="menu" className="absolute top-full left-0 z-10 mt-2 w-56 rounded-panel border border-line bg-panel p-1 shadow-lg">
          {openPages.map((page) => (
            <button
              key={page}
              type="button"
              role="menuitem"
              onClick={() => exportPages([page])}
              className={menuItemClass}
            >
              {de.png.page(page)}
            </button>
          ))}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              setChoosing(true)
            }}
            className={menuItemClass}
          >
            {de.png.several}
          </button>
        </div>
      )}
      {choosing && (
        <PageChoiceDialog
          pageCount={pageCount}
          preselected={openPages}
          onExport={exportPages}
          onCancel={() => setChoosing(false)}
        />
      )}
      {failed && (
        <p role="alert" className="absolute top-full left-0 z-10 mt-2 w-64 rounded-panel border border-line bg-panel p-3 text-sm text-muted shadow-lg">
          {de.png.failed}
        </p>
      )}
    </div>
  )
}
