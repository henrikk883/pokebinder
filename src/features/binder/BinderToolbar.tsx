import { useState } from 'react'
import { de } from '../../i18n/de'
import { chronologicalSetIds, tcgdexFor } from '../../lib/tcgdex'
import { isPhone } from '../../lib/phone'
import { binderStore, useBinderStore } from '../../store/binderStore'
import { confirmDialog, promptDialog } from '../../store/dialogStore'
import { useEditorStore } from '../../store/editorStore'
import { LAYOUTS, type Binder, type CardRef, type Layout } from '../../types/binder'
import { MissingListMenu } from '../export/MissingListMenu'
import { PngMenu } from '../export/PngMenu'
import { ShoppingButton } from '../export/ShoppingButton'
import { ShoppingDialog } from '../export/ShoppingDialog'
import { MasterSetSettingsDialog } from '../masterset/MasterSetSettingsDialog'
import { ShareDialog } from '../share/ShareDialog'
import { cardLangs, countCards } from './binderModel'
import { createCardComparator, createDexComparator, type CardComparator } from './sorting'
import { applyVariantFixes, loadVariantFixes } from './variantFix'
import { buildSpreads, pageNumbersOf, type Spread } from './spreads'
import { useDismiss } from '../../lib/useDismiss'

const buttonClass =
  'flex h-10 items-center gap-2 rounded-control border border-line bg-raised px-3 text-sm hover:border-accent disabled:cursor-not-allowed disabled:text-muted disabled:hover:border-line max-md:h-9 max-md:px-2.5'

// On a phone a menu comes up from the bottom over the whole width instead of dropping down
// beside its button, where it would hang over the edge of the screen.
const menuClass =
  'absolute top-full z-10 mt-2 rounded-panel border border-line bg-panel p-1 shadow-lg max-md:fixed max-md:inset-x-2 max-md:top-auto max-md:bottom-20 max-md:z-40 max-md:mt-0 max-md:max-h-[60vh] max-md:w-auto max-md:overflow-y-auto'
const menuItemClass =
  'flex w-full items-center gap-2 rounded-control px-3 py-2 text-left text-sm hover:bg-raised'
const menuHeadingClass = 'px-3 pt-2 pb-1 text-xs font-semibold tracking-wide text-muted uppercase'

type SortOrder = 'set' | 'dex'

/** Order by set and number: sets of the binder's language first, then those of other languages. */
async function setComparator(binder: Binder): Promise<CardComparator> {
  const catalogs = await Promise.all(cardLangs(binder).map((lang) => tcgdexFor(lang).getCatalog()))
  return createCardComparator([...new Set(catalogs.flatMap(chronologicalSetIds))])
}

/** Order by Pokédex number; the numbers come with the card data of each set. */
async function dexComparator(binder: Binder): Promise<CardComparator> {
  const key = (ref: CardRef) => `${ref.lang}:${ref.cardId}`
  const refs = new Map(
    binder.pages.flatMap((page) =>
      page.slots.flatMap((slot) => (slot.cardRef ? [[key(slot.cardRef), slot.cardRef] as const] : [])),
    ),
  )
  const numbers = new Map<string, number>()
  await Promise.all(
    [...refs.values()].map(async (ref) => {
      const detail = await tcgdexFor(ref.lang).getCardDetail(ref.cardId)
      if (detail?.dexNumber !== undefined) numbers.set(key(ref), detail.dexNumber)
    }),
  )
  return createDexComparator((card) => numbers.get(key(card.cardRef)), await setComparator(binder))
}

function SortMenu({ binder, spread }: { binder: Binder; spread: Spread }) {
  const sortCardsBy = useBinderStore((state) => state.sortCardsBy)
  const [open, setOpen] = useState(false)
  const menu = useDismiss<HTMLDivElement>(open, () => setOpen(false))
  const [failed, setFailed] = useState(false)

  async function sort(order: SortOrder, pageId?: string) {
    setOpen(false)
    setFailed(false)
    try {
      const compare = await (order === 'dex' ? dexComparator(binder) : setComparator(binder))
      sortCardsBy(pageId === undefined ? {} : { pageId }, compare)
    } catch {
      setFailed(true)
    }
  }

  const pages = pageNumbersOf(spread)
  const group = (order: SortOrder) => (
    <>
      {pages.map((pageNumber) => (
        <button
          key={pageNumber}
          type="button"
          role="menuitem"
          onClick={() => sort(order, binder.pages[pageNumber - 1]?.id)}
          className={menuItemClass}
        >
          {order === 'set' ? de.binder.sortPage(pageNumber) : de.binder.sortPageByDex(pageNumber)}
        </button>
      ))}
      <button type="button" role="menuitem" onClick={() => sort(order)} className={menuItemClass}>
        {order === 'set' ? de.binder.sortBinder : de.binder.sortBinderByDex}
      </button>
    </>
  )

  return (
    <div
      ref={menu}
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
        <div role="menu" className={`${menuClass} left-0 w-72 max-md:w-auto`}>
          <p className={menuHeadingClass}>{de.binder.sortBySet}</p>
          {group('set')}
          <p className={menuHeadingClass}>{de.binder.sortByDex}</p>
          {group('dex')}
        </div>
      )}
      {failed && (
        <p role="alert" className={`${menuClass} left-0 w-64 p-3 text-sm text-muted`}>
          {de.binder.sortFailed}
        </p>
      )}
    </div>
  )
}

/** "Mehr": what is needed now and then – name, layout, contents of a master set, spare cards. */
function MoreMenu({ binder }: { binder: Binder }) {
  const renameBinder = useBinderStore((state) => state.renameBinder)
  const changeLayout = useBinderStore((state) => state.changeLayout)
  const replaceContent = useBinderStore((state) => state.replaceContent)
  const [open, setOpen] = useState(false)
  const menu = useDismiss<HTMLDivElement>(open, () => setOpen(false))
  const [adjusting, setAdjusting] = useState(false)
  const [checking, setChecking] = useState(false)
  // the list is of the binder as it was when asked for; later changes do not move it
  const [trading, setTrading] = useState<Binder | null>(null)
  const [sharing, setSharing] = useState(false)

  /** Looks for cards in a finish they do not exist in and, after a question, puts them right. */
  async function handleVariants() {
    setOpen(false)
    setChecking(true)
    const editor = useEditorStore.getState()
    try {
      const fixes = await loadVariantFixes(binder)
      if (fixes.length === 0) {
        editor.setNotice(de.variantFix.allFine)
        return
      }
      const agreed = await confirmDialog({
        title: de.variantFix.title(fixes.length),
        text: de.variantFix.text,
        confirmLabel: de.variantFix.confirm,
      })
      // the binder as it is now: it may have changed while the question was open
      const current = binderStore.getState().binder
      if (agreed && current) replaceContent(applyVariantFixes(current, fixes))
    } catch {
      editor.setNotice(de.variantFix.failed)
    } finally {
      setChecking(false)
    }
  }

  async function handleRename() {
    setOpen(false)
    const name = await promptDialog({
      title: de.binder.rename,
      label: de.newBinder.name,
      value: binder.name,
      confirmLabel: de.binder.renameConfirm,
    })
    if (name !== null) renameBinder(name)
  }

  async function handleLayout(layout: Layout) {
    setOpen(false)
    if (layout === binder.layout) return
    const agreed =
      countCards(binder) === 0 ||
      (await confirmDialog({
        title: de.binder.layoutTitle(de.layouts[layout]),
        text: de.binder.confirmLayout,
        confirmLabel: de.binder.layoutConfirm,
      }))
    if (agreed) changeLayout(layout)
  }

  return (
    <div
      ref={menu}
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
        {de.binder.more}
      </button>
      {open && (
        <div role="menu" className={`${menuClass} right-0 w-64 max-md:w-auto`}>
          <button type="button" role="menuitem" onClick={handleRename} className={menuItemClass}>
            {de.binder.rename}
          </button>
          {binder.mode === 'masterSet' && binder.setId !== undefined && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                setAdjusting(true)
              }}
              className={menuItemClass}
            >
              {de.masterSet.adjust}
            </button>
          )}
          <button type="button" role="menuitem" disabled={checking} onClick={handleVariants} className={menuItemClass}>
            {checking ? de.variantFix.checking : de.variantFix.menu}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              setSharing(true)
            }}
            className={menuItemClass}
          >
            {de.share.menu}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              setTrading(binder)
            }}
            className={menuItemClass}
          >
            {de.trade.menu}
          </button>
          <p className={menuHeadingClass}>{de.binder.layout}</p>
          {LAYOUTS.map((layout) => (
            <button
              key={layout}
              type="button"
              role="menuitemradio"
              aria-checked={layout === binder.layout}
              onClick={() => handleLayout(layout)}
              className={menuItemClass}
            >
              <span aria-hidden="true" className="w-4 text-accent-hover">
                {layout === binder.layout ? '✓' : ''}
              </span>
              {de.layouts[layout]}
            </button>
          ))}
        </div>
      )}
      {sharing && <ShareDialog binder={binder} onClose={() => setSharing(false)} />}
      {trading && (
        <ShoppingDialog
          title={de.trade.title(trading.name)}
          hint={de.trade.hint}
          emptyText={de.trade.empty}
          withBudget={false}
          load={async (onProgress) =>
            (await import('../export/missingListTransfer')).loadTradeRows(trading, onProgress)
          }
          onClose={() => setTrading(null)}
        />
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
    </div>
  )
}

function HistoryArrow({ direction }: { direction: 'undo' | 'redo' }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={`size-4 ${direction === 'redo' ? '-scale-x-100' : ''}`}
      aria-hidden="true"
    >
      <path d="M7 4 3 8l4 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 8h8a5 5 0 0 1 0 10H8" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

export function BinderToolbar({ binder, spread }: { binder: Binder; spread: Spread }) {
  const addPage = useBinderStore((state) => state.addPage)
  const showSpread = useEditorStore((state) => state.showSpread)
  const canUndo = useBinderStore((state) => state.canUndo)
  const canRedo = useBinderStore((state) => state.canRedo)
  const undo = useBinderStore((state) => state.undo)
  const redo = useBinderStore((state) => state.redo)

  function handleAddPage() {
    addPage()
    // open the binder where the new page is
    showSpread(buildSpreads(binder.pages.length + 1, isPhone()).length - 1)
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <h2
        // The name takes the room the buttons leave and is cut short before they wrap. On a
        // phone it has a row of its own, the buttons wrap below it.
        className="min-w-24 flex-1 basis-0 truncate text-2xl font-semibold max-md:basis-full max-md:text-xl"
        title={binder.name}
      >
        {binder.name}
      </h2>
      <SortMenu binder={binder} spread={spread} />
      <MissingListMenu binder={binder} buttonClass={buttonClass} />
      <ShoppingButton binder={binder} buttonClass={buttonClass} />
      <PngMenu
        binder={binder}
        binderName={binder.name}
        pageCount={binder.pages.length}
        openPages={pageNumbersOf(spread)}
        buttonClass={buttonClass}
      />
      <div className="flex">
        <button
          type="button"
          aria-label={de.history.undo}
          title={`${de.history.undo} (Strg+Z)`}
          disabled={!canUndo}
          onClick={undo}
          className={`${buttonClass} rounded-r-none px-2.5`}
        >
          <HistoryArrow direction="undo" />
        </button>
        <button
          type="button"
          aria-label={de.history.redo}
          title={`${de.history.redo} (Strg+Y)`}
          disabled={!canRedo}
          onClick={redo}
          className={`${buttonClass} -ml-px rounded-l-none px-2.5`}
        >
          <HistoryArrow direction="redo" />
        </button>
      </div>
      <MoreMenu binder={binder} />
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
