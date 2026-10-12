import { crc32, deflateSync } from 'node:zlib'

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, checksum])
}

/**
 * A PNG that fades from `left` to `right`, so that different parts of it can be told apart.
 * Colours are [red, green, blue].
 */
export function makePng(
  width: number,
  height: number,
  left: [number, number, number],
  right: [number, number, number] = left,
): Buffer {
  const row = Buffer.alloc(1 + width * 3) // filter byte, then RGB per pixel
  for (let x = 0; x < width; x++) {
    const t = width === 1 ? 0 : x / (width - 1)
    for (let channel = 0; channel < 3; channel++) {
      row[1 + x * 3 + channel] = Math.round((left[channel] ?? 0) * (1 - t) + (right[channel] ?? 0) * t)
    }
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header.set([8, 2, 0, 0, 0], 8) // 8 bit, RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.concat(Array.from({ length: height }, () => row)))),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

export function pngFile(name: string, buffer: Buffer) {
  return { name, mimeType: 'image/png', buffer }
}
