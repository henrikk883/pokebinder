import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

const sampleBackup = fileURLToPath(new URL('../fixtures/sample-backup.json', import.meta.url))

test('an imported binder survives a reload and exports unchanged', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Noch kein Binder angelegt.')).toBeVisible()

  await page.getByLabel('Backup-Datei auswählen').setInputFiles(sampleBackup)
  await expect(page.getByRole('heading', { name: 'Kanto Collection' })).toBeVisible()
  await expect(page.getByText('Layout 2 × 2 · 2 Seiten')).toBeVisible()
  await expect(page.getByRole('status')).toHaveText('Lokal gespeichert')

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Kanto Collection' })).toBeVisible()
  await expect(page.getByRole('status')).toHaveText('Lokal gespeichert')

  await page.getByRole('button', { name: 'Backup' }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: 'Als JSON exportieren' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^pokebinder-kanto-collection-\d{4}-\d{2}-\d{2}\.json$/)

  const exported = JSON.parse(await readFile(await download.path(), 'utf8')) as Record<string, unknown>
  const original = JSON.parse(await readFile(sampleBackup, 'utf8')) as Record<string, unknown>
  expect(exported.binder).toEqual(original.binder)
  expect(exported.assets).toEqual(original.assets)
})

test('a file that is no backup is rejected with a message', async ({ page }) => {
  await page.goto('/')

  await page.getByLabel('Backup-Datei auswählen').setInputFiles({
    name: 'notes.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"hello":"world"}'),
  })

  await expect(page.getByRole('alert')).toHaveText('Die Datei ist kein PokéBinder-Backup.')
  await expect(page.getByText('Noch kein Binder angelegt.')).toBeVisible()
})
