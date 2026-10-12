/**
 * The text Cardmarket takes under "Wants" → "Add Decklist": one card per line. A Pokémon
 * needs its English name followed by its abilities and attacks ("Mew ex Restart Genome
 * Hacking"); its name alone is turned away. Trainers and energy go by their name.
 * See https://help.cardmarket.com/en/how-to-add-a-pkmn-decklist-to-wants
 */

/** A card as Cardmarket's list names it: English name, then abilities and attacks in the card's order. */
export interface CardmarketCard {
  name: string
  moves: readonly string[]
}

/** Abilities and attacks as TCGdex lists them on a card. */
export interface RawListedCard {
  name?: string | null
  abilities?: ({ name?: string | null } | null)[] | null
  attacks?: ({ name?: string | null } | null)[] | null
}

const names = (entries: RawListedCard['abilities']): string[] =>
  (entries ?? []).flatMap((entry) => (entry?.name ? [entry.name.trim()] : []))

/** What a line for the card is made of; `undefined` for a card without a name. */
export function cardmarketCardOf(raw: RawListedCard): CardmarketCard | undefined {
  const name = raw.name?.trim()
  if (!name) return undefined
  // abilities first, as on the card and in Cardmarket's own example
  return { name, moves: [...names(raw.abilities), ...names(raw.attacks)] }
}

/** The line of one card, e.g. `2x Venusaur ex Tranquil Flower Dangerous Toxwhip`. */
export function cardmarketLine(card: CardmarketCard, count: number): string {
  return [`${count}x`, card.name, ...card.moves].join(' ')
}

/**
 * The lines for a list of wanted cards, in the order they come in. Cardmarket tells cards
 * apart by name and attacks, not by print: several prints of one card (the plain one and
 * its illustration rare) become one line with their number added up.
 */
export function cardmarketLines(cards: readonly CardmarketCard[]): string[] {
  const counted = new Map<string, { card: CardmarketCard; count: number }>()
  for (const card of cards) {
    const key = [card.name, ...card.moves].join('\n').toLowerCase()
    const entry = counted.get(key)
    if (entry) entry.count++
    else counted.set(key, { card, count: 1 })
  }
  return [...counted.values()].map(({ card, count }) => cardmarketLine(card, count))
}
