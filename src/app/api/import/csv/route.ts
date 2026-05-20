import { parseCSV } from '@/lib/csv'
import { isDemoMode, demoNotFound } from '@/lib/api-demo-guard'

const MAX_SIZE_BYTES = 5 * 1024 * 1024

export async function POST(req: Request): Promise<Response> {
  if (isDemoMode()) return demoNotFound()
  const contentType = req.headers.get('content-type') ?? ''
  if (!contentType.includes('multipart/form-data')) {
    return Response.json({ error: 'Request must be multipart/form-data' }, { status: 400 })
  }

  let formData: FormData
  try { formData = await req.formData() } catch {
    return Response.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return Response.json({ error: 'file field is required' }, { status: 400 })
  }

  const isCSV = file.type === 'text/csv' || file.name.endsWith('.csv')
  if (!isCSV) {
    return Response.json({ error: 'File must be a CSV (text/csv or .csv)' }, { status: 400 })
  }

  if (file.size > MAX_SIZE_BYTES) {
    return Response.json({ error: 'File exceeds maximum size of 5MB' }, { status: 413 })
  }

  const fileContent = await file.text()
  const rows = parseCSV(fileContent)
  if (rows.length < 1) {
    return Response.json({ error: 'CSV file is empty' }, { status: 400 })
  }

  const headers = rows[0]
  const previewRows = rows.slice(1, 11)

  return Response.json({
    data: {
      headers,
      preview: previewRows.map((row, i) => ({ row: i + 2, cells: row })),
      totalRows: rows.length - 1,
    },
  })
}
