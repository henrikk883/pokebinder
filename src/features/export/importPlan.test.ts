import { describe, expect, it } from 'vitest'
import type { Binder } from '../../types/binder'
import { canChoose, planImport, replacesSomething, suggestedImport } from './importPlan'

const binder = (id: string, updatedAt: string, name = id) => ({ id, name, updatedAt }) as Binder

const monday = '2026-10-12T10:00:00.000Z'
const tuesday = '2026-10-13T10:00:00.000Z'

describe('planImport', () => {
  it('tells new binders from ones that are here already, and which side has the later version', () => {
    const onDevice = [binder('kanto', monday), binder('johto', tuesday), binder('hoenn', monday), binder('only-here', monday)]
    const inFile = [binder('kanto', tuesday), binder('johto', monday), binder('hoenn', monday), binder('sinnoh', monday)]

    const plan = planImport(inFile, onDevice)

    expect(plan.map((entry) => [entry.binder.id, entry.kind])).toEqual([
      ['kanto', 'newer'],
      ['johto', 'older'],
      ['hoenn', 'same'],
      ['sinnoh', 'new'],
    ])
    expect(plan[0]?.local?.updatedAt).toBe(monday)
    expect(plan[3]?.local).toBeUndefined()
  })

  it('keeps the order of the file and says nothing about binders that are only here', () => {
    const plan = planImport([binder('b', monday), binder('a', monday)], [binder('c', monday)])

    expect(plan.map((entry) => entry.binder.id)).toEqual(['b', 'a'])
  })
})

describe('what is asked and suggested', () => {
  const onDevice = [binder('kanto', monday), binder('johto', tuesday), binder('hoenn', monday)]

  it('asks only when a binder of this device would be replaced', () => {
    expect(replacesSomething(planImport([binder('sinnoh', monday)], onDevice))).toBe(false)
    expect(replacesSomething(planImport([binder('hoenn', monday)], onDevice))).toBe(false)
    expect(replacesSomething(planImport([binder('kanto', tuesday)], onDevice))).toBe(true)
    expect(replacesSomething(planImport([binder('johto', monday)], onDevice))).toBe(true)
    expect(replacesSomething([])).toBe(false)
  })

  it('suggests what is new or newer and leaves the later version of this device alone', () => {
    const plan = planImport(
      [binder('kanto', tuesday), binder('johto', monday), binder('hoenn', monday), binder('sinnoh', monday)],
      onDevice,
    )

    expect(suggestedImport(plan)).toEqual(['kanto', 'sinnoh'])
    expect(plan.map(canChoose)).toEqual([true, true, false, true])
  })
})
