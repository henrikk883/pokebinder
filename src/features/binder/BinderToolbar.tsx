import { useState } from 'react'
import { de } from '../../i18n/de'
import { chronologicalSetIds, tcgdexFor } from '../../lib/tcgdex'
import { useBinderStore } from '../../store/binderStore'
import { useEditorStore } from '../../store/editorStore'
import { LAYOUTS, type Binder, type Layout } from '../../types/binder'
import { MasterSetSettingsDialog } from '../masterset/MasterSetSettingsDialog'
import { cardLangs, countCards } from './binderModel'
import { buildSpreads, pageNumbersOf, type Spread } from './spreads'

const buttonClass =
  'flex h-10 items-center gap-2 rounded-control border border-line bg-raised px-3 text-sm hover:border-accent disabled:cursor-not-allowed disabled:text-muted disabled:hover:border-line'

const menuItemClass = 'block w-full rounded-control px-3 py-2 text-left text-sm hover:bg-raised'

function SortMenu({ binder, spread }: { binder: Binder; spread: Spread }) {
  const sortCards = useBinderStore((state) => state.sortCards)
  const [open, setOpen] = useState(false)
  const [failed, setFailed] = useState(false)

  async function sort(pageId?: string) {
    setOpen(false)
    setFailed(false)
    try {
      // sets of the binder's language first, then those of other languages its cards are in
      const catalogs = await Promise.all(cardLangs(binder).map((lang) => tcgdexFor(lang).getCatalog()))
      const setOrder = [...new Set(catalogs.flatMap(chronologicalSetIds))]
      sortCards(pageId === undefined ? {} : { pageId }, setOrder)
    } catch {
      setFailed(true)
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
        onClick={() => setOpen((isOpen) => !isOpen)}
        className={buttonClass}
      >
        {de.binder.sort}
      </button>
      {open && (
        <div role="menu" className="absolute top-full left-0 z-10 mt-2 w-56 rounded-panel border border-line bg-panel p-1 shadow-lg">
          {pageNumbersOf(spread).map((pageNumber) => (
            <button
              key={pageNumber}
              type="button"
              role="menuitem"
              onClick={() => sort(binder.pages[pageNumber - 1]?.id)}
              className={menuItemClass}
            >
              {de.binder.sortPage(pageNumber)}
            </button>
          ))}
          <button type="button" role="menuitem" onClick={() => sort()} className={menuItemClass}>
            {de.binder.sortBinder}
          </button>
        </div>
      )}
      {failed && (
        <p role="alert" className="absolute top-full left-0 z-10 mt-2 w-64 rounded-panel border border-line bg-panel p-3 text-sm text-muted shadow-lg">
          {de.binder.sortFailed}
        </p>
      )}
    </div>
  )
}

export function BinderToolbar({ binder, spread }: { binder: Binder; spread: Spread }) {
  const addPage = useBinderStore((state) => state.addPage)
  const changeLayout = useBinderStore((state) => state.changeLayout)
  const showSpread = useEditorStore((state) => state.showSpread)

  const replaceContent = useBinderStore((state) => state.replaceContent)
  const [adjusting, setAdjusting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportFailed, setExportFailed] = useState(false)

  async function handleMissingList() {
    setExporting(true)
    setExportFailed(false)
    try {
      // the PDF library is large and only needed here, so it is loaded on demand
      const { downloadMissingList } = await import('../export/missingListTransfer')
      await downloadMissingList(binder)
    } catch {
      setExportFailed(true)
    } finally {
      setExporting(false)
    }
  }

  function handleLayout(layout: Layout) {
    if (countCards(binder) === 0 || window.confirm(de.binder.confirmLayout)) changeLayout(layout)
  }

  function handleAddPage() {
    addPage()
    // open the binder where the new page is
    showSpread(buildSpreads(binder.pages.length + 1).length - 1)
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <h2 className="mr-2 min-w-0 truncate text-2xl font-semibold">{binder.name}</h2>
      <select
        aria-label={de.binder.layout}
        value={binder.layout}
        onChange={(event) => handleLayout(event.target.value as Layout)}
        className={`${buttonClass} pr-2`}
      >
        {LAYOUTS.map((layout) => (
          <option key={layout} value={layout}>
            {de.layouts[layout]}
          </option>
        ))}
      </select>
      <SortMenu binder={binder} spread={spread} />
      {binder.mode === 'masterSet' && binder.setId !== undefined && (
        <button type="button" onClick={() => setAdjusting(true)} className={buttonClass}>
          {de.masterSet.adjust}
        </button>
      )}
      {adjusting && binder.setId !== undefined && (
        <MasterSetSettingsDialog
          binder={binder}
          setId={binder.setId}
          onCancel={() => setAdjusting(false)}
          onApply={(next) => {
            replaceContent(next)
            setAdjusting(false)
          }}
        />
      )}
      <div className="relative">
        <button type="button" disabled={exporting} onClick={handleMissingList} className={buttonClass}>
          {de.binder.missingListPdf}
        </button>
        {exportFailed && (
          <p role="alert" className="absolute top-full left-0 z-10 mt-2 w-64 rounded-panel border border-line bg-panel p-3 text-sm text-muted shadow-lg">
            {de.missingList.failed}
          </p>
        )}
      </div>
      <button
        type="button"
        aria-label={de.binder.addPageLabel}
        onClick={handleAddPage}
        className="flex h-10 items-center gap-2 rounded-control bg-accent px-4 text-sm font-medium text-white hover:bg-accent-hover"
      >
        <span aria-hidden="true">+</span>
        {de.binder.addPage}
      </button>
    </div>
  )
}
