import Papa from 'papaparse'
import type { Contact } from '../types'

const BOOL_TRUE = new Set(['yes', 'true', '1'])

function parseBool(val: string | undefined): boolean {
  if (!val) return false
  return BOOL_TRUE.has(String(val).trim().toLowerCase())
}

function parseGiftAmount(val: string | undefined): number {
  if (!val) return 0
  const cleaned = String(val).replace(/[$,\s]/g, '')
  const n = parseFloat(cleaned)
  return isNaN(n) ? 0 : n
}

function parseIntVal(val: string | undefined): number | null {
  if (!val || String(val).trim() === '') return null
  const n = parseInt(String(val).trim(), 10)
  return isNaN(n) ? null : n
}

// Normalizes date strings to YYYY-MM-DD. Handles:
//   M/D/YY and M/D/YYYY (slash-delimited, US order)
//   YYYY-MM-DD (already correct — pass through)
// Anything unrecognized is returned as empty string.
export function normalizeDateString(val: string | undefined): string {
  if (!val || val.trim() === '') return ''
  const s = val.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/)
  if (slashMatch) {
    const [, m, d, y] = slashMatch
    const year = y.length === 2 ? `20${y}` : y
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  return ''
}

const COLUMN_MAP: Record<string, keyof Contact> = {
  'Full Name': 'fullName',
  'Relationship': 'relationship',
  'Returning': 'returning',
  'Top Priority': 'topPriority',
  'Address Status': 'addressStatus',
  'Sent': 'sent',
  'Letter Address Name': 'letterAddressName',
  'Salutation': 'salutation',
'Thank-you Sent?': 'thankYouSent',
  'Notes': 'notes',
  'Street Address': 'streetAddress',
  'City': 'city',
  'State': 'state',
  'Zip': 'zip',
  'Country': 'country',
  'Concatenated Address': 'concatenatedAddress',
  'Phone': 'phone',
  'Followed Up?': 'followedUp',
  'Call Made?': 'followedUp',
  'Email Address': 'email',
  'Financial Partner': 'financialPartner',
  'Prayer Partner': 'prayerPartner',
  'Pledged to Give': 'pledgedToGive',
  'Form of Gift Received': 'formOfGift',
  'Gift Amount': 'giftAmount',
  'Date Received': 'dateReceived',
}

const BOOL_FIELDS = new Set<keyof Contact>([
  'returning', 'sent', 'thankYouSent', 'followedUp', 'responded', 'financialPartner', 'prayerPartner',
  'pledgedToGive',
])

const COLUMN_MAP_INVERSE = Object.fromEntries(
  Object.entries(COLUMN_MAP).map(([csvCol, field]) => [field, csvCol])
) as Record<keyof Contact, string>

export interface ImportDiagnostics {
  totalRows: number
  imported: number
  skipped: number
  skippedRows: number[]
  missingHeaders: string[]
  unmappedHeaders: string[]
  rowErrors: { row: number; col: string; val: string | undefined; error: string }[]
  papaParseMeta: Papa.ParseMeta
  papaParseErrors: Papa.ParseError[]
}

export function buildTemplateCSV(): string {
  const exampleRow: Record<string, string> = {
    'Full Name': 'John Smith',
    'Relationship': 'Family Friend',
    'Returning': 'No',
    'Top Priority': '1',
    'Address Status': 'Confirmed',
    'Sent': 'No',
    'Letter Address Name': 'The Smith Family',
    'Salutation': 'John',
    'Thank-you Sent?': 'No',
    'Notes': 'Met at church camp 2023',
    'Street Address': '123 Main St',
    'City': 'Springfield',
    'State': 'IL',
    'Zip': '62701',
    'Country': 'USA',
    'Concatenated Address': '123 Main St, Springfield, IL 62701',
    'Phone': '555-867-5309',
    'Followed Up?': 'No',
    'Email Address': 'john.smith@example.com',
    'Financial Partner': 'No',
    'Prayer Partner': 'No',
    'Pledged to Give': 'No',
    'Form of Gift Received': '',
    'Gift Amount': '',
    'Date Received': '',
  }
  const columns = Object.keys(COLUMN_MAP).filter(col => col !== 'Call Made?')
  return Papa.unparse([exampleRow], { columns })
}

export function exportTemplate(): void {
  const csv = buildTemplateCSV()
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'contacts-import-template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export function buildExportCSV(contacts: Contact[]): string {
  const rows = contacts.map(c => {
    const row: Record<string, string> = {}
    for (const [field, csvCol] of Object.entries(COLUMN_MAP_INVERSE)) {
      const key = field as keyof Contact
      const val = c[key]
      if (BOOL_FIELDS.has(key)) {
        row[csvCol] = val ? 'Yes' : 'No'
      } else {
        row[csvCol] = val != null ? String(val) : ''
      }
    }
    return row
  })
  return Papa.unparse(rows, { columns: Object.keys(COLUMN_MAP) })
}

export function exportCSV(contacts: Contact[]): void {
  const csv = buildExportCSV(contacts)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `contacts-export-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function parseCSV(csvText: string): { contacts: Contact[]; diagnostics: ImportDiagnostics } {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  })

  const detectedHeaders = result.meta?.fields ?? []
  const expectedHeaders = Object.keys(COLUMN_MAP)
  const missingHeaders = expectedHeaders.filter(h => !detectedHeaders.includes(h))
  const unmappedHeaders = detectedHeaders.filter(h => !COLUMN_MAP[h])

  const rows = result.data
  const contacts: Contact[] = []
  const skippedRows: number[] = []
  const rowErrors: ImportDiagnostics['rowErrors'] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const mapped: Partial<Contact> = {}

    for (const [csvCol, field] of Object.entries(COLUMN_MAP)) {
      if (!(csvCol in row)) continue
      const val = row[csvCol]
      try {
        if (field === 'topPriority') {
          mapped[field] = parseIntVal(val)
        } else if (field === 'giftAmount') {
          mapped[field] = parseGiftAmount(val)
        } else if (field === 'dateReceived') {
          mapped[field] = normalizeDateString(val)
        } else if (BOOL_FIELDS.has(field)) {
          (mapped as Record<string, boolean>)[field] = parseBool(val)
        } else {
          (mapped as Record<string, string>)[field] = val ? String(val).trim() : ''
        }
      } catch (err) {
        rowErrors.push({ row: i + 2, col: csvCol, val, error: (err as Error).message })
      }
    }

    if (!mapped.fullName && !mapped.relationship) {
      skippedRows.push(i + 2)
      continue
    }

    contacts.push({ ...mapped } as Contact)
  }

  return {
    contacts,
    diagnostics: {
      totalRows: rows.length,
      imported: contacts.length,
      skipped: skippedRows.length,
      skippedRows,
      missingHeaders,
      unmappedHeaders,
      rowErrors,
      papaParseMeta: result.meta,
      papaParseErrors: result.errors,
    },
  }
}
