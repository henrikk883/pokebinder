export const LAYOUTS = ['2x2', '3x3', '4x4'] as const
export type Layout = (typeof LAYOUTS)[number]

/**
 * Where the pockets of a page open. `mixed` is the pattern of many bought binders:
 * the outermost column opens towards the rings, all other columns away from them.
 */
export const OPENING_SIDES = ['left', 'right', 'mixed'] as const
export type OpeningSide = (typeof OPENING_SIDES)[number]

/** The side a single pocket opens to. */
export type PocketOpening = 'left' | 'right'

export const BINDER_MODES = ['empty', 'masterSet'] as const
export type BinderMode = (typeof BINDER_MODES)[number]

/** The print finishes every set knows. */
export const BASE_VARIANTS = ['normal', 'holo', 'reverse'] as const

/**
 * Print finish of a card: one of `BASE_VARIANTS`, or the pattern of a special reverse
 * holo as TCGdex names it (`pokeball`, `masterball`, `energy`, `friendball`, …). Which
 * patterns exist differs from set to set, so the list is open.
 */
export type CardVariant = string

export function isCardVariant(value: unknown): value is CardVariant {
  return typeof value === 'string' && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value)
}

/** Order of variants of the same card: base finishes first, then patterns by name. */
export function compareVariants(a: CardVariant, b: CardVariant): number {
  const rank = (variant: CardVariant) => {
    const index = (BASE_VARIANTS as readonly string[]).indexOf(variant)
    return index === -1 ? BASE_VARIANTS.length : index
  }
  return rank(a) - rank(b) || a.localeCompare(b)
}

export const CARD_LANGS = ['de', 'en', 'ja', 'ko'] as const
export type CardLang = (typeof CARD_LANGS)[number]

/**
 * Languages the app offers. Korean is part of the data model, but TCGdex has next to no
 * Korean cards and no images for them, so it is not offered.
 */
export const OFFERED_LANGS = ['de', 'en', 'ja'] as const satisfies readonly CardLang[]

export const DEFAULT_LANG: CardLang = 'de'

/** Reference to a TCGdex card; card data itself is never stored. */
export interface CardRef {
  cardId: string
  lang: CardLang
  variant: CardVariant
}

export interface Slot {
  index: number
  cardRef?: CardRef
  /** Only meaningful when a card is set; `false` means the card is missing. */
  owned: boolean
}

/** Which part of an image shows: focus point (0–1 on both axes, 0.5 = centre) and magnification (1 = fills the area). */
export interface ImageCrop {
  x: number
  y: number
  zoom: number
}

/**
 * An uploaded image behind the pockets. It starts at `fromSlot` and covers `spanCols` ×
 * `spanRows` pockets. On a left-hand page it may reach across the rings onto the facing
 * page; `spanCols` is then larger than the columns left on its own page.
 */
export interface PlacedImage {
  id: string
  assetId: string
  fromSlot: number
  spanCols: number
  spanRows: number
  crop: ImageCrop
}

export interface Page {
  id: string
  index: number
  openingSide: OpeningSide
  /** Always rows × cols entries, row by row. */
  slots: Slot[]
  images: PlacedImage[]
}

export interface BinderCover {
  title: string
  assetId?: string
}

export interface Binder {
  id: string
  name: string
  mode: BinderMode
  setId?: string
  withReverseHolo: boolean
  withSecretRares: boolean
  withPromos: boolean
  layout: Layout
  /** Language new cards are searched and placed in; each card keeps its own language. */
  lang: CardLang
  /** Opening side that newly added pages start with. */
  defaultOpeningSide: OpeningSide
  cover: BinderCover
  pages: Page[]
  /** ISO 8601 timestamps. */
  createdAt: string
  updatedAt: string
}

export interface Asset {
  id: string
  blob: Blob
  mimeType: string
  width: number
  height: number
  /** ISO 8601; orders the image library. Missing on images from older backups. */
  createdAt?: string
}

export interface SlotPosition {
  pageId: string
  slotIndex: number
}
