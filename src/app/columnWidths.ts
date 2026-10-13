/** How wide the two side columns beside the binder are, in pixels. */
export interface ColumnWidths {
  left: number
  right: number
}

/** The width a side column starts with, and goes back to at a double click on its edge. */
export const DEFAULT_COLUMN_WIDTH = 300
/** Narrower than this, two cards no longer fit side by side. */
export const MIN_COLUMN_WIDTH = 280
export const MAX_COLUMN_WIDTH = 720
/** What the binder between the columns keeps at the least. */
export const MIN_BINDER_WIDTH = 360

// How wide the columns are is a matter of this device; it is not part of a backup.
const WIDTHS_KEY = 'pokebinder:column-widths'

/**
 * The width a column may have when `wanted` is asked for: within its own limits, and no
 * wider than leaves the binder its room in an area `area` wide, beside another column of
 * `other` pixels (0 where that one is folded away). On a small screen the least width wins.
 */
export function clampColumnWidth(wanted: number, area: number, other: number): number {
  const room = Math.max(MIN_COLUMN_WIDTH, area - other - MIN_BINDER_WIDTH)
  return Math.round(Math.min(Math.max(wanted, MIN_COLUMN_WIDTH), MAX_COLUMN_WIDTH, room))
}

/** Reads stored widths; whatever cannot be read, or is out of bounds, starts as usual. */
export function parseColumnWidths(text: string | null): ColumnWidths {
  const widths: ColumnWidths = { left: DEFAULT_COLUMN_WIDTH, right: DEFAULT_COLUMN_WIDTH }
  try {
    const stored: unknown = JSON.parse(text ?? 'null')
    if (typeof stored === 'object' && stored !== null) {
      for (const side of ['left', 'right'] as const) {
        const value = (stored as Record<string, unknown>)[side]
        if (typeof value === 'number' && value >= MIN_COLUMN_WIDTH && value <= MAX_COLUMN_WIDTH) widths[side] = Math.round(value)
      }
    }
  } catch {
    // nothing stored that can be read
  }
  return widths
}

export function readColumnWidths(): ColumnWidths {
  try {
    return parseColumnWidths(localStorage.getItem(WIDTHS_KEY))
  } catch {
    return parseColumnWidths(null)
  }
}

export function storeColumnWidths(widths: ColumnWidths): void {
  try {
    localStorage.setItem(WIDTHS_KEY, JSON.stringify(widths))
  } catch {
    // without storage the widths simply last until the app is closed
  }
}
