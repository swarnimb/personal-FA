/**
 * favicon.test.ts
 *
 * Asserts that `src/app/favicon.ico` — the Next.js App Router favicon source
 * of truth — exists, is non-empty, and is a valid ICO file with at least one
 * 32×32 entry. Next.js serves this file automatically at `/favicon.ico`; no
 * copy in `public/` is needed (and a duplicate there would conflict).
 */

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(HERE, '..', '..', '..')
const FAVICON_PATH = resolve(PROJECT_ROOT, 'src', 'app', 'favicon.ico')

describe('favicon', () => {
  it('src/app/favicon.ico exists and is non-empty', () => {
    expect(existsSync(FAVICON_PATH)).toBe(true)
    const stat = statSync(FAVICON_PATH)
    expect(stat.size).toBeGreaterThan(0)
  })

  it('has the ICO magic bytes (00 00 01 00) at offset 0', () => {
    const buf = readFileSync(FAVICON_PATH)
    expect(buf[0]).toBe(0x00)
    expect(buf[1]).toBe(0x00)
    expect(buf[2]).toBe(0x01)
    expect(buf[3]).toBe(0x00)
  })

  it('contains an entry at 32x32', () => {
    const buf = readFileSync(FAVICON_PATH)
    const count = buf.readUInt16LE(4)
    expect(count).toBeGreaterThanOrEqual(1)

    let found32 = false
    for (let i = 0; i < count; i++) {
      const entryOffset = 6 + i * 16
      const w = buf[entryOffset] === 0 ? 256 : buf[entryOffset]
      const h = buf[entryOffset + 1] === 0 ? 256 : buf[entryOffset + 1]
      if (w === 32 && h === 32) {
        found32 = true
        break
      }
    }
    expect(found32).toBe(true)
  })
})
