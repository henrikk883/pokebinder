import { de } from '../../i18n/de'
import { setIdOfCardId, tcgdex } from '../../lib/tcgdex'
import type { Binder } from '../../types/binder'
import { buildMissingList, type CardInfo, type MissingRow } from './missingList'
import { createMissingListPdf } from './missingListPdf'

/** Name, number, set and rarity for the missing cards of a binder, as far as TCGdex has them. */
export async function loadMissingList(binder: Binder): Promise<MissingRow[]> {
  const missing = buildMissingList(binder, () => undefined)
  const infos = new Map<string, CardInfo>()
  if (missing.length > 0) {
    const catalog = await tcgdex.getCatalog()
    await Promise.all(
      [...new Set(missing.map((row) => row.cardId))].map(async (cardId) => {
        const detail = await tcgdex.getCardDetail(cardId).catch(() => undefined)
        if (!detail) return
        const set = catalog.setsById.get(setIdOfCardId(cardId, catalog.setsById) ?? '')
        const info: CardInfo = { name: detail.name, localId: detail.localId }
        if (set) {
          info.setName = set.name
          info.officialCount = set.cardCount.official
        }
        if (detail.rarity) info.rarity = detail.rarity
        infos.set(cardId, info)
      }),
    )
  }
  return buildMissingList(binder, (cardId) => infos.get(cardId))
}

export function missingListFileName(binderName: string, isoDate: string): string {
  const slug = binderName
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `fehlliste-${slug || 'binder'}-${isoDate.slice(0, 10)}.pdf`
}

/** Offers the checklist of missing cards as a PDF download. */
export async function downloadMissingList(binder: Binder): Promise<void> {
  const rows = await loadMissingList(binder)
  const now = new Date()
  const bytes = await createMissingListPdf({
    title: de.missingList.title(binder.name),
    subtitle: de.missingList.subtitle(rows.length, new Intl.DateTimeFormat('de-DE').format(now)),
    emptyText: de.missingList.empty,
    columns: de.missingList.columns,
    rows,
    variantLabel: de.variantLabel,
    pageLabel: de.missingList.page,
  })
  const url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }))
  const link = document.createElement('a')
  link.href = url
  link.download = missingListFileName(binder.name, now.toISOString())
  link.click()
  URL.revokeObjectURL(url)
}
