import { baseVariant, mapWithConcurrency, tcgdexFor } from '../../lib/tcgdex'
import type { Binder, CardLang, CardVariant, SlotPosition } from '../../types/binder'
import { defaultContext, setVariant, type ModelContext } from './binderModel'

/** A card that lies in the binder in a finish it does not exist in, and the finish it gets instead. */
export interface VariantFix {
  position: SlotPosition
  cardId: string
  from: CardVariant
  to: CardVariant
}

/** The finishes a card exists in; `undefined` where that is not known. */
export type VariantLookup = (cardId: string, lang: CardLang) => readonly CardVariant[] | undefined

/**
 * Cards whose finish does not exist, each with the base finish of the card to put in its
 * place (normal where there is one, else holo). Typical for cards placed before the app
 * looked the finishes up: a card that only exists as holo lying there as "normal". Cards
 * whose finishes are not known are left alone.
 */
export function findVariantFixes(binder: Binder, variantsOf: VariantLookup): VariantFix[] {
  const fixes: VariantFix[] = []
  for (const page of binder.pages) {
    for (const slot of page.slots) {
      if (!slot.cardRef) continue
      const { cardId, lang, variant } = slot.cardRef
      const variants = variantsOf(cardId, lang)
      if (!variants || variants.length === 0 || variants.includes(variant)) continue
      fixes.push({ position: { pageId: page.id, slotIndex: slot.index }, cardId, from: variant, to: baseVariant(variants) })
    }
  }
  return fixes
}

/**
 * Puts the fixes into the binder. A pocket that no longer holds the card in the finish the
 * fix was found for (the binder changed meanwhile) is passed over.
 */
export function applyVariantFixes(
  binder: Binder,
  fixes: readonly VariantFix[],
  ctx: ModelContext = defaultContext,
): Binder {
  let fixed = binder
  for (const fix of fixes) {
    const slot = fixed.pages.find((page) => page.id === fix.position.pageId)?.slots[fix.position.slotIndex]
    if (slot?.cardRef?.cardId !== fix.cardId || slot.cardRef.variant !== fix.from) continue
    fixed = setVariant(fixed, fix.position, fix.to, ctx)
  }
  return fixed
}

/** Looks the finishes of every card of the binder up at TCGdex and finds what to fix. */
export async function loadVariantFixes(binder: Binder): Promise<VariantFix[]> {
  const refs = binder.pages.flatMap((page) => page.slots.flatMap((slot) => (slot.cardRef ? [slot.cardRef] : [])))
  const unique = [...new Map(refs.map((ref) => [`${ref.lang}:${ref.cardId}`, ref])).values()]
  const known = new Map<string, readonly CardVariant[]>()
  await mapWithConcurrency(unique, 8, async (ref) => {
    const detail = await tcgdexFor(ref.lang)
      .getCardDetail(ref.cardId)
      .catch(() => undefined)
    if (detail) known.set(`${ref.lang}:${ref.cardId}`, detail.variants)
  })
  return findVariantFixes(binder, (cardId, lang) => known.get(`${lang}:${cardId}`))
}
