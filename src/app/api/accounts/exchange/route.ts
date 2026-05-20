import { z } from 'zod'
import { ExchangeType } from '@prisma/client'
import { encrypt } from '@/lib/crypto'
import { db } from '@/lib/db'
import { isDemoMode, demoNotFound } from '@/lib/api-demo-guard'

const addExchangeSchema = z.object({
  exchange: z.enum(['Coinbase', 'Kraken']),
  apiKey: z.string().min(1, 'apiKey is required'),
  apiSecret: z.string().min(1, 'apiSecret is required'),
})

export async function POST(req: Request): Promise<Response> {
  if (isDemoMode()) return demoNotFound()
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = addExchangeSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { exchange, apiKey, apiSecret } = parsed.data

  // Both credentials encrypted as one JSON payload to avoid IV reuse (single encrypt call = single IV)
  const credentialPayload = JSON.stringify({ apiKey, apiSecret })
  const { ciphertext, iv, authTag } = encrypt(credentialPayload)

  const connection = await db.exchangeConnection.create({
    data: {
      exchange: exchange as ExchangeType,
      encryptedApiKey: ciphertext,
      encryptedApiSecret: '',
      iv,
      authTag,
    },
  })

  return Response.json({
    data: { id: connection.id, exchange: connection.exchange },
  })
}
