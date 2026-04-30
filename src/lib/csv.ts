import Papa from 'papaparse'

export interface CSVParser {
  parse(rows: string[][]): ParsedTransaction[]
}

export type ParsedTransaction = {
  date: Date
  amountCents: number
  merchant: string
}

export type ColumnMapping = {
  dateCol: number
  amountCol: number
  descriptionCol: number
}

export function parseCSV(fileContent: string): string[][] {
  const result = Papa.parse<string[]>(fileContent, {
    skipEmptyLines: true,
  })
  return result.data
}

export function mapColumns(rows: string[][], mapping: ColumnMapping): ParsedTransaction[] {
  return rows.slice(1).map((row, i) => {
    const rowNum = i + 2
    const dateStr = row[mapping.dateCol]?.trim()
    const amountStr = row[mapping.amountCol]?.trim()
    const merchant = row[mapping.descriptionCol]?.trim() ?? ''

    const date = new Date(dateStr)
    if (isNaN(date.getTime())) {
      throw new Error(`Row ${rowNum}: invalid date: ${dateStr}`)
    }

    const amount = parseFloat(amountStr)
    if (isNaN(amount)) {
      throw new Error(`Row ${rowNum}: non-numeric amount: ${amountStr}`)
    }

    return { date, amountCents: Math.round(amount * 100), merchant }
  })
}
