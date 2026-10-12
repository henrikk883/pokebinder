import { db } from '../../db/database'
import { createResponseCache } from './cache'
import { createGraphqlTransport, createSdkTransport, createTcgdexClient } from './client'

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
export { cardImageUrl, englishCardImage, setLogoUrl, type CardImageSize } from './images'
export type * from './types'

const DAY_MS = 24 * 60 * 60 * 1000

/** The app's access point to TCGdex. The MVP works with German cards only. */
export const tcgdex = createTcgdexClient({
  lang: 'de',
  transport: createSdkTransport(),
  graphql: createGraphqlTransport(),
  cache: createResponseCache(db, { maxAgeMs: DAY_MS }),
})
