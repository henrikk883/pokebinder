import { newId } from '../../lib/id'
import {
  DEFAULT_LANG,
  type Binder,
  type BinderMode,
  type CardLang,
  type CardRef,
  type CardVariant,
  type Layout,
  type OpeningSide,
  type Page,
  type PocketOpening,
  type Slot,
  type SlotPosition,
} from '../../types/binder'

export interface LayoutDimensions {
  rows: number
  cols: number
}

const LAYOUT_DIMENSIONS: Record<Layout, LayoutDimensions> = {
  '2x2': { rows: 2, cols: 2 },
  '3x3': { rows: 3, cols: 3 },
  '4x4': { rows: 4, cols: 4 },
}

export function layoutDimensions(layout: Layout): LayoutDimensions {
  return LAYOUT_DIMENSIONS[layout]
}

export function slotsPerPage(layout: Layout): number {
  const { rows, cols } = layoutDimensions(layout)
  return rows * cols
}

/**
 * The side one pocket opens to. With `mixed` it depends on where the page lies: odd page
 * numbers are right-hand pages with the rings on their left, even ones are left-hand pages.
 * There the outermost column opens towards the rings and the others away from them, so on
 * a right-hand 3 × 3 page the columns open right, right, left, and on a left-hand page
 * right, left, left.
 */
export function pocketOpening(
  openingSide: OpeningSide,
  pageIndex: number,
  slotIndex: number,
  layout: Layout,
): PocketOpening {
  if (openingSide !== 'mixed') return openingSide
  const { cols } = layoutDimensions(layout)
  const column = slotIndex % cols
  const isRightHandPage = pageIndex % 2 === 0
  if (isRightHandPage) return column === cols - 1 ? 'left' : 'right'
  return column === 0 ? 'right' : 'left'
}

export interface NewBinderInput {
  name: string
  layout?: Layout
  lang?: CardLang
  defaultOpeningSide?: OpeningSide
  mode?: BinderMode
  setId?: string
  withReverseHolo?: boolean
  withSecretRares?: boolean
  withPromos?: boolean
}

/** Source of ids and timestamps, replaceable in tests. */
export interface ModelContext {
  newId: () => string
  now: () => string
}

export const defaultContext: ModelContext = {
  newId,
  now: () => new Date().toISOString(),
}

function emptySlot(index: number): Slot {
  return { index, owned: false }
}

export function createPage(
  layout: Layout,
  index: number,
  openingSide: OpeningSide,
  ctx: ModelContext = defaultContext,
): Page {
  return {
    id: ctx.newId(),
    index,
    openingSide,
    slots: Array.from({ length: slotsPerPage(layout) }, (_, i) => emptySlot(i)),
    images: [],
  }
}

export function createBinder(input: NewBinderInput, ctx: ModelContext = defaultContext): Binder {
  const layout = input.layout ?? '3x3'
  const defaultOpeningSide = input.defaultOpeningSide ?? 'right'
  const timestamp = ctx.now()
  const binder: Binder = {
    id: ctx.newId(),
    name: input.name,
    mode: input.mode ?? 'empty',
    withReverseHolo: input.withReverseHolo ?? false,
    withSecretRares: input.withSecretRares ?? true,
    withPromos: input.withPromos ?? true,
    layout,
    lang: input.lang ?? DEFAULT_LANG,
    defaultOpeningSide,
    cover: { title: input.name },
    pages: [createPage(layout, 0, defaultOpeningSide, ctx)],
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  if (input.setId !== undefined) binder.setId = input.setId
  return binder
}

/** The binder with new pages and a fresh change date. */
export function withPages(binder: Binder, pages: Page[], ctx: ModelContext): Binder {
  return { ...binder, pages, updatedAt: ctx.now() }
}

export function findPage(binder: Binder, pageId: string): Page {
  const page = binder.pages.find((p) => p.id === pageId)
  if (!page) throw new RangeError(`Unknown page: ${pageId}`)
  return page
}

function findSlot(binder: Binder, position: SlotPosition): Slot {
  const slot = findPage(binder, position.pageId).slots[position.slotIndex]
  if (!slot) throw new RangeError(`Unknown slot: ${position.pageId}/${position.slotIndex}`)
  return slot
}

type SlotContent = Pick<Slot, 'cardRef' | 'owned'>

function contentOf(slot: Slot): SlotContent {
  return slot.cardRef ? { cardRef: slot.cardRef, owned: slot.owned } : { owned: false }
}

function writeSlots(
  binder: Binder,
  writes: { position: SlotPosition; content: SlotContent }[],
  ctx: ModelContext,
): Binder {
  for (const { position } of writes) findSlot(binder, position)
  const pages = binder.pages.map((page) => {
    const pageWrites = writes.filter((w) => w.position.pageId === page.id)
    if (pageWrites.length === 0) return page
    const slots = page.slots.map((slot) => {
      const write = pageWrites.find((w) => w.position.slotIndex === slot.index)
      return write ? { index: slot.index, ...write.content } : slot
    })
    return { ...page, slots }
  })
  return withPages(binder, pages, ctx)
}

export function addPage(binder: Binder, ctx: ModelContext = defaultContext): Binder {
  const page = createPage(binder.layout, binder.pages.length, binder.defaultOpeningSide, ctx)
  return withPages(binder, [...binder.pages, page], ctx)
}

export function removePage(
  binder: Binder,
  pageId: string,
  ctx: ModelContext = defaultContext,
): Binder {
  findPage(binder, pageId)
  const pages = binder.pages
    .filter((page) => page.id !== pageId)
    .map((page, index) => (page.index === index ? page : { ...page, index }))
  return withPages(binder, pages, ctx)
}

/** Puts a card into a pocket, replacing what was there. Hand-placed cards start as owned. */
export function setCard(
  binder: Binder,
  position: SlotPosition,
  cardRef: CardRef,
  owned = true,
  ctx: ModelContext = defaultContext,
): Binder {
  return writeSlots(binder, [{ position, content: { cardRef, owned } }], ctx)
}

export function clearSlot(
  binder: Binder,
  position: SlotPosition,
  ctx: ModelContext = defaultContext,
): Binder {
  return writeSlots(binder, [{ position, content: { owned: false } }], ctx)
}

/** Moves a card to another pocket; an occupied target swaps with the source. */
export function moveCard(
  binder: Binder,
  from: SlotPosition,
  to: SlotPosition,
  ctx: ModelContext = defaultContext,
): Binder {
  const source = findSlot(binder, from)
  const target = findSlot(binder, to)
  if (!source.cardRef) return binder
  if (from.pageId === to.pageId && from.slotIndex === to.slotIndex) return binder
  return writeSlots(
    binder,
    [
      { position: to, content: contentOf(source) },
      { position: from, content: contentOf(target) },
    ],
    ctx,
  )
}

/** Marks a card as owned or missing; empty pockets have no such state. */
export function setOwned(
  binder: Binder,
  position: SlotPosition,
  owned: boolean,
  ctx: ModelContext = defaultContext,
): Binder {
  const slot = findSlot(binder, position)
  if (!slot.cardRef || slot.owned === owned) return binder
  return writeSlots(binder, [{ position, content: { cardRef: slot.cardRef, owned } }], ctx)
}

/** A card together with its owned state, detached from the pocket it sits in. */
export interface PlacedCard {
  cardRef: CardRef
  owned: boolean
}

function cardsOf(pages: readonly Page[]): PlacedCard[] {
  return pages.flatMap((page) =>
    page.slots.flatMap((slot) => (slot.cardRef ? [{ cardRef: slot.cardRef, owned: slot.owned }] : [])),
  )
}

/** Fills the pockets of a page from `cards`, taking as many as fit. */
function fillPage(page: Page, cards: PlacedCard[]): Page {
  return {
    ...page,
    slots: page.slots.map((slot): Slot => {
      const card = cards.shift()
      return card ? { index: slot.index, cardRef: card.cardRef, owned: card.owned } : emptySlot(slot.index)
    }),
  }
}

/**
 * Puts the cards of one page, or of the whole binder, into the given order.
 * They move up to the first pockets; the pockets left over end up empty.
 */
export function sortCards(
  binder: Binder,
  scope: { pageId?: string },
  compare: (a: PlacedCard, b: PlacedCard) => number,
  ctx: ModelContext = defaultContext,
): Binder {
  const inScope = (page: Page) => scope.pageId === undefined || page.id === scope.pageId
  if (scope.pageId !== undefined) findPage(binder, scope.pageId)

  const sorted = cardsOf(binder.pages.filter(inScope)).sort(compare)
  return withPages(
    binder,
    binder.pages.map((page) => (inScope(page) ? fillPage(page, sorted) : page)),
    ctx,
  )
}

/**
 * Switches to another pocket layout. Cards keep their order and flow onto as many pages as
 * they need; existing pages are never removed. Placed images do not survive, because their
 * span refers to the old grid.
 */
export function changeLayout(
  binder: Binder,
  layout: Layout,
  ctx: ModelContext = defaultContext,
): Binder {
  if (layout === binder.layout) return binder
  const cards = cardsOf(binder.pages)
  const pageCount = Math.max(binder.pages.length, Math.ceil(cards.length / slotsPerPage(layout)))
  const pages = Array.from({ length: pageCount }, (_, index) => {
    const previous = binder.pages[index]
    const page = createPage(layout, index, previous?.openingSide ?? binder.defaultOpeningSide, ctx)
    return fillPage(previous ? { ...page, id: previous.id } : page, cards)
  })
  return { ...withPages(binder, pages, ctx), layout }
}

/**
 * Gives the binder another name. The cover title follows as long as it is still the
 * binder's name; a title that was set on its own stays.
 */
export function renameBinder(
  binder: Binder,
  name: string,
  ctx: ModelContext = defaultContext,
): Binder {
  const trimmed = name.trim()
  if (trimmed === '' || trimmed === binder.name) return binder
  const cover = binder.cover.title === binder.name ? { ...binder.cover, title: trimmed } : binder.cover
  return { ...binder, name: trimmed, cover, updatedAt: ctx.now() }
}

/** Changes the print finish of the card in a pocket. */
export function setVariant(
  binder: Binder,
  position: SlotPosition,
  variant: CardVariant,
  ctx: ModelContext = defaultContext,
): Binder {
  const slot = findSlot(binder, position)
  if (!slot.cardRef || slot.cardRef.variant === variant) return binder
  return writeSlots(
    binder,
    [{ position, content: { cardRef: { ...slot.cardRef, variant }, owned: slot.owned } }],
    ctx,
  )
}

/** Changes the language of the card in a pocket; the card id stays the same. */
export function setCardLang(
  binder: Binder,
  position: SlotPosition,
  lang: CardLang,
  ctx: ModelContext = defaultContext,
): Binder {
  const slot = findSlot(binder, position)
  if (!slot.cardRef || slot.cardRef.lang === lang) return binder
  return writeSlots(
    binder,
    [{ position, content: { cardRef: { ...slot.cardRef, lang }, owned: slot.owned } }],
    ctx,
  )
}

/** Languages of the cards in the binder, the binder's own language first. */
export function cardLangs(binder: Binder): CardLang[] {
  return [...new Set([binder.lang, ...cardsOf(binder.pages).map((card) => card.cardRef.lang)])]
}

export interface Progress {
  /** Pockets that hold a card; empty pockets do not count. */
  total: number
  owned: number
  missing: number
}

export function countProgress(binder: Binder): Progress {
  const cards = cardsOf(binder.pages)
  const owned = cards.filter((card) => card.owned).length
  return { total: cards.length, owned, missing: cards.length - owned }
}

/** Number of pockets that hold a card. */
export function countCards(binder: Binder): number {
  return cardsOf(binder.pages).length
}

export function setOpeningSide(
  binder: Binder,
  pageId: string,
  openingSide: OpeningSide,
  ctx: ModelContext = defaultContext,
): Binder {
  if (findPage(binder, pageId).openingSide === openingSide) return binder
  const pages = binder.pages.map((page) => (page.id === pageId ? { ...page, openingSide } : page))
  return withPages(binder, pages, ctx)
}

function renumbered(pages: Page[]): Page[] {
  return pages.map((page, index) => (page.index === index ? page : { ...page, index }))
}

/**
 * Moves a page to another place in the binder; the pages in between move up by one.
 * `toIndex` is where the page stands afterwards. Pages change sides by this, so images
 * across two pages need `normalizeImages` afterwards.
 */
export function movePage(
  binder: Binder,
  pageId: string,
  toIndex: number,
  ctx: ModelContext = defaultContext,
): Binder {
  const page = findPage(binder, pageId)
  const target = Math.max(0, Math.min(binder.pages.length - 1, toIndex))
  if (target === page.index) return binder
  const pages = binder.pages.filter((entry) => entry.id !== pageId)
  pages.splice(target, 0, page)
  return withPages(binder, renumbered(pages), ctx)
}

/** Adds an empty page at `atIndex`; the pages from there on move back by one. */
export function insertPage(binder: Binder, atIndex: number, ctx: ModelContext = defaultContext): Binder {
  const index = Math.max(0, Math.min(binder.pages.length, atIndex))
  const pages = [...binder.pages]
  pages.splice(index, 0, createPage(binder.layout, index, binder.defaultOpeningSide, ctx))
  return withPages(binder, renumbered(pages), ctx)
}

/**
 * Adds a copy of a page right behind it: the same cards with their marks, the same images
 * and opening side. The copy and its images get ids of their own.
 */
export function duplicatePage(binder: Binder, pageId: string, ctx: ModelContext = defaultContext): Binder {
  const page = findPage(binder, pageId)
  const copy: Page = {
    ...page,
    id: ctx.newId(),
    slots: page.slots.map((slot) => ({ ...slot })),
    images: page.images.map((image) => ({ ...image, id: ctx.newId() })),
  }
  const pages = [...binder.pages]
  pages.splice(page.index + 1, 0, copy)
  return withPages(binder, renumbered(pages), ctx)
}
