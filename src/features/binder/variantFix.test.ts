import { beforeEach, describe, expect, it } from 'vitest'
import { createTestContext } from '../../test/modelContext'
import type { Binder, CardVariant } from '../../types/binder'
import { createBinder, setCard, setCount, setVariant, type ModelContext } from './binderModel'
import { applyVariantFixes, findVariantFixes, type VariantLookup } from './variantFix'

let ctx: ModelContext
let binder: Binder

const at = (slotIndex: number) => ({ pageId: binder.pages[0]?.id ?? '', slotIndex })

/** "holo-only" exists as holo only, "common" as normal and reverse, "balls" has the ball patterns. */
const FINISHES: Record<string, CardVariant[]> = {
  'holo-only': ['holo'],
  common: ['normal', 'reverse'],
  balls: ['normal', 'pokeball', 'masterball'],
}
const variantsOf: VariantLookup = (cardId) => FINISHES[cardId]

function place(source: Binder, slotIndex: number, cardId: string, variant: CardVariant, owned = true): Binder {
  return setCard(source, at(slotIndex), { cardId, lang: 'de', variant }, owned, ctx)
}

beforeEach(() => {
  ctx = createTestContext()
  binder = createBinder({ name: 'Test' }, ctx)
})

describe('findVariantFixes', () => {
  it('finds a card lying there in a finish it does not exist in', () => {
    const cards = place(binder, 0, 'holo-only', 'normal')

    expect(findVariantFixes(cards, variantsOf)).toEqual([
      { position: at(0), cardId: 'holo-only', from: 'normal', to: 'holo' },
    ])
  })

  it('puts the base finish in its place: normal where there is one', () => {
    let cards = place(binder, 0, 'common', 'holo')
    cards = place(cards, 1, 'balls', 'reverse')

    expect(findVariantFixes(cards, variantsOf).map((fix) => [fix.cardId, fix.from, fix.to])).toEqual([
      ['common', 'holo', 'normal'],
      ['balls', 'reverse', 'normal'],
    ])
  })

  it('leaves alone what exists, what is not known, and empty pockets', () => {
    let cards = place(binder, 0, 'holo-only', 'holo')
    cards = place(cards, 1, 'common', 'reverse')
    cards = place(cards, 2, 'balls', 'masterball')
    cards = place(cards, 3, 'unknown-card', 'normal')

    expect(findVariantFixes(cards, variantsOf)).toEqual([])
    expect(findVariantFixes(binder, variantsOf)).toEqual([])
  })
})

describe('applyVariantFixes', () => {
  it('changes the finish and keeps marks and numbers of copies', () => {
    let cards = place(binder, 0, 'holo-only', 'normal')
    cards = setCount(cards, at(0), 2, ctx)
    cards = place(cards, 1, 'common', 'holo', false)

    const fixed = applyVariantFixes(cards, findVariantFixes(cards, variantsOf), ctx)

    expect(fixed.pages[0]?.slots[0]).toMatchObject({ owned: true, count: 2, cardRef: { cardId: 'holo-only', variant: 'holo' } })
    expect(fixed.pages[0]?.slots[1]).toMatchObject({ owned: false, cardRef: { cardId: 'common', variant: 'normal' } })
    expect(findVariantFixes(fixed, variantsOf)).toEqual([])
  })

  it('passes over a pocket that changed since the fix was found', () => {
    const cards = place(binder, 0, 'holo-only', 'normal')
    const fixes = findVariantFixes(cards, variantsOf)

    // meanwhile another card was put there, or the finish was changed by hand
    const replaced = place(cards, 0, 'common', 'normal')
    expect(applyVariantFixes(replaced, fixes, ctx)).toBe(replaced)
    const byHand = setVariant(cards, at(0), 'reverse', ctx)
    expect(applyVariantFixes(byHand, fixes, ctx)).toBe(byHand)
  })

  it('changes nothing without fixes', () => {
    expect(applyVariantFixes(binder, [], ctx)).toBe(binder)
  })
})
