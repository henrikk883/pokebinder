import { useEffect, useState } from 'react'
import type { Binder } from '../../types/binder'
import { countProgress } from './binderModel'
import { loadBinderValue, type BinderValue } from './binderValue'
import { dayOf, readHistory, recordPoint, storeHistory, type ValuePoint } from './valueHistory'

/** What a binder was worth when it was last looked at. */
export interface StoredValue {
  /** `updatedAt` of the binder the value is of: after a change it is worked out anew. */
  updatedAt: string
  /** ISO 8601 time the prices were asked for. */
  at: string
  value: BinderValue
}

export type ShelfValues = Readonly<Record<string, StoredValue>>

/** Prices move slowly; once a day is often enough to ask for them. */
export const VALUE_MAX_AGE_MS = 24 * 60 * 60 * 1000

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

/** Reads the stored values; what cannot be read is left out. */
export function parseShelfValues(text: string | null): ShelfValues {
  let raw: unknown
  try {
    raw = text ? JSON.parse(text) : undefined
  } catch {
    raw = undefined
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {}
  const values: Record<string, StoredValue> = {}
  for (const [id, entry] of Object.entries(raw)) {
    if (typeof entry !== 'object' || entry === null) continue
    const { updatedAt, at, value } = entry as { updatedAt?: unknown; at?: unknown; value?: Partial<BinderValue> | null }
    if (typeof updatedAt !== 'string' || typeof at !== 'string' || !value) continue
    if (!isNumber(value.owned) || !isNumber(value.missing) || !isNumber(value.unpriced)) continue
    values[id] = { updatedAt, at, value: { owned: value.owned, missing: value.missing, unpriced: value.unpriced } }
  }
  return values
}

/** Whether the value of a binder has to be worked out (again): none yet, changed since, or old. */
export function needsValue(binder: Binder, stored: StoredValue | undefined, now: number): boolean {
  if (!stored || stored.updatedAt !== binder.updatedAt) return true
  const age = now - Date.parse(stored.at)
  return !(age >= 0 && age < VALUE_MAX_AGE_MS)
}

/**
 * Whether a freshly worked out value is to take the place of the stored one. Without a
 * connection every card comes back without a price; that says nothing about the binder
 * and must not wipe out what was known.
 */
export function replacesStored(binder: Binder, fresh: BinderValue, stored: StoredValue | undefined): boolean {
  const cards = countProgress(binder).total
  const nothingPriced = cards > 0 && fresh.unpriced >= cards
  return !(nothingPriced && stored !== undefined && stored.value.unpriced < cards)
}

export interface ShelfTotal {
  /** Cards marked as owned, and all cards, over every binder. */
  owned: number
  cards: number
  /** Cardmarket value of the owned cards of the binders a value is known for. */
  worth: number
  /** Binders whose value is not known yet. */
  pending: number
}

/** The collection as a whole. A binder changed since its value was worked out counts with that value. */
export function shelfTotal(binders: readonly Binder[], values: ShelfValues): ShelfTotal {
  let owned = 0
  let cards = 0
  let cents = 0
  let pending = 0
  for (const binder of binders) {
    const progress = countProgress(binder)
    owned += progress.owned
    cards += progress.total
    const stored = values[binder.id]
    if (stored) cents += Math.round(stored.value.owned * 100)
    else if (progress.total > 0) pending++
  }
  return { owned, cards, worth: cents / 100, pending }
}

// Kept in this browser: the prices can be asked for again on any device.
const SHELF_VALUES_KEY = 'pokebinder:shelf-values'

function readStored(): ShelfValues {
  try {
    return parseShelfValues(localStorage.getItem(SHELF_VALUES_KEY))
  } catch {
    return {}
  }
}

function store(values: ShelfValues): void {
  try {
    localStorage.setItem(SHELF_VALUES_KEY, JSON.stringify(values))
  } catch {
    // without storage the values are simply worked out again next time
  }
}

/**
 * Notes what the binders are worth today, once every one of them has a value: a day with
 * a binder missing would look like a loss. Returns the history as it then is.
 */
export function noteToday(binders: readonly Binder[], values: ShelfValues, now: string): ValuePoint[] {
  const history = readHistory()
  const filled = binders.filter((binder) => countProgress(binder).total > 0)
  if (filled.length === 0 || filled.some((binder) => values[binder.id] === undefined)) return history
  const next = recordPoint(
    history,
    dayOf(now),
    Object.fromEntries(filled.map((binder) => [binder.id, values[binder.id]?.value.owned ?? 0])),
  )
  storeHistory(next)
  return next
}

export interface ShelfWorth {
  values: ShelfValues
  /** What the binders were worth on the days the shelf was looked at, oldest first. */
  history: readonly ValuePoint[]
}

/**
 * What each binder on the shelf is worth. Known values are there at once; those that are
 * missing or out of date are worked out one binder after the other, since each card needs
 * a request of its own the first time on a day.
 */
export function useShelfValues(binders: readonly Binder[]): ShelfWorth {
  const [values, setValues] = useState<ShelfValues>(readStored)
  const [history, setHistory] = useState<readonly ValuePoint[]>(readHistory)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      for (const binder of binders) {
        const known = readStored()
        if (countProgress(binder).total === 0 || !needsValue(binder, known[binder.id], Date.now())) continue
        const value = await loadBinderValue(binder).catch(() => undefined)
        if (cancelled) return
        if (!value || !replacesStored(binder, value, known[binder.id])) continue
        // read again: another tab, or this loop, may have stored other binders meanwhile
        const next = {
          ...readStored(),
          [binder.id]: { updatedAt: binder.updatedAt, at: new Date().toISOString(), value },
        }
        store(next)
        setValues(next)
      }
      if (!cancelled) setHistory(noteToday(binders, readStored(), new Date().toISOString()))
    })()
    return () => {
      cancelled = true
    }
  }, [binders])

  return { values, history }
}
