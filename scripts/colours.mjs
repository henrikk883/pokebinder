// Works out the colours of every card picture, for "Ähnliche Farben" in the card info:
//   npm run colours
// Asks TCGdex for all English cards, loads the small picture of every card that has no
// colour signature yet and writes public/colours/. The first run loads every picture there
// is (some twenty thousand); later runs only those of new cards. The cards of the high
// rarities (`RARE`) are the ones similar cards are looked for among; they come first in
// the files. The pictures are read by
// the browser Playwright brings along, so nothing else is needed.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const API = 'https://api.tcgdex.net/v2/en'
const OUT = new URL('../public/colours/', import.meta.url)
/** Series that only exist in the mobile game; the app leaves them out as well. */
const DIGITAL_ONLY_SERIES = new Set(['tcgp'])
/** Pictures loaded at a time; TCGdex is a free service. */
const AT_A_TIME = 4
/**
 * The rarities whose cards are offered as similar ones, as TCGdex names them in English:
 * illustration rares and above. Their pictures cover the card, so the whole card counts.
 */
const RARE = [
  'Illustration rare',
  'Special illustration rare',
  'Ultra Rare',
  'Hyper rare',
  'Mega Hyper Rare',
  'Mega Attack Rare',
  'Secret Rare',
  'Shiny Ultra Rare',
  'Black White Rare',
  'Amazing Rare',
]
/** Numbers per card; `SIGNATURE_LENGTH` in src/features/similar/similarColours.ts. */
const SIGNATURE_LENGTH = 52

async function json(path) {
  const response = await fetch(`${API}/${path}`)
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`)
  return response.json()
}

async function picture(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url)
      if (response.ok) return Buffer.from(await response.arrayBuffer())
      if (response.status === 404) return undefined
    } catch {
      // try again
    }
  }
  return undefined
}

/**
 * Runs in the page. The signature says how much of a card's picture is of which colour:
 * twelve hues, each pale or strong and dark or light, and four greys from black to white.
 * Changing it means working out every card again (delete public/colours/ first).
 */
function installSignature() {
  window.signature = async (dataUrl, wholeCard) => {
    const bitmap = await createImageBitmap(await (await fetch(dataUrl)).blob())
    const size = 32
    const canvas = new OffscreenCanvas(size, size)
    const context = canvas.getContext('2d')
    // the picture window of a card, not its frame; where the picture covers the card, all
    // of it but the border
    const [x, y, width, height] = wholeCard ? [0.07, 0.06, 0.86, 0.88] : [0.09, 0.12, 0.82, 0.38]
    context.drawImage(bitmap, bitmap.width * x, bitmap.height * y, bitmap.width * width, bitmap.height * height, 0, 0, size, size)
    const { data } = context.getImageData(0, 0, size, size)
    const HUES = 12
    const bins = new Float32Array(HUES * 4 + 4)
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] / 255
      const g = data[i + 1] / 255
      const b = data[i + 2] / 255
      const max = Math.max(r, g, b)
      const delta = max - Math.min(r, g, b)
      const saturation = max === 0 ? 0 : delta / max
      if (saturation < 0.18 || max < 0.15) {
        bins[HUES * 4 + Math.min(3, Math.floor(max * 4))] += 1
        continue
      }
      let hue = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4
      hue = ((hue * 60 + 360) % 360) / (360 / HUES)
      const low = Math.floor(hue) % HUES
      const share = hue - Math.floor(hue)
      const level = (saturation >= 0.5 ? 2 : 0) + (max >= 0.6 ? 1 : 0)
      // a hue between two bins counts for both, so that the edge of a bin splits nothing
      bins[low * 4 + level] += 1 - share
      bins[((low + 1) % HUES) * 4 + level] += share
    }
    return Array.from(bins, (value) => Math.round((value / (size * size)) * 255))
  }
}

/** What is known so far: per card its signature and whether it is one of the whole card. */
async function readExisting() {
  try {
    const { rare, ids } = JSON.parse(await readFile(new URL('cards.json', OUT), 'utf8'))
    const signatures = await readFile(new URL('signatures.bin', OUT))
    if (signatures.length !== ids.length * SIGNATURE_LENGTH) throw new Error('public/colours/: the two files do not belong together')
    return new Map(
      ids.map((id, index) => [
        id,
        { wholeCard: index < rare, signature: signatures.subarray(index * SIGNATURE_LENGTH, (index + 1) * SIGNATURE_LENGTH) },
      ]),
    )
  } catch (error) {
    if (error.code === 'ENOENT') return new Map()
    throw error
  }
}

async function save(known) {
  // the cards similar ones are looked for among come first
  const rare = [...known.keys()].filter((id) => known.get(id).wholeCard)
  const ids = [...rare, ...[...known.keys()].filter((id) => !known.get(id).wholeCard)]
  const signatures = new Uint8Array(ids.length * SIGNATURE_LENGTH)
  ids.forEach((id, index) => signatures.set(known.get(id).signature, index * SIGNATURE_LENGTH))
  await mkdir(OUT, { recursive: true })
  await writeFile(new URL('cards.json', OUT), JSON.stringify({ rare: rare.length, ids }))
  await writeFile(new URL('signatures.bin', OUT), signatures)
  return { cards: ids.length, rare: rare.length, bytes: signatures.length }
}

async function main() {
  const known = await readExisting()
  console.log(`known so far: ${known.size} cards`)

  const series = (await json('series')).filter((entry) => !DIGITAL_ONLY_SERIES.has(entry.id))
  const setIds = []
  for (const entry of series) setIds.push(...(await json(`series/${entry.id}`)).sets.map((set) => set.id))
  const rare = new Set()
  for (const rarity of RARE) {
    for (const card of await json(`cards?rarity=eq:${encodeURIComponent(rarity)}`)) rare.add(card.id)
  }
  const wanted = []
  let withoutPicture = 0
  for (const setId of setIds) {
    for (const card of (await json(`sets/${setId}`)).cards) {
      const wholeCard = rare.has(card.id)
      // worked out again where a card has moved into or out of the high rarities
      if (known.get(card.id)?.wholeCard === wholeCard) continue
      if (card.image) wanted.push({ ...card, wholeCard })
      else withoutPicture++
    }
  }
  console.log(`${setIds.length} sets; ${wanted.length} cards to work out, ${withoutPicture} without a picture`)

  if (wanted.length > 0) {
    const browser = await chromium.launch()
    const page = await browser.newPage()
    await page.goto('about:blank')
    await page.evaluate(installSignature)
    let done = 0
    let failed = 0
    const queue = [...wanted]
    await Promise.all(
      Array.from({ length: AT_A_TIME }, async () => {
        for (let card = queue.shift(); card; card = queue.shift()) {
          const buffer = await picture(`${card.image}/low.webp`)
          const signature =
            buffer &&
            (await page
              .evaluate(([url, wholeCard]) => window.signature(url, wholeCard), [
                `data:image/webp;base64,${buffer.toString('base64')}`,
                card.wholeCard,
              ])
              .catch(() => undefined))
          if (signature) known.set(card.id, { wholeCard: card.wholeCard, signature: Uint8Array.from(signature) })
          else failed++
          if (++done % 1000 === 0) {
            // kept as it goes, so that a run that is cut off has not been for nothing
            await save(known)
            console.log(`  ${done} of ${wanted.length}`)
          }
        }
      }),
    )
    await browser.close()
    console.log(`worked out: ${wanted.length - failed}; not loadable this time: ${failed}`)
  }

  const { cards, rare: offered, bytes } = await save(known)
  console.log(`public/colours/: ${cards} cards, ${offered} of them of the high rarities, ${(bytes / 1024 / 1024).toFixed(2)} MB`)
}

await main()
