import { describe, expect, it } from 'vitest'
import type { Binder } from '../../types/binder'
import {
  DEFAULT_SHELF_PREFS,
  moveInOrder,
  parseShelfPrefs,
  shiftInOrder,
  sortBinders,
} from './binderOrder'

const binder = (id: string, name: string, updatedAt: string) => ({ id, name, updatedAt }) as Binder

const kanto = binder('k', 'Kanto', '2026-10-01T10:00:00.000Z')
const aerger = binder('a', 'Ärger im Paradies', '2026-10-03T10:00:00.000Z')
const zehn = binder('z10', 'Binder 10', '2026-10-02T10:00:00.000Z')
const zwei = binder('z2', 'binder 2', '2026-09-01T10:00:00.000Z')
const all = [kanto, aerger, zehn, zwei]

const ids = (binders: Binder[]) => binders.map((entry) => entry.id)

describe('sortBinders', () => {
  it('puts the binder changed last in front', () => {
    expect(ids(sortBinders(all, 'updated'))).toEqual(['a', 'z10', 'k', 'z2'])
  })

  it('sorts by name the German way: umlauts with their vowel, case ignored, 2 before 10', () => {
    expect(ids(sortBinders(all, 'name'))).toEqual(['a', 'z2', 'z10', 'k'])
  })

  it('follows the own order', () => {
    expect(ids(sortBinders(all, 'custom', ['z2', 'k', 'a', 'z10']))).toEqual(['z2', 'k', 'a', 'z10'])
  })

  it('puts binders the own order does not know in front, the newest first', () => {
    expect(ids(sortBinders(all, 'custom', ['k', 'gone', 'z2']))).toEqual(['a', 'z10', 'k', 'z2'])
    expect(ids(sortBinders(all, 'custom'))).toEqual(['a', 'z10', 'k', 'z2'])
  })

  it('leaves the given list as it is', () => {
    sortBinders(all, 'name')

    expect(ids(all)).toEqual(['k', 'a', 'z10', 'z2'])
  })
})

describe('moveInOrder', () => {
  it('puts a binder where another one stands, towards the front or the back', () => {
    expect(moveInOrder(['a', 'b', 'c', 'd'], 'd', 'b')).toEqual(['a', 'd', 'b', 'c'])
    expect(moveInOrder(['a', 'b', 'c', 'd'], 'a', 'c')).toEqual(['b', 'c', 'a', 'd'])
  })

  it('changes nothing when dropped on itself or on something unknown', () => {
    expect(moveInOrder(['a', 'b'], 'a', 'a')).toEqual(['a', 'b'])
    expect(moveInOrder(['a', 'b'], 'a', 'x')).toEqual(['a', 'b'])
    expect(moveInOrder(['a', 'b'], 'x', 'a')).toEqual(['a', 'b'])
  })
})

describe('shiftInOrder', () => {
  it('moves a binder one place and stops at the ends', () => {
    expect(shiftInOrder(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c'])
    expect(shiftInOrder(['a', 'b', 'c'], 'b', 1)).toEqual(['a', 'c', 'b'])
    expect(shiftInOrder(['a', 'b', 'c'], 'a', -1)).toEqual(['a', 'b', 'c'])
    expect(shiftInOrder(['a', 'b', 'c'], 'c', 1)).toEqual(['a', 'b', 'c'])
  })
})

describe('parseShelfPrefs', () => {
  it('reads what was stored', () => {
    expect(parseShelfPrefs('{"sort":"custom","order":["b","a"]}')).toEqual({
      sort: 'custom',
      order: ['b', 'a'],
    })
  })

  it('falls back to the default for anything it cannot read', () => {
    expect(parseShelfPrefs(null)).toEqual(DEFAULT_SHELF_PREFS)
    expect(parseShelfPrefs('not json')).toEqual(DEFAULT_SHELF_PREFS)
    expect(parseShelfPrefs('[]')).toEqual(DEFAULT_SHELF_PREFS)
    expect(parseShelfPrefs('{"sort":"colour","order":["a",3]}')).toEqual({ sort: 'updated', order: ['a'] })
  })
})
