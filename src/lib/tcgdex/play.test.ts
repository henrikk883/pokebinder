import { describe, expect, it } from 'vitest'
import { playInfoOf } from './play'

describe('playInfoOf', () => {
  it('tells Pokémon, trainers and energy apart, in English and in German', () => {
    expect(playInfoOf({ category: 'Pokemon' }).category).toBe('pokemon')
    expect(playInfoOf({ category: 'Pokémon' }).category).toBe('pokemon')
    expect(playInfoOf({ category: 'Trainer' }).category).toBe('trainer')
    expect(playInfoOf({ category: 'Energy' }).category).toBe('energy')
    expect(playInfoOf({ category: 'Energie' }).category).toBe('energy')
    expect(playInfoOf({ category: 'ポケモン' }).category).toBe('unknown')
    expect(playInfoOf({}).category).toBe('unknown')
  })

  it('knows basic energy from special energy', () => {
    expect(playInfoOf({ category: 'Energy', energyType: 'Normal' }).basicEnergy).toBe(true)
    expect(playInfoOf({ category: 'Energy', energyType: 'Special' }).basicEnergy).toBe(false)
    expect(playInfoOf({ category: 'Energy' }).basicEnergy).toBe(false)
    // a Pokémon of the type "Normal" is no energy
    expect(playInfoOf({ category: 'Pokemon', energyType: 'Normal' }).basicEnergy).toBe(false)
  })

  it('passes on where the card may be played, if TCGdex says so', () => {
    expect(playInfoOf({ category: 'Pokemon', legal: { standard: false, expanded: true } }).legal).toEqual({
      standard: false,
      expanded: true,
    })
    expect(playInfoOf({ category: 'Pokemon', legal: { expanded: null } }).legal).toEqual({ standard: false, expanded: false })
    expect('legal' in playInfoOf({ category: 'Pokemon' })).toBe(false)
  })
})
