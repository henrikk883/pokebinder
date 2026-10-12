import { de } from '../../i18n/de'
import { setIdOfCardId, tcgdexFor } from '../../lib/tcgdex'
import type { Binder, CardLang } from '../../types/binder'
import { buildMissingList, type CardInfo, type MissingRow } from './missingList'
import { createMissingListPdf } from './missingListPdf'

const infoKey = (cardId: string, lang: CardLang) => `${lang}:${cardId}`

/** Name, number, set and rarity for the missing cards of a binder, as far as TCGdex has them. */
export async function loadMissingList(binder: Binder): Promise<MissingRow[]> {
  const missing = buildMissingList(binder, () => undefined)
  const infos = new Map<string, CardInfo>()
  const wanted = new Map(missing.map((row) => [infoKey(row.cardId, row.lang), row]))

  await Promise.all(
    [...wanted.values()].map(async ({ cardId, lang }) => {
      const client = tcgdexFor(lang)
      const detail = await client.getCardDetail(cardId).catch(() => undefined)
      if (!detail) return
      const { setsById } = await client.getCatalog()
      const set = setsById.get(setIdOfCardId(cardId, setsById) ?? '')
      const info: CardInfo = { name: detail.name, localId: detail.localId }
      if (set) {
        info.setId = set.id
        info.setName = set.name
        info.officialCount = set.cardCount.official
      }
      if (detail.rarity) info.rarity = detail.rarity
      infos.set(infoKey(cardId, lang), info)
    }),
  )
  return buildMissingList(binder, (cardId, lang) => infos.get(infoKey(cardId, lang)))
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
    languageLabel: (lang) => de.languageCodes[lang],
    pageLabel: de.missingList.page,
  })
  const url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }))
  const link = document.createElement('a')
  link.href = url
  link.download = missingListFileName(binder.name, now.toISOString())
  link.click()
  URL.revokeObjectURL(url)
}
