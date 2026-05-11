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

// Normalizes US phone numbers to XXX-XXX-XXXX. Strips formatting characters
// and leading +1/1 country code. International numbers (not 10 or 11 digits
// after stripping) are passed through as-is.
export function normalizePhoneString(val: string | undefined): string {
  if (!val || val.trim() === '') return ''
  // Strip all formatting: spaces, parens, dots, dashes (keep digits and leading +)
  const stripped = val.trim().replace(/[\s().+-]/g, '')
  // US 11-digit with country code 1
  if (/^1\d{10}$/.test(stripped)) {
    const d = stripped.slice(1)
    return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`
  }
  // US 10-digit
  if (/^\d{10}$/.test(stripped)) {
    return `${stripped.slice(0, 3)}-${stripped.slice(3, 6)}-${stripped.slice(6)}`
  }
  // International or unrecognized — return trimmed original
  return val.trim()
}

// Normalizes date strings to YYYY-MM-DD. Handles formats that appear in
// real CSV exports from Excel, Google Sheets, phones, and manual entry:
//   YYYY-MM-DD            — ISO, pass through
//   M/D/YY, M/D/YYYY      — US slash (Excel default)
//   MM-DD-YYYY, M-D-YYYY  — US dash
//   MM-DD-YY, M-D-YY      — US dash short year
//   DD.MM.YYYY            — European dot (common in Google Sheets locale)
//   Month D, YYYY         — Long month name ("January 5, 2026")
//   Mon D, YYYY           — Short month name ("Jan 5, 2026")
// Junk values (blank, "-", "N/A", etc.) return empty string.
export function normalizeDateString(val: string | undefined): string {
  if (!val || val.trim() === '') return ''
  const s = val.trim()

  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s

  // M/D/YY or M/D/YYYY (US slash — Excel default)
  const slashUS = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/)
  if (slashUS) {
    const [, m, d, y] = slashUS
    const year = y.length === 2 ? `20${y}` : y
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  // MM-DD-YYYY or MM-DD-YY or M-D-YYYY or M-D-YY (US dash)
  const dashUS = s.match(/^(\d{1,2})-(\d{1,2})-(\d{2}|\d{4})$/)
  if (dashUS) {
    const [, m, d, y] = dashUS
    const year = y.length === 2 ? `20${y}` : y
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  // DD.MM.YYYY (European dot — Google Sheets with European locale)
  const dotEU = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (dotEU) {
    const [, d, m, y] = dotEU
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  // "Month D, YYYY" or "Mon D, YYYY" (long or short month name)
  const MONTHS: Record<string, string> = {
    january: '01', february: '02', march: '03', april: '04',
    may: '05', june: '06', july: '07', august: '08',
    september: '09', october: '10', november: '11', december: '12',
    jan: '01', feb: '02', mar: '03', apr: '04',
    jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  }
  const longMonth = s.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/)
  if (longMonth) {
    const [, monthStr, d, y] = longMonth
    const m = MONTHS[monthStr.toLowerCase()]
    if (m) return `${y}-${m}-${d.padStart(2, '0')}`
  }

  return ''
}

const COLUMN_MAP: Record<string, keyof Contact> = {
  // New split-name columns (preferred)
  'First Name': 'firstName',
  'Last Name': 'lastName',
  'Organization': 'organization',
  // Legacy column — backwards compat for old exports
  'Full Name': 'firstName',
  'Relationship': 'relationship',
  'Returning': 'returning',
  'Top Priority': 'topPriority',
  'Address Status': 'addressStatus',
  'Sent': 'sent',
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
    'First Name': 'John',
    'Last Name': 'Smith',
    'Organization': '',
    'Relationship': 'Family Friend',
    'Returning': 'No',
    'Top Priority': '1',
    'Address Status': 'Confirmed',
    'Sent': 'No',
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
  const columns = Object.keys(COLUMN_MAP).filter(col => col !== 'Call Made?' && col !== 'Full Name')
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

// Export columns (canonical new format — no legacy Full Name header)
const EXPORT_COLUMNS = Object.keys(COLUMN_MAP).filter(col => col !== 'Call Made?' && col !== 'Full Name')

export function buildExportCSV(contacts: Contact[]): string {
  const rows = contacts.map(c => {
    const row: Record<string, string> = {}
    for (const [csvCol, field] of Object.entries(COLUMN_MAP)) {
      if (csvCol === 'Call Made?' || csvCol === 'Full Name') continue
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
  return Papa.unparse(rows, { columns: EXPORT_COLUMNS })
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
  const hasLegacyFormat = detectedHeaders.includes('Full Name') && !detectedHeaders.includes('First Name')
  const expectedHeaders = Object.keys(COLUMN_MAP).filter(h => {
    if (hasLegacyFormat) return h !== 'First Name' && h !== 'Last Name' && h !== 'Organization'
    return h !== 'Full Name' && h !== 'Call Made?'
  })
  const missingHeaders = expectedHeaders.filter(h => !detectedHeaders.includes(h))
  const unmappedHeaders = detectedHeaders.filter(h => !COLUMN_MAP[h])

  const rows = result.data
  const contacts: Contact[] = []
  const skippedRows: number[] = []
  const rowErrors: ImportDiagnostics['rowErrors'] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const mapped: Partial<Contact> = {}

    // Track whether legacy Full Name column was present (needs splitting)
    const hasLegacyFullName = 'Full Name' in row && !('First Name' in row)

    for (const [csvCol, field] of Object.entries(COLUMN_MAP)) {
      if (!(csvCol in row)) continue
      if (csvCol === 'Full Name' && !hasLegacyFullName) continue
      const val = row[csvCol]
      try {
        if (field === 'topPriority') {
          mapped[field] = parseIntVal(val)
        } else if (field === 'giftAmount') {
          mapped[field] = parseGiftAmount(val)
        } else if (field === 'dateReceived') {
          mapped[field] = normalizeDateString(val)
        } else if (field === 'phone') {
          (mapped as Record<string, string>)[field] = normalizePhoneString(val)
        } else if (BOOL_FIELDS.has(field)) {
          (mapped as Record<string, boolean>)[field] = parseBool(val)
        } else {
          (mapped as Record<string, string>)[field] = val ? String(val).trim() : ''
        }
      } catch (err) {
        rowErrors.push({ row: i + 2, col: csvCol, val, error: (err as Error).message })
      }
    }

    // Split legacy Full Name into firstName / lastName
    if (hasLegacyFullName && mapped.firstName) {
      const parts = (mapped.firstName as string).split(' ')
      mapped.firstName = parts[0]
      if (!mapped.lastName) mapped.lastName = parts.slice(1).join(' ')
    }

    if (!mapped.firstName && !mapped.lastName && !mapped.organization && !mapped.relationship) {
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
