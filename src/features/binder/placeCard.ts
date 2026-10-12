import { baseVariant, tcgdexFor, type CardSummary } from '../../lib/tcgdex'
import { binderStore } from '../../store/binderStore'
import { useEditorStore } from '../../store/editorStore'
import type { CardLang, CardVariant } from '../../types/binder'
import { withFallback } from './dragDrop'
import { clampSpread, spreadOfPage } from './spreads'
import { nextEmptyAfter, tapTarget } from './tapPlacement'

/** A card does not wait longer than this for its finish; it then lands as normal. */
const VARIANT_LOOKUP_TIMEOUT_MS = 1500

/**
 * The finish a card from the search arrives in: the one it really has, so that a card that
 * only exists as holo is placed as holo. The finishes of its set are usually known already.
 */
export function baseVariantOf(cardId: string, lang: CardLang): Promise<CardVariant> {
  return withFallback(
    tcgdexFor(lang)
      .getCardDetail(cardId)
      .then((detail) => (detail ? baseVariant(detail.variants) : undefined)),
    'normal',
    VARIANT_LOOKUP_TIMEOUT_MS,
  )
}

/**
 * Puts a card from the search into the binder at a tap (see `tapPlacement.ts`), then moves
 * the selection on to the next free pocket and turns the binder to it. Says in
 * `editorStore.tapped` what happened, for the search to show: the binder is not in view.
 */
export async function placeByTap(card: CardSummary, lang: CardLang): Promise<void> {
  const before = binderStore.getState().binder
  if (!before) return
  const editor = useEditorStore.getState()
  // on a phone a page lies open on its own, and its index is that of what lies open
  const openPage = clampSpread(editor.spreadIndex, before.pages.length)
  const target = tapTarget(before, editor.selection, openPage)
  if (!target) {
    editor.noteTap({ kind: 'full' })
    return
  }
  const variant = await baseVariantOf(card.id, lang)
  binderStore.getState().dropCard({ kind: 'search', card, lang, variant }, { kind: 'pocket', position: target.position })

  const after = binderStore.getState().binder
  const next = after ? nextEmptyAfter(after, target.position) : undefined
  const state = useEditorStore.getState()
  if (next) {
    // turning the page lets go of the selection, so it is set afterwards
    state.showSpread(spreadOfPage(next.page - 1, true))
    state.select(next.position)
  } else {
    state.select(null)
  }
  state.noteTap({ kind: 'placed', name: card.name, page: target.page, pocket: target.pocket })
}
