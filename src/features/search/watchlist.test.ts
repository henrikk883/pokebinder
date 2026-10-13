import { describe, expect, it } from 'vitest'
import {
  addList,
  addToList,
  isSaved,
  listsWith,
  mergeWatchlists,
  notedInOtherLangs,
  parseWatchlist,
  parseWatchlists,
  QUICK_LIST_ID,
  removeList,
  renameList,
  savedCardCount,
  toggleInList,
  toggleSaved,
  type SavedCard,
  type Watchlist,
} from './watchlist'

const pikachu: SavedCard = { cardId: 'sv03.5-025', lang: 'de', savedAt: '2026-10-12T10:00:00.000Z' }
const glurak: SavedCard = { cardId: 'sv03.5-006', lang: 'de', savedAt: '2026-10-12T11:00:00.000Z' }

const quick = (cards: SavedCard[] = []): Watchlist => ({ id: QUICK_LIST_ID, name: '', cards })
const buy = (cards: SavedCard[] = []): Watchlist => ({ id: 'buy', name: 'Kaufen', cards })

describe('toggleSaved', () => {
  it('notes a card in front of the others', () => {
    const list = toggleSaved([pikachu], 'sv03.5-006', 'de', '2026-10-12T11:00:00.000Z')

    expect(list).toEqual([glurak, pikachu])
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

describe('several lists', () => {
  it('notes a card on the list that is named and leaves the others alone', () => {
    const lists = toggleInList([quick(), buy()], 'buy', 'sv03.5-025', 'de', pikachu.savedAt)

    expect(lists).toEqual([quick(), buy([pikachu])])
    expect(toggleInList(lists, 'buy', 'sv03.5-025', 'de', 'later')).toEqual([quick(), buy()])
    expect(toggleInList(lists, 'nope', 'sv03.5-025', 'de', 'later')).toEqual(lists)
  })

  it('knows which lists a card is on, and counts a card on two lists once', () => {
    const lists = [quick([pikachu]), buy([pikachu, glurak])]

    expect(listsWith(lists, 'sv03.5-025', 'de')).toEqual([QUICK_LIST_ID, 'buy'])
    expect(listsWith(lists, 'sv03.5-006', 'de')).toEqual(['buy'])
    expect(listsWith(lists, 'sv03.5-025', 'en')).toEqual([])
    expect(savedCardCount(lists)).toBe(2)
    expect(savedCardCount([quick()])).toBe(0)
  })

  it('adds a list at the end, but not one without a name', () => {
    expect(addList([quick()], 'michi', '  Michi-Binder ')).toEqual([quick(), { id: 'michi', name: 'Michi-Binder', cards: [] }])
    expect(addList([quick()], 'x', '   ')).toBeUndefined()
  })

  it('renames and removes lists, but never the quick list', () => {
    const lists = [quick([pikachu]), buy([glurak])]

    expect(renameList(lists, 'buy', ' Einkauf ')[1]).toMatchObject({ id: 'buy', name: 'Einkauf', cards: [glurak] })
    expect(renameList(lists, 'buy', '  ')).toEqual(lists)
    expect(renameList(lists, QUICK_LIST_ID, 'Anders')).toEqual(lists)
    expect(removeList(lists, 'buy')).toEqual([quick([pikachu])])
    expect(removeList(lists, QUICK_LIST_ID)).toEqual(lists)
  })
})

describe('parseWatchlists', () => {
  it('reads what was stored, the quick list first', () => {
    const stored = JSON.stringify([buy([glurak]), quick([pikachu])])

    expect(parseWatchlists(stored)).toEqual([quick([pikachu]), buy([glurak])])
  })

  it('starts with an empty quick list when nothing is stored', () => {
    expect(parseWatchlists(null)).toEqual([quick()])
    expect(parseWatchlists('not json')).toEqual([quick()])
    expect(parseWatchlists('{"id":"quick"}')).toEqual([quick()])
  })

  it('takes over the single list of earlier versions as the quick list', () => {
    const legacy = JSON.stringify([pikachu, glurak])

    expect(parseWatchlists(null, legacy)).toEqual([quick([pikachu, glurak])])
    // once lists are stored, the old one no longer counts
    expect(parseWatchlists(JSON.stringify([quick()]), legacy)).toEqual([quick()])
  })

  it('leaves out lists and cards it cannot read, and ones that are there twice', () => {
    const stored = JSON.stringify([
      quick([pikachu, { cardId: 'x', lang: 'xx', savedAt: '' } as unknown as SavedCard, pikachu]),
      { id: 'buy', name: 'Kaufen', cards: 'none' },
      { id: 'buy', name: 'Noch einmal', cards: [] },
      { id: '', name: 'Ohne Kennung', cards: [] },
      { id: 'noname', name: '  ', cards: [] },
      'text',
      null,
    ])

    expect(parseWatchlists(stored)).toEqual([quick([pikachu]), buy()])
  })
})

describe('parseWatchlist', () => {
  it('reads the cards of the single list of earlier versions', () => {
    expect(parseWatchlist(JSON.stringify([pikachu]))).toEqual([pikachu])
    expect(parseWatchlist(null)).toEqual([])
    expect(parseWatchlist('{"cardId":"x"}')).toEqual([])
  })
})

describe('mergeWatchlists', () => {
  const bisasam: SavedCard = { cardId: 'sv03.5-001', lang: 'de', savedAt: '2026-10-13T09:00:00.000Z' }

  it('adds to a list both sides have the cards it lacks, after its own', () => {
    const merged = mergeWatchlists([quick([pikachu])], [quick([glurak, pikachu])])

    expect(merged).toEqual([quick([pikachu, glurak])])
  })

  it('adds lists only the other side has, and keeps the ones only this side has', () => {
    const mine: Watchlist = { id: 'michi', name: 'Michi-Binder', cards: [bisasam] }

    const merged = mergeWatchlists([quick(), mine], [quick(), buy([glurak])])

    expect(merged).toEqual([quick(), mine, buy([glurak])])
  })

  it('keeps the name a list has on this side', () => {
    const merged = mergeWatchlists([quick(), buy([pikachu])], [quick(), { id: 'buy', name: 'Einkauf', cards: [glurak] }])

    expect(merged[1]).toEqual({ id: 'buy', name: 'Kaufen', cards: [pikachu, glurak] })
  })

  it('changes nothing when the other side brings nothing new', () => {
    const local = [quick([pikachu]), buy([glurak])]

    const merged = mergeWatchlists(local, [quick([pikachu]), buy()])

    expect(merged).toEqual(local)
    // untouched lists stay the very same objects, so nothing is redrawn or recalculated
    expect(merged[0]).toBe(local[0])
    expect(mergeWatchlists(local, [])).toEqual(local)
  })
})

describe('addToList', () => {
  const now = '2026-10-13T09:00:00.000Z'

  it('notes several cards in front of the others, in the order given', () => {
    const lists = addToList([quick([pikachu]), buy()], QUICK_LIST_ID, [{ cardId: 'a-1', lang: 'de' }, { cardId: 'a-2', lang: 'en' }], now)

    expect(lists[0]?.cards).toEqual([
      { cardId: 'a-1', lang: 'de', savedAt: now },
      { cardId: 'a-2', lang: 'en', savedAt: now },
      pikachu,
    ])
    expect(lists[1]?.cards).toEqual([])
  })

  it('leaves a card that is on the list already as it is, and takes each card once', () => {
    const lists = addToList([quick([pikachu])], QUICK_LIST_ID, [pikachu, { cardId: 'a-1', lang: 'de' }, { cardId: 'a-1', lang: 'de' }], now)

    expect(lists[0]?.cards).toEqual([{ cardId: 'a-1', lang: 'de', savedAt: now }, pikachu])
  })

  it('changes nothing where there is nothing new, or no such list', () => {
    const before = [quick([pikachu])]
    expect(addToList(before, QUICK_LIST_ID, [pikachu], now)[0]).toBe(before[0])
    expect(addToList(before, 'nothing', [glurak], now)).toEqual(before)
  })
})

describe('notedInOtherLangs', () => {
  const english: SavedCard = { ...pikachu, lang: 'en' }
  const japanese: SavedCard = { ...pikachu, lang: 'ja' }

  it('says in which other languages a card is noted, and on which lists', () => {
    const lists = [quick([english]), buy([english, japanese])]

    expect(notedInOtherLangs(lists, pikachu.cardId, 'de')).toEqual([
      { lang: 'en', listIds: [QUICK_LIST_ID, 'buy'] },
      { lang: 'ja', listIds: ['buy'] },
    ])
  })

  it('leaves out the language asked in, and knows of nothing for a card that is not noted', () => {
    expect(notedInOtherLangs([quick([pikachu, english])], pikachu.cardId, 'de')).toEqual([{ lang: 'en', listIds: [QUICK_LIST_ID] }])
    expect(notedInOtherLangs([quick([pikachu])], pikachu.cardId, 'de')).toEqual([])
    expect(notedInOtherLangs([quick([pikachu])], glurak.cardId, 'en')).toEqual([])
  })
})
