import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useContacts } from '../hooks/useContacts'
import type { Contact } from '../types'

// ── Supabase mock ────────────────────────────────────────────────────────────

const { mockFrom, FAKE_USER_ID } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  FAKE_USER_ID: 'user-abc-123',
}))

vi.mock('../lib/supabase', () => ({
  supabase: { from: mockFrom, auth: {} },
}))

vi.mock('../lib/auth', () => ({
  getCurrentUserId: vi.fn().mockResolvedValue(FAKE_USER_ID),
}))

// ── Query builder ─────────────────────────────────────────────────────────────
// The hook chains calls like: supabase.from(t).select(...).eq(...).order(...)
// and awaits the whole chain. We make each method return the same builder and
// make the builder itself thenable.

function makeBuilder(result: { data: unknown; error: unknown }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b: any = {}
  const self = () => b
  b.select = vi.fn(self)
  b.insert = vi.fn(self)
  b.update = vi.fn(self)
  b.upsert = vi.fn(self)
  b.delete = vi.fn(self)
  b.eq = vi.fn(self)
  b.in = vi.fn(self)
  b.not = vi.fn(self)
  b.order = vi.fn(self)
  b.single = vi.fn().mockResolvedValue(result)
  // Thenability: lets `await builder` resolve directly
  b.then = (resolve: (v: typeof result) => unknown) =>
    Promise.resolve(result).then(resolve)
  return b
}

const TRIP_ID = 'trip-xyz-456'

// ── Data helpers ─────────────────────────────────────────────────────────────

function makeContact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: 'contact-1',
    firstName: 'Alice',
    lastName: 'Example',
    organization: undefined,
    relationship: 'Friend',
    returning: false,
    topPriority: null,
    addressStatus: '',
    salutation: '',
    notes: '',
    streetAddress: '',
    city: '',
    state: '',
    zip: '',
    country: '',
    concatenatedAddress: '',
    phone: '',
    email: '',
    sent: false,
    thankYouSent: false,
    followedUp: false,
    responded: false,
    financialPartner: false,
    prayerPartner: false,
    pledgedToGive: false,
    formOfGift: '',
    giftAmount: 0,
    dateReceived: '',
    contactTripId: 'ct-1',
    ...overrides,
  }
}

function contactDbRow(id = 'contact-1', firstName = 'Alice', lastName = 'Example') {
  return {
    id,
    user_id: FAKE_USER_ID,
    first_name: firstName,
    last_name: lastName,
    organization: null,
    relationship: 'Friend',
    top_priority: null,
    address_status: '',
    salutation: '',
    notes: '',
    street_address: '',
    city: '',
    state: '',
    zip: '',
    country: '',
    concatenated_address: '',
    phone: '',
    email: '',
    created_at: '2026-05-10T00:00:00Z',
    updated_at: '2026-05-10T00:00:00Z',
    contact_trips: [] as unknown[],
  }
}

function ctDbRow(contactId = 'contact-1', overrides: Record<string, unknown> = {}) {
  return {
    id: 'ct-1',
    trip_id: TRIP_ID,
    contact_id: contactId,
    user_id: FAKE_USER_ID,
    sent: false,
    thank_you_sent: false,
    call_made: false,
    responded: false,
    financial_partner: false,
    prayer_partner: false,
    pledged_to_give: false,
    form_of_gift: '',
    gift_amount: 0,
    date_received: '',
    ...overrides,
  }
}

// Empty initial load — returns [] so the hook useEffect succeeds with no contacts
function emptyLoadBuilder() {
  return makeBuilder({ data: [], error: null })
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ── Tests ────────────────────────────────────────────────────────────────────

describe('initial load', () => {
  it('fetches contacts filtered by user_id', async () => {
    const dbRow = { ...contactDbRow(), contact_trips: [ctDbRow()] }
    mockFrom.mockReturnValue(makeBuilder({ data: [dbRow], error: null }))

    const { result } = renderHook(() => useContacts(TRIP_ID))
    await act(async () => { await new Promise(r => setTimeout(r, 0)) })

    expect(mockFrom).toHaveBeenCalledWith('contacts')
    const builder = (mockFrom as MockedFunction<typeof mockFrom>).mock.results[0].value
    expect(builder.eq).toHaveBeenCalledWith('user_id', FAKE_USER_ID)
    expect(result.current.contacts).toHaveLength(1)
    expect(result.current.contacts[0].firstName).toBe('Alice')
    expect(result.current.contacts[0].lastName).toBe('Example')
    expect(result.current.loading).toBe(false)
  })
})

describe('addContact', () => {
  it('inserts to contacts then contact_trips, does not send id field, updates state', async () => {
    const contactRow = contactDbRow()
    const ct = ctDbRow()

    // Call order: (0) initial load, (1) contacts insert, (2) contact_trips insert, (3) activity_log insert
    mockFrom
      .mockReturnValueOnce(emptyLoadBuilder())
      .mockReturnValueOnce(makeBuilder({ data: contactRow, error: null })) // contacts insert → .single()
      .mockReturnValueOnce(makeBuilder({ data: ct, error: null }))         // contact_trips insert → .single()
      .mockReturnValueOnce(makeBuilder({ data: null, error: null }))       // activity_log insert

    const { result } = renderHook(() => useContacts(TRIP_ID))
    await act(async () => { await new Promise(r => setTimeout(r, 0)) })

    await act(async () => {
      await result.current.addContact({ firstName: 'Alice', lastName: 'Example', relationship: 'Friend' })
    })

    // Call index 1 is the contacts insert
    const contactsBuilder = (mockFrom as MockedFunction<typeof mockFrom>).mock.results[1].value
    const insertArg = contactsBuilder.insert.mock.calls[0][0] as Record<string, unknown>
    expect(insertArg).not.toHaveProperty('id')
    expect(insertArg).toHaveProperty('user_id', FAKE_USER_ID)
    expect(insertArg).toHaveProperty('first_name', 'Alice')
    expect(insertArg).toHaveProperty('last_name', 'Example')

    expect(result.current.contacts).toHaveLength(1)
    expect(result.current.contacts[0].firstName).toBe('Alice')
    expect(result.current.contacts[0].lastName).toBe('Example')
  })

  it('throws and does not update state when contacts insert fails', async () => {
    mockFrom
      .mockReturnValueOnce(emptyLoadBuilder())
      .mockReturnValue(makeBuilder({ data: null, error: { message: 'insert failed' } }))

    const { result } = renderHook(() => useContacts(TRIP_ID))
    await act(async () => { await new Promise(r => setTimeout(r, 0)) })

    await act(async () => {
      await expect(result.current.addContact({ firstName: 'Bob' })).rejects.toMatchObject({ message: 'insert failed' })
    })

    expect(result.current.contacts).toHaveLength(0)
  })
})

describe('updateContact', () => {
  it('patches only provided fields in contacts and contact_trips', async () => {
    const updatedContact = { ...contactDbRow(), first_name: 'Alice', last_name: 'Updated' }
    const ct = ctDbRow('contact-1', { gift_amount: 100 })

    // (0) initial load, (1) contacts update, (2) contact_trips upsert, (3) activity_log insert
    mockFrom
      .mockReturnValueOnce(emptyLoadBuilder())
      .mockReturnValueOnce(makeBuilder({ data: updatedContact, error: null }))
      .mockReturnValueOnce(makeBuilder({ data: ct, error: null }))
      .mockReturnValueOnce(makeBuilder({ data: null, error: null }))

    const { result } = renderHook(() => useContacts(TRIP_ID))
    await act(async () => { await new Promise(r => setTimeout(r, 0)) })

    await act(async () => {
      await result.current.updateContact('contact-1', { firstName: 'Alice', lastName: 'Updated', giftAmount: 100 })
    })

    const contactsBuilder = (mockFrom as MockedFunction<typeof mockFrom>).mock.results[1].value
    expect(contactsBuilder.update.mock.calls[0][0]).toMatchObject({ first_name: 'Alice', last_name: 'Updated' })

    const ctBuilder = (mockFrom as MockedFunction<typeof mockFrom>).mock.results[2].value
    expect(ctBuilder.upsert.mock.calls[0][0]).toMatchObject({ gift_amount: 100 })
  })
})

describe('deleteContact', () => {
  it('removes contact from state after successful delete', async () => {
    const dbRow = { ...contactDbRow(), contact_trips: [ctDbRow()] }
    mockFrom
      .mockReturnValueOnce(makeBuilder({ data: [dbRow], error: null })) // initial load
      .mockReturnValueOnce(makeBuilder({ data: null, error: null }))    // delete

    const { result } = renderHook(() => useContacts(TRIP_ID))
    await act(async () => { await new Promise(r => setTimeout(r, 0)) })
    expect(result.current.contacts).toHaveLength(1)

    await act(async () => {
      await result.current.deleteContact('contact-1')
    })

    expect(result.current.contacts).toHaveLength(0)
  })
})

describe('replaceAll (B1 fix)', () => {
  it('inserts new contacts BEFORE deleting old ones', async () => {
    const newContact = makeContact({ id: 'contact-new', firstName: 'New', lastName: 'Person' })
    const newDbRow = { ...contactDbRow('contact-new', 'New', 'Person'), contact_trips: [] }
    const newCt = ctDbRow('contact-new')

    const callOrder: string[] = []

    // (0) initial load
    mockFrom.mockReturnValueOnce(emptyLoadBuilder())

    // Subsequent calls track insert vs delete order
    mockFrom.mockImplementation((table: string) => {
      const b = makeBuilder({ data: null, error: null })
      b.insert = vi.fn(() => {
        callOrder.push(`insert:${table}`)
        if (table === 'contacts') return makeBuilder({ data: [newDbRow], error: null })
        if (table === 'contact_trips') return makeBuilder({ data: [newCt], error: null })
        return makeBuilder({ data: null, error: null })
      })
      b.delete = vi.fn(() => {
        callOrder.push(`delete:${table}`)
        return makeBuilder({ data: null, error: null })
      })
      return b
    })

    const { result } = renderHook(() => useContacts(TRIP_ID))
    await act(async () => { await new Promise(r => setTimeout(r, 0)) })

    await act(async () => {
      await result.current.replaceAll([newContact])
    })

    const firstInsert = callOrder.findIndex(c => c === 'insert:contacts')
    const deletion = callOrder.findIndex(c => c === 'delete:contacts')
    expect(firstInsert).toBeGreaterThanOrEqual(0)
    expect(deletion).toBeGreaterThanOrEqual(0)
    // The key invariant: inserts happen before the delete
    expect(firstInsert).toBeLessThan(deletion)
  })

  it('does not delete existing contacts when insert fails', async () => {
    const newContact = makeContact({ firstName: 'New', lastName: 'Person' })
    const deleteCalls: string[] = []

    mockFrom.mockReturnValueOnce(emptyLoadBuilder())
    mockFrom.mockImplementation((table: string) => {
      const b = makeBuilder({ data: null, error: null })
      b.insert = vi.fn(() => makeBuilder({ data: null, error: { message: 'insert failed' } }))
      b.delete = vi.fn(() => {
        deleteCalls.push(table)
        return makeBuilder({ data: null, error: null })
      })
      return b
    })

    const { result } = renderHook(() => useContacts(TRIP_ID))
    await act(async () => { await new Promise(r => setTimeout(r, 0)) })

    await act(async () => {
      await expect(result.current.replaceAll([newContact])).rejects.toMatchObject({ message: 'insert failed' })
    })

    expect(deleteCalls).not.toContain('contacts')
  })
})
