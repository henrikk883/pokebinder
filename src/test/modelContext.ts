import type { ModelContext } from '../features/binder/binderModel'

/** Predictable ids (`id-1`, `id-2`, …) and timestamps one second apart. */
export function createTestContext(): ModelContext {
  let ids = 0
  let seconds = 0
  return {
    newId: () => `id-${++ids}`,
    now: () => new Date(Date.UTC(2026, 9, 12, 10, 0, seconds++)).toISOString(),
  }
}
