import { describe, expect, it } from 'vitest'
import {
  cardImageSources,
  cardImageUrl,
  englishCardImage,
  pokemontcgCardImages,
  pokemontcgSetId,
} from './images'

describe('pokemontcgSetId', () => {
  it.each([
    // subsets TCGdex has no scans of at all
    ['swsh12.5gg', 'swsh12pt5gg'],
    ['swsh9tg', 'swsh9tg'],
    ['swsh4.5sv', 'swsh45sv'],
    ['sm7.5', 'sm75'],
    ['smp', 'smp'],
    ['swshp', 'swshp'],
    ['svp', 'svp'],
    ['ecard2', 'ecard2'],
    // regular sets: numbers lose their leading zeros, half sets are written "pt5" …
    ['sv03.5', 'sv3pt5'],
    ['sv08.5', 'sv8pt5'],
    ['sv01', 'sv1'],
    ['swsh12.5', 'swsh12pt5'],
    ['me02.5', 'me2pt5'],
    // … except in the series that write them without it
    ['swsh3.5', 'swsh35'],
    ['swsh4.5', 'swsh45'],
    ['sm3.5', 'sm35'],
    ['sm11.5', 'sm115'],
    ['swsh3', 'swsh3'],
    ['cel25', 'cel25'],
    ['base1', 'base1'],
  ])('maps %s to %s', (tcgdex, pokemontcg) => {
    expect(pokemontcgSetId(tcgdex)).toBe(pokemontcg)
  })

  it('leaves ids it cannot read as they are', () => {
    expect(pokemontcgSetId('30th-c')).toBe('30th-c')
  })
})

describe('pokemontcgCardImages', () => {
  it('offers the number as it is and without leading zeros', () => {
    expect(pokemontcgCardImages({ localId: '025' }, { id: 'sv03.5' }, 'small')).toEqual([
      'https://images.pokemontcg.io/sv3pt5/025.png',
      'https://images.pokemontcg.io/sv3pt5/25.png',
    ])
  })

  it('offers one address where there are no zeros to strip', () => {
    expect(pokemontcgCardImages({ localId: 'GG01' }, { id: 'swsh12.5gg' }, 'small')).toEqual([
      'https://images.pokemontcg.io/swsh12pt5gg/GG01.png',
    ])
    expect(pokemontcgCardImages({ localId: 'SM195' }, { id: 'smp' }, 'small')).toEqual([
      'https://images.pokemontcg.io/smp/SM195.png',
    ])
  })

  it('takes the high resolution scan for the binder', () => {
    expect(pokemontcgCardImages({ localId: 'TG03' }, { id: 'swsh11tg' }, 'large')).toEqual([
      'https://images.pokemontcg.io/swsh11tg/TG03_hires.png',
    ])
  })

  it('does not ask for Japanese sets, which that database does not have', () => {
    expect(pokemontcgCardImages({ localId: '006' }, { id: 'SV2a' }, 'small')).toEqual([])
  })
})

describe('cardImageSources', () => {
  const set = { id: 'swsh12.5gg', seriesId: 'swsh' }

  it('shows the scan in the card language and nothing else when there is one', () => {
    const card = { localId: '025', image: 'https://assets.tcgdex.net/de/sv/sv03.5/025' }

    expect(cardImageSources(card, { id: 'sv03.5', seriesId: 'sv' }, 'small')).toEqual({
      own: 'https://assets.tcgdex.net/de/sv/sv03.5/025/low.webp',
      substitutes: [],
    })
    expect(cardImageSources(card, undefined, 'large').own).toBe(cardImageUrl(card.image, 'large'))
  })

  it('otherwise tries the English scan of TCGdex first, then the second source', () => {
    expect(cardImageSources({ localId: 'GG01' }, set, 'large')).toEqual({
      own: undefined,
      substitutes: [
        'https://assets.tcgdex.net/en/swsh/swsh12.5gg/GG01/high.webp',
        'https://images.pokemontcg.io/swsh12pt5gg/GG01_hires.png',
      ],
    })
    expect(cardImageSources({ localId: 'GG01' }, set, 'small').substitutes[0]).toBe(
      cardImageUrl(englishCardImage({ localId: 'GG01' }, set), 'small'),
    )
  })

  it('has nothing to offer while the set of the card is unknown', () => {
    expect(cardImageSources({ localId: 'GG01' }, undefined, 'small')).toEqual({
      own: undefined,
      substitutes: [],
    })
  })
})
