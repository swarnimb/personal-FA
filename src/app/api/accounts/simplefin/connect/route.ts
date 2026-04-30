import { z } from 'zod'
import { encrypt } from '@/lib/crypto'
import { db } from '@/lib/db'
import { exchangeSetupToken } from '@/lib/simplefin'

const connectSchema = z.object({
  setupToken: z.string().min(1, 'setupToken is required'),
})

export async function POST(req: Request): Promise<Response> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = connectSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'setupToken is required' }, { status: 400 })
  }

  let accessUrl: string
  try {
    accessUrl = await exchangeSetupToken(parsed.data.setupToken)
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Token exchange failed' },
      { status: 502 },
    )
  }

  const { ciphertext, iv, authTag } = encrypt(accessUrl)

  // Single-user: replace any existing connection
  await db.simplefinConnection.deleteMany()
  await db.simplefinConnection.create({
    data: { encryptedAccessUrl: ciphertext, iv, authTag },
  })

  return Response.json({ data: { connected: true } })
}
