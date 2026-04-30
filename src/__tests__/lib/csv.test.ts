import { describe, it, expect } from 'vitest'
import { parseCSV, mapColumns } from '../../lib/csv'

const SAMPLE_CSV = `date,amount,description
2026-04-01,-45.23,TRADER JOES 123
2026-04-02,2500.00,DIRECT DEP PAYROLL
2026-04-03,-12.50,NETFLIX`

const MAPPING = { dateCol: 0, amountCol: 1, descriptionCol: 2 }

describe('parseCSV', () => {
  it('parses valid CSV into row arrays', () => {
    const rows = parseCSV(SAMPLE_CSV)
    expect(rows).toHaveLength(4) // header + 3 data rows
    expect(rows[0]).toEqual(['date', 'amount', 'description'])
    expect(rows[1][2]).toBe('TRADER JOES 123')
  })
})

describe('mapColumns', () => {
  it('maps columns correctly', () => {
    const rows = parseCSV(SAMPLE_CSV)
    const result = mapColumns(rows, MAPPING)
    expect(result).toHaveLength(3)
    expect(result[0].amountCents).toBe(-4523)
    expect(result[0].merchant).toBe('TRADER JOES 123')
    expect(result[1].amountCents).toBe(250000)
  })

  it('throws on non-numeric amount column', () => {
    const rows = [
      ['date', 'amount', 'description'],
      ['2026-04-01', 'not-a-number', 'Some Merchant'],
    ]
    expect(() => mapColumns(rows, MAPPING)).toThrow('non-numeric amount')
  })
})
