import { describe, expect, it } from 'vitest'
import { changeOf, dayOf, parseHistory, recordPoint, seriesOf, thinHistory, type ValuePoint } from './valueHistory'

const point = (date: string, binders: Record<string, number> = { a: 1 }): ValuePoint => ({ date, binders })

/** `count` days in a row, ending on `last`. */
function days(last: string, count: number): ValuePoint[] {
  const end = Date.parse(`${last}T00:00:00.000Z`)
  return Array.from({ length: count }, (_, i) => point(new Date(end - (count - 1 - i) * 86_400_000).toISOString().slice(0, 10)))
}

describe('recordPoint', () => {
  it('adds a day, and brings a day already noted up to date', () => {
    let history = recordPoint([], '2026-10-12', { a: 10 })
    history = recordPoint(history, '2026-10-13', { a: 12, b: 3 })
    history = recordPoint(history, '2026-10-13', { a: 13, b: 3 })

    expect(history).toEqual([point('2026-10-12', { a: 10 }), point('2026-10-13', { a: 13, b: 3 })])
  })

  it('keeps the days in order whatever order they come in', () => {
    const history = recordPoint([point('2026-10-13')], '2026-10-12', { a: 1 })

    expect(history.map((entry) => entry.date)).toEqual(['2026-10-12', '2026-10-13'])
    expect(dayOf('2026-10-12T23:59:59.000Z')).toBe('2026-10-12')
  })
})

describe('thinHistory', () => {
  it('keeps every day of the last ninety', () => {
    const history = days('2026-10-12', 90)

    expect(thinHistory(history, '2026-10-12')).toEqual(history)
  })

  it('keeps one day a week of what is older', () => {
    const history = days('2026-10-12', 90 + 70)
    const thinned = thinHistory(history, '2026-10-12')
    const old = thinned.slice(0, thinned.length - 90)

    expect(thinned.slice(-90)).toEqual(history.slice(-90))
    // seventy older days are ten weeks, give or take the ones cut at either end
    expect(old.length).toBeGreaterThanOrEqual(10)
    expect(old.length).toBeLessThanOrEqual(11)
    // and thinning what is thinned changes nothing
    expect(thinHistory(thinned, '2026-10-12')).toEqual(thinned)
  })
})

describe('seriesOf and changeOf', () => {
  const history = [
    point('2026-10-01', { a: 10.1, b: 0.2 }),
    point('2026-10-05', { a: 11 }),
    point('2026-10-12', { a: 12.5, b: 1 }),
  ]

  it('adds the binders up for the collection as a whole', () => {
    expect(seriesOf(history, null)).toEqual([
      { date: '2026-10-01', value: 10.3 },
      { date: '2026-10-05', value: 11 },
      { date: '2026-10-12', value: 13.5 },
    ])
  })

  it('follows one binder on the days it was noted', () => {
    expect(seriesOf(history, 'b')).toEqual([
      { date: '2026-10-01', value: 0.2 },
      { date: '2026-10-12', value: 1 },
    ])
    expect(seriesOf(history, 'unknown')).toEqual([])
  })

  it('says by how much the value changed since the first day', () => {
    expect(changeOf(seriesOf(history, null))).toEqual({ since: '2026-10-01', amount: 3.2 })
    expect(changeOf(seriesOf(history, 'b'))).toEqual({ since: '2026-10-01', amount: 0.8 })
    expect(changeOf(seriesOf(history.slice(0, 1), null))).toBeUndefined()
    expect(changeOf([])).toBeUndefined()
  })
})

describe('parseHistory', () => {
  it('reads what was stored, oldest first, and leaves out what cannot be read', () => {
    const text = JSON.stringify([
      point('2026-10-12', { a: 2 }),
      { date: 'gestern', binders: { a: 1 } },
      { date: '2026-10-11', binders: { a: 1, b: 'viel' } },
      { date: '2026-10-10' },
      null,
    ])

    expect(parseHistory(text)).toEqual([point('2026-10-11', { a: 1 }), point('2026-10-12', { a: 2 })])
    expect(parseHistory('{}')).toEqual([])
    expect(parseHistory('not json')).toEqual([])
    expect(parseHistory(null)).toEqual([])
  })
})
