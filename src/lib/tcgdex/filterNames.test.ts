import { describe, expect, it } from 'vitest'
import { filterNameIn } from './filterNames'

describe('filterNameIn', () => {
  it('names a type, a kind of card and a rarity in the other language', () => {
    expect(filterNameIn('Feuer', 'de', 'en')).toBe('Fire')
    expect(filterNameIn('Fire', 'en', 'de')).toBe('Feuer')
    expect(filterNameIn('Pokémon', 'de', 'en')).toBe('Pokemon')
    expect(filterNameIn('Selten, besondere Illustration', 'de', 'ja')).toBe('Special illustration rare')
    expect(filterNameIn('Illustration rare', 'ja', 'de')).toBe('Selten, Illustration')
  })

  it('leaves a name as it is between languages that share their names', () => {
    expect(filterNameIn('Fire', 'en', 'ja')).toBe('Fire')
    expect(filterNameIn('Feuer', 'de', 'de')).toBe('Feuer')
  })

  it('keeps names that are the same everywhere, and those it does not know', () => {
    expect(filterNameIn('Promo', 'de', 'en')).toBe('Promo')
    expect(filterNameIn('Trainer', 'en', 'de')).toBe('Trainer')
    expect(filterNameIn('Character Rare', 'ja', 'de')).toBe('Character Rare')
  })

  it('finds the way back for every name', () => {
    for (const name of ['Feuer', 'Unlicht', 'Energie', 'Häufig', 'ultraselten, Schillernd', 'selten, Primus']) {
      expect(filterNameIn(filterNameIn(name, 'de', 'en'), 'en', 'de')).toBe(name)
    }
  })
})
