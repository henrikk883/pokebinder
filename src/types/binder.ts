export const LAYOUTS = ['2x2', '3x3', '4x4'] as const
export type Layout = (typeof LAYOUTS)[number]

export const OPENING_SIDES = ['left', 'right'] as const
export type OpeningSide = (typeof OPENING_SIDES)[number]

export const BINDER_MODES = ['empty', 'masterSet'] as const
export type BinderMode = (typeof BINDER_MODES)[number]

export const CARD_VARIANTS = ['normal', 'reverse', 'holo', 'pokeball', 'masterball'] as const
export type CardVariant = (typeof CARD_VARIANTS)[number]

export const CARD_LANGS = ['de', 'en', 'ja', 'ko'] as const
export type CardLang = (typeof CARD_LANGS)[number]

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

export interface ImageCrop {
  x: number
  y: number
  zoom: number
}

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
}

export interface SlotPosition {
  pageId: string
  slotIndex: number
}
