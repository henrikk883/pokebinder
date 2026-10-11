// Records the TCGdex responses the Playwright tests replay.
// Run from the project root: node tests/fixtures/tcgdex/record.mjs
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const API = 'https://api.tcgdex.net/v2'
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
]

async function fetchJson(request) {
  const response = await fetch(`${API}/${request}`)
  if (!response.ok) throw new Error(`${request}: HTTP ${response.status}`)
  return response.json()
}

const series = await fetchJson('de/series')
for (const { id } of series) requests.push(`de/series/${id}`)

const index = {}
await mkdir(outDir, { recursive: true })
for (const [i, request] of requests.entries()) {
  const file = `${String(i + 1).padStart(2, '0')}-${request.replace(/[^a-z0-9.]+/gi, '_').slice(0, 60)}.json`
  await writeFile(`${outDir}${file}`, JSON.stringify(await fetchJson(request)))
  index[request] = file
  console.log(request, '->', file)
}
await writeFile(`${outDir}index.json`, `${JSON.stringify(index, null, 2)}\n`)
