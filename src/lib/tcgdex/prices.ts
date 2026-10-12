import type { CardVariant } from '../../types/binder'

/** Cardmarket figures as TCGdex passes them on; 0 and null both mean "no figure". */
export interface RawCardmarket {
  unit?: string | null
  avg?: number | null
  trend?: number | null
  'avg-holo'?: number | null
  'trend-holo'?: number | null
}

export interface RawPricedVariant {
  type: string
  foil?: string | null
  stamp?: string[] | null
  size?: string | null
  pricing?: { cardmarket?: RawCardmarket | null } | null
}

export interface RawPricedCard {
  pricing?: { cardmarket?: RawCardmarket | null } | null
  variants_detailed?: RawPricedVariant[] | null
}

export interface Price {
  /** Cardmarket price trend, or the average where there is no trend. */
  amount: number
  currency: string
}

const figure = (value: number | null | undefined) =>
  typeof value === 'number' && value > 0 ? value : undefined

/**
 * Cardmarket lists a card and its reverse holo as one product with two sets of figures:
 * the plain ones for the normal card, the `-holo` ones for the foil. A card that only
 * exists as holo has just the plain figures.
 */
function amountFor(market: RawCardmarket, foiled: boolean): number | undefined {
  const plain = figure(market.trend) ?? figure(market.avg)
  const holo = figure(market['trend-holo']) ?? figure(market['avg-holo'])
  return foiled ? (holo ?? plain) : (plain ?? holo)
}

function isRegularPrint(print: RawPricedVariant): boolean {
  return (print.stamp ?? []).length === 0 && (print.size ?? 'standard') === 'standard'
}

/** The print of a card that a binder variant stands for; finishes carry their English names. */
function printOf(prints: readonly RawPricedVariant[], variant: CardVariant): RawPricedVariant | undefined {
  const regular = prints.filter(isRegularPrint)
  const plain = (type: string) => regular.find((print) => print.type === type && !print.foil)
  switch (variant) {
    case 'normal':
      return plain('normal')
    case 'holo':
      return plain('holo') ?? regular.find((print) => print.type !== 'normal' && print.type !== 'reverse')
    case 'reverse':
      return plain('reverse')
    default:
      return regular.find((print) => print.type === 'reverse' && print.foil === variant)
  }
}

/**
 * Cardmarket price of a card in one finish, read from the card data of TCGdex.
 * `undefined` when Cardmarket has no figure for it.
 */
export function cardmarketPrice(card: RawPricedCard, variant: CardVariant): Price | undefined {
  const print = printOf(card.variants_detailed ?? [], variant)
  const market = print?.pricing?.cardmarket ?? card.pricing?.cardmarket
  if (!market) return undefined
  // every finish but the normal card is a foil
  const amount = amountFor(market, variant !== 'normal')
  return amount === undefined ? undefined : { amount, currency: market.unit ?? 'EUR' }
}

/** Runs `task` for every item with at most `limit` running at once; results keep the order. */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>,
  onProgress?: (done: number, total: number) => void,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  let done = 0
  async function worker(): Promise<void> {
    while (next < items.length) {
      const index = next++
      results[index] = await task(items[index] as T, index)
      onProgress?.(++done, items.length)
    }
  }
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), items.length) }, worker))
  return results
}
