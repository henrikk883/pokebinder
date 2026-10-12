import { compareVariants, type CardVariant } from '../../types/binder'

/** One print of a card as TCGdex describes it (English names). */
export interface RawVariant {
  type: string
  foil?: string | null
  stamp?: string[] | null
  size?: string | null
}

/**
 * Foils that do not come out of the set's own boosters but from special products
 * (blister packs, tins); they are not part of a master set.
 */
const OUTSIDE_FOILS = new Set(['cosmos', 'galaxy', 'cracked-ice', 'league'])

function isRegularPrint(variant: RawVariant): boolean {
  return (variant.stamp ?? []).length === 0 && (variant.size ?? 'standard') === 'standard'
}

/**
 * The finishes of a card that belong into a binder, base finish first.
 *
 * - `normal` and `holo` as printed; a gold or rainbow card counts as `holo`
 * - `reverse` for the plain reverse holo
 * - one entry per special reverse pattern, named like the pattern (`pokeball`, `energy`, …)
 *
 * Stamped prints, jumbo cards and foils from special products are left out. Every card
 * has at least one finish, also promos that only exist stamped.
 */
export function variantsOf(prints: readonly RawVariant[]): CardVariant[] {
  const regular = prints.filter(isRegularPrint)
  const variants = new Set<CardVariant>()

  for (const print of regular) {
    const foil = print.foil ?? undefined
    if (print.type === 'normal') variants.add('normal')
    else if (print.type === 'reverse') {
      if (foil === undefined) variants.add('reverse')
      else if (!OUTSIDE_FOILS.has(foil)) variants.add(foil)
    } else if (foil === undefined || !OUTSIDE_FOILS.has(foil)) variants.add('holo')
  }

  if (!variants.has('normal') && !variants.has('holo')) {
    // only special prints exist: take the finish of whatever there is
    const any = regular[0] ?? prints[0]
    variants.add(any?.type === 'normal' || any === undefined ? 'normal' : 'holo')
  }
  return [...variants].sort(compareVariants)
}

/** The finish a card has when you just say its name: normal if it exists, else holo. */
export function baseVariant(variants: readonly CardVariant[]): CardVariant {
  return variants.includes('normal') ? 'normal' : (variants[0] ?? 'normal')
}
