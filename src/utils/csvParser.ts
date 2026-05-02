import Papa from 'papaparse'
import { v4 as uuidv4 } from 'uuid'
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

const COLUMN_MAP: Record<string, keyof Contact> = {
  'Full Name': 'fullName',
  'Relationship': 'relationship',
  'Returning': 'returning',
  'Top Priority': 'topPriority',
  'Address Status': 'addressStatus',
  'Sent': 'sent',
  'Letter Address Name': 'letterAddressName',
  'Salutation': 'salutation',
  'Letter Printed?': 'letterPrinted',
  'Main Envelope Printed?': 'mainEnvelopePrinted',
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
  'returning', 'sent', 'letterPrinted', 'mainEnvelopePrinted',
  'thankYouSent', 'followedUp', 'responded', 'financialPartner', 'prayerPartner',
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

export function exportTemplate(): void {
  const csv = Papa.unparse([], { columns: Object.keys(COLUMN_MAP) })
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'contacts-import-template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export function exportCSV(contacts: Contact[]): void {
  const rows = contacts.map(c => {
    const row: Record<string, string> = {}
    for (const [field, csvCol] of Object.entries(COLUMN_MAP_INVERSE)) {
      const key = field as keyof Contact
      const val = c[key]
      if (BOOL_FIELDS.has(key)) {
        row[csvCol] = val ? 'Yes' : 'No'
      } else if (key === 'giftAmount') {
        row[csvCol] = val != null ? String(val) : ''
      } else {
        row[csvCol] = val != null ? String(val) : ''
      }
    }
    return row
  })

  const csv = Papa.unparse(rows, { columns: Object.keys(COLUMN_MAP) })
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
      const val = row[csvCol]
      try {
        if (field === 'topPriority') {
          mapped[field] = parseIntVal(val)
        } else if (field === 'giftAmount') {
          mapped[field] = parseGiftAmount(val)
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

    contacts.push({ id: uuidv4(), ...mapped } as Contact)
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
