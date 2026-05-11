import { describe, it, expect } from 'vitest'
import { parseCSV, buildTemplateCSV, buildExportCSV, normalizeDateString, normalizePhoneString } from '../utils/csvParser'
import type { Contact } from '../types'

// New-format headers (split name)
const ALL_HEADERS = [
  'First Name', 'Last Name', 'Organization', 'Relationship', 'Returning', 'Top Priority', 'Address Status',
  'Sent', 'Salutation', 'Thank-you Sent?', 'Notes',
  'Street Address', 'City', 'State', 'Zip', 'Country', 'Concatenated Address',
  'Phone', 'Followed Up?', 'Email Address', 'Financial Partner', 'Prayer Partner',
  'Pledged to Give', 'Form of Gift Received', 'Gift Amount', 'Date Received',
]

// Legacy-format headers (old Full Name column)
const LEGACY_HEADERS = [
  'Full Name', 'Relationship', 'Returning', 'Top Priority', 'Address Status',
  'Sent', 'Letter Address Name', 'Salutation', 'Thank-you Sent?', 'Notes',
  'Street Address', 'City', 'State', 'Zip', 'Country', 'Concatenated Address',
  'Phone', 'Followed Up?', 'Email Address', 'Financial Partner', 'Prayer Partner',
  'Pledged to Give', 'Form of Gift Received', 'Gift Amount', 'Date Received',
]

function makeRow(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    'First Name': 'Jane',
    'Last Name': 'Doe',
    'Organization': '',
    'Relationship': 'Church Friend',
    'Returning': 'No',
    'Top Priority': '',
    'Address Status': 'Confirmed',
    'Sent': 'No',
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

function makeLegacyRow(overrides: Record<string, string> = {}): Record<string, string> {
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
    const csv = buildCSV([makeRow({ 'First Name': 'John', 'Last Name': 'Smith', 'Relationship': 'Family' })])
    const { contacts, diagnostics } = parseCSV(csv)
    expect(contacts).toHaveLength(1)
    expect(contacts[0].firstName).toBe('John')
    expect(contacts[0].lastName).toBe('Smith')
    expect(contacts[0].relationship).toBe('Family')
    expect(diagnostics.imported).toBe(1)
    expect(diagnostics.skipped).toBe(0)
  })

  describe('legacy Full Name backwards compat', () => {
    it('splits Full Name into firstName + lastName', () => {
      const csv = buildCSV([makeLegacyRow({ 'Full Name': 'John Smith' })], LEGACY_HEADERS)
      const { contacts } = parseCSV(csv)
      expect(contacts[0].firstName).toBe('John')
      expect(contacts[0].lastName).toBe('Smith')
    })

    it('handles single-word Full Name (no last name)', () => {
      const csv = buildCSV([makeLegacyRow({ 'Full Name': 'Cher' })], LEGACY_HEADERS)
      const { contacts } = parseCSV(csv)
      expect(contacts[0].firstName).toBe('Cher')
      expect(contacts[0].lastName).toBe('')
    })

    it('handles Full Name with multiple spaces (first word = first, rest = last)', () => {
      const csv = buildCSV([makeLegacyRow({ 'Full Name': 'Mary Ann Jones' })], LEGACY_HEADERS)
      const { contacts } = parseCSV(csv)
      expect(contacts[0].firstName).toBe('Mary')
      expect(contacts[0].lastName).toBe('Ann Jones')
    })
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
      expect((parseCSV(yesCSV).contacts[0] as unknown as Record<string, unknown>)[field]).toBe(true)
      expect((parseCSV(noCSV).contacts[0] as unknown as Record<string, unknown>)[field]).toBe(false)
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
    it('skips a row with no name and no relationship', () => {
      const csv = buildCSV([
        makeRow({ 'First Name': 'Valid', 'Last Name': 'Person', 'Relationship': 'Friend' }),
        makeRow({ 'First Name': '', 'Last Name': '', 'Organization': '', 'Relationship': '' }),
      ])
      const { contacts, diagnostics } = parseCSV(csv)
      expect(contacts).toHaveLength(1)
      expect(diagnostics.skipped).toBe(1)
      expect(diagnostics.skippedRows).toContain(3)
    })

    it('keeps a row that has a relationship but no name', () => {
      const csv = buildCSV([makeRow({ 'First Name': '', 'Last Name': '', 'Relationship': 'Friend' })])
      const { contacts } = parseCSV(csv)
      expect(contacts).toHaveLength(1)
    })

    it('keeps a row that has a first name but no relationship', () => {
      const csv = buildCSV([makeRow({ 'First Name': 'Solo', 'Relationship': '' })])
      const { contacts } = parseCSV(csv)
      expect(contacts).toHaveLength(1)
    })

    it('keeps a row that has only an organization', () => {
      const csv = buildCSV([makeRow({ 'First Name': '', 'Last Name': '', 'Organization': 'Acme Corp', 'Relationship': '' })])
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
      const csv = buildCSV([makeRow(), makeRow({ 'First Name': 'Second', 'Last Name': 'Person' })])
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
  it('produces a CSV with First Name / Last Name columns', () => {
    const csv = buildTemplateCSV()
    const firstLine = csv.split('\n')[0]
    expect(firstLine).toContain('First Name')
    expect(firstLine).toContain('Last Name')
    expect(firstLine).toContain('Gift Amount')
    expect(firstLine).toContain('Followed Up?')
  })

  it('does not include the Call Made? alias column', () => {
    const csv = buildTemplateCSV()
    expect(csv).not.toContain('Call Made?')
  })

  it('does not include the legacy Full Name column', () => {
    const csv = buildTemplateCSV()
    const firstLine = csv.split('\n')[0]
    expect(firstLine).not.toContain('Full Name')
  })

  it('includes exactly one data row (the example)', () => {
    const csv = buildTemplateCSV()
    const lines = csv.split('\n').filter(Boolean)
    expect(lines).toHaveLength(2)
  })

  it('example row has John / Smith as first/last name', () => {
    const csv = buildTemplateCSV()
    expect(csv).toContain('John')
    expect(csv).toContain('Smith')
  })

  it('round-trips: the example row can be parsed back by parseCSV', () => {
    const csv = buildTemplateCSV()
    const { contacts, diagnostics } = parseCSV(csv)
    expect(diagnostics.skipped).toBe(0)
    expect(contacts).toHaveLength(1)
    expect(contacts[0].firstName).toBe('John')
    expect(contacts[0].lastName).toBe('Smith')
    expect(contacts[0].topPriority).toBe(1)
  })
})

describe('buildExportCSV', () => {
  const base: Contact = {
    id: 'test-id',
    firstName: 'Jane',
    lastName: 'Doe',
    organization: undefined,
    relationship: 'Friend',
    returning: false,
    topPriority: null,
    addressStatus: 'Confirmed',
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
    expect(csv).toContain('Yes')
    expect(csv).toContain('No')
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

  it('round-trips firstName, lastName, and city', () => {
    const csv = buildExportCSV([base])
    const { contacts } = parseCSV(csv)
    expect(contacts[0].firstName).toBe('Jane')
    expect(contacts[0].lastName).toBe('Doe')
    expect(contacts[0].city).toBe('Portland')
    expect(contacts[0].email).toBe('jane@example.com')
  })

  it('handles multiple contacts', () => {
    const second: Contact = { ...base, firstName: 'Bob', lastName: 'Smith', giftAmount: 0, sent: false }
    const csv = buildExportCSV([base, second])
    const { contacts } = parseCSV(csv)
    expect(contacts).toHaveLength(2)
    expect(contacts[1].firstName).toBe('Bob')
    expect(contacts[1].lastName).toBe('Smith')
    expect(contacts[1].sent).toBe(false)
  })

  it('produces a header row that parseCSV recognizes with no missing headers', () => {
    const csv = buildExportCSV([base])
    const { diagnostics } = parseCSV(csv)
    const missing = diagnostics.missingHeaders.filter(h => h !== 'Call Made?' && h !== 'Full Name')
    expect(missing).toHaveLength(0)
  })
})

describe('normalizeDateString', () => {
  it.each([
    // ISO pass-through
    ['2026-03-12', '2026-03-12'],
    ['2026-04-01', '2026-04-01'],
    // US slash (Excel default) — M/D/YY and M/D/YYYY
    ['3/12/26',   '2026-03-12'],
    ['3/14/26',   '2026-03-14'],
    ['4/1/26',    '2026-04-01'],
    ['4/10/26',   '2026-04-10'],
    ['3/12/2026', '2026-03-12'],
    ['4/1/2026',  '2026-04-01'],
    ['12/31/2026', '2026-12-31'],
    // US dash — M-D-YYYY and M-D-YY
    ['3-12-2026',  '2026-03-12'],
    ['1-5-2026',   '2026-01-05'],
    ['12-31-26',   '2026-12-31'],
    ['3-12-26',    '2026-03-12'],
    // European dot — DD.MM.YYYY
    ['12.03.2026', '2026-03-12'],
    ['01.01.2026', '2026-01-01'],
    ['31.12.2026', '2026-12-31'],
    // Long month name
    ['January 5, 2026',   '2026-01-05'],
    ['March 12, 2026',    '2026-03-12'],
    ['December 31, 2026', '2026-12-31'],
    // Short month name
    ['Jan 5, 2026',  '2026-01-05'],
    ['Mar 12, 2026', '2026-03-12'],
    ['Dec 31 2026',  '2026-12-31'],
    // Junk / empty
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

describe('normalizePhoneString', () => {
  it.each([
    // 10-digit bare — canonical US format
    ['5558675309',          '555-867-5309'],
    // Already-formatted US with dashes
    ['555-867-5309',        '555-867-5309'],
    // Parens + space
    ['(555) 867-5309',      '555-867-5309'],
    // Dots
    ['555.867.5309',        '555-867-5309'],
    // With +1 country code
    ['+15558675309',        '555-867-5309'],
    // With 1 country code, no plus
    ['15558675309',         '555-867-5309'],
    // With +1 and formatting
    ['+1 (555) 867-5309',   '555-867-5309'],
    // Blank / undefined
    ['',                    ''],
    [undefined,             ''],
    ['   ',                 ''],
    // International — pass through as-is
    ['+44 20 7946 0958',    '+44 20 7946 0958'],
    ['+61 2 9876 5432',     '+61 2 9876 5432'],
    // International numbers whose digit count after stripping could collide with
    // the 10/11-digit US heuristic — must NOT be treated as US numbers.
    // UK mobile: +44 strips the + but leaves 12 digits → pass through
    ['+447911123456',       '+447911123456'],
    // Mexico: +52 + 10 digits = 12 digits total → pass through
    ['+5215551234567',      '+5215551234567'],
    // A bare 10-digit number that starts with a country-code-like prefix but has
    // no + — the function cannot distinguish it from a US number, so it normalizes.
    // This documents the known limitation: without a + prefix the function assumes US.
    ['0207946095',          '020-794-6095'],
  ])('"%s" → "%s"', (input, expected) => {
    expect(normalizePhoneString(input)).toBe(expected)
  })

  it('parseCSV normalizes phone on import (parens format)', () => {
    const csv = buildCSV([makeRow({ 'Phone': '(555) 867-5309' })])
    const { contacts } = parseCSV(csv)
    expect(contacts[0].phone).toBe('555-867-5309')
  })

  it('parseCSV normalizes phone on import (+1 country code)', () => {
    const csv = buildCSV([makeRow({ 'Phone': '+15558675309' })])
    const { contacts } = parseCSV(csv)
    expect(contacts[0].phone).toBe('555-867-5309')
  })

  it('parseCSV passes through blank phone as empty string', () => {
    const csv = buildCSV([makeRow({ 'Phone': '' })])
    const { contacts } = parseCSV(csv)
    expect(contacts[0].phone).toBe('')
  })
})
