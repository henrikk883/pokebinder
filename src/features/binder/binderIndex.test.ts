import { beforeEach, describe, expect, it } from 'vitest'
import { createTestContext } from '../../test/modelContext'
import type { Binder, CardRef, SlotPosition } from '../../types/binder'
import { createBinder, setCard, setOwned, toTray, type ModelContext } from './binderModel'
import { presenceIn } from './binderIndex'

const pikachu: CardRef = { cardId: 'sv03.5-025', lang: 'de', variant: 'normal' }
const pikachuEnglish: CardRef = { cardId: 'sv03.5-025', lang: 'en', variant: 'reverse' }
const mew: CardRef = { cardId: 'sv03.5-151', lang: 'en', variant: 'holo' }

let ctx: ModelContext
let binder: Binder
const at = (source: Binder, slotIndex: number): SlotPosition => ({ pageId: source.pages[0]?.id ?? '', slotIndex })

beforeEach(() => {
  ctx = createTestContext()
  binder = createBinder({ name: 'Kanto' }, ctx)
  binder = setCard(binder, at(binder, 0), pikachu, true, ctx)
  binder = setCard(binder, at(binder, 1), pikachuEnglish, true, ctx)
  binder = setCard(binder, at(binder, 2), mew, true, ctx)
  binder = setOwned(binder, at(binder, 2), false, ctx)
})

describe('presenceIn', () => {
  it('counts the pockets a card lies in, whatever its language or finish', () => {
    expect(presenceIn(binder, pikachu.cardId)).toEqual({ pockets: 2, langs: ['de', 'en'] })
  })

  it('counts a card that is still missing as well: it has its pocket', () => {
    expect(presenceIn(binder, mew.cardId)).toEqual({ pockets: 1, langs: ['en'] })
  })

  it('counts cards laid aside in the tray', () => {
    const laid = toTray(binder, [at(binder, 0), at(binder, 2)], ctx)

    expect(presenceIn(laid, pikachu.cardId)).toEqual({ pockets: 2, langs: ['en', 'de'] })
    expect(presenceIn(laid, mew.cardId)).toEqual({ pockets: 1, langs: ['en'] })
  })

  it('knows of nothing for a card that is not in the binder, and follows the binder as it changes', () => {
    expect(presenceIn(binder, 'sv03.5-006')).toBeUndefined()
    const next = setCard(binder, at(binder, 5), { cardId: 'sv03.5-006', lang: 'de', variant: 'holo' }, true, ctx)
    expect(presenceIn(next, 'sv03.5-006')).toEqual({ pockets: 1, langs: ['de'] })
    // the binder of before is still what it was
    expect(presenceIn(binder, 'sv03.5-006')).toBeUndefined()
  })
})
