import { describe, expect, it } from 'vitest'
import sample from '../../../docs/cardmarket-wants-beispiel.txt?raw'
import { parseCardmarketWants } from './cardmarketWants'

describe('parseCardmarketWants', () => {
  it('reads the list Henrik copied out of Cardmarket', () => {
    const entries = parseCardmarketWants(sample)

    expect(entries).toHaveLength(12)
    // wanted in any expansion: no set, no number
    expect(entries[0]).toEqual({ amount: 2, name: 'Bisasam [Schmarotzer]' })
    expect(entries[1]).toEqual({
      amount: 1,
      name: 'Lillys Entschlossenheit',
      setCode: 'MEG',
      number: '184',
      expansion: 'Mega-Entwicklung',
      version: 3,
    })
    // the four Mew ex of "151", the last of them the metal card
    expect(entries.slice(8).map((entry) => [entry.name, entry.setCode, entry.number, entry.expansion, entry.version])).toEqual([
      ['Mew ex', 'MEW', '151', '151', 1],
      ['Mew ex', 'MEW', '193', '151', 2],
      ['Mew ex', 'MEW', '205', '151', 3],
      ['Mew ex', 'MEW', '205', '151', 4],
    ])
  })

  it('takes an expansion without a version for a card with one print', () => {
    const text = ['\t\t3\tSwitch (MEW 206)\t', '151', '\tEgal\t'].join('\n')

    expect(parseCardmarketWants(text)).toEqual([
      { amount: 3, name: 'Switch', setCode: 'MEW', number: '206', expansion: '151' },
    ])
  })

  it('copes with other line endings and with what is no list at all', () => {
    const windows = '\t\t1\tMew ex (MEW 151)\t\r\n151 Version 1\r\n\tEgal\t\r\n'

    expect(parseCardmarketWants(windows)).toEqual([
      { amount: 1, name: 'Mew ex', setCode: 'MEW', number: '151', expansion: '151', version: 1 },
    ])
    expect(parseCardmarketWants('')).toEqual([])
    expect(parseCardmarketWants('Hallo\nWelt')).toEqual([])
    // language and condition rows are no entries
    expect(parseCardmarketWants('\tAny\tAny\tAny\tAny\t\tN\t\n≥\nPO\nPoor')).toEqual([])
  })

  it('keeps brackets that belong to the name', () => {
    const text = '\t\t1\tPikachu (Flying) (CEL 006)\t\nCelebrations'

    expect(parseCardmarketWants(text)[0]).toMatchObject({ name: 'Pikachu (Flying)', setCode: 'CEL', number: '006' })
  })
})
