import type { Binder } from '../../types/binder'

/**
 * How a binder in a backup file stands to what is on this device:
 * - `new`: not here yet
 * - `newer`: here too, and the file has the later version
 * - `older`: here too, and this device has the later version
 * - `same`: here in exactly this version
 */
export type ImportKind = 'new' | 'newer' | 'older' | 'same'

export interface ImportEntry {
  /** The binder as the file has it. */
  binder: Binder
  kind: ImportKind
  /** The binder as this device has it, where it has it. */
  local?: Binder
}

/** Compares the binders of a file with those on this device, in the order of the file. */
export function planImport(incoming: readonly Binder[], existing: readonly Binder[]): ImportEntry[] {
  const byId = new Map(existing.map((binder) => [binder.id, binder]))
  return incoming.map((binder) => {
    const local = byId.get(binder.id)
    if (!local) return { binder, kind: 'new' }
    const kind: ImportKind =
      binder.updatedAt === local.updatedAt ? 'same' : binder.updatedAt > local.updatedAt ? 'newer' : 'older'
    return { binder, kind, local }
  })
}

/** Whether reading the file would replace a binder of this device: then the collector is asked first. */
export function replacesSomething(entries: readonly ImportEntry[]): boolean {
  return entries.some((entry) => entry.kind === 'newer' || entry.kind === 'older')
}

/**
 * What is read unless the collector decides otherwise: everything that is new or newer.
 * A binder this device has the later version of stays, as does one that is the same.
 */
export function suggestedImport(entries: readonly ImportEntry[]): string[] {
  return entries.filter((entry) => entry.kind === 'new' || entry.kind === 'newer').map((entry) => entry.binder.id)
}

/** A binder that is the same on both sides has nothing to decide. */
export function canChoose(entry: ImportEntry): boolean {
  return entry.kind !== 'same'
}
