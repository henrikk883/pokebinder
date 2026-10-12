/**
 * The text Cardmarket takes under "Wants" → "Add Decklist": one card per line. A Pokémon
 * needs its English name followed by its abilities and attacks ("Mew ex Restart Genome
 * Hacking"); its name alone is turned away. Trainers and energy go by their name.
 * See https://help.cardmarket.com/en/how-to-add-a-pkmn-decklist-to-wants
 *
 * The exact print is named by the expansion and, where a set holds several prints of a
 * card, the version, both in brackets: "1x Mew ex Restart Genome Hacking (V.2) (151)".
 * Found out by trying it at Cardmarket (Henrik, 12.10.2026): the versions of a card count
 * up in the order of the card numbers – Mew ex 151/165 is V.1, 193/165 V.2, 205/165 V.3 –
 * and products that are no cards of the set (a metal card) come after them.
 */

/** A card as Cardmarket's list names it. */
export interface CardmarketCard {
  /** English name. */
  name: string
  /** Abilities and attacks in the card's order. */
  moves: readonly string[]
  /** English name of the set, as the expansion. */
  expansion?: string
  /** Which print of the card within the set, counted from 1; only where there are several. */
  version?: number
}

/** Abilities and attacks as TCGdex lists them on a card. */
export interface RawListedCard {
  id?: string | null
  name?: string | null
  abilities?: ({ name?: string | null } | null)[] | null
  attacks?: ({ name?: string | null } | null)[] | null
  set?: { id?: string | null; name?: string | null } | null
}

const names = (entries: RawListedCard['abilities']): string[] =>
  (entries ?? []).flatMap((entry) => (entry?.name ? [entry.name.trim()] : []))

/** What a line for the card is made of; `undefined` for a card without a name. */
export function cardmarketCardOf(raw: RawListedCard): CardmarketCard | undefined {
  const name = raw.name?.trim()
  if (!name) return undefined
  // abilities first, as on the card and in Cardmarket's own example
  const card: CardmarketCard = { name, moves: [...names(raw.abilities), ...names(raw.attacks)] }
  const expansion = raw.set?.name?.trim()
  if (expansion) card.expansion = expansion
  return card
}

/** A print of a card in a set: its id and, where known, its abilities and attacks. */
export interface SetPrint {
  id: string
  /** `undefined` where the print could not be looked up; it then counts as the same card. */
  moves?: readonly string[]
}

const sameMoves = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((move, index) => move.toLowerCase() === b[index]?.toLowerCase())

/**
 * Which version a card is among the prints of the same name in its set. `prints` are the
 * cards of the set that carry the card's name, in the order of their numbers. A print with
 * other attacks is another card (two different Pikachu in one set) and is not counted.
 * `undefined` where the card is the only print: Cardmarket then has no versions of it.
 */
export function versionAmong(cardId: string, moves: readonly string[], prints: readonly SetPrint[]): number | undefined {
  const same = prints.filter((print) => print.id === cardId || print.moves === undefined || sameMoves(print.moves, moves))
  const position = same.findIndex((print) => print.id === cardId)
  return same.length > 1 && position >= 0 ? position + 1 : undefined
}

/** The line of one card, e.g. `2x Mew ex Restart Genome Hacking (V.2) (151)`. */
export function cardmarketLine(card: CardmarketCard, count: number): string {
  return [
    `${count}x`,
    card.name,
    ...card.moves,
    ...(card.version !== undefined && card.expansion ? [`(V.${card.version})`] : []),
    ...(card.expansion ? [`(${card.expansion})`] : []),
  ].join(' ')
}

/**
 * The lines for a list of wanted cards, in the order they come in. The same print wanted
 * several times (in several finishes, say) is one line with the number added up.
 */
export function cardmarketLines(cards: readonly CardmarketCard[]): string[] {
  const counted = new Map<string, { card: CardmarketCard; count: number }>()
  for (const card of cards) {
    const key = cardmarketLine(card, 1).toLowerCase()
    const entry = counted.get(key)
    if (entry) entry.count++
    else counted.set(key, { card, count: 1 })
  }
  return [...counted.values()].map(({ card, count }) => cardmarketLine(card, count))
}
