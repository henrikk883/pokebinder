import { db } from '../../db/database'
import type { CardLang } from '../../types/binder'
import { createResponseCache } from './cache'
import { createGraphqlTransport, createSdkTransport, createTcgdexClient } from './client'
import type { TcgdexClient } from './types'

export { CARDS_PER_PAGE } from './client'
export {
  chronologicalSetIds,
  compareLocalId,
  matchesNumber,
  setIdOfCard,
  setIdOfCardId,
  sortByNumber,
} from './cardIds'
export { baseVariant } from './variants'
export { mapWithConcurrency } from './prices'
export {
  cardImageAt,
  cardImageSources,
  cardImageUrl,
  englishCardImage,
  imageExists,
  pokemontcgCardImages,
  pokemontcgSetId,
  readPicture,
  setLogoUrl,
  type CardImageSize,
  type SubstituteImage,
} from './images'
export { scanMemory } from './scanMemory'
export type * from './types'

const DAY_MS = 24 * 60 * 60 * 1000

const transport = createSdkTransport()
const graphql = createGraphqlTransport()
const cache = createResponseCache(db, { maxAgeMs: DAY_MS })
const clients = new Map<CardLang, TcgdexClient>()

/** The app's access point to TCGdex for cards of one language. */
export function tcgdexFor(lang: CardLang): TcgdexClient {
  let client = clients.get(lang)
  if (!client) {
    client = createTcgdexClient({ lang, transport, graphql, cache })
    clients.set(lang, client)
  }
  return client
}
