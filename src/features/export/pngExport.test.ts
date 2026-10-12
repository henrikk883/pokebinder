import { describe, expect, it } from 'vitest'
import { exportScale, exportSelector, pngFileName, SPREAD_EXPORT_WIDTH } from './pngExport'

describe('pngFileName', () => {
  it('names the file after binder and pages', () => {
    expect(pngFileName('Kanto Collection', { kind: 'spread', pages: [2, 3] })).toBe(
      'kanto-collection-seiten-2-3.png',
    )
    expect(pngFileName('Kanto Collection', { kind: 'spread', pages: [1] })).toBe('kanto-collection-seite-1.png')
    expect(pngFileName('Kanto Collection', { kind: 'page', page: 5 })).toBe('kanto-collection-seite-5.png')
  })

  it('copes with an open cover without pages and with odd names', () => {
    expect(pngFileName('Größe & Stärke!', { kind: 'spread', pages: [] })).toBe('grosse-starke-cover.png')
    expect(pngFileName('ポケモン', { kind: 'page', page: 1 })).toBe('binder-seite-1.png')
  })
})

describe('exportScale', () => {
  it('reaches the wanted width whatever the zoom on screen', () => {
    // 80 % zoom shows the spread 784 px wide, 150 % shows it 1470 px wide
    expect(784 * exportScale(784, SPREAD_EXPORT_WIDTH)).toBeCloseTo(3000)
    expect(1470 * exportScale(1470, SPREAD_EXPORT_WIDTH)).toBeCloseTo(3000)
  })

  it('does not divide by zero for an element that is not laid out', () => {
    expect(exportScale(0, SPREAD_EXPORT_WIDTH)).toBe(1)
  })
})

describe('exportSelector', () => {
  it('points at the spread or at one page', () => {
    expect(exportSelector({ kind: 'spread', pages: [2, 3] })).toBe('[data-export="spread"]')
    expect(exportSelector({ kind: 'page', page: 3 })).toBe('[data-export="page-3"]')
  })
})
