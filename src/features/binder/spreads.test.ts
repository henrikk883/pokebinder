import { describe, expect, it } from 'vitest'
import { buildSpreads, clampSpread, clampZoom, pageNumbersOf, spreadOfPage } from './spreads'

describe('buildSpreads', () => {
  it('puts page 1 alone on the right, next to the inside of the cover', () => {
    expect(buildSpreads(1)).toEqual([{ index: 0, left: 'cover', right: 0 }])
  })

  it('pairs the following pages: 2–3, 4–5, …', () => {
    expect(buildSpreads(5)).toEqual([
      { index: 0, left: 'cover', right: 0 },
      { index: 1, left: 1, right: 2 },
      { index: 2, left: 3, right: 4 },
    ])
  })

  it('leaves the right side empty after a last page on the left', () => {
    expect(buildSpreads(4)).toEqual([
      { index: 0, left: 'cover', right: 0 },
      { index: 1, left: 1, right: 2 },
      { index: 2, left: 3, right: null },
    ])
  })

  it('shows just the cover for a binder without pages', () => {
    expect(buildSpreads(0)).toEqual([{ index: 0, left: 'cover', right: null }])
  })

  it('shows every page exactly once', () => {
    for (const pageCount of [1, 2, 3, 8, 21]) {
      const shown = buildSpreads(pageCount).flatMap(pageNumbersOf)
      expect(shown).toEqual(Array.from({ length: pageCount }, (_, i) => i + 1))
    }
  })
})

describe('spreadOfPage', () => {
  it('finds the spread a page is on', () => {
    const spreads = buildSpreads(7)
    for (let page = 0; page < 7; page++) {
      const spread = spreads[spreadOfPage(page)]
      expect([spread?.left, spread?.right]).toContain(page)
    }
  })
})

describe('pageNumbersOf', () => {
  it('numbers pages from 1 and skips cover and empty sides', () => {
    expect(pageNumbersOf({ index: 0, left: 'cover', right: 0 })).toEqual([1])
    expect(pageNumbersOf({ index: 2, left: 3, right: 4 })).toEqual([4, 5])
    expect(pageNumbersOf({ index: 2, left: 3, right: null })).toEqual([4])
    expect(pageNumbersOf({ index: 0, left: 'cover', right: null })).toEqual([])
  })
})

describe('limits', () => {
  it('keeps the zoom between 50 and 150 % in steps of 5', () => {
    expect(clampZoom(85)).toBe(85)
    expect(clampZoom(45)).toBe(50)
    expect(clampZoom(155)).toBe(150)
    expect(clampZoom(87)).toBe(85)
  })

  it('keeps the spread inside the binder', () => {
    expect(clampSpread(-1, 3)).toBe(0)
    expect(clampSpread(1, 3)).toBe(1)
    expect(clampSpread(9, 3)).toBe(2)
    expect(clampSpread(2, 0)).toBe(0)
  })
})
