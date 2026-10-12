// @vitest-environment node
import { describe, expect, it } from 'vitest'
import sampleBackup from '../../../tests/fixtures/sample-backup.json?raw'
import { createTestContext } from '../../test/modelContext'
import type { Asset, Binder } from '../../types/binder'
import { addPage, createBinder, setCard } from '../binder/binderModel'
import {
  BackupError,
  backupFileName,
  backupReminder,
  createBackup,
  createFullBackup,
  fullBackupFileName,
  parseAnyBackup,
  parseBackup,
  referencedAssetIds,
  serializeBackup,
  type BackupErrorCode,
} from './backup'

function buildBinder(): Binder {
  const ctx = createTestContext()
  let binder = addPage(createBinder({ name: 'Kanto Collection', layout: '3x3' }, ctx), ctx)
  const [first, second] = binder.pages
  if (!first || !second) throw new Error('Expected two pages')

  binder = setCard(
    binder,
    { pageId: first.id, slotIndex: 0 },
    { cardId: 'sv03.5-025', lang: 'de', variant: 'normal' },
    true,
    ctx,
  )
  binder = setCard(
    binder,
    { pageId: second.id, slotIndex: 8 },
    { cardId: 'sv03.5-025', lang: 'de', variant: 'reverse' },
    false,
    ctx,
  )
  return {
    ...binder,
    cover: { title: 'Kanto', assetId: 'asset-cover' },
    pages: binder.pages.map((page) =>
      page.id === second.id
        ? {
            ...page,
            openingSide: 'left' as const,
            images: [
              {
                id: 'image-1',
                assetId: 'asset-forest',
                fromSlot: 0,
                spanCols: 1,
                spanRows: 3,
                crop: { x: 0.25, y: -0.5, zoom: 1.5 },
              },
            ],
          }
        : page,
    ),
  }
}

function buildAssets(): Asset[] {
  // every byte value, repeated: catches encoding mistakes with binary data
  const forest = Uint8Array.from({ length: 70_000 }, (_, i) => i % 256)
  return [
    {
      id: 'asset-cover',
      blob: new Blob([Uint8Array.of(137, 80, 78, 71)], { type: 'image/png' }),
      mimeType: 'image/png',
      width: 600,
      height: 800,
    },
    {
      id: 'asset-forest',
      blob: new Blob([forest], { type: 'image/jpeg' }),
      mimeType: 'image/jpeg',
      width: 1200,
      height: 1600,
    },
  ]
}

async function bytesOf(asset: Asset | undefined): Promise<number[]> {
  if (!asset) throw new Error('Asset missing')
  return [...new Uint8Array(await asset.blob.arrayBuffer())]
}

function errorCodeOf(run: () => unknown): BackupErrorCode | undefined {
  try {
    run()
  } catch (error) {
    if (error instanceof BackupError) return error.code
    throw error
  }
  return undefined
}

describe('backup round trip', () => {
  it('returns the same binder after export and re-import', async () => {
    const binder = buildBinder()

    const json = serializeBackup(await createBackup(binder, buildAssets()))
    const restored = parseBackup(json)

    expect(restored.binder).toEqual(binder)
  })

  it('returns the same images, byte for byte', async () => {
    const assets = buildAssets()

    const json = serializeBackup(await createBackup(buildBinder(), assets))
    const restored = parseBackup(json)

    expect(restored.assets.map(({ id, mimeType, width, height }) => ({ id, mimeType, width, height }))).toEqual(
      assets.map(({ id, mimeType, width, height }) => ({ id, mimeType, width, height })),
    )
    expect(restored.assets.map((asset) => asset.blob.type)).toEqual(['image/png', 'image/jpeg'])
    expect(await bytesOf(restored.assets[0])).toEqual(await bytesOf(assets[0]))
    expect(await bytesOf(restored.assets[1])).toEqual(await bytesOf(assets[1]))
  })

  it('exports the same JSON again after an import', async () => {
    const first = await createBackup(buildBinder(), buildAssets(), '2026-10-12T10:00:00.000Z')
    const restored = parseBackup(serializeBackup(first))

    const second = await createBackup(restored.binder, restored.assets, '2026-10-12T10:00:00.000Z')

    expect(serializeBackup(second)).toBe(serializeBackup(first))
  })

  it('reads the sample backup file', () => {
    const { binder, assets } = parseBackup(sampleBackup)

    expect(binder.name).toBe('Kanto Collection')
    expect(binder.pages).toHaveLength(2)
    expect(assets.map((asset) => asset.id)).toEqual(referencedAssetIds(binder))
  })
})

describe('referencedAssetIds', () => {
  it('lists cover and placed images once each', () => {
    const binder = buildBinder()
    const [first] = binder.pages
    if (!first) throw new Error('Expected a page')
    const withDuplicate: Binder = {
      ...binder,
      pages: binder.pages.map((page) =>
        page.id === first.id
          ? {
              ...page,
              images: [
                {
                  id: 'image-2',
                  assetId: 'asset-forest',
                  fromSlot: 0,
                  spanCols: 1,
                  spanRows: 1,
                  crop: { x: 0, y: 0, zoom: 1 },
                },
              ],
            }
          : page,
      ),
    }

    expect(referencedAssetIds(withDuplicate)).toEqual(['asset-cover', 'asset-forest'])
    expect(referencedAssetIds({ ...binder, cover: { title: 'Kanto' }, pages: [] })).toEqual([])
  })
})

describe('parseBackup validation', () => {
  async function backupObject(): Promise<Record<string, unknown>> {
    const json = serializeBackup(await createBackup(buildBinder(), buildAssets()))
    return JSON.parse(json) as Record<string, unknown>
  }

  it('rejects text that is not JSON', () => {
    expect(errorCodeOf(() => parseBackup('not json'))).toBe('invalidJson')
  })

  it('rejects JSON that is not a PokéBinder backup', () => {
    expect(errorCodeOf(() => parseBackup('[]'))).toBe('wrongFormat')
    expect(errorCodeOf(() => parseBackup('{"name":"something else"}'))).toBe('wrongFormat')
  })

  it('rejects backups of an unknown version', async () => {
    const backup = { ...(await backupObject()), version: 2 }

    expect(errorCodeOf(() => parseBackup(JSON.stringify(backup)))).toBe('unsupportedVersion')
  })

  it.each([
    ['a missing name', (b: Record<string, unknown>) => delete b.name],
    ['an unknown layout', (b: Record<string, unknown>) => (b.layout = '5x5')],
    ['pages that are not a list', (b: Record<string, unknown>) => (b.pages = {})],
    [
      'a page with too few pockets',
      (b: Record<string, unknown>) => {
        const page = (b.pages as { slots: unknown[] }[])[0]
        page?.slots.pop()
      },
    ],
    [
      'a malformed card variant',
      (b: Record<string, unknown>) => {
        const page = (b.pages as { slots: { cardRef?: { variant: string } }[] }[])[0]
        const cardRef = page?.slots[0]?.cardRef
        if (cardRef) cardRef.variant = 'Not A Variant!'
      },
    ],
    [
      'an image that starts outside the page',
      (b: Record<string, unknown>) => {
        const page = (b.pages as { images: { fromSlot: number }[] }[])[1]
        const image = page?.images[0]
        if (image) image.fromSlot = 9
      },
    ],
  ])('rejects a binder with %s', async (_label, damage) => {
    const backup = await backupObject()
    damage(backup.binder as Record<string, unknown>)

    expect(errorCodeOf(() => parseBackup(JSON.stringify(backup)))).toBe('invalidData')
  })

  it('rejects image data that is not base64', async () => {
    const backup = await backupObject()
    const asset = (backup.assets as { data: string }[])[0]
    if (asset) asset.data = '***'

    expect(errorCodeOf(() => parseBackup(JSON.stringify(backup)))).toBe('invalidData')
  })

  it('reads backups from before binders had a language as German', async () => {
    const backup = await backupObject()
    delete (backup.binder as Record<string, unknown>).lang

    expect(parseBackup(JSON.stringify(backup)).binder.lang).toBe('de')
  })

  it('keeps the language of a binder and rejects one it does not know', async () => {
    const backup = await backupObject()
    ;(backup.binder as Record<string, unknown>).lang = 'ja'
    expect(parseBackup(JSON.stringify(backup)).binder.lang).toBe('ja')

    ;(backup.binder as Record<string, unknown>).lang = 'xx'
    expect(errorCodeOf(() => parseBackup(JSON.stringify(backup)))).toBe('invalidData')
  })

  it('drops fields the app does not know', async () => {
    const backup = await backupObject()
    ;(backup.binder as Record<string, unknown>).cardData = { hp: 60 }

    expect(parseBackup(JSON.stringify(backup)).binder).not.toHaveProperty('cardData')
  })
})

describe('full backup', () => {
  function secondBinder(): Binder {
    return { ...createBinder({ name: 'Johto', layout: '2x2', lang: 'en' }, createTestContext()), id: 'second' }
  }

  it('returns all binders and the whole image library after export and re-import', async () => {
    const binders = [buildBinder(), secondBinder()]
    const assets = buildAssets()

    const json = JSON.stringify(await createFullBackup(binders, assets, '2026-10-12T10:00:00.000Z'))
    const restored = parseAnyBackup(json)

    expect(restored.binders).toEqual(binders)
    expect(restored.assets.map((asset) => asset.id)).toEqual(['asset-cover', 'asset-forest'])
    expect(await bytesOf(restored.assets[1])).toEqual(await bytesOf(assets[1]))
  })

  it('keeps images that no binder uses, unlike the backup of a single binder', async () => {
    const unused: Asset = {
      id: 'unused',
      blob: new Blob([Uint8Array.of(1, 2, 3)], { type: 'image/png' }),
      mimeType: 'image/png',
      width: 1,
      height: 1,
      createdAt: '2026-10-01T00:00:00.000Z',
    }

    const restored = parseAnyBackup(JSON.stringify(await createFullBackup([], [unused])))

    expect(restored.binders).toEqual([])
    expect(restored.assets).toMatchObject([{ id: 'unused', createdAt: '2026-10-01T00:00:00.000Z' }])
  })

  it('reads the backup of a single binder as well', async () => {
    const binder = buildBinder()

    const restored = parseAnyBackup(serializeBackup(await createBackup(binder, buildAssets())))

    expect(restored.binders).toEqual([binder])
    expect(restored.assets).toHaveLength(2)
  })

  it('rejects what is no backup, a newer version, and damaged binders', async () => {
    const full = await createFullBackup([buildBinder()], [])

    expect(errorCodeOf(() => parseAnyBackup('nope'))).toBe('invalidJson')
    expect(errorCodeOf(() => parseAnyBackup('{"format":"something"}'))).toBe('wrongFormat')
    expect(errorCodeOf(() => parseAnyBackup(JSON.stringify({ ...full, version: 2 })))).toBe('unsupportedVersion')
    expect(errorCodeOf(() => parseAnyBackup(JSON.stringify({ ...full, binders: [{ name: 'x' }] })))).toBe(
      'invalidData',
    )
    expect(errorCodeOf(() => parseAnyBackup(JSON.stringify({ ...full, binders: 'all' })))).toBe('invalidData')
    // a full backup is not accepted where exactly one binder is expected
    expect(errorCodeOf(() => parseBackup(JSON.stringify(full)))).toBe('wrongFormat')
  })

  it('is named after the day it was made', () => {
    expect(fullBackupFileName('2026-10-12T10:00:00.000Z')).toBe('pokebinder-gesamtsicherung-2026-10-12.json')
  })
})

describe('backupReminder', () => {
  const now = '2026-10-30T12:00:00.000Z'

  it('has nothing to say without binders', () => {
    expect(backupReminder(null, now, false)).toEqual({ kind: 'none' })
  })

  it('says so when nothing was ever saved', () => {
    expect(backupReminder(null, now, true)).toEqual({ kind: 'never' })
    expect(backupReminder('not a date', now, true)).toEqual({ kind: 'never' })
  })

  it('keeps quiet for two weeks after a backup, then counts the days', () => {
    expect(backupReminder('2026-10-30T08:00:00.000Z', now, true)).toEqual({ kind: 'none' })
    expect(backupReminder('2026-10-17T12:00:00.000Z', now, true)).toEqual({ kind: 'none' })
    expect(backupReminder('2026-10-16T12:00:00.000Z', now, true)).toEqual({ kind: 'old', days: 14 })
    expect(backupReminder('2026-09-01T12:00:00.000Z', now, true)).toEqual({ kind: 'old', days: 59 })
  })
})

describe('backupFileName', () => {
  it('builds a file name from binder name and date', () => {
    expect(backupFileName('Kanto Collection', '2026-10-12T10:00:00.000Z')).toBe(
      'pokebinder-kanto-collection-2026-10-12.json',
    )
    expect(backupFileName('Pokémon: Größe & Stärke!', '2026-01-02T00:00:00.000Z')).toBe(
      'pokebinder-pokemon-grosse-starke-2026-01-02.json',
    )
    expect(backupFileName('  ', '2026-01-02T00:00:00.000Z')).toBe(
      'pokebinder-binder-2026-01-02.json',
    )
  })
})
