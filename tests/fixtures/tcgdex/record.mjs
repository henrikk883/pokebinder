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
  'de/sets/sv08.5',
  'de/sets/svp',
  // a set with many cards that have no German scan, some of them no English one either
  'de/sets/smp',
  'de/cards?name=Glurak&pagination:page=1&pagination:itemsPerPage=60',
  'de/cards?name=Glurak&pagination:page=2&pagination:itemsPerPage=60',
  'de/cards?name=Glurak&set.id=eq:sv03.5&pagination:page=1&pagination:itemsPerPage=1000',
  // "006/165": both sets with 165 official cards
  'de/cards?localId=6&set.id=eq:sv03.5&pagination:page=1&pagination:itemsPerPage=1000',
  'de/cards?localId=6&set.id=eq:ecard1&pagination:page=1&pagination:itemsPerPage=1000',
  // Cardmarket prices come with the single card, read from the English data
  'en/cards/sv03.5-001',
  'en/cards/sv03.5-002',
  'en/cards/sv03.5-003',
  // a name typed in English while German cards are shown: nothing under the name, but the
  // cards of the Pokémon it stands for (see the query for its Pokédex number below)
  'de/cards?name=psyduck&pagination:page=1&pagination:itemsPerPage=60',
  'de/cards?dexId=eq:54&pagination:page=1&pagination:itemsPerPage=60',
  // the kinds of cards, the artists, and cards found by them
  'de/categories',
  'de/illustrators',
  'de/cards?illustrator=Mitsuhiro Arita&pagination:page=1&pagination:itemsPerPage=60',
  'de/cards?name=Glurak&illustrator=Mitsuhiro Arita&pagination:page=1&pagination:itemsPerPage=60',
  'de/cards?name=Glurak&illustrator=Mitsuhiro Arita&category=eq:Pokémon&pagination:page=1&pagination:itemsPerPage=60',
  'de/cards?name=Glurak&illustrator=Mitsuhiro Arita&category=eq:Trainer&pagination:page=1&pagination:itemsPerPage=60',
  // English and Japanese cards
  'en/series',
  'en/rarities',
  'en/types',
  'en/sets/sv03.5',
  'en/cards?name=Charizard&pagination:page=1&pagination:itemsPerPage=60',
  'ja/series',
  'ja/rarities',
  'ja/types',
  'ja/sets/SV2a',
  'ja/cards?name=リザードン&pagination:page=1&pagination:itemsPerPage=60',
]

async function fetchJson(request) {
  const response = await fetch(`${API}/${encodeURI(request)}`)
  if (!response.ok) throw new Error(`${request}: HTTP ${response.status}`)
  return response.json()
}

for (const lang of ['de', 'en', 'ja']) {
  for (const { id } of await fetchJson(`${lang}/series`)) requests.push(`${lang}/series/${id}`)
}

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
// Set details (rarity and finishes of every card) come from the GraphQL endpoint.
// The query must ask for the same fields as `setDetailsQuery` in src/lib/tcgdex/client.ts.
for (const [setId, lang] of [
  ['sv03.5', 'de'],
  ['sv08.5', 'de'],
  ['svp', 'de'],
  ['sv03.5', 'en'],
  ['SV2a', 'ja'],
]) {
  const cards = `cards(filters: { id: "${setId}-" }, pagination: { page: 1, itemsPerPage: 1000 })`
  const printsLang = lang === 'ja' ? 'ja' : 'en'
  const query = `{
  cards: ${cards} @locale(lang: "${lang}") { id localId name image rarity dexId illustrator }
  prints: ${cards} @locale(lang: "${printsLang}") { id variants_detailed { type foil stamp size } }
}`
  const response = await fetch(`${API}/graphql`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const body = await response.json()
  if (!response.ok || body.errors) throw new Error(`graphql ${setId}: ${JSON.stringify(body.errors)}`)
  const file = `graphql-set-details-${lang}-${setId}.json`
  await writeFile(`${outDir}${file}`, JSON.stringify(body))
  index[`graphql:${lang}:${setId}`] = file
  console.log(`graphql:${lang}:${setId}`, '->', file)
}

// Which Pokémon a name stands for, asked in the language the name is in.
// The query must be the same as `dexIdsQuery` in src/lib/tcgdex/client.ts.
for (const [lang, name] of [['en', 'psyduck']]) {
  const query = `{
  cards(filters: { name: ${JSON.stringify(name)} }, pagination: { page: 1, itemsPerPage: 100 }) @locale(lang: "${lang}") { dexId }
}`
  const response = await fetch(`${API}/graphql`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const body = await response.json()
  if (!response.ok || body.errors) throw new Error(`graphql ${name}: ${JSON.stringify(body.errors)}`)
  const file = `graphql-names-${lang}-${name}.json`
  await writeFile(`${outDir}${file}`, JSON.stringify(body))
  index[`graphql:names:${lang}:${name}`] = file
  console.log(`graphql:names:${lang}:${name}`, '->', file)
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
