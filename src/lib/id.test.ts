import { describe, expect, it } from 'vitest'
import { newId } from './id'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('newId', () => {
  it('uses the id of the browser where there is one', () => {
    const source = { randomUUID: () => 'from-the-browser', getRandomValues: crypto.getRandomValues.bind(crypto) }

    expect(newId(source)).toBe('from-the-browser')
    expect(newId()).toMatch(UUID_V4)
  })

  it('makes a UUID of its own on pages without one (not https, not localhost)', () => {
    const source = { getRandomValues: crypto.getRandomValues.bind(crypto) }

    const ids = Array.from({ length: 50 }, () => newId(source))

    for (const id of ids) expect(id).toMatch(UUID_V4)
    expect(new Set(ids).size).toBe(50)
  })
})
