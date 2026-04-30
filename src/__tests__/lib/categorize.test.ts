import { describe, it, expect } from 'vitest'
import { categorizeTransaction } from '../../lib/categorize'

describe('categorizeTransaction', () => {
  it('DIRECT DEP PAYROLL positive → Paycheck/Salary', () => {
    expect(categorizeTransaction('DIRECT DEP PAYROLL', 250000)).toBe('Paycheck/Salary')
  })

  it('TRADER JOES 123 → Groceries', () => {
    expect(categorizeTransaction('TRADER JOES 123', -4523)).toBe('Groceries')
  })

  it('ZELLE PAYMENT positive → Transfer In', () => {
    expect(categorizeTransaction('ZELLE PAYMENT', 50000)).toBe('Transfer In')
  })

  it('ZELLE PAYMENT negative → Transfer Out', () => {
    expect(categorizeTransaction('ZELLE PAYMENT', -50000)).toBe('Transfer Out')
  })

  it('RANDOM MERCHANT XYZ → Uncategorized', () => {
    expect(categorizeTransaction('RANDOM MERCHANT XYZ', -1000)).toBe('Uncategorized')
  })
})
