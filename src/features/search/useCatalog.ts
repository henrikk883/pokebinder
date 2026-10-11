import { tcgdex, type Catalog } from '../../lib/tcgdex'
import { useLoaded, type Loaded } from './useLoaded'

const loadCatalog = () => tcgdex.getCatalog()

/** Series and sets; loaded once and shared by everything that needs set names. */
export function useCatalog(): Loaded<Catalog> {
  return useLoaded(loadCatalog)
}
