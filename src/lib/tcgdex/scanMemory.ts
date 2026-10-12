/**
 * What the app found out about pictures that are not there, so that it does not ask again
 * every time a card is shown. For many sets TCGdex has no English scan of any card; after
 * a few cards the whole set is known to be like that, also the next time the app is opened.
 */

/** After this many cards of a set without a scan, and none with one, the set counts as having none. */
export const MISSES_FOR_FOLDER = 3
/** A set may get its scans later; after this long it is asked again. */
export const FOLDER_MEMORY_MS = 7 * 24 * 60 * 60 * 1000

const STORAGE_KEY = 'pokebinder:no-scans'

/**
 * The part of a picture's address that names its set, e.g.
 * `https://assets.tcgdex.net/en/swsh/swsh12.5gg` for the card `…/GG01/high.webp`.
 * `undefined` for addresses that are not built like that.
 */
export function scanFolder(url: string): string | undefined {
  const match = /^(https:\/\/assets\.tcgdex\.net\/[^/]+\/[^/]+\/[^/]+)\/[^/]+\/[^/]+$/.exec(url)
  return match?.[1]
}

export interface ScanMemory {
  /** A picture failed to load. */
  noteMissing(url: string): void
  /** A picture loaded: its set does have scans. */
  noteFound(url: string): void
  /** Whether a picture is known not to be there, itself or because its whole set has none. */
  isMissing(url: string): boolean
}

interface Storage {
  read(): string | null
  write(value: string): void
}

export function createScanMemory(storage: Storage, now: () => number = Date.now): ScanMemory {
  const missingUrls = new Set<string>()
  const misses = new Map<string, Set<string>>()
  const foldersWithScans = new Set<string>()
  let emptyFolders: Record<string, number> | undefined

  function folders(): Record<string, number> {
    if (emptyFolders) return emptyFolders
    emptyFolders = {}
    try {
      const raw: unknown = JSON.parse(storage.read() ?? '{}')
      if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
        for (const [folder, since] of Object.entries(raw)) {
          if (typeof since === 'number' && now() - since < FOLDER_MEMORY_MS) emptyFolders[folder] = since
        }
      }
    } catch {
      // nothing remembered
    }
    return emptyFolders
  }

  function store(): void {
    try {
      storage.write(JSON.stringify(folders()))
    } catch {
      // without storage the sets are found out again next time
    }
  }

  return {
    noteMissing(url) {
      missingUrls.add(url)
      const folder = scanFolder(url)
      if (folder === undefined || foldersWithScans.has(folder)) return
      // counted by card: the small and the large picture of one card are one miss
      const card = url.slice(0, url.lastIndexOf('/'))
      const cards = misses.get(folder) ?? new Set<string>()
      cards.add(card)
      misses.set(folder, cards)
      if (cards.size >= MISSES_FOR_FOLDER && folders()[folder] === undefined) {
        folders()[folder] = now()
        store()
      }
    },

    noteFound(url) {
      missingUrls.delete(url)
      const folder = scanFolder(url)
      if (folder === undefined) return
      foldersWithScans.add(folder)
      misses.delete(folder)
      if (folders()[folder] !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- keyed by address
        delete folders()[folder]
        store()
      }
    },

    isMissing(url) {
      if (missingUrls.has(url)) return true
      const folder = scanFolder(url)
      return folder !== undefined && !foldersWithScans.has(folder) && folders()[folder] !== undefined
    },
  }
}

/** The memory of this browser. */
export const scanMemory: ScanMemory = createScanMemory({
  read: () => {
    try {
      return localStorage.getItem(STORAGE_KEY)
    } catch {
      return null
    }
  },
  write: (value) => {
    try {
      localStorage.setItem(STORAGE_KEY, value)
    } catch {
      // see above
    }
  },
})
