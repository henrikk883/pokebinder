import { beforeEach, describe, expect, it } from 'vitest'
import { createTestContext } from '../../test/modelContext'
import type { Binder, PlacedImage } from '../../types/binder'
import { addPage, createBinder, removePage, setCard, type ModelContext } from '../binder/binderModel'
import {
  cellsOf,
  changePlacement,
  checkPlacement,
  clampCrop,
  DEFAULT_CROP,
  facingPage,
  fitWithin,
  imageAt,
  imagePieces,
  maxSpan,
  moveImage,
  normalizeImages,
  placeImage,
  removeImage,
  setCover,
  setImageCrop,
  type Placement,
  type PlacementResult,
} from './imageModel'

let ctx: ModelContext
/** 3 × 3 binder with five pages: 1 alone, then the spreads 2–3 and 4–5. */
let binder: Binder

const pageId = (index: number) => binder.pages[index]?.id ?? ''

function expectOk(result: PlacementResult): Binder {
  if (!result.ok) throw new Error(`Placement refused: ${result.error}`)
  return result.binder
}

function place(source: Binder, pageIndex: number, placement: Placement, assetId = 'asset'): Binder {
  return expectOk(placeImage(source, source.pages[pageIndex]?.id ?? '', assetId, placement, ctx))
}

function imagesOn(source: Binder, pageIndex: number): PlacedImage[] {
  return source.pages[pageIndex]?.images ?? []
}

beforeEach(() => {
  ctx = createTestContext()
  binder = createBinder({ name: 'Test' }, ctx)
  for (let i = 0; i < 4; i++) binder = addPage(binder, ctx)
})

describe('facing pages', () => {
  it('only left-hand pages (even page numbers) have a page across the rings', () => {
    expect(facingPage(binder, 0)).toBeUndefined() // page 1 lies next to the cover
    expect(facingPage(binder, 1)).toBe(binder.pages[2]) // page 2 faces page 3
    expect(facingPage(binder, 2)).toBeUndefined()
    expect(facingPage(binder, 3)).toBe(binder.pages[4])
  })

  it('a last page on the left has nothing across from it', () => {
    const four = removePage(binder, pageId(4), ctx)

    expect(facingPage(four, 3)).toBeUndefined()
  })
})

describe('maxSpan', () => {
  it('ends at the page edge on page 1 and on right-hand pages', () => {
    expect(maxSpan(binder, 0, 0)).toEqual({ cols: 3, rows: 3 })
    expect(maxSpan(binder, 0, 4)).toEqual({ cols: 2, rows: 2 })
    expect(maxSpan(binder, 2, 8)).toEqual({ cols: 1, rows: 1 })
  })

  it('reaches across the rings from a left-hand page', () => {
    expect(maxSpan(binder, 1, 0)).toEqual({ cols: 6, rows: 3 })
    expect(maxSpan(binder, 1, 5)).toEqual({ cols: 4, rows: 2 })
  })
})

describe('placeImage', () => {
  it('puts an image behind one pocket, centred and unmagnified', () => {
    const next = place(binder, 0, { fromSlot: 4, spanCols: 1, spanRows: 1 })

    expect(imagesOn(next, 0)).toEqual([
      { id: expect.any(String), assetId: 'asset', fromSlot: 4, spanCols: 1, spanRows: 1, crop: DEFAULT_CROP },
    ])
    expect(next.updatedAt > binder.updatedAt).toBe(true)
    expect(imagesOn(binder, 0)).toEqual([])
  })

  it.each([
    ['2 wide, 1 high', { fromSlot: 0, spanCols: 2, spanRows: 1 }, [0, 1]],
    ['1 wide, 3 high', { fromSlot: 2, spanCols: 1, spanRows: 3 }, [2, 5, 8]],
    ['the whole page', { fromSlot: 0, spanCols: 3, spanRows: 3 }, [0, 1, 2, 3, 4, 5, 6, 7, 8]],
  ])('covers the right pockets for %s', (_label, placement, slots) => {
    expect(cellsOf(binder, 0, placement)).toEqual(slots.map((slotIndex) => ({ pageIndex: 0, slotIndex })))
    expect(checkPlacement(binder, 0, placement)).toBeNull()
  })

  it('refuses an image that does not fit on the page', () => {
    expect(checkPlacement(binder, 0, { fromSlot: 1, spanCols: 3, spanRows: 1 })).toBe('outOfBounds')
    expect(checkPlacement(binder, 0, { fromSlot: 6, spanCols: 1, spanRows: 2 })).toBe('outOfBounds')
    expect(checkPlacement(binder, 0, { fromSlot: 9, spanCols: 1, spanRows: 1 })).toBe('outOfBounds')
    expect(checkPlacement(binder, 0, { fromSlot: 0, spanCols: 0, spanRows: 1 })).toBe('outOfBounds')
    expect(checkPlacement(binder, 0, { fromSlot: 0, spanCols: 1.5, spanRows: 1 })).toBe('outOfBounds')
    expect(placeImage(binder, pageId(0), 'asset', { fromSlot: 1, spanCols: 3, spanRows: 1 }, ctx)).toEqual({
      ok: false,
      error: 'outOfBounds',
    })
  })

  it('refuses an image that would overlap another one', () => {
    const next = place(binder, 0, { fromSlot: 4, spanCols: 2, spanRows: 1 })

    expect(checkPlacement(next, 0, { fromSlot: 5, spanCols: 1, spanRows: 1 })).toBe('overlap')
    expect(checkPlacement(next, 0, { fromSlot: 1, spanCols: 1, spanRows: 2 })).toBe('overlap')
    expect(checkPlacement(next, 0, { fromSlot: 3, spanCols: 1, spanRows: 1 })).toBeNull()
    expect(checkPlacement(next, 0, { fromSlot: 6, spanCols: 3, spanRows: 1 })).toBeNull()
  })

  it('leaves cards alone: images lie behind them', () => {
    const card = { cardId: 'sv03.5-025', lang: 'de', variant: 'normal' } as const
    const withCard = setCard(binder, { pageId: pageId(0), slotIndex: 4 }, card, true, ctx)

    const next = place(withCard, 0, { fromSlot: 3, spanCols: 3, spanRows: 1 })

    expect(next.pages[0]?.slots[4]).toEqual({ index: 4, cardRef: card, owned: true })
  })
})

describe('images across both pages of a spread', () => {
  it('allows 6 wide and 1 high from a left-hand page', () => {
    const next = place(binder, 1, { fromSlot: 3, spanCols: 6, spanRows: 1 })

    expect(cellsOf(next, 1, imagesOn(next, 1)[0] as PlacedImage)).toEqual([
      { pageIndex: 1, slotIndex: 3 },
      { pageIndex: 1, slotIndex: 4 },
      { pageIndex: 1, slotIndex: 5 },
      { pageIndex: 2, slotIndex: 3 },
      { pageIndex: 2, slotIndex: 4 },
      { pageIndex: 2, slotIndex: 5 },
    ])
  })

  it('does not allow it on page 1, which has no page across from it', () => {
    expect(checkPlacement(binder, 0, { fromSlot: 0, spanCols: 6, spanRows: 1 })).toBe('outOfBounds')
    expect(checkPlacement(binder, 0, { fromSlot: 0, spanCols: 4, spanRows: 1 })).toBe('outOfBounds')
  })

  it('does not allow it from a right-hand page or beyond the spread', () => {
    expect(checkPlacement(binder, 2, { fromSlot: 0, spanCols: 4, spanRows: 1 })).toBe('outOfBounds')
    expect(checkPlacement(binder, 1, { fromSlot: 0, spanCols: 7, spanRows: 1 })).toBe('outOfBounds')
    expect(checkPlacement(binder, 1, { fromSlot: 1, spanCols: 6, spanRows: 1 })).toBe('outOfBounds')
  })

  it('counts as overlap on the facing page, in both directions', () => {
    const wide = place(binder, 1, { fromSlot: 0, spanCols: 5, spanRows: 1 })
    expect(checkPlacement(wide, 2, { fromSlot: 1, spanCols: 1, spanRows: 1 })).toBe('overlap')
    expect(checkPlacement(wide, 2, { fromSlot: 2, spanCols: 1, spanRows: 1 })).toBeNull()

    const onRight = place(binder, 2, { fromSlot: 0, spanCols: 1, spanRows: 1 })
    expect(checkPlacement(onRight, 1, { fromSlot: 0, spanCols: 4, spanRows: 1 })).toBe('overlap')
    expect(checkPlacement(onRight, 1, { fromSlot: 3, spanCols: 4, spanRows: 1 })).toBeNull()
  })

  it('is found behind pockets of both pages', () => {
    const next = place(binder, 1, { fromSlot: 3, spanCols: 5, spanRows: 1 })
    const image = imagesOn(next, 1)[0]

    expect(imageAt(next, 1, 4)).toEqual({ page: next.pages[1], image })
    expect(imageAt(next, 2, 4)).toEqual({ page: next.pages[1], image })
    expect(imageAt(next, 2, 5)).toBeUndefined()
    expect(imageAt(next, 1, 0)).toBeUndefined()
  })

  it('is drawn in two parts that continue each other', () => {
    const next = place(binder, 1, { fromSlot: 4, spanCols: 4, spanRows: 2 })
    const image = imagesOn(next, 1)[0]

    expect(imagePieces(next, 1)).toEqual([
      { image, ownerPageId: pageId(1), column: 1, row: 1, cols: 2, rows: 2, offsetCols: 0 },
    ])
    expect(imagePieces(next, 2)).toEqual([
      { image, ownerPageId: pageId(1), column: 0, row: 1, cols: 2, rows: 2, offsetCols: 2 },
    ])
    expect(imagePieces(next, 3)).toEqual([])
  })
})

describe('changing images', () => {
  it('resizes an image, ignoring its own old area when checking for overlap', () => {
    const placed = place(binder, 0, { fromSlot: 0, spanCols: 1, spanRows: 1 })
    const imageId = imagesOn(placed, 0)[0]?.id ?? ''

    const next = expectOk(
      changePlacement(placed, pageId(0), imageId, { fromSlot: 0, spanCols: 3, spanRows: 2 }, ctx),
    )

    expect(imagesOn(next, 0)[0]).toMatchObject({ id: imageId, fromSlot: 0, spanCols: 3, spanRows: 2 })
  })

  it('refuses a resize into another image or off the page', () => {
    let placed = place(binder, 0, { fromSlot: 0, spanCols: 1, spanRows: 1 })
    placed = place(placed, 0, { fromSlot: 2, spanCols: 1, spanRows: 1 }, 'other')
    const imageId = imagesOn(placed, 0)[0]?.id ?? ''

    expect(changePlacement(placed, pageId(0), imageId, { fromSlot: 0, spanCols: 3, spanRows: 1 }, ctx)).toEqual({
      ok: false,
      error: 'overlap',
    })
    expect(changePlacement(placed, pageId(0), imageId, { fromSlot: 0, spanCols: 1, spanRows: 4 }, ctx)).toEqual({
      ok: false,
      error: 'outOfBounds',
    })
    expect(() =>
      changePlacement(placed, pageId(0), 'nope', { fromSlot: 0, spanCols: 1, spanRows: 1 }, ctx),
    ).toThrow(RangeError)
  })

  it('stores the crop within its limits', () => {
    const placed = place(binder, 0, { fromSlot: 0, spanCols: 1, spanRows: 1 })
    const imageId = imagesOn(placed, 0)[0]?.id ?? ''

    const next = setImageCrop(placed, pageId(0), imageId, { x: 0.2, y: 1.4, zoom: 9 }, ctx)

    expect(imagesOn(next, 0)[0]?.crop).toEqual({ x: 0.2, y: 1, zoom: 4 })
    expect(clampCrop({ x: -1, y: 0.5, zoom: 0.2 })).toEqual({ x: 0, y: 0.5, zoom: 1 })
  })

  it('removes an image', () => {
    let placed = place(binder, 0, { fromSlot: 0, spanCols: 1, spanRows: 1 })
    placed = place(placed, 0, { fromSlot: 2, spanCols: 1, spanRows: 1 }, 'other')
    const imageId = imagesOn(placed, 0)[0]?.id ?? ''

    const next = removeImage(placed, pageId(0), imageId, ctx)

    expect(imagesOn(next, 0).map((image) => image.assetId)).toEqual(['other'])
  })
})

describe('moveImage', () => {
  const at = (pageIndex: number, slotIndex: number) => ({ pageId: pageId(pageIndex), slotIndex })

  it('moves an image by the way from the pocket it is grabbed at to the pocket it is dropped on', () => {
    // 2 × 2 in the top left corner of page 1, grabbed at its bottom right pocket
    const placed = place(binder, 0, { fromSlot: 0, spanCols: 2, spanRows: 2 })
    const before = imagesOn(placed, 0)[0]
    const crop = { x: 0.2, y: 0.7, zoom: 2 }
    const cropped = setImageCrop(placed, pageId(0), before?.id ?? '', crop, ctx)

    const next = expectOk(moveImage(cropped, at(0, 4), at(0, 8), ctx))

    // one pocket to the right and one down; size, crop and identity stay
    expect(imagesOn(next, 0)).toEqual([{ ...before, fromSlot: 4, crop }])
  })

  it('leaves the cards in their pockets', () => {
    let placed = place(binder, 0, { fromSlot: 0, spanCols: 1, spanRows: 1 })
    placed = setCard(placed, at(0, 1), { cardId: 'sv03.5-025', lang: 'de', variant: 'normal' }, true, ctx)

    const next = expectOk(moveImage(placed, at(0, 0), at(0, 1), ctx))

    expect(imagesOn(next, 0)[0]?.fromSlot).toBe(1)
    expect(next.pages[0]?.slots[1]?.cardRef?.cardId).toBe('sv03.5-025')
  })

  it('moves an image to the other page of the spread, in both directions', () => {
    const placed = place(binder, 1, { fromSlot: 3, spanCols: 2, spanRows: 1 })
    const imageId = imagesOn(placed, 1)[0]?.id

    const right = expectOk(moveImage(placed, at(1, 3), at(2, 0), ctx))
    expect(imagesOn(right, 1)).toEqual([])
    expect(imagesOn(right, 2)).toMatchObject([{ id: imageId, fromSlot: 0, spanCols: 2, spanRows: 1 }])

    const back = expectOk(moveImage(right, at(2, 1), at(1, 8), ctx))
    expect(imagesOn(back, 2)).toEqual([])
    expect(imagesOn(back, 1)).toMatchObject([{ id: imageId, fromSlot: 7 }])
  })

  it('lets an image reach across the rings, and takes one that does back onto one page', () => {
    const placed = place(binder, 1, { fromSlot: 0, spanCols: 2, spanRows: 1 })

    // its left pocket goes to the last column of the left page: the right one lands on page 3
    const across = expectOk(moveImage(placed, at(1, 0), at(1, 2), ctx))
    expect(imagesOn(across, 1)[0]?.fromSlot).toBe(2)
    expect(imageAt(across, 2, 0)?.image.id).toBe(imagesOn(across, 1)[0]?.id)

    // grabbed at the part on page 3 and pulled one pocket to the right: now all on page 3
    const over = expectOk(moveImage(across, at(2, 0), at(2, 1), ctx))
    expect(imagesOn(over, 1)).toEqual([])
    expect(imagesOn(over, 2)[0]?.fromSlot).toBe(0)
  })

  it('refuses a move over the edge of the page or of the binder', () => {
    const placed = place(binder, 0, { fromSlot: 0, spanCols: 2, spanRows: 2 })

    // page 1 has no page to its left, and nothing to its right
    expect(moveImage(placed, at(0, 1), at(0, 0), ctx)).toEqual({ ok: false, error: 'outOfBounds' })
    expect(moveImage(placed, at(0, 0), at(0, 2), ctx)).toEqual({ ok: false, error: 'outOfBounds' })
    expect(moveImage(placed, at(0, 0), at(0, 6), ctx)).toEqual({ ok: false, error: 'outOfBounds' })
    // a right-hand page ends at the edge of the binder
    const onTheRight = place(binder, 2, { fromSlot: 0, spanCols: 2, spanRows: 1 })
    expect(moveImage(onTheRight, at(2, 0), at(2, 2), ctx)).toEqual({ ok: false, error: 'outOfBounds' })
  })

  it('refuses a move onto another image, but not onto its own old place', () => {
    let placed = place(binder, 0, { fromSlot: 0, spanCols: 2, spanRows: 1 })
    placed = place(placed, 0, { fromSlot: 5, spanCols: 1, spanRows: 1 }, 'other')

    expect(moveImage(placed, at(0, 0), at(0, 4), ctx)).toEqual({ ok: false, error: 'overlap' })
    expect(imagesOn(expectOk(moveImage(placed, at(0, 0), at(0, 1), ctx)), 0)).toHaveLength(2)
  })

  it('changes nothing when dropped where it was grabbed, or when there is no image', () => {
    const placed = place(binder, 0, { fromSlot: 0, spanCols: 2, spanRows: 1 })

    expect(expectOk(moveImage(placed, at(0, 1), at(0, 1), ctx))).toBe(placed)
    expect(expectOk(moveImage(placed, at(0, 8), at(0, 7), ctx))).toBe(placed)
  })
})

describe('normalizeImages', () => {
  it('changes nothing in a binder that is in order', () => {
    const placed = place(binder, 1, { fromSlot: 0, spanCols: 6, spanRows: 1 })

    expect(normalizeImages(placed, ctx)).toBe(placed)
  })

  it('cuts an image back to its page when the page moves to the right-hand side', () => {
    const placed = place(binder, 3, { fromSlot: 0, spanCols: 5, spanRows: 2 })

    // without page 2, the old page 4 becomes page 3 and lies on the right
    const next = normalizeImages(removePage(placed, pageId(1), ctx), ctx)

    expect(imagesOn(next, 2)[0]).toMatchObject({ fromSlot: 0, spanCols: 3, spanRows: 2 })
  })

  it('cuts an image back when its facing page is gone', () => {
    const placed = place(binder, 3, { fromSlot: 4, spanCols: 4, spanRows: 1 })

    const next = normalizeImages(removePage(placed, pageId(4), ctx), ctx)

    expect(imagesOn(next, 3)[0]).toMatchObject({ fromSlot: 4, spanCols: 2 })
  })

  it('cuts an image back when it would now cover an image of the new facing page', () => {
    // pages 2–3 hold a wide image; page 5 holds one of its own in the top row
    let placed = place(binder, 1, { fromSlot: 0, spanCols: 6, spanRows: 1 })
    placed = place(placed, 4, { fromSlot: 1, spanCols: 1, spanRows: 1 }, 'own')

    // without pages 3 and 4, page 5 moves up and faces page 2
    let next = removePage(placed, pageId(2), ctx)
    next = normalizeImages(removePage(next, pageId(3), ctx), ctx)

    expect(next.pages).toHaveLength(3)
    expect(imagesOn(next, 1)[0]).toMatchObject({ spanCols: 3 })
    expect(imagesOn(next, 2)[0]).toMatchObject({ assetId: 'own', fromSlot: 1 })
  })

  it('repairs images from a hand-edited backup', () => {
    const [first, ...rest] = binder.pages
    if (!first) throw new Error('Expected a page')
    const broken: Binder = {
      ...binder,
      pages: [
        {
          ...first,
          images: [
            { id: 'a', assetId: 'x', fromSlot: 4, spanCols: 9, spanRows: 9, crop: DEFAULT_CROP },
            { id: 'b', assetId: 'x', fromSlot: 40, spanCols: 1, spanRows: 1, crop: DEFAULT_CROP },
          ],
        },
        ...rest,
      ],
    }

    const next = normalizeImages(broken, ctx)

    expect(imagesOn(next, 0)).toEqual([
      { id: 'a', assetId: 'x', fromSlot: 4, spanCols: 2, spanRows: 2, crop: DEFAULT_CROP },
    ])
  })
})

describe('setCover', () => {
  it('sets title and image, and removes the image again', () => {
    const withImage = setCover(binder, { title: 'Kanto', assetId: 'cover' }, ctx)
    expect(withImage.cover).toEqual({ title: 'Kanto', assetId: 'cover' })
    expect(withImage.name).toBe('Test')

    const without = setCover(withImage, { title: 'Kanto' }, ctx)
    expect(without.cover).toEqual({ title: 'Kanto' })
    expect(without.updatedAt > withImage.updatedAt).toBe(true)
  })
})

describe('fitWithin', () => {
  it('keeps images that are small enough', () => {
    expect(fitWithin(1200, 1600)).toEqual({ width: 1200, height: 1600 })
    expect(fitWithin(2000, 2000)).toEqual({ width: 2000, height: 2000 })
  })

  it('scales larger images down to 2000 px on the long edge, keeping the shape', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 2000, height: 1500 })
    expect(fitWithin(3000, 6000)).toEqual({ width: 1000, height: 2000 })
    expect(fitWithin(10000, 3)).toEqual({ width: 2000, height: 1 })
  })
})
