import type { Binder, CardLang, CardVariant } from '../../types/binder'

/** What the list needs to know about a card; comes from TCGdex. */
export interface CardInfo {
  name: string
  localId: string
  setId?: string
  setName?: string
  officialCount?: number
  rarity?: string
}

export interface MissingRow {
  cardId: string
  variant: CardVariant
  lang: CardLang
  /** Empty when the set is unknown. */
  setId: string
  setName: string
  /** Number as printed on the card, e.g. `025/165`. */
  number: string
  name: string
  /** Empty when TCGdex has no rarity for the card. */
  rarity: string
  /** Page of the binder the card belongs on, starting at 1. */
  page: number
}

/**
 * Every card of the binder that is marked as missing, in binder order. A card that sits
 * in several pockets (e.g. normal and reverse) gets one row per pocket.
 */
export function buildMissingList(
  binder: Binder,
  lookup: (cardId: string, lang: CardLang) => CardInfo | undefined,
): MissingRow[] {
  const rows: MissingRow[] = []
  for (const page of binder.pages) {
    for (const slot of page.slots) {
      if (!slot.cardRef || slot.owned) continue
      const { cardId, variant, lang } = slot.cardRef
      const info = lookup(cardId, lang)
      rows.push({
        cardId,
        variant,
        lang,
        setId: info?.setId ?? '',
        setName: info?.setName ?? '',
        number: info
          ? info.officialCount === undefined
            ? info.localId
            : `${info.localId}/${info.officialCount}`
          : '',
        // without data from TCGdex the id is all there is to identify the card
        name: info?.name ?? cardId,
        rarity: info?.rarity ?? '',
        page: page.index + 1,
      })
    }
  }
  return rows
}

/** Whether the list needs to say which language each card is in. */
export function hasSeveralLanguages(rows: readonly MissingRow[]): boolean {
  return new Set(rows.map((row) => row.lang)).size > 1
}
