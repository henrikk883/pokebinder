import type { Binder, CardLang } from '../../types/binder'

/** How far the cards of one set are collected, within one binder. */
export interface SetProgress {
  /** Tells the rows apart: a set counts per language. */
  key: string
  lang: CardLang
  /** Empty for cards whose set is not known. */
  setId: string
  /** Name of the set in the language of its cards; empty where the set is not known. */
  name: string
  /** Pockets that hold a card of the set. */
  total: number
  owned: number
  missing: number
}

export type SetLookup = (cardId: string, lang: CardLang) => { id: string; name: string } | undefined

/**
 * The progress of a binder set by set, in the order the sets first appear in it. Like the
 * progress of the whole binder it counts pockets: a card that lies there twice counts
 * twice. Cards whose set cannot be told come last, as one row per language.
 */
export function progressBySet(binder: Binder, setOf: SetLookup): SetProgress[] {
  const rows = new Map<string, SetProgress>()
  for (const page of binder.pages) {
    for (const slot of page.slots) {
      if (!slot.cardRef) continue
      const { cardId, lang } = slot.cardRef
      const set = setOf(cardId, lang)
      const key = `${lang}:${set?.id ?? ''}`
      const row = rows.get(key) ?? { key, lang, setId: set?.id ?? '', name: set?.name ?? '', total: 0, owned: 0, missing: 0 }
      row.total += 1
      if (slot.owned) row.owned += 1
      else row.missing += 1
      rows.set(key, row)
    }
  }
  const all = [...rows.values()]
  return [...all.filter((row) => row.setId !== ''), ...all.filter((row) => row.setId === '')]
}
