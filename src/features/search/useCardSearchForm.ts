import { useMemo, useState } from 'react'
import { tcgdexFor } from '../../lib/tcgdex'
import type { CardLang } from '../../types/binder'
import { useCardSearch } from './useCardSearch'
import { useCatalog } from './useCatalog'
import { useDebouncedValue } from './useDebouncedValue'
import { useLoaded } from './useLoaded'

/** Results follow the typing after this pause. */
const SEARCH_DELAY_MS = 300

/**
 * What a card search needs, whatever it looks like: the text and the filters with their
 * choices, and the cards found. The narrow search beside the binder and the wide one on
 * the page "Karten" each have their own.
 */
export function useCardSearchForm(lang: CardLang) {
  const [text, setText] = useState('')
  const [setId, setSetId] = useState<string>()
  const [rarity, setRarity] = useState<string>()
  const [type, setType] = useState<string>()

  const catalog = useCatalog(lang)
  const loaders = useMemo(
    () => ({
      rarities: () => tcgdexFor(lang).getRarities(),
      types: () => tcgdexFor(lang).getTypes(),
    }),
    [lang],
  )
  const rarities = useLoaded(loaders.rarities)
  const types = useLoaded(loaders.types)
  const search = useCardSearch(lang, useDebouncedValue(text, SEARCH_DELAY_MS), setId, rarity, type)

  const sets = catalog.status === 'ready' ? catalog.data.setsById : undefined
  return {
    text,
    setText,
    setId,
    setSetId,
    rarity,
    setRarity,
    type,
    setType,
    catalog,
    rarities: rarities.status === 'ready' ? rarities.data : [],
    types: types.status === 'ready' ? types.data : [],
    search,
    sets,
    selectedSet: setId ? sets?.get(setId) : undefined,
  }
}
