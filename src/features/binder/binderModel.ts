import type {
  Binder,
  BinderMode,
  CardRef,
  Layout,
  OpeningSide,
  Page,
  Slot,
  SlotPosition,
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

export interface NewBinderInput {
  name: string
  layout?: Layout
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
  newId: () => crypto.randomUUID(),
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
    defaultOpeningSide,
    cover: { title: input.name },
    pages: [createPage(layout, 0, defaultOpeningSide, ctx)],
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  if (input.setId !== undefined) binder.setId = input.setId
  return binder
}

function withPages(binder: Binder, pages: Page[], ctx: ModelContext): Binder {
  return { ...binder, pages, updatedAt: ctx.now() }
}

function findPage(binder: Binder, pageId: string): Page {
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
