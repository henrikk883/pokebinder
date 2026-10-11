import { de } from '../../i18n/de'
import { setIdOfCard } from '../../lib/tcgdex'
import { useBinderStore } from '../../store/binderStore'
import { useEditorStore } from '../../store/editorStore'
import { OPENING_SIDES, type OpeningSide, type Page, type Slot } from '../../types/binder'
import { CardImage } from '../search/CardImage'
import { useCatalog } from '../search/useCatalog'
import { useCard } from './useCard'

const fieldClass =
  'flex h-10 items-center rounded-control border border-line bg-raised px-3 text-sm'
const outlineButtonClass =
  'flex h-10 w-full items-center justify-center rounded-control border border-line bg-raised text-sm disabled:cursor-not-allowed disabled:text-muted'

function SelectedCard({ page, slot }: { page: Page; slot: Slot }) {
  const setOwned = useBinderStore((state) => state.setOwned)
  const card = useCard(slot.cardRef?.cardId)
  const catalog = useCatalog()
  const set =
    card && catalog.status === 'ready' ? catalog.data.setsById.get(setIdOfCard(card)) : undefined
  const position = { pageId: page.id, slotIndex: slot.index }

  if (!slot.cardRef) return <p className="text-sm text-muted">{de.selection.emptyPocket}</p>

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <div className="w-24 shrink-0">
          {card ? (
            <CardImage card={card} set={set} size="small" missing={!slot.owned} />
          ) : (
            <div className="aspect-[63/88] w-full rounded-pocket bg-raised" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-base font-medium">
            {card ? card.name : card === null ? de.binder.unknownCard : ''}
          </p>
          {card && (
            <p className="mt-1 text-sm text-muted">
              {set ? `${set.name} · ${card.localId}/${set.cardCount.official}` : card.localId}
            </p>
          )}
        </div>
      </div>

      <div role="group" aria-label={de.selection.ownedState} className="flex rounded-control bg-raised p-0.5 text-sm">
        {[true, false].map((owned) => (
          <button
            key={String(owned)}
            type="button"
            aria-pressed={slot.owned === owned}
            onClick={() => setOwned(position, owned)}
            className={`h-9 flex-1 rounded-control font-medium ${
              slot.owned === owned ? 'bg-accent text-white' : 'text-muted hover:text-text'
            }`}
          >
            {owned ? de.selection.owned : de.selection.missing}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Right column: what is selected, and settings for the page it is on. */
export function SelectionPanel() {
  const binder = useBinderStore((state) => state.binder)
  const clearSlot = useBinderStore((state) => state.clearSlot)
  const setOpeningSide = useBinderStore((state) => state.setOpeningSide)
  const selection = useEditorStore((state) => state.selection)

  const page = selection ? binder?.pages.find((entry) => entry.id === selection.pageId) : undefined
  const slot = selection ? page?.slots[selection.slotIndex] : undefined

  return (
    <section className="space-y-6 p-4">
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">{de.selection.title}</h2>
        {page && slot ? (
          <SelectedCard page={page} slot={slot} />
        ) : (
          <p className="text-sm text-muted">{de.selection.empty}</p>
        )}
      </div>

      {page && slot && (
        <>
          <div className="space-y-3 border-t border-line pt-5">
            <h3 className="text-lg font-semibold">{de.selection.pocket}</h3>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div className="space-y-1">
                <dt className="text-muted">{de.selection.page}</dt>
                <dd className={fieldClass}>{page.index + 1}</dd>
              </div>
              <div className="space-y-1">
                <dt className="text-muted">{de.selection.position}</dt>
                <dd className={fieldClass}>{slot.index + 1}</dd>
              </div>
            </dl>
            <button
              type="button"
              disabled={!slot.cardRef}
              onClick={() => clearSlot({ pageId: page.id, slotIndex: slot.index })}
              className="flex h-10 w-full items-center justify-center rounded-control border border-danger/70 text-sm text-danger hover:bg-danger/10 disabled:cursor-not-allowed disabled:border-line disabled:text-muted disabled:hover:bg-transparent"
            >
              {de.selection.clear}
            </button>
          </div>

          <div className="space-y-3 border-t border-line pt-5">
            <h3 className="text-lg font-semibold">{de.selection.design}</h3>
            <select
              aria-label={de.selection.opening}
              value={page.openingSide}
              onChange={(event) => setOpeningSide(page.id, event.target.value as OpeningSide)}
              className={`${fieldClass} w-full`}
            >
              {OPENING_SIDES.map((side) => (
                <option key={side} value={side}>
                  {de.openingSides[side]}
                </option>
              ))}
            </select>
            <button type="button" disabled className={outlineButtonClass}>
              {de.selection.addImage}
            </button>
            <button type="button" disabled className={outlineButtonClass}>
              {de.selection.cropImage}
            </button>
            <button type="button" disabled className={outlineButtonClass}>
              {de.selection.editCover}
            </button>
          </div>
        </>
      )}
    </section>
  )
}
