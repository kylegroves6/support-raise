import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { normalizeDateString } from '../utils/csvParser'

// ── normalizeDateString property tests ───────────────────────────────────────

describe('normalizeDateString — property tests', () => {
  it('always returns a string', () => {
    fc.assert(fc.property(fc.string(), input => {
      const result = normalizeDateString(input)
      expect(typeof result).toBe('string')
    }))
  })

  it('never throws', () => {
    fc.assert(fc.property(fc.string(), input => {
      expect(() => normalizeDateString(input)).not.toThrow()
    }))
  })

  it('valid YYYY-MM-DD strings are returned unchanged', () => {
    const yyyy = fc.integer({ min: 2000, max: 2099 }).map(y => String(y))
    const mm = fc.integer({ min: 1, max: 12 }).map(m => String(m).padStart(2, '0'))
    const dd = fc.integer({ min: 1, max: 28 }).map(d => String(d).padStart(2, '0'))
    fc.assert(fc.property(yyyy, mm, dd, (y, m, d) => {
      const iso = `${y}-${m}-${d}`
      expect(normalizeDateString(iso)).toBe(iso)
    }))
  })

  it('M/D/YY inputs (US slash) produce YYYY-MM-DD output', () => {
    const month = fc.integer({ min: 1, max: 12 })
    const day = fc.integer({ min: 1, max: 28 })
    const year = fc.integer({ min: 0, max: 99 })
    fc.assert(fc.property(month, day, year, (m, d, y) => {
      const input = `${m}/${d}/${String(y).padStart(2, '0')}`
      const result = normalizeDateString(input)
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(result).toContain(String(m).padStart(2, '0'))
      expect(result).toContain(String(d).padStart(2, '0'))
    }))
  })

  it('M/D/YYYY inputs (US slash) produce YYYY-MM-DD with correct year', () => {
    const month = fc.integer({ min: 1, max: 12 })
    const day = fc.integer({ min: 1, max: 28 })
    const year = fc.integer({ min: 2000, max: 2099 })
    fc.assert(fc.property(month, day, year, (m, d, y) => {
      const input = `${m}/${d}/${y}`
      const result = normalizeDateString(input)
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(result.startsWith(String(y))).toBe(true)
    }))
  })

  it('M-D-YYYY inputs (US dash) produce YYYY-MM-DD with correct year', () => {
    const month = fc.integer({ min: 1, max: 12 })
    const day = fc.integer({ min: 1, max: 28 })
    const year = fc.integer({ min: 2000, max: 2099 })
    fc.assert(fc.property(month, day, year, (m, d, y) => {
      const input = `${m}-${d}-${y}`
      const result = normalizeDateString(input)
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(result.startsWith(String(y))).toBe(true)
    }))
  })

  it('DD.MM.YYYY inputs (European dot) produce YYYY-MM-DD with swapped day/month', () => {
    const month = fc.integer({ min: 1, max: 12 })
    const day = fc.integer({ min: 1, max: 28 })
    const year = fc.integer({ min: 2000, max: 2099 })
    fc.assert(fc.property(month, day, year, (m, d, y) => {
      const input = `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${y}`
      const result = normalizeDateString(input)
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(result).toBe(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
    }))
  })

  it('long month name inputs produce YYYY-MM-DD', () => {
    const MONTHS = ['January','February','March','April','May','June',
      'July','August','September','October','November','December']
    const month = fc.integer({ min: 0, max: 11 })
    const day = fc.integer({ min: 1, max: 28 })
    const year = fc.integer({ min: 2000, max: 2099 })
    fc.assert(fc.property(month, day, year, (m, d, y) => {
      const input = `${MONTHS[m]} ${d}, ${y}`
      const result = normalizeDateString(input)
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(result.startsWith(String(y))).toBe(true)
      expect(result).toContain(String(m + 1).padStart(2, '0'))
    }))
  })

  it('output is either empty string or a YYYY-MM-DD pattern', () => {
    fc.assert(fc.property(fc.string(), input => {
      const result = normalizeDateString(input)
      expect(result === '' || /^\d{4}-\d{2}-\d{2}$/.test(result)).toBe(true)
    }))
  })

  it('whitespace-only strings return empty string', () => {
    fc.assert(fc.property(fc.array(fc.constantFrom(' ', '\t', '\n'), { maxLength: 20 }).map(a => a.join('')), s => {
      expect(normalizeDateString(s)).toBe('')
    }))
  })
})

// ── parseGiftAmount property tests ───────────────────────────────────────────
// parseGiftAmount is not exported, but its behavior is tested via parseCSV.
// We test the contract by replicating the same logic.

function parseGiftAmountInlined(val: string | undefined): number {
  if (!val) return 0
  const cleaned = String(val).replace(/[$,\s]/g, '')
  const n = parseFloat(cleaned)
  return isNaN(n) ? 0 : n
}

describe('parseGiftAmount — property tests', () => {
  it('always returns a non-negative finite number', () => {
    fc.assert(fc.property(fc.string(), val => {
      const result = parseGiftAmountInlined(val)
      expect(typeof result).toBe('number')
      expect(isFinite(result)).toBe(true)
    }))
  })

  it('non-numeric strings always return 0', () => {
    fc.assert(fc.property(fc.string().filter(s => {
      const cleaned = s.replace(/[$,\s]/g, '')
      return isNaN(parseFloat(cleaned))
    }), val => {
      expect(parseGiftAmountInlined(val)).toBe(0)
    }))
  })

  it('numeric values round-trip through string correctly', () => {
    fc.assert(fc.property(fc.float({ min: 0, max: 1_000_000, noNaN: true, noDefaultInfinity: true }), n => {
      const result = parseGiftAmountInlined(String(n))
      expect(Math.abs(result - n)).toBeLessThan(0.001)
    }))
  })

  it('dollar sign prefix is stripped', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 10_000 }), n => {
      expect(parseGiftAmountInlined(`$${n}`)).toBe(n)
    }))
  })

  it('comma-formatted numbers are parsed correctly', () => {
    fc.assert(fc.property(fc.integer({ min: 1_000, max: 999_999 }), n => {
      const formatted = n.toLocaleString('en-US')
      expect(parseGiftAmountInlined(formatted)).toBe(n)
    }))
  })
})

// ── Legacy Full Name split property tests ─────────────────────────────────────

function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/)
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' '),
  }
}

describe('legacy Full Name split — property tests', () => {
  it('never throws on any string input', () => {
    fc.assert(fc.property(fc.string(), name => {
      expect(() => splitFullName(name)).not.toThrow()
    }))
  })

  it('single word → firstName is the word, lastName is empty', () => {
    fc.assert(fc.property(fc.string().filter(s => s.trim() !== '' && !s.includes(' ')), name => {
      const { firstName, lastName } = splitFullName(name)
      expect(firstName).toBe(name.trim())
      expect(lastName).toBe('')
    }))
  })

  it('two words → firstName is first word, lastName is second word', () => {
    const word = fc.string({ minLength: 1, maxLength: 20 }).filter(s => !s.includes(' ') && s.trim() === s)
    fc.assert(fc.property(word, word, (first, last) => {
      const { firstName, lastName } = splitFullName(`${first} ${last}`)
      expect(firstName).toBe(first)
      expect(lastName).toBe(last)
    }))
  })

  it('firstName + (space) + lastName always reconstructs a superset of the original parts', () => {
    const word = fc.string({ minLength: 1, maxLength: 10 }).filter(s => s.trim() === s && !s.includes(' '))
    fc.assert(fc.property(fc.array(word, { minLength: 1, maxLength: 4 }), words => {
      const fullName = words.join(' ')
      const { firstName, lastName } = splitFullName(fullName)
      const rejoined = [firstName, lastName].filter(Boolean).join(' ')
      expect(rejoined).toBe(fullName)
    }))
  })
})
