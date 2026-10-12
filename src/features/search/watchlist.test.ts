import { describe, expect, it } from 'vitest'
import { isSaved, parseWatchlist, toggleSaved, type SavedCard } from './watchlist'

const pikachu: SavedCard = { cardId: 'sv03.5-025', lang: 'de', savedAt: '2026-10-12T10:00:00.000Z' }

describe('toggleSaved', () => {
  it('notes a card in front of the others', () => {
    const list = toggleSaved([pikachu], 'sv03.5-006', 'de', '2026-10-12T11:00:00.000Z')

    expect(list).toEqual([{ cardId: 'sv03.5-006', lang: 'de', savedAt: '2026-10-12T11:00:00.000Z' }, pikachu])
  })

  it('takes a noted card off the list again', () => {
    expect(toggleSaved([pikachu], 'sv03.5-025', 'de', 'later')).toEqual([])
  })

  it('tells the same card in another language apart', () => {
    const list = toggleSaved([pikachu], 'sv03.5-025', 'en', 'later')

    expect(list).toHaveLength(2)
    expect(isSaved(list, 'sv03.5-025', 'en')).toBe(true)
    expect(isSaved(list, 'sv03.5-025', 'de')).toBe(true)
    expect(isSaved(list, 'sv03.5-025', 'ja')).toBe(false)
    expect(toggleSaved(list, 'sv03.5-025', 'en', 'later')).toEqual([pikachu])
  })

  it('leaves the given list as it is', () => {
    const list = [pikachu]

    toggleSaved(list, 'sv03.5-006', 'de', 'later')

    expect(list).toEqual([pikachu])
  })
})

describe('parseWatchlist', () => {
  it('reads what was stored', () => {
    expect(parseWatchlist(JSON.stringify([pikachu]))).toEqual([pikachu])
  })

  it('gives an empty list for anything that is not a list', () => {
    expect(parseWatchlist(null)).toEqual([])
    expect(parseWatchlist('')).toEqual([])
    expect(parseWatchlist('not json')).toEqual([])
    expect(parseWatchlist('{"cardId":"x"}')).toEqual([])
  })

  it('leaves out entries it cannot read and ones that are there twice', () => {
    const stored = JSON.stringify([
      pikachu,
      { cardId: 'sv03.5-006', lang: 'xx' },
      { lang: 'de' },
      'text',
      null,
      pikachu,
      { cardId: 'SV2a-006', lang: 'ja' },
    ])

    expect(parseWatchlist(stored)).toEqual([pikachu, { cardId: 'SV2a-006', lang: 'ja', savedAt: '' }])
  })
})
