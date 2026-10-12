// Lets an image model (CLIP) look at the cards of the high rarities, for "Ähnliche Karten"
// in the card info and the themes of "Karten stöbern". Runs after colours.mjs as part of
//   npm run colours
// and writes public/colours/looks.json and looks.bin: what the model sees in each card, as
// numbers, and the cards that fit each theme best. Only new cards are looked at. The model
// is loaded once (some hundred MB) and runs on this computer; the app gets its results only.
import { readFile, writeFile } from 'node:fs/promises'
import { AutoProcessor, AutoTokenizer, CLIPTextModelWithProjection, CLIPVisionModelWithProjection, RawImage } from '@huggingface/transformers'

const API = 'https://api.tcgdex.net/v2/en'
const OUT = new URL('../../public/colours/', import.meta.url)
const MODEL = 'Xenova/clip-vit-base-patch32'
/** Pictures loaded at a time; TCGdex is a free service. */
const AT_A_TIME = 4
/**
 * The numbers are kept as whole ones from -127 to 127. Nearly all lie far below this
 * limit; the few above it are the same for every picture and tell nothing apart.
 */
const LIMIT = 0.25
/** Cards kept per theme; the app shows fewer. */
const PER_THEME = 144
/**
 * The themes of "Karten stöbern": what the model is asked for. The names shown are in
 * src/i18n/de.ts under `themes.names`; a theme without a name there is not shown.
 * Tried and left out, because the cards found did not fit: sky, cave, thunderstorm, rain,
 * outer space.
 */
const THEMES = {
  autumn: 'a golden autumn scene with orange and red leaves, warm light',
  winter: 'a snowy winter landscape',
  spring: 'a meadow full of colourful flowers in spring',
  beach: 'a sunny beach with blue sea and sand in summer',
  underwater: 'underwater scene in the deep blue sea',
  night: 'a night sky full of stars with the moon',
  sunset: 'a sunset with a pink and orange sky',
  forest: 'a deep green forest with trees',
  mountains: 'a landscape of high mountains and rocky cliffs',
  desert: 'a dry desert with sand and rocks',
  fire: 'fire, flames and the lava of a volcano',
  city: 'a city street with houses and buildings',
  neon: 'a city at night with neon lights',
  home: 'a cozy room inside a house, warm and homely',
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(new URL(file, OUT), 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT' && fallback !== undefined) return fallback
    throw error
  }
}

async function picture(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url)
      if (response.ok) return new Blob([await response.arrayBuffer()])
      if (response.status === 404) return undefined
    } catch {
      // try again
    }
  }
  return undefined
}

/** The model's numbers for one picture or text, made one long and kept as whole numbers. */
function compact(values) {
  const length = Math.hypot(...values)
  return Int8Array.from(values, (value) => Math.round((Math.max(-LIMIT, Math.min(LIMIT, value / length)) / LIMIT) * 127))
}

function likeness(a, b) {
  let dot = 0
  let lengthA = 0
  let lengthB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    lengthA += a[i] * a[i]
    lengthB += b[i] * b[i]
  }
  return dot / Math.sqrt(lengthA * lengthB)
}

const { rare, ids } = await readJson('cards.json')
const offered = ids.slice(0, rare)

// what is known so far
const before = await readJson('looks.json', { model: MODEL, size: 0, ids: [] })
const known = new Map()
if (before.model === MODEL && before.ids.length > 0) {
  const bytes = new Int8Array((await readFile(new URL('looks.bin', OUT))).buffer.slice(0))
  if (bytes.length !== before.ids.length * before.size) throw new Error('public/colours/: looks.json and looks.bin do not belong together')
  before.ids.forEach((id, index) => known.set(id, bytes.subarray(index * before.size, (index + 1) * before.size)))
}
const wanted = offered.filter((id) => !known.has(id))
console.log(`looks: ${offered.length} cards of the high rarities, ${wanted.length} to look at`)

if (wanted.length > 0) {
  const images = new Map()
  for (const setId of new Set(wanted.map((id) => id.slice(0, id.lastIndexOf('-'))))) {
    const response = await fetch(`${API}/sets/${setId}`)
    if (!response.ok) continue
    for (const card of (await response.json()).cards ?? []) if (card.image) images.set(card.id, card.image)
  }
  const processor = await AutoProcessor.from_pretrained(MODEL)
  const vision = await CLIPVisionModelWithProjection.from_pretrained(MODEL)
  let failed = 0
  for (let at = 0; at < wanted.length; at += 16) {
    const batch = wanted.slice(at, at + 16)
    const blobs = []
    for (let from = 0; from < batch.length; from += AT_A_TIME) {
      blobs.push(...(await Promise.all(batch.slice(from, from + AT_A_TIME).map((id) => (images.has(id) ? picture(`${images.get(id)}/low.webp`) : undefined)))))
    }
    const loaded = batch.filter((_, index) => blobs[index])
    failed += batch.length - loaded.length
    if (loaded.length === 0) continue
    const pictures = await Promise.all(blobs.filter(Boolean).map((blob) => RawImage.fromBlob(blob)))
    const { image_embeds } = await vision(await processor(pictures))
    const size = image_embeds.dims[1]
    loaded.forEach((id, row) => known.set(id, compact(image_embeds.data.subarray(row * size, (row + 1) * size))))
    if ((at / 16) % 25 === 24) console.log(`  ${at + batch.length} of ${wanted.length}`)
  }
  console.log(`looked at: ${wanted.length - failed}; not loadable this time: ${failed}`)
}

// in the order of cards.json; cards that have left the high rarities are dropped
const kept = offered.filter((id) => known.has(id))
const size = kept.length > 0 ? known.get(kept[0]).length : 0
const all = new Int8Array(kept.length * size)
kept.forEach((id, index) => all.set(known.get(id), index * size))

// the cards that fit each theme best
const tokenizer = await AutoTokenizer.from_pretrained(MODEL)
const text = await CLIPTextModelWithProjection.from_pretrained(MODEL)
const names = Object.keys(THEMES)
const { text_embeds } = await text(tokenizer(Object.values(THEMES), { padding: true, truncation: true }))
const themes = names.map((id, row) => {
  const asked = compact(text_embeds.data.subarray(row * size, (row + 1) * size))
  const cards = kept
    .map((card) => ({ card, fit: likeness(asked, known.get(card)) }))
    .sort((a, b) => b.fit - a.fit)
    .slice(0, PER_THEME)
    .map((entry) => entry.card)
  return { id, cards }
})

await writeFile(new URL('looks.json', OUT), JSON.stringify({ model: MODEL, size, ids: kept, themes }))
await writeFile(new URL('looks.bin', OUT), all)
console.log(`public/colours/: looks of ${kept.length} cards, ${(all.length / 1024 / 1024).toFixed(2)} MB; ${themes.length} themes`)
