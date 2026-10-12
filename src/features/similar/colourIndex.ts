import { SIGNATURE_LENGTH, type ColourIndex } from './similarColours'

let loading: Promise<ColourIndex> | undefined

async function load(): Promise<ColourIndex> {
  const [cards, signatures] = await Promise.all([fetch('/colours/cards.json'), fetch('/colours/signatures.bin')])
  if (!cards.ok || !signatures.ok) throw new Error('colour index: not there')
  const { ids, rare } = (await cards.json()) as { ids?: unknown; rare?: unknown }
  const bytes = new Uint8Array(await signatures.arrayBuffer())
  if (
    !Array.isArray(ids) ||
    !ids.every((id) => typeof id === 'string') ||
    typeof rare !== 'number' ||
    bytes.length !== ids.length * SIGNATURE_LENGTH
  ) {
    throw new Error('colour index: not readable')
  }
  return { ids: ids as string[], rare, signatures: bytes }
}

/**
 * The colours of all card pictures, a file of the app itself; loaded when first asked for
 * and kept for as long as the app is open.
 */
export function loadColourIndex(): Promise<ColourIndex> {
  loading ??= load().catch((error: unknown) => {
    // not remembered: the next attempt may succeed
    loading = undefined
    throw error
  })
  return loading
}
