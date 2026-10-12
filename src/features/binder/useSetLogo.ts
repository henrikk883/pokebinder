import { setLogoUrl } from '../../lib/tcgdex'
import type { Binder } from '../../types/binder'
import { useReadyCatalog } from '../search/useCatalog'

/** Whether the cover of a binder shows the logo of its set: a master set without a picture of its own. */
export function wantsSetLogo(binder: Pick<Binder, 'mode' | 'setId' | 'cover'>): boolean {
  return binder.mode === 'masterSet' && binder.setId !== undefined && binder.cover.assetId === undefined
}

/**
 * Address of the logo of the set a master set binder is of, to stand on its cover as long
 * as the collector has not chosen a picture. Nothing is stored for it: the binder knows its
 * set, and the logo comes from TCGdex like the card pictures (the English one where there
 * is none in the binder's language). `undefined` for every other binder, and until the
 * sets are known.
 */
export function useSetLogo(binder: Binder): string | undefined {
  const wanted = wantsSetLogo(binder)
  const catalog = useReadyCatalog(binder.lang)
  const logo = wanted && binder.setId !== undefined ? catalog?.setsById.get(binder.setId)?.logo : undefined
  return logo === undefined ? undefined : setLogoUrl(logo)
}
