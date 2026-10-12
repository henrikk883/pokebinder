import { expect, test } from './fixtures'

// A wants list as it comes out of Cardmarket when its table is marked and copied
// (see docs/cardmarket-wants-beispiel.txt): the three Mew ex of "151", the metal card
// Cardmarket lists as a fourth version, and a card wanted in any expansion.
const entry = (amount: number, card: string, expansion: string) =>
  [`\t\t${amount}\t${card}\t`, expansion, '\tEgal\t', '≥', 'PO', 'Poor', '\tAny\tAny\tAny\tAny\t\tN\t'].join('\n')
const copied = [
  ['\t\t2\tBisasam [Schmarotzer]\tEgal\tEgal\t', '≥', 'PO', 'Poor', '\tAny\tAny\tAny\tAny\t\tN\t'].join('\n'),
  entry(1, 'Mew ex (MEW 151)', '151 Version 1'),
  entry(1, 'Mew ex (MEW 193)', '151 Version 2'),
  entry(1, 'Mew ex (MEW 205)', '151 Version 3'),
  entry(1, 'Mew ex (MEW 205)', '151 Version 4'),
  entry(1, 'Glurak ex (XXX 006)', 'Eine Erweiterung, die es nicht gibt'),
].join('\n')

test('a wants list copied out of Cardmarket becomes a binder of exactly those prints, as missing', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Liste importieren' }).click()
  const dialog = page.getByRole('dialog', { name: 'Wunschliste von Cardmarket importieren' })
  // nothing to check, nothing to make a binder of
  await expect(dialog.getByRole('button', { name: 'Liste prüfen' })).toBeDisabled()

  await dialog.getByRole('textbox', { name: 'Kopierte Wunschliste' }).fill(copied)
  await dialog.getByLabel('Name des Binders').fill('Wünsche')
  await dialog.getByRole('button', { name: 'Liste prüfen' }).click()

  // what was found, and what not and why
  await expect(dialog.getByTestId('import-list-result')).toContainText('3 von 6 Einträgen erkannt.')
  await expect(dialog.getByTestId('import-list-problem')).toHaveText([
    'Bisasam [Schmarotzer] – ohne Erweiterung gewünscht: Welcher Druck gemeint ist, steht nicht in der Liste',
    'Mew ex (MEW 205) – ein Sonderprodukt, das nicht zu den Karten des Sets gehört',
    'Glurak ex (XXX 006) – die Erweiterung ist der App nicht bekannt',
  ])

  await dialog.getByRole('button', { name: 'Binder mit 3 Karten anlegen' }).click()
  await expect(page.getByRole('heading', { name: 'Wünsche' })).toBeVisible()
  const pockets = page.getByRole('region', { name: 'Seite 1', exact: true }).getByTestId('pocket')
  // the three prints by their numbers, in the order of the list, none of them there yet
  await expect(pockets.nth(0)).toHaveAttribute('data-card-id', 'sv03.5-151')
  await expect(pockets.nth(1)).toHaveAttribute('data-card-id', 'sv03.5-193')
  await expect(pockets.nth(2)).toHaveAttribute('data-card-id', 'sv03.5-205')
  for (const index of [0, 1, 2]) await expect(pockets.nth(index)).toHaveAttribute('data-owned', 'false')
  await expect(page.getByTestId('progress')).toContainText('0 / 3 Karten gesammelt')

  // the binder is stored like any other
  await expect(page.getByText('Lokal gespeichert')).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Wünsche' })).toBeVisible()
  await expect(pockets.nth(1)).toHaveAttribute('data-card-id', 'sv03.5-193')
})

test('a text that is no wants list makes no binder', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Liste importieren' }).click()
  const dialog = page.getByRole('dialog', { name: 'Wunschliste von Cardmarket importieren' })

  await dialog.getByRole('textbox', { name: 'Kopierte Wunschliste' }).fill('Nur irgendein Text\nohne Karten')
  await dialog.getByRole('button', { name: 'Liste prüfen' }).click()

  await expect(dialog.getByTestId('import-list-result')).toContainText('In dem Text steht kein Eintrag einer Wunschliste.')
  await expect(dialog.getByRole('button', { name: /^Binder mit 0 Karten anlegen/ })).toBeDisabled()
  // changing the text asks for a new check
  await dialog.getByRole('textbox', { name: 'Kopierte Wunschliste' }).fill('etwas anderes')
  await expect(dialog.getByRole('button', { name: 'Liste prüfen' })).toBeEnabled()
  await dialog.getByRole('button', { name: 'Abbrechen' }).click()
  await expect(page.getByTestId('binder-tile')).toHaveCount(0)
})
