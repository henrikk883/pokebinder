import type { LookIndex, Theme } from './similarCards'
import { SIGNATURE_LENGTH, type ColourIndex } from './similarColours'

/** Loads once, keeps the answer for as long as the app is open, and tries again after a failure. */
function once<T>(load: () => Promise<T>): () => Promise<T> {
  let loading: Promise<T> | undefined
  return () => {
    loading ??= load().catch((error: unknown) => {
      // not remembered: the next attempt may succeed
      loading = undefined
      throw error
    })
    return loading
  }
}

async function files(json: string, binary: string): Promise<[unknown, ArrayBuffer]> {
  const [described, numbers] = await Promise.all([fetch(json), fetch(binary)])
  if (!described.ok || !numbers.ok) throw new Error(`${json}: not there`)
  return [await described.json(), await numbers.arrayBuffer()]
}

const isStrings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string')

function isThemes(value: unknown): value is Theme[] {
  return (
    Array.isArray(value) &&
    value.every((entry: unknown) => {
      const theme = entry as Partial<Theme> | null
      return typeof theme?.id === 'string' && isStrings(theme.cards)
    })
  )
}

/**
 * The colours of all card pictures, a file of the app itself; loaded when first asked for
 * and kept for as long as the app is open.
 */
export const loadColourIndex = once<ColourIndex>(async () => {
  const [described, numbers] = await files('/colours/cards.json', '/colours/signatures.bin')
  const { ids, rare } = described as { ids?: unknown; rare?: unknown }
  const signatures = new Uint8Array(numbers)
  if (!isStrings(ids) || typeof rare !== 'number' || signatures.length !== ids.length * SIGNATURE_LENGTH) {
    throw new Error('colour index: not readable')
  }
  return { ids, rare, signatures }
})

/** What the image model sees in the cards of the high rarities, and the themes; loaded like the colours. */
export const loadLookIndex = once<LookIndex>(async () => {
  const [described, numbers] = await files('/colours/looks.json', '/colours/looks.bin')
  const { ids, size, themes } = described as { ids?: unknown; size?: unknown; themes?: unknown }
  const rows = new Int8Array(numbers)
  if (!isStrings(ids) || typeof size !== 'number' || !isThemes(themes) || rows.length !== ids.length * size) {
    throw new Error('look index: not readable')
  }
  return { ids, size, rows, themes }
})
