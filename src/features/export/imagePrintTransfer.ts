import { de } from '../../i18n/de'
import { assetStore } from '../../store/assetStore'
import type { Binder } from '../../types/binder'
import { layOutSheets, pieceSource, printPieces, type PlacedPiece } from './imagePrint'
import { createImagePrintPdf, type PrintedPiece } from './imagePrintPdf'
import { download, slugOf, type Progress } from './missingListTransfer'

/** One pocket (63 × 88 mm) at 300 dots per inch. */
const POCKET_PX = { width: 744, height: 1039 }
const JPEG_QUALITY = 0.92

export function imagePrintFileName(binderName: string, isoDate: string): string {
  return `bilder-${slugOf(binderName)}-${isoDate.slice(0, 10)}.pdf`
}

/** The section of the picture a piece shows, as a JPEG; `undefined` if it cannot be drawn. */
async function pieceJpeg(piece: PlacedPiece, picture: ImageBitmap): Promise<Uint8Array | undefined> {
  const source = pieceSource(picture, piece)
  // 300 dpi at most; a picture with fewer pixels is not blown up, the printer does that
  const wanted = piece.part.cols * POCKET_PX.width
  const scale = Math.min(1, source.width / wanted)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(wanted * scale))
  canvas.height = Math.max(1, Math.round(piece.part.rows * POCKET_PX.height * scale))
  const context = canvas.getContext('2d')
  if (!context) return undefined
  // transparent parts of a PNG would come out black in a JPEG
  context.fillStyle = '#fff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(picture, source.x, source.y, source.width, source.height, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
  return blob ? new Uint8Array(await blob.arrayBuffer()) : undefined
}

/**
 * Offers the binder's own images as a PDF to print in true size: every pocket an image
 * lies behind is 63 × 88 mm on paper, in binder order, with cut marks.
 */
export async function downloadImagePrint(binder: Binder, onProgress?: Progress): Promise<void> {
  const sheets = layOutSheets(printPieces(binder))
  const total = sheets.reduce((sum, sheet) => sum + sheet.length, 0)
  const pictures = new Map<string, ImageBitmap | undefined>()
  let done = 0
  onProgress?.(done, total)

  try {
    const printed: PrintedPiece[][] = []
    for (const sheet of sheets) {
      const pieces: PrintedPiece[] = []
      for (const piece of sheet) {
        if (!pictures.has(piece.assetId)) {
          const asset = assetStore.getState().assets.find((entry) => entry.id === piece.assetId)
          pictures.set(piece.assetId, asset ? await createImageBitmap(asset.blob).catch(() => undefined) : undefined)
        }
        const picture = pictures.get(piece.assetId)
        // an image whose file is gone leaves its place on the sheet empty
        const jpeg = picture ? await pieceJpeg(piece, picture) : undefined
        if (jpeg) pieces.push({ jpeg, at: piece.at, cols: piece.part.cols, rows: piece.part.rows })
        onProgress?.(++done, total)
      }
      printed.push(pieces)
    }

    const now = new Date()
    const bytes = await createImagePrintPdf({
      title: de.imagePrint.title(binder.name),
      footer: de.imagePrint.footer,
      sheets: printed,
    })
    download(bytes as Uint8Array<ArrayBuffer>, 'application/pdf', imagePrintFileName(binder.name, now.toISOString()))
  } finally {
    for (const picture of pictures.values()) picture?.close()
  }
}
