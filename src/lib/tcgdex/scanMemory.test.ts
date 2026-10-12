import { describe, expect, it } from 'vitest'
import { createScanMemory, FOLDER_MEMORY_MS, MISSES_FOR_FOLDER, scanFolder } from './scanMemory'

const gallery = (card: string, quality = 'high') => `https://assets.tcgdex.net/en/swsh/swsh12.5gg/${card}/${quality}.webp`

function memory(stored: string | null = null, clock = { now: 1_000_000 }) {
  const storage = { value: stored }
  const scans = createScanMemory(
    {
      read: () => storage.value,
      write: (value) => {
        storage.value = value
      },
    },
    () => clock.now,
  )
  return { scans, storage, clock }
}

describe('scanFolder', () => {
  it('names the set a picture belongs to', () => {
    expect(scanFolder(gallery('GG01'))).toBe('https://assets.tcgdex.net/en/swsh/swsh12.5gg')
    expect(scanFolder('https://images.pokemontcg.io/swsh12pt5gg/GG01_hires.png')).toBeUndefined()
    expect(scanFolder('https://assets.tcgdex.net/en/swsh/swsh12.5gg/logo.webp')).toBeUndefined()
  })
})

describe('what is remembered about missing pictures', () => {
  it('does not ask twice for a picture that was not there', () => {
    const { scans } = memory()

    expect(scans.isMissing(gallery('GG01'))).toBe(false)
    scans.noteMissing(gallery('GG01'))
    expect(scans.isMissing(gallery('GG01'))).toBe(true)
    // other cards of the set are still worth a try
    expect(scans.isMissing(gallery('GG02'))).toBe(false)
  })

  it('takes a set for having no scans after a few cards without one', () => {
    const { scans, storage } = memory()

    for (let card = 1; card < MISSES_FOR_FOLDER; card++) scans.noteMissing(gallery(`GG0${card}`))
    // the small and the large picture of one card are one card
    scans.noteMissing(gallery('GG01', 'low'))
    expect(scans.isMissing(gallery('GG50'))).toBe(false)

    scans.noteMissing(gallery(`GG0${MISSES_FOR_FOLDER}`))
    expect(scans.isMissing(gallery('GG50'))).toBe(true)
    expect(scans.isMissing(gallery('GG50', 'low'))).toBe(true)
    // another set is another matter
    expect(scans.isMissing('https://assets.tcgdex.net/en/sv/sv03.5/025/high.webp')).toBe(false)
    expect(storage.value).toContain('swsh12.5gg')
  })

  it('knows that the next time the app is opened, for a week', () => {
    const first = memory()
    for (let card = 1; card <= MISSES_FOR_FOLDER; card++) first.scans.noteMissing(gallery(`GG0${card}`))

    const later = memory(first.storage.value, { now: first.clock.now + FOLDER_MEMORY_MS - 1 })
    expect(later.scans.isMissing(gallery('GG70'))).toBe(true)
    const muchLater = memory(first.storage.value, { now: first.clock.now + FOLDER_MEMORY_MS })
    expect(muchLater.scans.isMissing(gallery('GG70'))).toBe(false)
  })

  it('never writes a set off in which a picture was found', () => {
    const { scans, storage } = memory()

    scans.noteFound(gallery('GG05'))
    for (let card = 1; card <= MISSES_FOR_FOLDER + 2; card++) scans.noteMissing(gallery(`GG0${card}`))
    expect(scans.isMissing(gallery('GG50'))).toBe(false)
    // the cards that were missing still are
    expect(scans.isMissing(gallery('GG01'))).toBe(true)
    expect(storage.value).toBeNull()
  })

  it('takes a set back when one of its pictures turns up after all', () => {
    const { scans, storage } = memory()
    for (let card = 1; card <= MISSES_FOR_FOLDER; card++) scans.noteMissing(gallery(`GG0${card}`))

    scans.noteFound(gallery('GG50'))

    expect(scans.isMissing(gallery('GG60'))).toBe(false)
    expect(storage.value).toBe('{}')
  })

  it('starts empty when what was stored cannot be read', () => {
    expect(memory('not json').scans.isMissing(gallery('GG01'))).toBe(false)
    expect(memory('[1]').scans.isMissing(gallery('GG01'))).toBe(false)
  })
})
