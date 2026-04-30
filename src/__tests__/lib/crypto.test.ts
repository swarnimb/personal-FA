import { describe, it, expect } from 'vitest'
import { encrypt, decrypt } from '../../lib/crypto'

describe('crypto', () => {
  it('encrypts and decrypts to same value', () => {
    const plaintext = 'super-secret-api-key-value'
    const { ciphertext, iv, authTag } = encrypt(plaintext)
    expect(decrypt(ciphertext, iv, authTag)).toBe(plaintext)
  })

  it('throws on tampered ciphertext', () => {
    const { ciphertext, iv, authTag } = encrypt('original-value')
    // Flip the last byte of the ciphertext
    const tampered = ciphertext.slice(0, -2) + (ciphertext.slice(-2) === 'ff' ? '00' : 'ff')
    expect(() => decrypt(tampered, iv, authTag)).toThrow(
      'Decryption failed: integrity check failed',
    )
  })

  it('produces unique IV on each call', () => {
    const { iv: iv1 } = encrypt('same-plaintext')
    const { iv: iv2 } = encrypt('same-plaintext')
    expect(iv1).not.toBe(iv2)
  })
})
