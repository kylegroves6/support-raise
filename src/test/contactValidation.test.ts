import { describe, it, expect } from 'vitest'
import { validateEmail, validatePhone, validateGiftFields } from '../components/ContactModal'

describe('validateEmail', () => {
  it.each([
    'user@example.com',
    'user+tag@sub.example.co.uk',
    'first.last@domain.org',
    'a@b.cc',
  ])('accepts valid email: %s', email => {
    expect(validateEmail(email)).toBeNull()
  })

  it.each([
    'notanemail',
    'missing@tld',
    '@nodomain.com',
    'space in@email.com',
    'double@@at.com',
  ])('rejects invalid email: %s', email => {
    expect(validateEmail(email)).toBeTruthy()
  })

  it('returns null for empty string', () => {
    expect(validateEmail('')).toBeNull()
  })
})

describe('validatePhone', () => {
  it.each([
    '555-867-5309',
    '(555) 867-5309',
    '+1 555 867 5309',
    '+44 20 7946 0958',
    '5558675309',
    '2025551234',
  ])('accepts valid phone: %s', phone => {
    expect(validatePhone(phone)).toBeNull()
  })

  it.each([
    'abc',
    '123',          // too short (< 7 digits)
    '12345678901234567', // too long (> 15 digits)
    'not-a-number!!',
  ])('rejects invalid phone: %s', phone => {
    expect(validatePhone(phone)).toBeTruthy()
  })

  it('returns null for empty string', () => {
    expect(validatePhone('')).toBeNull()
  })
})

describe('validateGiftFields', () => {
  describe('gift amount = 0 — no errors', () => {
    it('no errors when amount is 0', () => {
      expect(validateGiftFields(0, '', '', false, false)).toEqual({})
    })

    it('no errors when amount is 0 even with missing fields', () => {
      expect(validateGiftFields(0, '', '', false, false)).toEqual({})
    })
  })

  describe('gift amount > 0 — requires all three conditions', () => {
    it('errors when formOfGift missing', () => {
      const e = validateGiftFields(100, '', '2026-01-01', true, false)
      expect(e.formOfGift).toBeTruthy()
      expect(e.dateReceived).toBeUndefined()
      expect(e.partnerStatus).toBeUndefined()
    })

    it('errors when dateReceived missing', () => {
      const e = validateGiftFields(100, 'Check', '', true, false)
      expect(e.dateReceived).toBeTruthy()
      expect(e.formOfGift).toBeUndefined()
      expect(e.partnerStatus).toBeUndefined()
    })

    it('errors when neither financialPartner nor pledgedToGive is set', () => {
      const e = validateGiftFields(100, 'Check', '2026-01-01', false, false)
      expect(e.partnerStatus).toBeTruthy()
      expect(e.formOfGift).toBeUndefined()
      expect(e.dateReceived).toBeUndefined()
    })

    it('no partnerStatus error when financialPartner is true', () => {
      const e = validateGiftFields(100, 'Check', '2026-01-01', true, false)
      expect(e.partnerStatus).toBeUndefined()
    })

    it('no partnerStatus error when pledgedToGive is true', () => {
      const e = validateGiftFields(100, 'Check', '2026-01-01', false, true)
      expect(e.partnerStatus).toBeUndefined()
    })

    it('all three errors when all required fields are missing', () => {
      const e = validateGiftFields(100, '', '', false, false)
      expect(e.formOfGift).toBeTruthy()
      expect(e.dateReceived).toBeTruthy()
      expect(e.partnerStatus).toBeTruthy()
    })

    it('no errors when all required fields are present', () => {
      const e = validateGiftFields(250, 'Online Donation', '2026-03-15', true, false)
      expect(e).toEqual({})
    })

    it('Financial Partner and Pledged to Give are independent — both together is valid', () => {
      const e = validateGiftFields(100, 'Check', '2026-01-01', true, true)
      expect(e).toEqual({})
    })

    it('Pledged to Give alone does not require Financial Partner', () => {
      const e = validateGiftFields(50, 'Cash', '2026-05-01', false, true)
      expect(e).toEqual({})
    })
  })
})
