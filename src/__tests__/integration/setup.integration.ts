import '@testing-library/jest-dom'

/** Thrown when the integration env is missing/misconfigured — never skip silently (EH-02/EH-05). */
export class IntegrationEnvError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'IntegrationEnvError'
  }
}

// Some transitively-imported modules require an encryption key at import time.
process.env.ENCRYPTION_KEY = Buffer.alloc(32).toString('hex')

const testUrl = process.env.TEST_DATABASE_URL

if (!testUrl) {
  throw new IntegrationEnvError(
    'TEST_DATABASE_URL is not set. Integration tests need a dedicated test database. ' +
      'Add TEST_DATABASE_URL=postgresql://USER:PASS@localhost:5432/amibroke_test to .env.local, ' +
      'then seed it with `npx tsx prisma/seed-demo.ts` (see docs/testing-setup.md). ' +
      'Refusing to run rather than silently testing nothing.',
  )
}

let dbName: string
try {
  dbName = new URL(testUrl).pathname.replace(/^\//, '')
} catch {
  throw new IntegrationEnvError(`TEST_DATABASE_URL is not a valid URL: "${testUrl}"`)
}

if (!/test/i.test(dbName)) {
  throw new IntegrationEnvError(
    `Refusing to run: TEST_DATABASE_URL points at database "${dbName}", which is not a ` +
      `*test* database. Use a dedicated DB whose name contains "test" (e.g. amibroke_test) ` +
      `so the production database (amibroke) can never be touched (SEC-01).`,
  )
}

// Point Prisma at the test DB BEFORE @/lib/db is imported by any test module.
process.env.DATABASE_URL = testUrl
