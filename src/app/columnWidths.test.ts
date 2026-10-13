import { describe, expect, it } from 'vitest'
import { clampColumnWidth, DEFAULT_COLUMN_WIDTH, MAX_COLUMN_WIDTH, MIN_COLUMN_WIDTH, parseColumnWidths } from './columnWidths'

describe('clampColumnWidth', () => {
  it('gives the width asked for where there is room', () => {
    expect(clampColumnWidth(420, 1600, 300)).toBe(420)
    expect(clampColumnWidth(420.4, 1600, 300)).toBe(420)
  })

  it('stays within the limits of a column', () => {
    expect(clampColumnWidth(100, 1600, 300)).toBe(MIN_COLUMN_WIDTH)
    expect(clampColumnWidth(5000, 3000, 300)).toBe(MAX_COLUMN_WIDTH)
  })

  it('leaves the binder its room beside the other column', () => {
    // 1400 wide, the other column 300, the binder at least 360: 740 are left, the limit is lower
    expect(clampColumnWidth(900, 1400, 300)).toBe(MAX_COLUMN_WIDTH)
    expect(clampColumnWidth(900, 1200, 300)).toBe(540)
    // with the other column folded away there is more
    expect(clampColumnWidth(900, 1200, 0)).toBe(MAX_COLUMN_WIDTH)
  })

  it('keeps the least width on a screen too small for everything', () => {
    expect(clampColumnWidth(400, 800, 300)).toBe(MIN_COLUMN_WIDTH)
  })
})

describe('parseColumnWidths', () => {
  const usual = { left: DEFAULT_COLUMN_WIDTH, right: DEFAULT_COLUMN_WIDTH }

  it('reads what was stored', () => {
    expect(parseColumnWidths('{"left":420,"right":310.6}')).toEqual({ left: 420, right: 311 })
  })

  it('starts as usual where nothing is stored or it cannot be read', () => {
    expect(parseColumnWidths(null)).toEqual(usual)
    expect(parseColumnWidths('not json')).toEqual(usual)
    expect(parseColumnWidths('[1,2]')).toEqual(usual)
  })

  it('takes each side on its own and leaves out what is out of bounds', () => {
    expect(parseColumnWidths('{"left":50,"right":400}')).toEqual({ left: DEFAULT_COLUMN_WIDTH, right: 400 })
    expect(parseColumnWidths('{"left":"wide","right":99999}')).toEqual(usual)
  })
})
