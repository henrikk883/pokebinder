import type { CardPage, CardQuery, TcgdexClient } from '../../lib/tcgdex'

export interface SearchInput {
  text: string
  setId?: string
  rarity?: string
  type?: string
}

export type SearchPlan =
  /** Nothing to search for yet. */
  | { kind: 'idle' }
  /** Only a card number was given; on its own it would match cards in every set. */
  | { kind: 'needsContext' }
  /** Show a whole set in number order. */
  | { kind: 'set'; setId: string }
  | { kind: 'query'; query: CardQuery }

/** Shorter names would match a large part of all cards. */
export const MIN_NAME_LENGTH = 2

export interface ParsedSearchText {
  name?: string
  number?: string
  /** The part after the slash of a number as printed on the card, e.g. 125 for "188/125". */
  officialCount?: number
}

/**
 * Splits the search text into a name and a card number.
 * Words made of digits count as the number: "Pikachu 25", "188/125", "025/165 Pikachu".
 */
export function parseSearchText(text: string): ParsedSearchText {
  const nameWords: string[] = []
  const parsed: ParsedSearchText = {}
  for (const word of text.trim().split(/\s+/)) {
    const match = /^(\d+)(?:\/(\d+))?$/.exec(word)
    if (match?.[1]) {
      parsed.number = match[1]
      if (match[2]) parsed.officialCount = Number(match[2])
      else delete parsed.officialCount
    } else if (word) {
      nameWords.push(word)
    }
  }
  if (nameWords.length > 0) parsed.name = nameWords.join(' ')
  return parsed
}

export function planSearch({ text, setId, rarity, type }: SearchInput): SearchPlan {
  const { name: typedName, number, officialCount } = parseSearchText(text)
  // inside a set even a single letter narrows things down usefully
  const name =
    typedName && (typedName.length >= MIN_NAME_LENGTH || setId) ? typedName : undefined

  if (!name && !number && !rarity && !type) return setId ? { kind: 'set', setId } : { kind: 'idle' }
  // a bare number matches cards in every set; "188/125" names the set size and is specific enough
  if (number && !name && !setId && officialCount === undefined) return { kind: 'needsContext' }

  const query: CardQuery = {}
  if (name) query.name = name
  if (number) query.number = number
  if (officialCount !== undefined && !setId) query.officialCount = officialCount
  if (setId) query.setId = setId
  if (rarity) query.rarity = rarity
  if (type) query.type = type
  return { kind: 'query', query }
}

const NOTHING: CardPage = { cards: [], hasMore: false }

/**
 * A name nothing is found under may have been typed in another language ("psyduck" while
 * German cards are shown). The other languages are asked which Pokémon it is, and that
 * Pokémon's cards are fetched in the language of the search. Trainers and energy have no
 * Pokédex number and are not found this way.
 */
async function searchByForeignName(
  client: Pick<TcgdexClient, 'queryCards'>,
  query: CardQuery,
  page: number,
  others: readonly Pick<TcgdexClient, 'dexIdsOfName'>[],
): Promise<CardPage> {
  const { name, ...rest } = query
  if (!name) return NOTHING
  for (const other of others) {
    const dexIds = await other.dexIdsOfName(name).catch(() => [])
    if (dexIds.length === 0) continue
    const pages = await Promise.all(dexIds.map((dexId) => client.queryCards({ ...rest, dexId }, page)))
    const seen = new Set<string>()
    const cards = pages.flatMap((found) => found.cards).filter((card) => !seen.has(card.id) && seen.add(card.id))
    if (cards.length > 0 || page > 1) return { cards, hasMore: pages.some((found) => found.hasMore) }
  }
  return NOTHING
}

/**
 * `others` are the clients of the other languages a name may have been typed in; without
 * them a name is looked for in the language of `client` only.
 */
export async function runSearch(
  client: Pick<TcgdexClient, 'getSetCards' | 'queryCards'>,
  plan: SearchPlan,
  page: number,
  others: readonly Pick<TcgdexClient, 'dexIdsOfName'>[] = [],
): Promise<CardPage> {
  switch (plan.kind) {
    case 'idle':
    case 'needsContext':
      return NOTHING
    case 'set':
      return { cards: await client.getSetCards(plan.setId), hasMore: false }
    case 'query': {
      const found = await client.queryCards(plan.query, page)
      if (found.cards.length > 0 || !plan.query.name || others.length === 0) return found
      // Only a name that finds nothing at all is taken for another language's: a later
      // page that happens to be empty is just the end of the list.
      const first = page === 1 ? found : await client.queryCards(plan.query, 1)
      return first.cards.length > 0 ? found : searchByForeignName(client, plan.query, page, others)
    }
  }
}
