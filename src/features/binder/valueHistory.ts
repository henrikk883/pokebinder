/** What the binders were worth on one day: the Cardmarket value of the owned cards, in euros. */
export interface ValuePoint {
  /** The day, as `YYYY-MM-DD`. */
  date: string
  /** By binder id. */
  binders: Readonly<Record<string, number>>
}

/** For this long every day is kept; of what is older, one day a week. */
export const DAILY_FOR_DAYS = 90

const DAY_MS = 24 * 60 * 60 * 1000
const dayNumber = (date: string) => Math.floor(Date.parse(`${date}T00:00:00.000Z`) / DAY_MS)

/** The day a moment falls on, in the form the history keeps. */
export function dayOf(iso: string): string {
  return iso.slice(0, 10)
}

/** Reads the stored history; what cannot be read is left out. Oldest day first. */
export function parseHistory(text: string | null): ValuePoint[] {
  let raw: unknown
  try {
    raw = text ? JSON.parse(text) : undefined
  } catch {
    raw = undefined
  }
  if (!Array.isArray(raw)) return []
  const points: ValuePoint[] = []
  for (const entry of raw as unknown[]) {
    if (typeof entry !== 'object' || entry === null) continue
    const { date, binders } = entry as { date?: unknown; binders?: unknown }
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(dayNumber(date))) continue
    if (typeof binders !== 'object' || binders === null || Array.isArray(binders)) continue
    const values = Object.fromEntries(
      Object.entries(binders).filter((value): value is [string, number] => typeof value[1] === 'number' && Number.isFinite(value[1])),
    )
    points.push({ date, binders: values })
  }
  return points.sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Keeps every day of the last while and, of what is older, the last day noted in each
 * week: enough to see where the value went without the history growing for ever.
 */
export function thinHistory(history: readonly ValuePoint[], today: string): ValuePoint[] {
  const now = dayNumber(today)
  const kept: ValuePoint[] = []
  for (const [index, point] of history.entries()) {
    const day = dayNumber(point.date)
    const next = history[index + 1]
    const recent = now - day < DAILY_FOR_DAYS
    // the last of its week: the one after it lies in another week, or is recent
    const lastOfWeek = !next || Math.floor(dayNumber(next.date) / 7) !== Math.floor(day / 7) || now - dayNumber(next.date) < DAILY_FOR_DAYS
    if (recent || lastOfWeek) kept.push(point)
  }
  return kept
}

/** Notes what the binders are worth today; a day already noted is brought up to date. */
export function recordPoint(
  history: readonly ValuePoint[],
  date: string,
  binders: Readonly<Record<string, number>>,
): ValuePoint[] {
  const others = history.filter((point) => point.date !== date)
  return thinHistory([...others, { date, binders }].sort((a, b) => a.date.localeCompare(b.date)), date)
}

export interface SeriesPoint {
  date: string
  value: number
}

/**
 * How the value went over time: of one binder, on the days it was noted, or (`null`) of
 * everything together. Added up in cents, so that many small amounts do not drift.
 */
export function seriesOf(history: readonly ValuePoint[], binderId: string | null): SeriesPoint[] {
  return history.flatMap((point): SeriesPoint[] => {
    if (binderId !== null) {
      const value = point.binders[binderId]
      return value === undefined ? [] : [{ date: point.date, value }]
    }
    const cents = Object.values(point.binders).reduce((sum, value) => sum + Math.round(value * 100), 0)
    return [{ date: point.date, value: cents / 100 }]
  })
}

/** By how much the value changed from the first day noted to the last; `undefined` with fewer than two days. */
export function changeOf(series: readonly SeriesPoint[]): { since: string; amount: number } | undefined {
  const first = series[0]
  const last = series.at(-1)
  if (!first || !last || first === last) return undefined
  return { since: first.date, amount: (Math.round(last.value * 100) - Math.round(first.value * 100)) / 100 }
}

// Kept in this browser, like the values it is made of.
const HISTORY_KEY = 'pokebinder:value-history'

export function readHistory(): ValuePoint[] {
  try {
    return parseHistory(localStorage.getItem(HISTORY_KEY))
  } catch {
    return []
  }
}

export function storeHistory(history: readonly ValuePoint[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
  } catch {
    // without storage there is simply no history
  }
}
