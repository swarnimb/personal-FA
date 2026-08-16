import { describe, it, expect } from 'vitest'
import {
  planRekey,
  RekeyDecisionError,
  CATEGORY_DECISIONS,
  CATEGORY_CORRECTIONS,
  type RuleRow,
} from '../../lib/rekey-merchant-rules'
import { ALL_CATEGORIES } from '../../lib/categories'

function rule(overrides: Partial<RuleRow> & { normalizedMerchant: string; category: string }): RuleRow {
  return {
    displayMerchant: overrides.normalizedMerchant,
    source: 'AI',
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  }
}

describe('planRekey — collapsing single-use rules', () => {
  it('collapses every posting of one recurring payment into a single rule', () => {
    const plan = planRekey([
      rule({ normalizedMerchant: 'amex epayment ach pmt 260722 a0056 swarnim bagre', category: 'Transfer Out' }),
      rule({ normalizedMerchant: 'amex epayment ach pmt 260727 a0488 swarnim bagre', category: 'Transfer Out' }),
      rule({ normalizedMerchant: 'amex epayment ach pmt 260601 a1232 swarnim bagre', category: 'Transfer Out' }),
    ])

    expect(plan.before).toBe(3)
    expect(plan.after).toBe(1)
    expect(plan.groups[0].newKey).toBe('amex epayment ach pmt swarnim bagre')
    expect(plan.groups[0].category).toBe('Transfer Out')
    expect(plan.groups[0].decidedBy).toBe('unanimous')
    expect(plan.conflicts).toHaveLength(0)
  })

  it('leaves an already-clean rule untouched', () => {
    const plan = planRekey([rule({ normalizedMerchant: 'chipotle', category: 'Dining & Bars' })])
    expect(plan.after).toBe(1)
    expect(plan.groups[0].newKey).toBe('chipotle')
    expect(plan.groups[0].decidedBy).toBe('single')
  })

  it('reports every key it produces as stable under re-normalization', () => {
    const plan = planRekey([
      rule({ normalizedMerchant: 'fid bkg svc llc moneyline 260227 z2191554111kjow swarnim bagre', category: 'Transfer Out' }),
      rule({ normalizedMerchant: 'p. terry\'s stand #15', category: 'Dining & Bars' }),
      rule({ normalizedMerchant: '7-eleven', category: 'Transport' }),
    ])
    expect(plan.unstableKeys).toEqual([])
  })
})

describe('planRekey — conflict resolution', () => {
  const FID = 'fid bkg svc llc moneyline swarnim bagre'

  it('a recorded decision beats the majority', () => {
    // 2 x Interest & Dividends vs 1 x Transfer Out — majority would say
    // Interest & Dividends, but the builder decided Transfer Out.
    const plan = planRekey([
      rule({ normalizedMerchant: 'fid bkg svc llc moneyline 260305 z21915541 78u00 swarnim bagre', category: 'Interest & Dividends' }),
      rule({ normalizedMerchant: 'fid bkg svc llc moneyline 260313 z2191554114dk4b swarnim bagre', category: 'Interest & Dividends' }),
      rule({ normalizedMerchant: 'fid bkg svc llc moneyline 260327 z2191554116xfrj swarnim bagre', category: 'Transfer Out' }),
    ])
    const group = plan.groups.find((g) => g.newKey === FID)
    expect(group?.category).toBe('Transfer Out')
    expect(group?.decidedBy).toBe('decision')
  })

  it('reports the disagreement even when it was decided — never a silent merge', () => {
    const plan = planRekey([
      rule({ normalizedMerchant: 'fid bkg svc llc moneyline 260305 z21915541 78u00 swarnim bagre', category: 'Interest & Dividends' }),
      rule({ normalizedMerchant: 'fid bkg svc llc moneyline 260327 z2191554116xfrj swarnim bagre', category: 'Transfer Out' }),
    ])
    expect(plan.conflicts).toHaveLength(1)
    expect(plan.conflicts[0].disagreement).toEqual(
      expect.arrayContaining(['Interest & Dividends', 'Transfer Out']),
    )
  })

  it('falls back to the majority for an undecided conflict', () => {
    const plan = planRekey([
      rule({ normalizedMerchant: 'acme corp 260101 a1234', category: 'Shopping' }),
      rule({ normalizedMerchant: 'acme corp 260202 b5678', category: 'Shopping' }),
      rule({ normalizedMerchant: 'acme corp 260303 c9012', category: 'Groceries' }),
    ])
    const group = plan.groups.find((g) => g.newKey === 'acme corp')
    expect(group?.category).toBe('Shopping')
    expect(group?.decidedBy).toBe('majority')
  })

  it('applies a category correction even without a merge', () => {
    const plan = planRekey([rule({ normalizedMerchant: '7-eleven', category: 'Utilities' })])
    expect(plan.groups[0].category).toBe('Transport')
    expect(plan.groups[0].decidedBy).toBe('correction')
  })
})

describe('planRekey — provenance', () => {
  it('keeps USER provenance when any collapsed rule was builder-set', () => {
    const plan = planRekey([
      rule({ normalizedMerchant: 'venmo payment 260514 1050298449100 swarnim bagre', category: 'Transfer Out', source: 'AI' }),
      rule({ normalizedMerchant: 'venmo payment 260522 1050474518937 swarnim bagre', category: 'Transfer Out', source: 'USER' }),
    ])
    expect(plan.groups[0].source).toBe('USER')
  })

  it('stays AI when every collapsed rule was LLM-proposed', () => {
    const plan = planRekey([
      rule({ normalizedMerchant: 'venmo payment 260514 1050298449100 swarnim bagre', category: 'Transfer Out', source: 'AI' }),
      rule({ normalizedMerchant: 'venmo payment 260522 1050474518937 swarnim bagre', category: 'Transfer Out', source: 'AI' }),
    ])
    expect(plan.groups[0].source).toBe('AI')
  })

  it('takes the display label from the most recently updated rule', () => {
    const plan = planRekey([
      rule({ normalizedMerchant: 'acme corp 260101 a1234', category: 'Shopping', displayMerchant: 'Old Label', updatedAt: new Date('2026-01-01') }),
      rule({ normalizedMerchant: 'acme corp 260303 c9012', category: 'Shopping', displayMerchant: 'New Label', updatedAt: new Date('2026-03-03') }),
    ])
    expect(plan.groups[0].displayMerchant).toBe('New Label')
  })
})

describe('planRekey — validation', () => {
  it('every recorded decision and correction names a real category', () => {
    for (const category of [...Object.values(CATEGORY_DECISIONS), ...Object.values(CATEGORY_CORRECTIONS)]) {
      expect(ALL_CATEGORIES).toContain(category)
    }
  })

  it('throws RekeyDecisionError when a decision names a category that does not exist', () => {
    // Guards the table against drift if ALL_CATEGORIES is ever renamed: the run
    // must fail loudly BEFORE any write rather than silently skip the decision.
    expect(() =>
      planRekey([rule({ normalizedMerchant: 'chipotle', category: 'Dining & Bars' })], {
        decisions: { chipotle: 'Not A Real Category' },
        corrections: {},
      }),
    ).toThrow(RekeyDecisionError)
  })

  it('the thrown error names the offending key and category', () => {
    expect(() =>
      planRekey([], { decisions: {}, corrections: { 'some key': 'Nonsense' } }),
    ).toThrow(/Nonsense.*some key|some key.*Nonsense/)
  })

  it('handles an empty rule table without throwing', () => {
    const plan = planRekey([])
    expect(plan.before).toBe(0)
    expect(plan.after).toBe(0)
    expect(plan.conflicts).toEqual([])
  })
})
