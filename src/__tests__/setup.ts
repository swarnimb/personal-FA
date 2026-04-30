import '@testing-library/jest-dom'

// Set required env vars before any module under test is imported.
// Uses 32 zero-bytes (64 hex chars) as a safe test key.
process.env.ENCRYPTION_KEY = Buffer.alloc(32).toString('hex')
