import { de } from '../../i18n/de'
import { QUICK_LIST_ID, type Watchlist } from './watchlist'

/** What a list is called: the quick list has a fixed name, the others the one they were given. */
export function listName(list: Pick<Watchlist, 'id' | 'name'>): string {
  return list.id === QUICK_LIST_ID ? de.watchlist.quick : list.name
}
