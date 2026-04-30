import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const KEY_HEX = process.env.ENCRYPTION_KEY
if (!KEY_HEX) {
  throw new Error('ENCRYPTION_KEY env var not set')
}

const KEY = Buffer.from(KEY_HEX, 'hex')
if (KEY.length !== 32) {
  throw new Error('ENCRYPTION_KEY must be a 32-byte hex string (64 hex chars)')
}

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16

export function encrypt(plaintext: string): {
  ciphertext: string
  iv: string
  authTag: string
} {
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

export function decrypt(ciphertext: string, iv: string, authTag: string): string {
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
