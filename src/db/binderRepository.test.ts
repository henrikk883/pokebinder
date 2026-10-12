// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { addPage, createBinder, setCard } from '../features/binder/binderModel'
import { createTestContext } from '../test/modelContext'
import type { Asset, Binder } from '../types/binder'
import { createBinderRepository, type BinderRepository } from './binderRepository'
import { PokeBinderDatabase } from './database'

let databaseName: string
let database: PokeBinderDatabase
let repository: BinderRepository
let counter = 0

function sampleBinder(name = 'Kanto Collection'): Binder {
  const ctx = createTestContext()
  const binder = addPage(createBinder({ name }, ctx), ctx)
  const pageId = binder.pages[0]?.id ?? ''
  return {
    ...setCard(
      binder,
      { pageId, slotIndex: 3 },
      { cardId: 'sv03.5-025', lang: 'de', variant: 'normal' },
      true,
      ctx,
    ),
    id: `binder-${name}`,
  }
}

function sampleAsset(id: string): Asset {
  return {
    id,
    blob: new Blob([Uint8Array.of(1, 2, 3, 250)], { type: 'image/png' }),
    mimeType: 'image/png',
    width: 10,
    height: 20,
  }
}

/** Closes the connection and opens a new one, like reloading the page. */
function reopen(): void {
  database.close()
  database = new PokeBinderDatabase(databaseName)
  repository = createBinderRepository(database)
}

beforeEach(() => {
  databaseName = `pokebinder-test-${++counter}`
  database = new PokeBinderDatabase(databaseName)
  repository = createBinderRepository(database)
})

afterEach(async () => {
  await database.delete()
})

describe('binderRepository', () => {
  it('returns a saved binder unchanged after reopening the database', async () => {
    const binder = sampleBinder()

    await repository.saveBinder(binder)
    reopen()

    expect(await repository.loadBinder(binder.id)).toEqual(binder)
  })

  it('overwrites a binder with the same id', async () => {
    const binder = sampleBinder()
    await repository.saveBinder(binder)

    await repository.saveBinder({ ...binder, name: 'Renamed' })

    expect((await repository.listBinders()).map((b) => b.name)).toEqual(['Renamed'])
  })

  it('lists binders with the most recently changed first', async () => {
    await repository.saveBinder({ ...sampleBinder('Old'), updatedAt: '2026-01-01T00:00:00.000Z' })
    await repository.saveBinder({ ...sampleBinder('New'), updatedAt: '2026-06-01T00:00:00.000Z' })
    await repository.saveBinder({ ...sampleBinder('Mid'), updatedAt: '2026-03-01T00:00:00.000Z' })

    expect((await repository.listBinders()).map((b) => b.name)).toEqual(['New', 'Mid', 'Old'])
  })

  it('reads binders stored before languages existed as German', async () => {
    const stored: Partial<Binder> = { ...sampleBinder() }
    delete stored.lang
    await database.binders.put(stored as Binder)

    expect((await repository.loadBinder(stored.id ?? ''))?.lang).toBe('de')
    expect((await repository.listBinders()).map((binder) => binder.lang)).toEqual(['de'])
  })

  it('deletes a binder', async () => {
    const binder = sampleBinder()
    await repository.saveBinder(binder)

    await repository.deleteBinder(binder.id)

    expect(await repository.loadBinder(binder.id)).toBeUndefined()
  })

  it('stores image files and skips unknown ids when loading', async () => {
    await repository.saveAssets([sampleAsset('a'), sampleAsset('b')])
    reopen()

    const assets = await repository.loadAssets(['b', 'missing', 'a'])

    expect(assets.map((asset) => asset.id)).toEqual(['b', 'a'])
    expect(assets[0]).toMatchObject({ mimeType: 'image/png', width: 10, height: 20 })
    const bytes = new Uint8Array((await assets[0]?.blob.arrayBuffer()) ?? new ArrayBuffer(0))
    expect([...bytes]).toEqual([1, 2, 3, 250])
  })

  it('saves a binder together with its images', async () => {
    const binder = sampleBinder()

    await repository.saveBinderWithAssets(binder, [sampleAsset('cover')])

    expect(await repository.loadBinder(binder.id)).toEqual(binder)
    expect(await repository.loadAssets(['cover'])).toHaveLength(1)
  })
})
