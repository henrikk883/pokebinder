// Records the TCGdex responses the Playwright tests replay.
// Run from the project root: node tests/fixtures/tcgdex/record.mjs
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const API = 'https://api.tcgdex.net/v2'
const ASSETS = 'https://assets.tcgdex.net'
const outDir = fileURLToPath(new URL('./responses/', import.meta.url))

/** Path and query exactly as the app requests them. */
const requests = [
  'de/series',
  'en/sets',
  'de/rarities',
  'de/types',
  'de/sets/sv03.5',
  'de/cards?name=Glurak&pagination:page=1&pagination:itemsPerPage=60',
  'de/cards?name=Glurak&pagination:page=2&pagination:itemsPerPage=60',
  'de/cards?name=Glurak&set.id=eq:sv03.5&pagination:page=1&pagination:itemsPerPage=1000',
  // "006/165": both sets with 165 official cards
  'de/cards?localId=6&set.id=eq:sv03.5&pagination:page=1&pagination:itemsPerPage=1000',
  'de/cards?localId=6&set.id=eq:ecard1&pagination:page=1&pagination:itemsPerPage=1000',
]

async function fetchJson(request) {
  const response = await fetch(`${API}/${request}`)
  if (!response.ok) throw new Error(`${request}: HTTP ${response.status}`)
  return response.json()
}

const series = await fetchJson('de/series')
for (const { id } of series) requests.push(`de/series/${id}`)

const index = {}
const seriesOfSet = new Map()
const cardsWithoutImage = []
await rm(outDir, { recursive: true, force: true })
await mkdir(outDir, { recursive: true })
for (const [i, request] of requests.entries()) {
  const file = `${String(i + 1).padStart(2, '0')}-${request.replace(/[^a-z0-9.]+/gi, '_').slice(0, 60)}.json`
  const data = await fetchJson(request)
  await writeFile(`${outDir}${file}`, JSON.stringify(data))
  index[request] = file
  console.log(request, '->', file)

  if (request.startsWith('de/series/')) for (const set of data.sets) seriesOfSet.set(set.id, data.id)
  if (request.startsWith('de/cards?')) cardsWithoutImage.push(...data.filter((card) => !card.image))
}
await writeFile(`${outDir}index.json`, `${JSON.stringify(index, null, 2)}\n`)

// Which of the cards without a German scan have an English one? The tests answer image
// requests accordingly, so both the substitute and the placeholder appear as in reality.
const englishImages = []
for (const card of cardsWithoutImage) {
  const setId = card.id.slice(0, -(card.localId.length + 1))
  const seriesId = seriesOfSet.get(setId)
  if (!seriesId) continue
  const image = `${ASSETS}/en/${seriesId}/${setId}/${card.localId}`
  const response = await fetch(`${image}/low.webp`, { method: 'HEAD' })
  if (response.ok) englishImages.push(image)
}
await writeFile(`${outDir}english-images.json`, `${JSON.stringify([...new Set(englishImages)].sort(), null, 2)}\n`)
console.log(`${englishImages.length} of ${cardsWithoutImage.length} cards without German scan have an English one`)
