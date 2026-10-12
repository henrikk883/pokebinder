import type { CSSProperties } from 'react'
import { useAssetUrl } from '../../store/assetStore'
import type { Binder } from '../../types/binder'
import { layoutDimensions } from '../binder/binderModel'
import { imagePieces, type ImagePiece } from './imageModel'
import { cropStyle, POCKET_GAP_UNITS } from './imageStyle'

function Piece({ piece }: { piece: ImagePiece }) {
  const url = useAssetUrl(piece.image.assetId)
  const { image, cols, offsetCols } = piece
  const gap = POCKET_GAP_UNITS

  // The image is laid out across its whole span; this part shows the section on this page.
  // One pocket is (100% - gaps) / cols wide, measured against this part.
  const pocket = `(100% - ${(cols - 1) * gap} * var(--u)) / ${cols}`
  const frame: CSSProperties = {
    width: `calc(${pocket} * ${image.spanCols} + ${(image.spanCols - 1) * gap} * var(--u))`,
    left: `calc((${pocket} * ${offsetCols} + ${offsetCols * gap} * var(--u)) * -1)`,
  }

  return (
    <div
      data-testid="placed-image"
      data-image-id={image.id}
      className="relative overflow-hidden rounded-pocket bg-raised"
      style={{
        gridColumn: `${piece.column + 1} / span ${cols}`,
        gridRow: `${piece.row + 1} / span ${piece.rows}`,
      }}
    >
      <div className="absolute inset-y-0 overflow-hidden" style={frame}>
        {url && (
          <img
            src={url}
            alt=""
            draggable={false}
            className="size-full"
            style={cropStyle(image.crop)}
          />
        )}
      </div>
    </div>
  )
}

/** Uploaded images of a page, drawn behind its pockets on the same grid. */
export function PlacedImageLayer({ binder, pageIndex }: { binder: Binder; pageIndex: number }) {
  const { rows, cols } = layoutDimensions(binder.layout)
  const pieces = imagePieces(binder, pageIndex)
  if (pieces.length === 0) return null

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 grid gap-[calc(var(--u)*8)]"
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
      }}
    >
      {pieces.map((piece) => (
        <Piece key={`${piece.ownerPageId}:${piece.image.id}`} piece={piece} />
      ))}
    </div>
  )
}
