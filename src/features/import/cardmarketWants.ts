/**
 * Reads a wants list as it comes out of Cardmarket when its table is marked and copied:
 * no file format, just what the browser puts on the clipboard. Each entry starts with a
 * line of cells holding the amount and the card, e.g. `1 | Mew ex (MEW 151)`, followed by
 * a line naming the expansion and the version (`151 Version 1`) and by lines for language
 * and condition, which are of no use here. See docs/cardmarket-wants-beispiel.txt.
 */

export interface WantsEntry {
  /** How many copies are wanted. */
  amount: number
  /** The card as Cardmarket names it, without what stands in brackets behind it. */
  name: string
  /** Cardmarket's short name of the set and the number of the card in it: `MEW`, `151`. */
  setCode?: string
  number?: string
  /** Name of the expansion, in the language Cardmarket is shown in. */
  expansion?: string
  /** Which print of the card within the expansion; missing where there is only one. */
  version?: number
}

const CARD = /^(.*\S)\s*\(([A-Za-z0-9-]+) ([A-Za-z0-9]+)\)$/
const VERSION = /^(.*\S)\s+Version (\d+)$/

/** The cells of a copied table row that hold something. */
const cellsOf = (line: string) =>
  line
    .split('\t')
    .map((cell) => cell.trim())
    .filter((cell) => cell !== '')

/** The entries of a copied wants list, in the order of the list. Lines that are no entries are passed over. */
export function parseCardmarketWants(text: string): WantsEntry[] {
  const entries: WantsEntry[] = []
  const lines = text.split(/\r?\n/)

  for (let index = 0; index < lines.length; index++) {
    const [amount, title] = cellsOf(lines[index] ?? '')
    // an entry: a row whose first cell is the amount and whose second is the card
    if (amount === undefined || title === undefined || !/^\d+$/.test(amount)) continue
    const count = Number(amount)
    if (count < 1) continue

    const card = CARD.exec(title)
    if (!card) {
      // wanted in any expansion: Cardmarket then names no set and no number
      entries.push({ amount: count, name: title })
      continue
    }
    const entry: WantsEntry = { amount: count, name: card[1] ?? title, setCode: card[2] ?? '', number: card[3] ?? '' }

    // the next line names the expansion, with the version where the set has several prints
    const next = (lines[index + 1] ?? '').trim()
    if (next !== '' && !next.includes('\t')) {
      const versioned = VERSION.exec(next)
      entry.expansion = versioned ? (versioned[1] ?? next) : next
      if (versioned) entry.version = Number(versioned[2])
    }
    entries.push(entry)
  }
  return entries
}
