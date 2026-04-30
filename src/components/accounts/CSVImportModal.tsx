'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type Account = { id: string; name: string }
type PreviewData = { headers: string[]; preview: { row: number; cells: string[] }[]; totalRows: number; fileContent: string }
type ColMap = { dateCol: string; amountCol: string; descriptionCol: string }
type ImportResult = { inserted: number; errors: { row: number; error: string }[] }

class CSVUploadError extends Error {
  constructor(message: string) { super(`CSV upload failed: ${message}`); this.name = 'CSVUploadError' }
}
class CSVImportError extends Error {
  constructor(message: string) { super(`CSV import failed: ${message}`); this.name = 'CSVImportError' }
}

const EMPTY_MAP: ColMap = { dateCol: '', amountCol: '', descriptionCol: '' }

/**
 * Two-step CSV import modal.
 * Step 1: account selector + file picker → uploads and previews headers + 10 rows.
 * Step 2: column mapping + preview table → confirm inserts transactions.
 */
export function CSVImportModal({ accounts }: { accounts: Account[] }) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [accountId, setAccountId] = useState('')
  const [fileKey, setFileKey] = useState(0)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [colMap, setColMap] = useState<ColMap>(EMPTY_MAP)
  const [isLoading, setIsLoading] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)

  const reset = () => {
    setAccountId('')
    setPreview(null)
    setColMap(EMPTY_MAP)
    setError(null)
    setResult(null)
    setIsLoading(false)
    setFileKey((k) => k + 1)
  }

  const handleFileChange = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0]
    if (!file) return
    const fileContent = await file.text()
    const form = new FormData()
    form.append('file', file)
    setIsLoading(true)
    setError(null)
    setPreview(null)
    try {
      const res = await fetch('/api/import/csv', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new CSVUploadError(data.error ?? 'Upload failed')
      setPreview({ ...data.data, fileContent })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleConfirm = async () => {
    if (!preview || !accountId || !colMap.dateCol || !colMap.amountCol || !colMap.descriptionCol) {
      setError('Select an account and map all three columns before confirming')
      return
    }
    setIsConfirming(true)
    setError(null)
    try {
      const res = await fetch('/api/import/csv/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          columnMapping: {
            dateCol: parseInt(colMap.dateCol, 10),
            amountCol: parseInt(colMap.amountCol, 10),
            descriptionCol: parseInt(colMap.descriptionCol, 10),
          },
          fileContent: preview.fileContent,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new CSVImportError(data.error ?? 'Import failed')
      setResult(data.data)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setIsConfirming(false)
    }
  }

  const setCol = (k: keyof ColMap, v: string) => setColMap((m) => ({ ...m, [k]: v }))
  const colOptions = preview?.headers.map((h, i) => ({ label: h || `Column ${i + 1}`, value: String(i) })) ?? []
  const canConfirm = !!accountId && !!colMap.dateCol && !!colMap.amountCol && !!colMap.descriptionCol

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { setIsOpen(o); if (!o) reset() }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" aria-label="Import CSV">Import CSV</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-manrope font-bold text-on-surface">Import CSV</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {result ? (
            <div className="flex flex-col gap-3">
              <p className="font-inter text-sm text-on-surface">
                Imported <span className="text-primary font-medium">{result.inserted}</span> rows successfully.
              </p>
              {result.errors.length > 0 && (
                <p className="font-inter text-xs text-tertiary">{result.errors.length} rows had errors and were skipped.</p>
              )}
              <Button onClick={() => setIsOpen(false)} aria-label="Done">Done</Button>
            </div>
          ) : (
            <>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger aria-label="Target account"><SelectValue placeholder="Select target account" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <label className="flex flex-col gap-1">
                <span className="font-inter text-xs text-on-surface-variant">CSV file (max 5 MB)</span>
                <input
                  key={fileKey}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileChange}
                  disabled={isLoading}
                  aria-label="Select CSV file"
                  className="font-inter text-sm text-on-surface-variant file:mr-3 file:rounded-md file:border-0 file:bg-surface-high file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-on-surface cursor-pointer"
                />
              </label>
              {isLoading && <p className="font-inter text-xs text-on-surface-variant">Uploading…</p>}
              {error && <p className="text-xs text-tertiary">{error}</p>}
              {preview && (
                <>
                  <div className="flex flex-col gap-2">
                    <p className="font-inter text-xs text-on-surface-variant font-medium uppercase tracking-wider">Map columns</p>
                    <div className="grid grid-cols-3 gap-2">
                      {(['dateCol', 'amountCol', 'descriptionCol'] as const).map((col) => (
                        <Select key={col} value={colMap[col]} onValueChange={(v) => setCol(col, v)}>
                          <SelectTrigger aria-label={col === 'dateCol' ? 'Date column' : col === 'amountCol' ? 'Amount column' : 'Description column'}>
                            <SelectValue placeholder={col === 'dateCol' ? 'Date' : col === 'amountCol' ? 'Amount' : 'Description'} />
                          </SelectTrigger>
                          <SelectContent>
                            {colOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ))}
                    </div>
                  </div>
                  <div className="overflow-x-auto rounded-lg bg-surface-low">
                    <table className="w-full text-xs font-inter">
                      <thead>
                        <tr>
                          {preview.headers.map((h, i) => (
                            <th key={i} className="px-3 py-2 text-left text-on-surface-variant font-medium">{h || `Col ${i + 1}`}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.preview.map(({ row, cells }) => (
                          <tr key={row} className="hover:bg-surface-highest transition-colors duration-150">
                            {cells.map((cell, i) => (
                              <td key={i} className="px-3 py-2 text-on-surface truncate max-w-[120px]">{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="font-inter text-xs text-on-surface-variant">{preview.totalRows} total rows to import</p>
                  <Button onClick={handleConfirm} disabled={isConfirming || !canConfirm} aria-label="Confirm CSV import">
                    {isConfirming ? 'Importing…' : `Import ${preview.totalRows} rows`}
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
