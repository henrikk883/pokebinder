import { describe, expect, it } from 'vitest'
import { nextBase, planSync, type SyncInput } from './syncPlan'

const monday = '2026-10-12T10:00:00.000Z'
const tuesday = '2026-10-13T10:00:00.000Z'
const wednesday = '2026-10-14T10:00:00.000Z'

const here = (id: string, updatedAt: string) => ({ id, updatedAt })
const there = (id: string, updatedAt: string, deleted = false) => ({ id, updatedAt, deleted })

const input = (partial: Partial<SyncInput>): SyncInput => ({
  local: [],
  remote: [],
  base: {},
  deletedLocally: [],
  ...partial,
})

describe('planSync', () => {
  it('has nothing to do when both sides are the same', () => {
    const state = input({ local: [here('a', monday)], remote: [there('a', monday)], base: { a: monday } })

    expect(planSync(state)).toEqual([])
    expect(planSync(input({}))).toEqual([])
  })

  it('sends a binder that only this device has', () => {
    expect(planSync(input({ local: [here('a', monday)] }))).toEqual([{ kind: 'push', id: 'a' }])
  })

  it('fetches a binder that only the server has', () => {
    expect(planSync(input({ remote: [there('a', monday)] }))).toEqual([{ kind: 'pull', id: 'a' }])
  })

  it('sends what changed here and fetches what changed there', () => {
    const state = input({
      local: [here('a', tuesday), here('b', monday)],
      remote: [there('a', monday), there('b', tuesday)],
      base: { a: monday, b: monday },
    })

    expect(planSync(state)).toEqual([
      { kind: 'push', id: 'a' },
      { kind: 'pull', id: 'b' },
    ])
  })

  it('asks when a binder changed on both sides since they last agreed', () => {
    const state = input({ local: [here('a', tuesday)], remote: [there('a', wednesday)], base: { a: monday } })

    expect(planSync(state)).toEqual([
      { kind: 'conflict', id: 'a', localUpdatedAt: tuesday, remoteUpdatedAt: wednesday },
    ])
  })

  it('asks as well when two devices made the same binder apart from each other', () => {
    // never synced, yet there on both sides in different versions: e.g. after reading a backup
    const state = input({ local: [here('a', monday)], remote: [there('a', tuesday)] })

    expect(planSync(state)).toEqual([
      { kind: 'conflict', id: 'a', localUpdatedAt: monday, remoteUpdatedAt: tuesday },
    ])
  })

  it('deletes on the server what was deleted here', () => {
    const state = input({ remote: [there('a', monday)], base: { a: monday }, deletedLocally: ['a'] })

    expect(planSync(state)).toEqual([{ kind: 'deleteRemote', id: 'a' }])
  })

  it('deletes here what was deleted on another device', () => {
    const state = input({ local: [here('a', monday)], remote: [there('a', tuesday, true)], base: { a: monday } })

    expect(planSync(state)).toEqual([{ kind: 'deleteLocal', id: 'a' }])
  })

  it('lets a change win over a deletion on the other side', () => {
    // deleted there, worked on here since: it comes back
    expect(
      planSync(input({ local: [here('a', tuesday)], remote: [there('a', wednesday, true)], base: { a: monday } })),
    ).toEqual([{ kind: 'push', id: 'a' }])
    // deleted here, worked on there since: it comes back as well
    expect(
      planSync(input({ remote: [there('a', tuesday)], base: { a: monday }, deletedLocally: ['a'] })),
    ).toEqual([{ kind: 'pull', id: 'a' }])
  })

  it('sends a binder again that the server has no record of any more', () => {
    // e.g. the store was emptied: what this device has is not thrown away
    expect(planSync(input({ local: [here('a', monday)], base: { a: monday } }))).toEqual([{ kind: 'push', id: 'a' }])
  })

  it('forgets a binder that is gone on both sides', () => {
    expect(planSync(input({ remote: [there('a', tuesday, true)], base: { a: monday }, deletedLocally: ['a'] }))).toEqual([
      { kind: 'forget', id: 'a' },
    ])
    expect(planSync(input({ base: { a: monday } }))).toEqual([{ kind: 'forget', id: 'a' }])
    // deleted elsewhere and never here: nothing to do, nothing to forget
    expect(planSync(input({ remote: [there('a', monday, true)] }))).toEqual([])
  })

  it('handles each binder on its own, in a fixed order', () => {
    const state = input({
      local: [here('c', tuesday), here('a', monday), here('d', monday)],
      remote: [there('b', monday), there('c', monday), there('d', monday)],
      base: { c: monday, d: monday },
    })

    expect(planSync(state)).toEqual([
      { kind: 'push', id: 'a' },
      { kind: 'pull', id: 'b' },
      { kind: 'push', id: 'c' },
    ])
  })
})

describe('nextBase', () => {
  it('records what both sides have once the actions are done', () => {
    const state = input({
      local: [here('same', monday), here('pushed', tuesday), here('pulled', monday), here('gone', monday)],
      remote: [
        there('same', monday),
        there('pushed', monday),
        there('pulled', tuesday),
        there('gone', tuesday, true),
        there('fetched', wednesday),
      ],
      base: { same: monday, pushed: monday, pulled: monday, gone: monday },
    })
    const actions = planSync(state)

    expect(nextBase(state, actions)).toEqual({
      same: monday,
      pushed: tuesday,
      pulled: tuesday,
      fetched: wednesday,
    })
  })

  it('keeps an undecided conflict open and records a decided one', () => {
    const state = input({ local: [here('a', tuesday)], remote: [there('a', wednesday)], base: { a: monday } })
    const actions = planSync(state)

    // not decided: the old base stays, so the conflict comes up again
    expect(nextBase(state, actions)).toEqual({ a: monday })
    expect(planSync({ ...state, base: nextBase(state, actions) })).toEqual(actions)
    // decided for the version of the server
    expect(nextBase(state, actions, { a: wednesday })).toEqual({ a: wednesday })
  })

  it('has no base for a conflict between binders that never agreed and is not decided', () => {
    const state = input({ local: [here('a', monday)], remote: [there('a', tuesday)] })

    expect(nextBase(state, planSync(state))).toEqual({})
  })

  it('settles: after a sync without conflicts the next one has nothing to do', () => {
    const state = input({
      local: [here('a', tuesday), here('b', monday)],
      remote: [there('b', tuesday), there('c', monday)],
      base: { b: monday },
    })
    const base = nextBase(state, planSync(state))
    // both sides as they are after pushing a, pulling b and c
    const after = input({
      local: [here('a', tuesday), here('b', tuesday), here('c', monday)],
      remote: [there('a', tuesday), there('b', tuesday), there('c', monday)],
      base,
    })

    expect(planSync(after)).toEqual([])
  })
})
