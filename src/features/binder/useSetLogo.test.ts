import { describe, expect, it } from 'vitest'
import { createBinder } from './binderModel'
import { wantsSetLogo } from './useSetLogo'

describe('wantsSetLogo', () => {
  const masterSet = createBinder({ name: '151', mode: 'masterSet', setId: 'sv03.5' })

  it('puts the logo of the set on a master set binder that has no picture of its own', () => {
    expect(wantsSetLogo(masterSet)).toBe(true)
  })

  it('leaves a cover the collector chose alone', () => {
    expect(wantsSetLogo({ ...masterSet, cover: { title: '151', assetId: 'asset-1' } })).toBe(false)
  })

  it('has no logo for a binder that is of no set', () => {
    expect(wantsSetLogo(createBinder({ name: 'Bunt' }))).toBe(false)
    expect(wantsSetLogo({ mode: 'masterSet', cover: { title: 'Ohne Set' } })).toBe(false)
  })
})
