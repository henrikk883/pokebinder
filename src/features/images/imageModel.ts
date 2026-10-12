import {
  defaultContext,
  findPage,
  layoutDimensions,
  withPages,
  type ModelContext,
} from '../binder/binderModel'
import type {
  Binder,
  BinderCover,
  ImageCrop,
  Page,
  PlacedImage,
  SlotPosition,
} from '../../types/binder'

/** Where an image sits: first pocket and how many pockets it covers in each direction. */
export interface Placement {
  fromSlot: number
  spanCols: number
  spanRows: number
}

export type PlacementError =
  /** Does not fit on the page, or on the spread for an image reaching across the rings. */
  | 'outOfBounds'
  /** Another image already covers one of the pockets. */
  | 'overlap'

export type PlacementResult = { ok: true; binder: Binder } | { ok: false; error: PlacementError }

export const DEFAULT_CROP: ImageCrop = { x: 0.5, y: 0.5, zoom: 1 }
export const MIN_CROP_ZOOM = 1
export const MAX_CROP_ZOOM = 4

export function clampCrop(crop: ImageCrop): ImageCrop {
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
  return {
    x: clamp(crop.x, 0, 1),
    y: clamp(crop.y, 0, 1),
    zoom: clamp(crop.zoom, MIN_CROP_ZOOM, MAX_CROP_ZOOM),
  }
}

/**
 * The page across the rings that an image on this page can reach onto. Only left-hand pages
 * (even page numbers) have one: page 1 lies alone next to the cover, and a right-hand page
 * ends at the edge of the binder.
 */
export function facingPage(binder: Binder, pageIndex: number): Page | undefined {
  return pageIndex % 2 === 1 ? binder.pages[pageIndex + 1] : undefined
}

/** Largest span an image starting at `fromSlot` can have. */
export function maxSpan(
  binder: Binder,
  pageIndex: number,
  fromSlot: number,
): { cols: number; rows: number } {
  const { rows, cols } = layoutDimensions(binder.layout)
  const column = fromSlot % cols
  const row = Math.floor(fromSlot / cols)
  return {
    cols: cols - column + (facingPage(binder, pageIndex) ? cols : 0),
    rows: rows - row,
  }
}

interface Cell {
  pageIndex: number
  slotIndex: number
}

const cellKey = (cell: Cell) => `${cell.pageIndex}:${cell.slotIndex}`

/** The pockets a placement covers, on its own page and, if it reaches that far, the facing one. */
export function cellsOf(binder: Binder, pageIndex: number, placement: Placement): Cell[] {
  const { cols } = layoutDimensions(binder.layout)
  const column = placement.fromSlot % cols
  const row = Math.floor(placement.fromSlot / cols)
  const cells: Cell[] = []
  for (let r = row; r < row + placement.spanRows; r++) {
    for (let c = column; c < column + placement.spanCols; c++) {
      cells.push(
        c < cols
          ? { pageIndex, slotIndex: r * cols + c }
          : { pageIndex: pageIndex + 1, slotIndex: r * cols + (c - cols) },
      )
    }
  }
  return cells
}

function fits(binder: Binder, pageIndex: number, placement: Placement): boolean {
  const page = binder.pages[pageIndex]
  const { fromSlot, spanCols, spanRows } = placement
  if (!page || !Number.isInteger(fromSlot) || fromSlot < 0 || fromSlot >= page.slots.length) {
    return false
  }
  if (!Number.isInteger(spanCols) || !Number.isInteger(spanRows) || spanCols < 1 || spanRows < 1) {
    return false
  }
  const max = maxSpan(binder, pageIndex, fromSlot)
  return spanCols <= max.cols && spanRows <= max.rows
}

/** Pockets covered by images on the given pages, with the image covering each. */
function coverage(
  binder: Binder,
  pageIndices: number[],
  exceptImageId?: string,
): Map<string, { page: Page; image: PlacedImage }> {
  const covered = new Map<string, { page: Page; image: PlacedImage }>()
  for (const pageIndex of pageIndices) {
    const page = binder.pages[pageIndex]
    if (!page) continue
    for (const image of page.images) {
      if (image.id === exceptImageId) continue
      for (const cell of cellsOf(binder, pageIndex, image)) covered.set(cellKey(cell), { page, image })
    }
  }
  return covered
}

/** Why a placement is not possible, or `null` when it is. */
export function checkPlacement(
  binder: Binder,
  pageIndex: number,
  placement: Placement,
  exceptImageId?: string,
): PlacementError | null {
  if (!fits(binder, pageIndex, placement)) return 'outOfBounds'
  const covered = coverage(binder, [pageIndex - 1, pageIndex, pageIndex + 1], exceptImageId)
  const taken = cellsOf(binder, pageIndex, placement).some((cell) => covered.has(cellKey(cell)))
  return taken ? 'overlap' : null
}

function replaceImages(
  binder: Binder,
  pageId: string,
  update: (images: PlacedImage[]) => PlacedImage[],
  ctx: ModelContext,
): Binder {
  return withPages(
    binder,
    binder.pages.map((page) => (page.id === pageId ? { ...page, images: update(page.images) } : page)),
    ctx,
  )
}

export function placeImage(
  binder: Binder,
  pageId: string,
  assetId: string,
  placement: Placement,
  ctx: ModelContext = defaultContext,
): PlacementResult {
  const page = findPage(binder, pageId)
  const error = checkPlacement(binder, page.index, placement)
  if (error) return { ok: false, error }
  const image: PlacedImage = {
    id: ctx.newId(),
    assetId,
    fromSlot: placement.fromSlot,
    spanCols: placement.spanCols,
    spanRows: placement.spanRows,
    crop: DEFAULT_CROP,
  }
  return { ok: true, binder: replaceImages(binder, pageId, (images) => [...images, image], ctx) }
}

/** Moves or resizes an image. */
export function changePlacement(
  binder: Binder,
  pageId: string,
  imageId: string,
  placement: Placement,
  ctx: ModelContext = defaultContext,
): PlacementResult {
  const page = findPage(binder, pageId)
  if (!page.images.some((image) => image.id === imageId)) throw new RangeError(`Unknown image: ${imageId}`)
  const error = checkPlacement(binder, page.index, placement, imageId)
  if (error) return { ok: false, error }
  return {
    ok: true,
    binder: replaceImages(
      binder,
      pageId,
      (images) =>
        images.map((image) =>
          image.id === imageId
            ? {
                ...image,
                fromSlot: placement.fromSlot,
                spanCols: placement.spanCols,
                spanRows: placement.spanRows,
              }
            : image,
        ),
      ctx,
    ),
  }
}

/**
 * Where a pocket lies on its spread, counted in pockets from the top left of the left-hand
 * page. Page 1 and every odd page lie on the right.
 */
function spreadCell(binder: Binder, cell: Cell): { spread: number; column: number; row: number } {
  const { cols } = layoutDimensions(binder.layout)
  const onTheRight = cell.pageIndex % 2 === 0
  return {
    spread: Math.ceil(cell.pageIndex / 2),
    column: (cell.slotIndex % cols) + (onTheRight ? cols : 0),
    row: Math.floor(cell.slotIndex / cols),
  }
}

/**
 * Moves the image behind the pocket `grabbed` so that this part of it comes to lie behind
 * the pocket `target`, as when it is dragged there. Size and crop stay; the image may end
 * up on the other page of the spread. Cards in the pockets stay where they are.
 */
export function moveImage(
  binder: Binder,
  grabbed: SlotPosition,
  target: SlotPosition,
  ctx: ModelContext = defaultContext,
): PlacementResult {
  const grabbedPage = findPage(binder, grabbed.pageId)
  const targetPage = findPage(binder, target.pageId)
  const found = imageAt(binder, grabbedPage.index, grabbed.slotIndex)
  if (!found) return { ok: true, binder }
  const { image, page: owner } = found
  const { rows, cols } = layoutDimensions(binder.layout)

  const from = spreadCell(binder, { pageIndex: grabbedPage.index, slotIndex: grabbed.slotIndex })
  const to = spreadCell(binder, { pageIndex: targetPage.index, slotIndex: target.slotIndex })
  const origin = spreadCell(binder, { pageIndex: owner.index, slotIndex: image.fromSlot })
  const column = origin.column + to.column - from.column
  const row = origin.row + to.row - from.row
  if (column < 0 || column >= 2 * cols || row < 0 || row >= rows) return { ok: false, error: 'outOfBounds' }

  // the page the image starts on: left of the rings or right of them
  const onTheRight = column >= cols
  const nextOwner = binder.pages[onTheRight ? to.spread * 2 : to.spread * 2 - 1]
  if (!nextOwner) return { ok: false, error: 'outOfBounds' }
  const placement: Placement = {
    fromSlot: row * cols + (onTheRight ? column - cols : column),
    spanCols: image.spanCols,
    spanRows: image.spanRows,
  }
  if (nextOwner.id === owner.id && placement.fromSlot === image.fromSlot) return { ok: true, binder }

  const error = checkPlacement(binder, nextOwner.index, placement, image.id)
  if (error) return { ok: false, error }
  const moved: PlacedImage = { ...image, fromSlot: placement.fromSlot }
  return {
    ok: true,
    binder: withPages(
      binder,
      binder.pages.map((page) => {
        const others = page.images.filter((entry) => entry.id !== image.id)
        if (page.id === nextOwner.id) return { ...page, images: [...others, moved] }
        return page.id === owner.id ? { ...page, images: others } : page
      }),
      ctx,
    ),
  }
}

export function setImageCrop(
  binder: Binder,
  pageId: string,
  imageId: string,
  crop: ImageCrop,
  ctx: ModelContext = defaultContext,
): Binder {
  findPage(binder, pageId)
  return replaceImages(
    binder,
    pageId,
    (images) => images.map((image) => (image.id === imageId ? { ...image, crop: clampCrop(crop) } : image)),
    ctx,
  )
}

export function removeImage(
  binder: Binder,
  pageId: string,
  imageId: string,
  ctx: ModelContext = defaultContext,
): Binder {
  findPage(binder, pageId)
  return replaceImages(binder, pageId, (images) => images.filter((image) => image.id !== imageId), ctx)
}

/** The image behind a pocket, with the page it belongs to (which may be the facing page). */
export function imageAt(
  binder: Binder,
  pageIndex: number,
  slotIndex: number,
): { page: Page; image: PlacedImage } | undefined {
  return coverage(binder, [pageIndex - 1, pageIndex]).get(cellKey({ pageIndex, slotIndex }))
}

/** The part of an image that lies on one page. */
export interface ImagePiece {
  image: PlacedImage
  ownerPageId: string
  /** Position and size of the part on this page, in pockets. */
  column: number
  row: number
  cols: number
  rows: number
  /** Columns of the image that lie before this part, on the facing page. */
  offsetCols: number
}

/** Everything to draw behind the pockets of a page, including parts reaching in from the left. */
export function imagePieces(binder: Binder, pageIndex: number): ImagePiece[] {
  const { cols } = layoutDimensions(binder.layout)
  const page = binder.pages[pageIndex]
  if (!page) return []
  const pieces: ImagePiece[] = []

  for (const image of page.images) {
    const column = image.fromSlot % cols
    pieces.push({
      image,
      ownerPageId: page.id,
      column,
      row: Math.floor(image.fromSlot / cols),
      cols: Math.min(image.spanCols, cols - column),
      rows: image.spanRows,
      offsetCols: 0,
    })
  }

  const left = binder.pages[pageIndex - 1]
  if (left && facingPage(binder, pageIndex - 1) === page) {
    for (const image of left.images) {
      const ownCols = cols - (image.fromSlot % cols)
      if (image.spanCols <= ownCols) continue
      pieces.push({
        image,
        ownerPageId: left.id,
        column: 0,
        row: Math.floor(image.fromSlot / cols),
        cols: image.spanCols - ownCols,
        rows: image.spanRows,
        offsetCols: ownCols,
      })
    }
  }
  return pieces
}

/**
 * Repairs images after pages moved (a page was deleted): an image that no longer has a
 * facing page, or would now cover another image there, is cut back to its own page.
 */
export function normalizeImages(binder: Binder, ctx: ModelContext = defaultContext): Binder {
  const { rows, cols } = layoutDimensions(binder.layout)
  let changed = false

  // 1. everything must fit on its page or spread
  let pages = binder.pages.map((page) => {
    const images = page.images.flatMap((image): PlacedImage[] => {
      if (image.fromSlot < 0 || image.fromSlot >= page.slots.length) return []
      const max = maxSpan(binder, page.index, image.fromSlot)
      const spanCols = Math.min(image.spanCols, max.cols)
      const spanRows = Math.min(image.spanRows, max.rows, rows)
      return spanCols === image.spanCols && spanRows === image.spanRows
        ? [image]
        : [{ ...image, spanCols, spanRows }]
    })
    if (images.length === page.images.length && images.every((image, i) => image === page.images[i])) {
      return page
    }
    changed = true
    return { ...page, images }
  })

  // 2. parts reaching onto the facing page give way to the images that live there
  const ownCells = new Set<string>()
  for (const page of pages) {
    for (const image of page.images) {
      const ownCols = Math.min(image.spanCols, cols - (image.fromSlot % cols))
      for (const cell of cellsOf(binder, page.index, { ...image, spanCols: ownCols })) {
        ownCells.add(cellKey(cell))
      }
    }
  }
  pages = pages.map((page) => {
    const images = page.images.map((image) => {
      const ownCols = cols - (image.fromSlot % cols)
      if (image.spanCols <= ownCols) return image
      const reaching = cellsOf(binder, page.index, image).filter((cell) => cell.pageIndex !== page.index)
      if (!reaching.some((cell) => ownCells.has(cellKey(cell)))) return image
      changed = true
      return { ...image, spanCols: ownCols }
    })
    return images.every((image, i) => image === page.images[i]) ? page : { ...page, images }
  })

  return changed ? withPages(binder, pages, ctx) : binder
}

export function setCover(
  binder: Binder,
  cover: BinderCover,
  ctx: ModelContext = defaultContext,
): Binder {
  const next: BinderCover = { title: cover.title }
  if (cover.assetId !== undefined) next.assetId = cover.assetId
  return { ...binder, cover: next, updatedAt: ctx.now() }
}

/** Longest edge an uploaded image keeps; larger ones are scaled down. */
export const MAX_IMAGE_EDGE = 2000

/** Size after scaling an image down so that neither edge exceeds `maxEdge`. */
export function fitWithin(
  width: number,
  height: number,
  maxEdge: number = MAX_IMAGE_EDGE,
): { width: number; height: number } {
  const longest = Math.max(width, height)
  if (longest <= maxEdge) return { width, height }
  const scale = maxEdge / longest
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}
