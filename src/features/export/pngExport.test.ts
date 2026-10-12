import { describe, expect, it } from 'vitest'
import { exportScale, exportSelector, PAGE_EXPORT_WIDTH, pngFileName } from './pngExport'

describe('pngFileName', () => {
  it('names the file after binder and page', () => {
    expect(pngFileName('Kanto Collection', 4)).toBe('kanto-collection-seite-4.png')
    expect(pngFileName('Kanto Collection', 12)).toBe('kanto-collection-seite-12.png')
  })

  it('copes with odd names', () => {
    expect(pngFileName('Größe & Stärke!', 1)).toBe('grosse-starke-seite-1.png')
    expect(pngFileName('ポケモン', 1)).toBe('binder-seite-1.png')
  })
})

describe('exportScale', () => {
  it('reaches the wanted width whatever the zoom on screen', () => {
    // at 80 % zoom a page is shown about 370 px wide, at 150 % about 700 px
    expect(370 * exportScale(370, PAGE_EXPORT_WIDTH)).toBeCloseTo(1500)
    expect(700 * exportScale(700, PAGE_EXPORT_WIDTH)).toBeCloseTo(1500)
  })

  it('does not divide by zero for an element that is not laid out', () => {
    expect(exportScale(0, PAGE_EXPORT_WIDTH)).toBe(1)
  })
})

describe('exportSelector', () => {
  it('points at one page', () => {
    expect(exportSelector(3)).toBe('[data-export="page-3"]')
  })
})
