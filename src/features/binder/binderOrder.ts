import type { Binder } from '../../types/binder'

/** How the shelf of "Meine Binder" is ordered. */
export type BinderSort = 'updated' | 'name' | 'custom'

export const BINDER_SORTS: readonly BinderSort[] = ['updated', 'name', 'custom']

export interface ShelfPrefs {
  sort: BinderSort
  /** Binder ids in the collector's own order; binders not named in it come first. */
  order: string[]
}

export const DEFAULT_SHELF_PREFS: ShelfPrefs = { sort: 'updated', order: [] }

const byName = new Intl.Collator('de', { numeric: true, sensitivity: 'base' })

const newestFirst = (a: Binder, b: Binder) => b.updatedAt.localeCompare(a.updatedAt)

/**
 * The binders in the chosen order. In the collector's own order, binders it does not know
 * yet (new ones) stand in front, the newest first.
 */
export function sortBinders(
  binders: readonly Binder[],
  sort: BinderSort,
  order: readonly string[] = [],
): Binder[] {
  const newest = [...binders].sort(newestFirst)
  if (sort === 'updated') return newest
  if (sort === 'name') return newest.sort((a, b) => byName.compare(a.name, b.name))
  const position = new Map(order.map((id, index) => [id, index]))
  // the sort is stable, so binders without a position keep "newest first" among themselves
  return newest.sort((a, b) => (position.get(a.id) ?? -1) - (position.get(b.id) ?? -1))
}

/** Puts `movedId` where `targetId` stands; the binders in between move up by one. */
export function moveInOrder(ids: readonly string[], movedId: string, targetId: string): string[] {
  const target = ids.indexOf(targetId)
  if (movedId === targetId || target < 0 || !ids.includes(movedId)) return [...ids]
  const rest = ids.filter((id) => id !== movedId)
  rest.splice(target, 0, movedId)
  return rest
}

/** Moves a binder by `steps` places (negative: towards the front), stopping at the ends. */
export function shiftInOrder(ids: readonly string[], movedId: string, steps: number): string[] {
  const from = ids.indexOf(movedId)
  if (from < 0) return [...ids]
  const to = Math.max(0, Math.min(ids.length - 1, from + steps))
  const rest = ids.filter((id) => id !== movedId)
  rest.splice(to, 0, movedId)
  return rest
}

/** Reads stored shelf settings; anything unreadable falls back to the default. */
export function parseShelfPrefs(text: string | null): ShelfPrefs {
  if (!text) return DEFAULT_SHELF_PREFS
  try {
    const raw: unknown = JSON.parse(text)
    if (typeof raw !== 'object' || raw === null) return DEFAULT_SHELF_PREFS
    const { sort, order } = raw as { sort?: unknown; order?: unknown }
    return {
      sort: BINDER_SORTS.find((known) => known === sort) ?? DEFAULT_SHELF_PREFS.sort,
      order: Array.isArray(order) ? order.filter((id): id is string => typeof id === 'string') : [],
    }
  } catch {
    return DEFAULT_SHELF_PREFS
  }
}
