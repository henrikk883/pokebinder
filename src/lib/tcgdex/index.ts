import { db } from '../../db/database'
import { createResponseCache } from './cache'
import { createSdkTransport, createTcgdexClient } from './client'

export { CARDS_PER_PAGE } from './client'
export { compareLocalId, matchesNumber, setIdOfCard, sortByNumber } from './cardIds'
export { cardImageUrl, setLogoUrl } from './images'
export type * from './types'

const DAY_MS = 24 * 60 * 60 * 1000

/** The app's access point to TCGdex. The MVP works with German cards only. */
export const tcgdex = createTcgdexClient({
  lang: 'de',
  transport: createSdkTransport(),
  cache: createResponseCache(db, { maxAgeMs: DAY_MS }),
})
