import { db } from '@/lib/db'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params

  const connection = await db.exchangeConnection.findUnique({ where: { id } })
  if (!connection) {
    return Response.json({ error: 'Exchange connection not found' }, { status: 404 })
  }

  // Deactivate linked accounts and sever the FK before deleting the connection
  await db.account.updateMany({
    where: { exchangeConnectionId: id },
    data: { isActive: false, exchangeConnectionId: null },
  })

  await db.exchangeConnection.delete({ where: { id } })

  return Response.json({ data: { deleted: true } })
}
