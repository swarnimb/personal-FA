import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { isDemoMode } from './demo-mode'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const KEY_BYTE_LENGTH = 32
const KEY_HEX_LENGTH = KEY_BYTE_LENGTH * 2

/**
 * Module-load encryption key resolution.
 *
 * V1.0 (demo mode off): require `ENCRYPTION_KEY` env var at module load
 * — throwing here preserves CONSTRAINT-06's load-bearing fail-loud
 * guarantee that no sync code path can ever run without a real key.
 *
 * Demo mode on: skip the key check so the GitHub Pages static build
 * (which runs without the secret) can import this module transitively.
 * `encrypt()` / `decrypt()` are unreachable in demo mode because all
 * sync entry points short-circuit before calling them; the throws below
 * are defence-in-depth in case a future caller bypasses the gates.
 */
const KEY: Buffer | null = (() => {
  if (isDemoMode()) {
    return null
  }
  const keyHex = process.env.ENCRYPTION_KEY
  if (!keyHex) {
    throw new Error('ENCRYPTION_KEY env var not set')
  }
  const key = Buffer.from(keyHex, 'hex')
  if (key.length !== KEY_BYTE_LENGTH) {
    throw new Error(
      `ENCRYPTION_KEY must be a ${KEY_BYTE_LENGTH}-byte hex string (${KEY_HEX_LENGTH} hex chars)`,
    )
  }
  return key
})()

/**
 * AES-256-GCM encrypt a plaintext credential.
 *
 * In demo mode this throws — sync entry points must gate calls with
 * `isDemoMode()`. CONSTRAINT-06 requires this remain the only encrypt path.
 */
export function encrypt(plaintext: string): {
  ciphertext: string
  iv: string
  authTag: string
} {
  if (KEY === null) {
    throw new Error('encrypt() unreachable in demo mode')
  }
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, KEY, iv)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  return {
    ciphertext: encrypted.toString('hex'),
    iv: iv.toString('hex'),
    authTag: cipher.getAuthTag().toString('hex'),
  }
}

/**
 * AES-256-GCM decrypt a ciphertext credential.
 *
 * In demo mode this throws — sync entry points must gate calls with
 * `isDemoMode()`. CONSTRAINT-06 requires this remain the only decrypt path.
 */
export function decrypt(ciphertext: string, iv: string, authTag: string): string {
  if (KEY === null) {
    throw new Error('decrypt() unreachable in demo mode')
  }
  try {
    const decipher = createDecipheriv(ALGORITHM, KEY, Buffer.from(iv, 'hex'))
    decipher.setAuthTag(Buffer.from(authTag, 'hex'))
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'hex')),
      decipher.final(),
    ])
    return decrypted.toString('utf8')
  } catch {
    throw new Error('Decryption failed: integrity check failed')
  }
}
