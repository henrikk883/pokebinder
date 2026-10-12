// Draws the PokeBinder logo as a Windows icon for the desktop shortcut.
// Run from the project root: node scripts/make-icon.mjs
import { writeFile } from 'node:fs/promises'
import { crc32, deflateSync } from 'node:zlib'

const SIZE = 256
const pixels = Buffer.alloc(SIZE * SIZE * 4) // RGBA, transparent

/** Whether a point lies in a rectangle with rounded corners. */
function inRoundedRect(x, y, left, top, width, height, radius) {
  if (x < left || x >= left + width || y < top || y >= top + height) return false
  const cx = Math.min(Math.max(x, left + radius), left + width - radius)
  const cy = Math.min(Math.max(y, top + radius), top + height - radius)
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2
}

function colourAt(x, y) {
  // the logo of the app header, scaled from its 24 px grid
  const u = SIZE / 24
  if ((x - 14.5 * u) ** 2 + (y - 12 * u) ** 2 <= (2.5 * u) ** 2) return [10, 13, 22]
  if (inRoundedRect(x, y, 8 * u, 2 * u, 13 * u, 20 * u, 2.5 * u)) return [124, 77, 255]
  if (inRoundedRect(x, y, 3 * u, 2 * u, 4 * u, 20 * u, 1.5 * u)) return [143, 102, 255]
  return undefined
}

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const colour = colourAt(x + 0.5, y + 0.5)
    if (colour) pixels.set([...colour, 255], (y * SIZE + x) * 4)
  }
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, checksum])
}

const header = Buffer.alloc(13)
header.writeUInt32BE(SIZE, 0)
header.writeUInt32BE(SIZE, 4)
header.set([8, 6, 0, 0, 0], 8) // 8 bit, RGBA
const rows = Buffer.alloc(SIZE * (SIZE * 4 + 1))
for (let y = 0; y < SIZE; y++) pixels.copy(rows, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4)
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', header),
  chunk('IDAT', deflateSync(rows)),
  chunk('IEND', Buffer.alloc(0)),
])

// an .ico file may simply wrap a PNG: 6 bytes header, one 16 byte entry, then the image
const ico = Buffer.alloc(22)
ico.writeUInt16LE(1, 2) // type: icon
ico.writeUInt16LE(1, 4) // one image
ico.writeUInt16LE(1, 10) // colour planes
ico.writeUInt16LE(32, 12) // bits per pixel
ico.writeUInt32LE(png.length, 14)
ico.writeUInt32LE(22, 18) // where the image starts; width and height 0 mean 256

await writeFile(new URL('../public/pokebinder.ico', import.meta.url), Buffer.concat([ico, png]))
console.log('public/pokebinder.ico written')
