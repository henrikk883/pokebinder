import { describe, expect, it } from 'vitest'
import {
  buildSpreads,
  clampSpread,
  clampZoom,
  fitZoom,
  pageNumbersOf,
  spreadOfPage,
} from './spreads'

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

describe('fitZoom', () => {
  // the binder as it is 784 × 540 at 80 %
  const at = (zoom: number) => ({ width: (980 * zoom) / 100, height: (675 * zoom) / 100 })

  it('keeps the usual zoom where the binder fits', () => {
    expect(fitZoom(80, at(80), { width: 840, height: 560 })).toBe(80)
    expect(fitZoom(80, at(80), at(80))).toBe(80)
  })

  it('goes down in steps of five until the binder fits, by height or by width', () => {
    // a tablet in landscape: not high enough
    expect(fitZoom(80, at(80), { width: 880, height: 479 })).toBe(70)
    expect(fitZoom(70, at(70), { width: 880, height: 479 })).toBe(70)
    // a narrow window: not wide enough
    expect(fitZoom(80, at(80), { width: 600, height: 900 })).toBe(60)
  })

  it('takes at least one step when the binder is a hair too large', () => {
    expect(fitZoom(80, { width: 784, height: 541 }, { width: 840, height: 540 })).toBe(75)
  })

  it('comes back up when there is more room, but not above the usual zoom', () => {
    expect(fitZoom(60, at(60), { width: 880, height: 479 })).toBe(70)
    expect(fitZoom(60, at(60), { width: 3000, height: 2000 })).toBe(80)
  })

  it('does not go below the smallest zoom', () => {
    expect(fitZoom(80, at(80), { width: 200, height: 100 })).toBe(50)
    expect(fitZoom(50, at(50), { width: 200, height: 100 })).toBe(50)
  })

  it('leaves the zoom alone while nothing is laid out yet', () => {
    expect(fitZoom(80, { width: 0, height: 0 }, { width: 800, height: 600 })).toBe(80)
    expect(fitZoom(80, at(80), { width: 0, height: 0 })).toBe(80)
  })
})

describe('one page at a time (phone)', () => {
  it('opens every page on its own, without the cover', () => {
    expect(buildSpreads(3, true)).toEqual([
      { index: 0, left: null, right: 0, single: true },
      { index: 1, left: null, right: 1, single: true },
      { index: 2, left: null, right: 2, single: true },
    ])
    expect(buildSpreads(3, true).map(pageNumbersOf)).toEqual([[1], [2], [3]])
  })

  it('still has something to show for a binder without pages', () => {
    expect(buildSpreads(0, true)).toEqual([{ index: 0, left: null, right: null, single: true }])
  })

  it('finds a page at its own index', () => {
    expect([0, 1, 2, 5].map((page) => spreadOfPage(page, true))).toEqual([0, 1, 2, 5])
    // with two pages open, as before
    expect([0, 1, 2, 5].map((page) => spreadOfPage(page))).toEqual([0, 1, 1, 3])
  })
})
