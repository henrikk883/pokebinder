import { baseVariant, type CardDetail, type Catalog } from '../../lib/tcgdex'
import type { Binder, CardLang, CardRef, Layout, OpeningSide, Slot } from '../../types/binder'
import {
  createBinder,
  createPage,
  defaultContext,
  slotsPerPage,
  type ModelContext,
} from '../binder/binderModel'

/**
 * A secret rare carries a number above the official size of its set (166/165), or a
 * number of its own kind (TG01). Illustration rares, special illustration rares, hyper
 * rares and the like all fall under it; their rarity tells them apart.
 */
export function isSecretRare(card: Pick<CardDetail, 'localId'>, officialCount: number): boolean {
  if (!/^\d+$/.test(card.localId)) return true
  return Number(card.localId) > officialCount
}

export interface RarityGroup {
  /** Rarity as TCGdex names it; empty for cards without one. */
  rarity: string
  count: number
}

/** The secret rares of a set by rarity, in the order they appear in the set. */
export function secretRareGroups(cards: readonly CardDetail[], officialCount: number): RarityGroup[] {
  const groups = new Map<string, number>()
  for (const card of cards) {
    if (!isSecretRare(card, officialCount)) continue
    const rarity = card.rarity ?? ''
    groups.set(rarity, (groups.get(rarity) ?? 0) + 1)
  }
  return [...groups].map(([rarity, count]) => ({ rarity, count }))
}

export interface MasterSetOptions {
  /** A pocket of its own for every further finish: reverse holo and each special pattern. */
  withVariants: boolean
  /** Rarities of secret rares to leave out; empty means all secret rares are included. */
  excludedSecretRarities: readonly string[]
  withPromos: boolean
}

export interface MasterSetSource {
  setId: string
  /** Promo set of the series, if it has one. */
  promoSetId?: string
  cards: readonly CardDetail[]
  officialCount: number
  /** Cards of the promo set; only needed when promos are wanted. */
  promos: readonly CardDetail[]
  lang: CardLang
}

/**
 * The cards of a master set in binder order: the set by number, each card followed by
 * its further finishes if wanted, and the promos at the end.
 */
export function buildMasterSet(source: MasterSetSource, options: MasterSetOptions): CardRef[] {
  const { lang } = source
  const refs: CardRef[] = []

  for (const card of source.cards) {
    if (
      isSecretRare(card, source.officialCount) &&
      options.excludedSecretRarities.includes(card.rarity ?? '')
    ) {
      continue
    }
    const base = baseVariant(card.variants)
    refs.push({ cardId: card.id, lang, variant: base })
    if (!options.withVariants) continue
    for (const variant of card.variants) {
      if (variant !== base) refs.push({ cardId: card.id, lang, variant })
    }
  }

  if (options.withPromos) {
    for (const card of source.promos) {
      refs.push({ cardId: card.id, lang, variant: baseVariant(card.variants) })
    }
  }
  return refs
}

export function pagesNeeded(cardCount: number, layout: Layout): number {
  return Math.max(1, Math.ceil(cardCount / slotsPerPage(layout)))
}

export interface MasterSetBinderInput {
  name: string
  layout: Layout
  lang: CardLang
  defaultOpeningSide: OpeningSide
  setId: string
  options: MasterSetOptions
}

/** A binder with one pocket per card, all of them still missing. */
export function createMasterSetBinder(
  input: MasterSetBinderInput,
  cards: readonly CardRef[],
  ctx: ModelContext = defaultContext,
): Binder {
  const binder = createBinder(
    {
      name: input.name,
      layout: input.layout,
      lang: input.lang,
      defaultOpeningSide: input.defaultOpeningSide,
      mode: 'masterSet',
      setId: input.setId,
      withReverseHolo: input.options.withVariants,
      withSecretRares: input.options.excludedSecretRarities.length === 0,
      withPromos: input.options.withPromos,
    },
    ctx,
  )
  const perPage = slotsPerPage(input.layout)
  const pages = Array.from({ length: pagesNeeded(cards.length, input.layout) }, (_, pageIndex) => {
    const page = createPage(input.layout, pageIndex, input.defaultOpeningSide, ctx)
    return {
      ...page,
      slots: page.slots.map((slot): Slot => {
        const cardRef = cards[pageIndex * perPage + slot.index]
        return cardRef ? { index: slot.index, cardRef, owned: false } : slot
      }),
    }
  })
  return { ...binder, pages }
}

const refKey = (ref: CardRef) => `${ref.cardId}/${ref.variant}`

/**
 * The options an existing master set was last built with, read from what is in it:
 * a group of secret rares counts as left out when the binder holds none of its cards.
 */
export function currentOptions(binder: Binder, source: MasterSetSource): MasterSetOptions {
  const present = new Set(
    binder.pages.flatMap((page) => page.slots.flatMap((slot) => (slot.cardRef ? [slot.cardRef.cardId] : []))),
  )
  const excluded = secretRareGroups(source.cards, source.officialCount)
    .map((group) => group.rarity)
    .filter(
      (rarity) =>
        !source.cards.some(
          (card) =>
            isSecretRare(card, source.officialCount) && (card.rarity ?? '') === rarity && present.has(card.id),
        ),
    )
  return {
    withVariants: binder.withReverseHolo,
    excludedSecretRarities: excluded,
    withPromos: binder.withPromos,
  }
}

/**
 * Rebuilds an existing master set for other options. Cards that no longer belong are
 * removed, new ones arrive as missing, and everything lies in set order again; cards
 * that stay keep their owned state. Cards that never belonged to the set (placed by
 * hand) follow at the end. Pages keep their settings and images; pages left empty at
 * the end are dropped unless an image lies on them.
 */
export function rebuildMasterSet(
  binder: Binder,
  source: MasterSetSource,
  options: MasterSetOptions,
  ctx: ModelContext = defaultContext,
): Binder {
  const wanted = buildMasterSet(source, options)
  // cards of the set and of its promo set are the master set's business; all others were placed by hand
  const ownSets = [source.setId, ...(source.promoSetId === undefined ? [] : [source.promoSetId])]
  const belongsToSet = (cardId: string) => ownSets.some((setId) => cardId.startsWith(`${setId}-`))

  const existing = binder.pages.flatMap((page) =>
    page.slots.flatMap((slot) => (slot.cardRef ? [{ cardRef: slot.cardRef, owned: slot.owned }] : [])),
  )
  const owned = new Set(existing.filter((card) => card.owned).map((card) => refKey(card.cardRef)))
  const extras = existing.filter((card) => !belongsToSet(card.cardRef.cardId))

  const cards = [...wanted.map((cardRef) => ({ cardRef, owned: owned.has(refKey(cardRef)) })), ...extras]
  const perPage = slotsPerPage(binder.layout)
  const lastImagePage = binder.pages.reduce((last, page) => (page.images.length > 0 ? page.index : last), -1)
  const pageCount = Math.max(pagesNeeded(cards.length, binder.layout), lastImagePage + 1)

  const pages = Array.from({ length: pageCount }, (_, pageIndex) => {
    const previous = binder.pages[pageIndex]
    const page = previous ?? createPage(binder.layout, pageIndex, binder.defaultOpeningSide, ctx)
    return {
      ...page,
      slots: page.slots.map((slot): Slot => {
        const card = cards[pageIndex * perPage + slot.index]
        return card ? { index: slot.index, cardRef: card.cardRef, owned: card.owned } : { index: slot.index, owned: false }
      }),
    }
  })

  return {
    ...binder,
    pages,
    withReverseHolo: options.withVariants,
    withSecretRares: options.excludedSecretRarities.length === 0,
    withPromos: options.withPromos,
    updatedAt: ctx.now(),
  }
}

/**
 * The promo set that goes with a set: TCGdex files promos per series (e.g. `svp` for all
 * Scarlet & Violet sets), not per set. `undefined` if the series has none.
 */
export function promoSetIdOf(catalog: Catalog, setId: string): string | undefined {
  const set = catalog.setsById.get(setId)
  if (!set) return undefined
  // western series name it like `svp`, Japanese ones like `SV-P`
  return [`${set.seriesId}p`, `${set.seriesId}-P`].find(
    (promoSetId) => promoSetId !== setId && catalog.setsById.has(promoSetId),
  )
}
