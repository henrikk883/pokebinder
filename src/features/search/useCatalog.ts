import { useEffect, useState } from 'react'
import { tcgdexFor, type Catalog } from '../../lib/tcgdex'
import type { CardLang } from '../../types/binder'
import type { Loaded } from './useLoaded'

// Catalogs seen once render immediately afterwards; every pocket asks for the one of its card.
const resolved = new Map<CardLang, Catalog>()

/** Series and sets of one language; loaded once and shared by everything that needs set names. */
export function useCatalog(lang: CardLang): Loaded<Catalog> {
  const [state, setState] = useState<{ lang: CardLang; loaded: Loaded<Catalog> }>()

  useEffect(() => {
    if (resolved.has(lang)) return
    let cancelled = false
    tcgdexFor(lang)
      .getCatalog()
      .then(
        (data) => {
          resolved.set(lang, data)
          if (!cancelled) setState({ lang, loaded: { status: 'ready', data } })
        },
        () => {
          if (!cancelled) setState({ lang, loaded: { status: 'error' } })
        },
      )
    return () => {
      cancelled = true
    }
  }, [lang])

  const known = resolved.get(lang)
  if (known) return { status: 'ready', data: known }
  return state && state.lang === lang ? state.loaded : { status: 'loading' }
}

/** The catalog once it is there, for places that simply show less without it. */
export function useReadyCatalog(lang: CardLang): Catalog | undefined {
  const catalog = useCatalog(lang)
  return catalog.status === 'ready' ? catalog.data : undefined
}
