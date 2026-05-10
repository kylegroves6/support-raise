import { describe, it, expect } from 'vitest'
import { parseCSV, buildTemplateCSV, buildExportCSV, normalizeDateString } from '../utils/csvParser'
import type { Contact } from '../types'

const ALL_HEADERS = [
  'Full Name', 'Relationship', 'Returning', 'Top Priority', 'Address Status',
  'Sent', 'Letter Address Name', 'Salutation', 'Thank-you Sent?', 'Notes',
  'Street Address', 'City', 'State', 'Zip', 'Country', 'Concatenated Address',
  'Phone', 'Followed Up?', 'Email Address', 'Financial Partner', 'Prayer Partner',
  'Pledged to Give', 'Form of Gift Received', 'Gift Amount', 'Date Received',
]

function makeRow(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    'Full Name': 'Jane Doe',
    'Relationship': 'Church Friend',
    'Returning': 'No',
    'Top Priority': '',
    'Address Status': 'Confirmed',
    'Sent': 'No',
    'Letter Address Name': 'The Does',
    'Salutation': 'Jane',
    'Thank-you Sent?': 'No',
    'Notes': '',
    'Street Address': '123 Main St',
    'City': 'Springfield',
    'State': 'IL',
    'Zip': '62701',
    'Country': 'USA',
    'Concatenated Address': '',
    'Phone': '555-1234',
    'Followed Up?': 'No',
    'Email Address': 'jane@example.com',
    'Financial Partner': 'No',
    'Prayer Partner': 'No',
    'Pledged to Give': 'No',
    'Form of Gift Received': '',
    'Gift Amount': '',
    'Date Received': '',
    ...overrides,
  }
}

function buildCSV(rows: Record<string, string>[], headers = ALL_HEADERS): string {
  const headerLine = headers.join(',')
  const dataLines = rows.map(row =>
    headers.map(h => `"${(row[h] ?? '').replace(/"/g, '""')}"`).join(',')
  )
  return [headerLine, ...dataLines].join('\n')
}

describe('parseCSV', () => {
  it('happy path: parses a valid row into a contact', () => {
    const csv = buildCSV([makeRow({ 'Full Name': 'John Smith', 'Relationship': 'Family' })])
    const { contacts, diagnostics } = parseCSV(csv)
    expect(contacts).toHaveLength(1)
    expect(contacts[0].fullName).toBe('John Smith')
    expect(contacts[0].relationship).toBe('Family')
    expect(diagnostics.imported).toBe(1)
    expect(diagnostics.skipped).toBe(0)
  })

  describe('boolean field parsing', () => {
    it.each([
      ['Yes', true],
      ['yes', true],
      ['true', true],
      ['1', true],
      ['No', false],
      ['no', false],
      ['false', false],
      ['0', false],
      ['', false],
    ])('Sent = %s → %s', (val, expected) => {
      const csv = buildCSV([makeRow({ 'Sent': val })])
      const { contacts } = parseCSV(csv)
      expect(contacts[0].sent).toBe(expected)
    })

    it.each([
      ['Financial Partner', 'financialPartner'],
      ['Prayer Partner', 'prayerPartner'],
      ['Pledged to Give', 'pledgedToGive'],
      ['Returning', 'returning'],
      ['Thank-you Sent?', 'thankYouSent'],
    ])('%s field parses Yes/No', (csvCol, field) => {
      const yesCSV = buildCSV([makeRow({ [csvCol]: 'Yes' })])
      const noCSV = buildCSV([makeRow({ [csvCol]: 'No' })])
      expect((parseCSV(yesCSV).contacts[0] as Record<string, unknown>)[field]).toBe(true)
      expect((parseCSV(noCSV).contacts[0] as Record<string, unknown>)[field]).toBe(false)
    })
  })

  describe('giftAmount parsing', () => {
    it.each([
      ['$1,234.56', 1234.56],
      ['500', 500],
      ['$0', 0],
      ['', 0],
      ['  ', 0],
      ['N/A', 0],
    ])('"%s" → %s', (val, expected) => {
      const csv = buildCSV([makeRow({ 'Gift Amount': val })])
      const { contacts } = parseCSV(csv)
      expect(contacts[0].giftAmount).toBe(expected)
    })
  })

  describe('topPriority parsing', () => {
    it('parses a numeric string to number', () => {
      const csv = buildCSV([makeRow({ 'Top Priority': '3' })])
      const { contacts } = parseCSV(csv)
      expect(contacts[0].topPriority).toBe(3)
    })

    it('returns null for blank', () => {
      const csv = buildCSV([makeRow({ 'Top Priority': '' })])
      const { contacts } = parseCSV(csv)
      expect(contacts[0].topPriority).toBeNull()
    })
  })

  describe('row skipping', () => {
    it('skips a row with no fullName and no relationship', () => {
      const csv = buildCSV([
        makeRow({ 'Full Name': 'Valid Person', 'Relationship': 'Friend' }),
        makeRow({ 'Full Name': '', 'Relationship': '' }),
      ])
      const { contacts, diagnostics } = parseCSV(csv)
      expect(contacts).toHaveLength(1)
      expect(diagnostics.skipped).toBe(1)
      expect(diagnostics.skippedRows).toContain(3) // row 2 in data = line 3 in file
    })

    it('keeps a row that has a relationship but no fullName', () => {
      const csv = buildCSV([makeRow({ 'Full Name': '', 'Relationship': 'Friend' })])
      const { contacts } = parseCSV(csv)
      expect(contacts).toHaveLength(1)
    })

    it('keeps a row that has a fullName but no relationship', () => {
      const csv = buildCSV([makeRow({ 'Full Name': 'Solo Name', 'Relationship': '' })])
      const { contacts } = parseCSV(csv)
      expect(contacts).toHaveLength(1)
    })
  })

  describe('diagnostics', () => {
    it('reports unknown columns in unmappedHeaders', () => {
      const headers = [...ALL_HEADERS, 'Favorite Color']
      const row = { ...makeRow(), 'Favorite Color': 'blue' }
      const csv = buildCSV([row], headers)
      const { diagnostics } = parseCSV(csv)
      expect(diagnostics.unmappedHeaders).toContain('Favorite Color')
    })

    it('reports missing expected columns in missingHeaders', () => {
      const headers = ALL_HEADERS.filter(h => h !== 'Gift Amount')
      const csv = buildCSV([makeRow()], headers)
      const { diagnostics } = parseCSV(csv)
      expect(diagnostics.missingHeaders).toContain('Gift Amount')
    })

    it('diagnostics.imported matches contacts length', () => {
      const csv = buildCSV([makeRow(), makeRow({ 'Full Name': 'Second Person' })])
      const { contacts, diagnostics } = parseCSV(csv)
      expect(diagnostics.imported).toBe(contacts.length)
    })
  })

  describe('column aliases', () => {
    it('"Followed Up?" maps to followedUp', () => {
      const csv = buildCSV([makeRow({ 'Followed Up?': 'Yes' })])
      const { contacts } = parseCSV(csv)
      expect(contacts[0].followedUp).toBe(true)
    })

    it('"Call Made?" also maps to followedUp', () => {
      const headers = [...ALL_HEADERS.filter(h => h !== 'Followed Up?'), 'Call Made?']
      const row = { ...makeRow(), 'Call Made?': 'Yes' }
      const csv = buildCSV([row], headers)
      const { contacts } = parseCSV(csv)
      expect(contacts[0].followedUp).toBe(true)
    })
  })

  it('parsed contacts do not have an id field set', () => {
    const csv = buildCSV([makeRow()])
    const { contacts } = parseCSV(csv)
    expect(contacts[0].id).toBeUndefined()
  })
})

describe('buildTemplateCSV', () => {
  it('produces a CSV with the expected header columns', () => {
    const csv = buildTemplateCSV()
    const firstLine = csv.split('\n')[0]
    expect(firstLine).toContain('Full Name')
    expect(firstLine).toContain('Gift Amount')
    expect(firstLine).toContain('Followed Up?')
  })

  it('does not include the Call Made? alias column', () => {
    const csv = buildTemplateCSV()
    expect(csv).not.toContain('Call Made?')
  })

  it('includes exactly one data row (the example)', () => {
    const csv = buildTemplateCSV()
    const lines = csv.split('\n').filter(Boolean)
    expect(lines).toHaveLength(2) // header + 1 example row
  })

  it('example row has John Smith as the full name', () => {
    const csv = buildTemplateCSV()
    expect(csv).toContain('John Smith')
  })

  it('round-trips: the example row can be parsed back by parseCSV', () => {
    const csv = buildTemplateCSV()
    const { contacts, diagnostics } = parseCSV(csv)
    expect(diagnostics.skipped).toBe(0)
    expect(contacts).toHaveLength(1)
    expect(contacts[0].fullName).toBe('John Smith')
    expect(contacts[0].topPriority).toBe(1)
  })
})

describe('buildExportCSV', () => {
  const base: Contact = {
    id: 'test-id',
    fullName: 'Jane Doe',
    relationship: 'Friend',
    returning: false,
    topPriority: null,
    addressStatus: 'Confirmed',
    letterAddressName: 'Jane Doe',
    salutation: 'Jane',
    notes: '',
    streetAddress: '1 Oak Ave',
    city: 'Portland',
    state: 'OR',
    zip: '97201',
    country: 'USA',
    concatenatedAddress: '',
    phone: '',
    email: 'jane@example.com',
    sent: true,
    thankYouSent: false,
    followedUp: true,
    responded: false,
    financialPartner: true,
    prayerPartner: false,
    pledgedToGive: false,
    formOfGift: 'Check',
    giftAmount: 250,
    dateReceived: '2026-01-15',
  }

  it('serializes boolean fields as Yes/No', () => {
    const csv = buildExportCSV([base])
    expect(csv).toContain('Yes') // sent, followedUp, financialPartner
    expect(csv).toContain('No')  // others
  })

  it('serializes sent=true as Yes', () => {
    const csv = buildExportCSV([base])
    const { contacts } = parseCSV(csv)
    expect(contacts[0].sent).toBe(true)
  })

  it('serializes financialPartner=true as Yes and round-trips', () => {
    const csv = buildExportCSV([base])
    const { contacts } = parseCSV(csv)
    expect(contacts[0].financialPartner).toBe(true)
  })

  it('serializes giftAmount as a plain number string', () => {
    const csv = buildExportCSV([base])
    const { contacts } = parseCSV(csv)
    expect(contacts[0].giftAmount).toBe(250)
  })

  it('round-trips all scalar string fields', () => {
    const csv = buildExportCSV([base])
    const { contacts } = parseCSV(csv)
    expect(contacts[0].fullName).toBe('Jane Doe')
    expect(contacts[0].city).toBe('Portland')
    expect(contacts[0].email).toBe('jane@example.com')
  })

  it('handles multiple contacts', () => {
    const second: Contact = { ...base, fullName: 'Bob Smith', giftAmount: 0, sent: false }
    const csv = buildExportCSV([base, second])
    const { contacts } = parseCSV(csv)
    expect(contacts).toHaveLength(2)
    expect(contacts[1].fullName).toBe('Bob Smith')
    expect(contacts[1].sent).toBe(false)
  })

  it('produces a header row that parseCSV recognizes with no missing headers', () => {
    const csv = buildExportCSV([base])
    const { diagnostics } = parseCSV(csv)
    // Call Made? is intentionally absent (it's an alias); everything else should be present
    const missing = diagnostics.missingHeaders.filter(h => h !== 'Call Made?')
    expect(missing).toHaveLength(0)
  })
})

describe('normalizeDateString', () => {
  it.each([
    // Already correct — pass through
    ['2026-03-12', '2026-03-12'],
    ['2026-04-01', '2026-04-01'],
    // M/D/YY — the format found in production data
    ['3/12/26',   '2026-03-12'],
    ['3/14/26',   '2026-03-14'],
    ['4/1/26',    '2026-04-01'],
    ['4/10/26',   '2026-04-10'],
    // M/D/YYYY — four-digit year variant
    ['3/12/2026', '2026-03-12'],
    ['4/1/2026',  '2026-04-01'],
    // Empty / junk — return empty string
    ['',    ''],
    ['-',   ''],
    ['N/A', ''],
    [undefined, ''],
  ])('"%s" → "%s"', (input, expected) => {
    expect(normalizeDateString(input)).toBe(expected)
  })

  it('parseCSV normalizes M/D/YY dates on import', () => {
    const csv = buildCSV([makeRow({ 'Date Received': '3/12/26' })])
    const { contacts } = parseCSV(csv)
    expect(contacts[0].dateReceived).toBe('2026-03-12')
  })

  it('parseCSV normalizes M/D/YYYY dates on import', () => {
    const csv = buildCSV([makeRow({ 'Date Received': '4/1/2026' })])
    const { contacts } = parseCSV(csv)
    expect(contacts[0].dateReceived).toBe('2026-04-01')
  })

  it('parseCSV passes through already-correct YYYY-MM-DD dates', () => {
    const csv = buildCSV([makeRow({ 'Date Received': '2026-04-30' })])
    const { contacts } = parseCSV(csv)
    expect(contacts[0].dateReceived).toBe('2026-04-30')
  })

  it('parseCSV clears junk date values to empty string', () => {
    const csv = buildCSV([makeRow({ 'Date Received': '-' })])
    const { contacts } = parseCSV(csv)
    expect(contacts[0].dateReceived).toBe('')
  })
})
