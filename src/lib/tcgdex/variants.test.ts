import { describe, expect, it } from 'vitest'
import { baseVariant, variantsOf, type RawVariant } from './variants'

const print = (type: string, foil: string | null = null, extra: Partial<RawVariant> = {}): RawVariant => ({
  type,
  foil,
  stamp: null,
  size: 'standard',
  ...extra,
})

describe('variantsOf', () => {
  it('reads a common card: normal and reverse holo', () => {
    expect(variantsOf([print('normal'), print('reverse')])).toEqual(['normal', 'reverse'])
  })

  it('gives each special reverse pattern its own finish (Prismatic Evolutions)', () => {
    expect(
      variantsOf([print('normal'), print('reverse'), print('reverse', 'pokeball'), print('reverse', 'masterball')]),
    ).toEqual(['normal', 'reverse', 'masterball', 'pokeball'])
  })

  it('knows patterns it has never heard of (Ascended Heroes)', () => {
    expect(
      variantsOf([
        print('normal'),
        print('reverse', 'energy'),
        print('reverse', 'friendball'),
        print('reverse', 'team-rocket'),
      ]),
    ).toEqual(['normal', 'energy', 'friendball', 'team-rocket'])
  })

  it('reads a card that only exists as holo, also in gold', () => {
    expect(variantsOf([print('holo')])).toEqual(['holo'])
    expect(variantsOf([print('holo', 'gold')])).toEqual(['holo'])
  })

  it('keeps both for a card printed with and without holo', () => {
    expect(variantsOf([print('holo'), print('normal'), print('reverse')])).toEqual(['normal', 'holo', 'reverse'])
  })

  it('leaves out stamped prints, jumbo cards and foils from special products', () => {
    expect(
      variantsOf([
        print('normal'),
        print('normal', null, { stamp: ['snowflake'] }),
        print('reverse', 'cosmos'),
        print('holo', 'cosmos'),
        print('holo', null, { size: 'jumbo' }),
        print('reverse', null, { stamp: ['set-logo'] }),
      ]),
    ).toEqual(['normal'])
  })

  it('still names a finish for promos that only exist stamped or in a special foil', () => {
    expect(variantsOf([print('holo', null, { stamp: ['set-logo'] }), print('holo', null, { stamp: ['staff'] })])).toEqual(['holo'])
    expect(variantsOf([print('normal', null, { stamp: ['worlds-2024'] })])).toEqual(['normal'])
    expect(variantsOf([print('holo', 'cosmos')])).toEqual(['holo'])
  })

  it('falls back to normal when TCGdex knows no prints', () => {
    expect(variantsOf([])).toEqual(['normal'])
  })
})

describe('baseVariant', () => {
  it('is normal where it exists, otherwise the first finish', () => {
    expect(baseVariant(['normal', 'reverse', 'pokeball'])).toBe('normal')
    expect(baseVariant(['holo'])).toBe('holo')
    expect(baseVariant([])).toBe('normal')
  })
})
