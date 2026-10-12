import { tcgdexFor } from '../../lib/tcgdex'
import { OFFERED_LANGS, type CardLang } from '../../types/binder'
import { baseVariantOf } from '../binder/placeCard'
import type { WantsEntry } from './cardmarketWants'
import { cardOfEntry, setsNamed, type ImportedCard, type ImportProblem, type ResolvedEntry } from './importList'

/**
 * Finds the cards the entries of a wants list name, in the language the binder is to be in.
 * The expansion is looked for under its name in every language the app offers: Cardmarket
 * names it in the language it is shown in, which need not be the binder's.
 */
export async function resolveWants(entries: readonly WantsEntry[], lang: CardLang): Promise<ResolvedEntry[]> {
  const client = tcgdexFor(lang)
  const catalogs = await Promise.all(
    [lang, ...OFFERED_LANGS.filter((other) => other !== lang)].map((other) =>
      tcgdexFor(other)
        .getCatalog()
        .then(
          (catalog) => catalog.series.flatMap((series) => series.sets),
          () => [],
        ),
    ),
  )

  const resolved: ResolvedEntry[] = []
  for (const entry of entries) {
    if (entry.setCode === undefined || entry.number === undefined) {
      resolved.push({ entry, problem: 'anyExpansion' })
      continue
    }
    const setIds = entry.expansion === undefined ? [] : setsNamed(entry.expansion, catalogs)
    let problem: ImportProblem = 'unknownSet'
    let found: ResolvedEntry | undefined
    for (const setId of setIds) {
      const cards = await client.getSetCards(setId).catch(() => [])
      const card = cardOfEntry(entry, cards)
      if (typeof card !== 'string') {
        found = { entry, card, setId }
        break
      }
      problem = card
    }
    resolved.push(found ?? { entry, problem })
  }
  return resolved
}

/** The cards of the resolved entries as they go into a binder: each in the finish it really has. */
export async function importedCards(resolved: readonly ResolvedEntry[], lang: CardLang): Promise<ImportedCard[]> {
  const cards: ImportedCard[] = []
  for (const entry of resolved) {
    if (!('card' in entry)) continue
    cards.push({ cardId: entry.card.id, variant: await baseVariantOf(entry.card.id, lang) })
  }
  return cards
}
