import { describe, test, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const README = readFileSync(resolve(process.cwd(), 'README.md'), 'utf8')

describe('README', () => {
  test('contains live demo link to swarnimb.github.io/personal-FA', () => {
    expect(README).toMatch(/swarnimb\.github\.io\/personal-FA/)
  })

  test('lists all six tab screenshots', () => {
    const screenshots = [
      'dashboard.png',
      'net-worth.png',
      'income.png',
      'spending.png',
      'investments.png',
      'accounts.png',
    ]
    for (const file of screenshots) {
      expect(README).toContain(file)
    }
  })
})
