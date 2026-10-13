import { useEffect, useMemo, useState } from 'react'
import { filterNameIn, tcgdexFor } from '../../lib/tcgdex'
import type { CardLang } from '../../types/binder'
import { useCardSearch } from './useCardSearch'
import { useCatalog } from './useCatalog'
import { useDebouncedValue } from './useDebouncedValue'
import { useLoaded, type Loaded } from './useLoaded'

/** Results follow the typing after this pause. */
const SEARCH_DELAY_MS = 300

/** What was typed and chosen in a search, and in which language. */
export interface CarriedSearch {
  lang: CardLang
  text: string
  setId: string | undefined
  rarity: string | undefined
  type: string | undefined
  illustrator: string
  category: string | undefined
}

/** Where a search is kept while it is mounted anew: what it held, and how it reports that. */
export interface SearchCarrier {
  before: CarriedSearch | undefined
  keep: (search: CarriedSearch) => void
}

/**
 * Keeps what was typed and chosen in a search across a change of language: the search of a
 * language starts afresh (see `useCardSearchForm`), and takes over from here. Held by
 * whatever shows the search.
 */
export function useCarriedSearch(): SearchCarrier {
  const [before, keep] = useState<CarriedSearch>()
  return { before, keep }
}

/** A chosen name, unless the language turns out not to have it. */
function known(name: string | undefined, names: Loaded<string[]>): string | undefined {
  return name !== undefined && names.status === 'ready' && !names.data.includes(name) ? undefined : name
}

/**
 * What a card search needs, whatever it looks like: the text and the filters with their
 * choices, and the cards found. The narrow search beside the binder and the wide one on
 * the page "Karten" each have their own.
 *
 * Sets, rarities and types are named differently in every language, so a search belongs to
 * one language and is mounted anew for another. With a `carrier`, the new one starts with
 * what the old one held: the text, the set and the artist as they are, type, kind of card
 * and rarity under their names in the new language. What the new language does not have (a
 * set that never came out in it, a rarity it does not know) is dropped.
 */
export function useCardSearchForm(lang: CardLang, carrier?: SearchCarrier) {
  // what the search of the language before held, as it was when this one was mounted
  const [before] = useState(carrier?.before)
  const keep = carrier?.keep
  const inNewLang = (name: string | undefined) =>
    name === undefined || !before ? undefined : filterNameIn(name, before.lang, lang)
  const [text, setText] = useState(before?.text ?? '')
  const [chosenSetId, setSetId] = useState(before?.setId)
  const [chosenRarity, setRarity] = useState(() => inNewLang(before?.rarity))
  const [chosenType, setType] = useState(() => inNewLang(before?.type))
  const [illustrator, setIllustrator] = useState(before?.illustrator ?? '')
  const [chosenCategory, setCategory] = useState(() => inNewLang(before?.category))

  const catalog = useCatalog(lang)
  const loaders = useMemo(
    () => ({
      rarities: () => tcgdexFor(lang).getRarities(),
      types: () => tcgdexFor(lang).getTypes(),
      categories: () => tcgdexFor(lang).getCategories(),
      illustrators: () => tcgdexFor(lang).getIllustrators(),
    }),
    [lang],
  )
  const rarities = useLoaded(loaders.rarities)
  const types = useLoaded(loaders.types)
  const categories = useLoaded(loaders.categories)
  const illustrators = useLoaded(loaders.illustrators)

  const sets = catalog.status === 'ready' ? catalog.data.setsById : undefined
  // taken over from another language, a choice may name something this one does not have
  const setId = chosenSetId !== undefined && sets && !sets.has(chosenSetId) ? undefined : chosenSetId
  const rarity = known(chosenRarity, rarities)
  const type = known(chosenType, types)
  const category = known(chosenCategory, categories)

  useEffect(() => {
    keep?.({ lang, text, setId, rarity, type, illustrator, category })
  }, [keep, lang, text, setId, rarity, type, illustrator, category])

  const search = useCardSearch(
    lang,
    useDebouncedValue(text, SEARCH_DELAY_MS),
    setId,
    rarity,
    type,
    useDebouncedValue(illustrator, SEARCH_DELAY_MS) || undefined,
    category,
  )

  return {
    text,
    setText,
    setId,
    setSetId,
    rarity,
    setRarity,
    type,
    setType,
    illustrator,
    setIllustrator,
    category,
    setCategory,
    catalog,
    rarities: rarities.status === 'ready' ? rarities.data : [],
    types: types.status === 'ready' ? types.data : [],
    categories: categories.status === 'ready' ? categories.data : [],
    illustrators: illustrators.status === 'ready' ? illustrators.data : [],
    search,
    sets,
    selectedSet: setId ? sets?.get(setId) : undefined,
  }
}
