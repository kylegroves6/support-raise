import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Contact } from '../types'

// Permanent contact columns (no per-trip fields)
const CONTACT_CAMEL_TO_SNAKE: Record<string, string> = {
  fullName: 'full_name',
  relationship: 'relationship',
  topPriority: 'top_priority',
  addressStatus: 'address_status',
  letterAddressName: 'letter_address_name',
  salutation: 'salutation',
  notes: 'notes',
  streetAddress: 'street_address',
  city: 'city',
  state: 'state',
  zip: 'zip',
  country: 'country',
  concatenatedAddress: 'concatenated_address',
  phone: 'phone',
  email: 'email',
}

// Per-trip columns that live in contact_trips
const TRIP_CAMEL_TO_SNAKE: Record<string, string> = {
  sent: 'sent',
  thankYouSent: 'thank_you_sent',
  followedUp: 'call_made',
  responded: 'responded',
  financialPartner: 'financial_partner',
  prayerPartner: 'prayer_partner',
  pledgedToGive: 'pledged_to_give',
  formOfGift: 'form_of_gift',
  giftAmount: 'gift_amount',
  dateReceived: 'date_received',
}

type DbRow = Record<string, unknown>

const TRIP_DEFAULTS = {
  sent: false, thankYouSent: false,
  followedUp: false, responded: false, financialPartner: false, prayerPartner: false,
  pledgedToGive: false, formOfGift: '', giftAmount: 0, dateReceived: '',
}

function fromContactRow(row: DbRow): Omit<Contact, keyof typeof TRIP_DEFAULTS | 'contactTripId'> {
  return {
    id: row['id'] as string,
    fullName: (row['full_name'] as string) ?? '',
    relationship: (row['relationship'] as string) ?? '',
    returning: (row['returning'] as boolean) ?? false,
    topPriority: row['top_priority'] != null ? Number(row['top_priority']) : null,
    addressStatus: (row['address_status'] as string) ?? '',
    letterAddressName: (row['letter_address_name'] as string) ?? '',
    salutation: (row['salutation'] as string) ?? '',
    notes: (row['notes'] as string) ?? '',
    streetAddress: (row['street_address'] as string) ?? '',
    city: (row['city'] as string) ?? '',
    state: (row['state'] as string) ?? '',
    zip: (row['zip'] as string) ?? '',
    country: (row['country'] as string) ?? '',
    concatenatedAddress: (row['concatenated_address'] as string) ?? '',
    phone: (row['phone'] as string) ?? '',
    email: (row['email'] as string) ?? '',
    createdAt: row['created_at'] as string | undefined,
    updatedAt: row['updated_at'] as string | undefined,
  }
}

function fromTripRow(row: DbRow): typeof TRIP_DEFAULTS & { contactTripId: string } {
  return {
    contactTripId: row['id'] as string,
    sent: (row['sent'] as boolean) ?? false,
    thankYouSent: (row['thank_you_sent'] as boolean) ?? false,
    followedUp: (row['call_made'] as boolean) ?? false,
    responded: (row['responded'] as boolean) ?? false,
    financialPartner: (row['financial_partner'] as boolean) ?? false,
    prayerPartner: (row['prayer_partner'] as boolean) ?? false,
    pledgedToGive: (row['pledged_to_give'] as boolean) ?? false,
    formOfGift: (row['form_of_gift'] as string) ?? '',
    giftAmount: row['gift_amount'] != null ? Number(row['gift_amount']) : 0,
    dateReceived: (row['date_received'] as string) ?? '',
  }
}

function toContactRow(data: Partial<Contact>): DbRow {
  const row: DbRow = {}
  for (const [camel, snake] of Object.entries(CONTACT_CAMEL_TO_SNAKE)) {
    if (camel in data) row[snake] = data[camel as keyof Contact]
  }
  return row
}

function toTripRow(data: Partial<Contact>): DbRow {
  const row: DbRow = {}
  for (const [camel, snake] of Object.entries(TRIP_CAMEL_TO_SNAKE)) {
    if (camel in data) row[snake] = data[camel as keyof Contact]
  }
  return row
}

async function getCurrentUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  return user.id
}

export function useContacts(tripId: string | null | undefined) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (tripId === undefined) return // still loading trip
    if (tripId === null) {
      setContacts([])
      setLoading(false)
      return
    }

    supabase
      .from('contacts')
      .select(`*, contact_trips!left(*)`)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (error) { setError(error); setLoading(false); return }
        const rows = (data as DbRow[]).map(row => {
          const tripRows = row['contact_trips'] as DbRow[] | null
          const tripRow = tripRows?.find(t => t['trip_id'] === tripId)
          // Returning = gave (financial_partner=true) on any prior trip
          const returning = (tripRows ?? []).some(
            t => t['trip_id'] !== tripId && t['financial_partner'] === true
          )
          return {
            ...fromContactRow(row),
            returning,
            ...(tripRow ? fromTripRow(tripRow) : { ...TRIP_DEFAULTS, contactTripId: undefined }),
          } as Contact
        })
        setContacts(rows)
        setLoading(false)
      })
  }, [tripId])

  const ensureContactTrip = useCallback(async (contactId: string, userId: string): Promise<string> => {
    if (!tripId) throw new Error('No active trip')
    const { data, error } = await supabase
      .from('contact_trips')
      .upsert({ trip_id: tripId, contact_id: contactId, user_id: userId }, { onConflict: 'trip_id,contact_id' })
      .select('id')
      .single()
    if (error) throw error
    return (data as DbRow)['id'] as string
  }, [tripId])

  const addContact = useCallback(async (data: Partial<Contact>): Promise<Contact> => {
    if (!tripId) throw new Error('No active trip')
    const userId = await getCurrentUserId()
    const { data: created, error } = await supabase
      .from('contacts')
      .insert({ ...toContactRow(data), user_id: userId })
      .select()
      .single()
    if (error) throw error
    const contactRow = fromContactRow(created as DbRow)

    // Create contact_trips row
    const { data: ctData, error: ctError } = await supabase
      .from('contact_trips')
      .insert({ trip_id: tripId, contact_id: contactRow.id, user_id: userId, ...toTripRow(data) })
      .select()
      .single()
    if (ctError) throw ctError

    const contact = { ...contactRow, ...fromTripRow(ctData as DbRow) }
    setContacts(prev => [...prev, contact])
    return contact
  }, [tripId])

  const updateContact = useCallback(async (id: string, data: Partial<Contact>): Promise<void> => {
    if (!tripId) throw new Error('No active trip')
    const userId = await getCurrentUserId()

    const contactFields = toContactRow(data)
    const tripFields = toTripRow(data)

    const [contactRes, tripRes] = await Promise.all([
      Object.keys(contactFields).length > 0
        ? supabase.from('contacts').update(contactFields).eq('id', id).select().single()
        : Promise.resolve({ data: null, error: null }),
      Object.keys(tripFields).length > 0
        ? supabase
            .from('contact_trips')
            .upsert({ trip_id: tripId, contact_id: id, user_id: userId, ...tripFields }, { onConflict: 'trip_id,contact_id' })
            .select()
            .single()
        : Promise.resolve({ data: null, error: null }),
    ])
    if (contactRes.error) throw contactRes.error
    if (tripRes.error) throw tripRes.error

    setContacts(prev => prev.map(c => {
      if (c.id !== id) return c
      const updatedContact = contactRes.data ? { ...c, ...fromContactRow(contactRes.data as DbRow) } : c
      const updatedTrip = tripRes.data ? { ...updatedContact, ...fromTripRow(tripRes.data as DbRow) } : updatedContact
      return updatedTrip
    }))
  }, [tripId])

  const deleteContact = useCallback(async (id: string): Promise<void> => {
    const { error } = await supabase.from('contacts').delete().eq('id', id)
    if (error) throw error
    setContacts(prev => prev.filter(c => c.id !== id))
  }, [])

  const importContacts = useCallback(async (incoming: Contact[]): Promise<void> => {
    if (!tripId) throw new Error('No active trip')
    const userId = await getCurrentUserId()
    const { data: existing } = await supabase.from('contacts').select('full_name').eq('user_id', userId)
    const existingNames = new Set(
      ((existing as DbRow[] | null) ?? []).map(r => String(r['full_name'] ?? '').toLowerCase())
    )
    const newOnes = incoming.filter(c => !existingNames.has((c.fullName ?? '').toLowerCase()))
    if (newOnes.length === 0) return

    const { data: insertedContacts, error } = await supabase
      .from('contacts')
      .insert(newOnes.map(c => ({ ...toContactRow(c), user_id: userId })))
      .select()
    if (error) throw error

    const ctRows = (insertedContacts as DbRow[]).map((row, i) => ({
      trip_id: tripId,
      contact_id: row['id'] as string,
      user_id: userId,
      ...toTripRow(newOnes[i]),
    }))
    const { data: ctData, error: ctError } = await supabase.from('contact_trips').insert(ctRows).select()
    if (ctError) throw ctError

    const ctMap = new Map((ctData as DbRow[]).map(r => [r['contact_id'] as string, r]))
    const imported = (insertedContacts as DbRow[]).map(row => ({
      ...fromContactRow(row),
      ...(ctMap.has(row['id'] as string) ? fromTripRow(ctMap.get(row['id'] as string)!) : { ...TRIP_DEFAULTS, contactTripId: undefined }),
    } as Contact))
    setContacts(prev => [...prev, ...imported])
  }, [tripId])

  const replaceAll = useCallback(async (incoming: Contact[]): Promise<void> => {
    if (!tripId) throw new Error('No active trip')
    const userId = await getCurrentUserId()
    await supabase.from('contacts').delete().eq('user_id', userId)

    const { data: insertedContacts, error } = await supabase
      .from('contacts')
      .insert(incoming.map(c => ({ ...toContactRow(c), user_id: userId })))
      .select()
    if (error) throw error

    const ctRows = (insertedContacts as DbRow[]).map((row, i) => ({
      trip_id: tripId,
      contact_id: row['id'] as string,
      user_id: userId,
      ...toTripRow(incoming[i]),
    }))
    const { data: ctData, error: ctError } = await supabase.from('contact_trips').insert(ctRows).select()
    if (ctError) throw ctError

    const ctMap = new Map((ctData as DbRow[]).map(r => [r['contact_id'] as string, r]))
    setContacts((insertedContacts as DbRow[]).map(row => ({
      ...fromContactRow(row),
      ...(ctMap.has(row['id'] as string) ? fromTripRow(ctMap.get(row['id'] as string)!) : { ...TRIP_DEFAULTS, contactTripId: undefined }),
    } as Contact)))
  }, [tripId])

  const deleteAll = useCallback(async (): Promise<void> => {
    const userId = await getCurrentUserId()
    await supabase.from('contacts').delete().eq('user_id', userId)
    setContacts([])
  }, [])

  const deleteMany = useCallback(async (ids: string[]): Promise<void> => {
    if (ids.length === 0) return
    await supabase.from('contacts').delete().in('id', ids)
    setContacts(prev => prev.filter(c => !ids.includes(c.id)))
  }, [])

  const updateMany = useCallback(async (ids: string[], data: Partial<Contact>): Promise<void> => {
    if (ids.length === 0 || !tripId) return
    const userId = await getCurrentUserId()
    const contactFields = toContactRow(data)
    const tripFields = toTripRow(data)

    if (Object.keys(contactFields).length > 0) {
      await supabase.from('contacts').update(contactFields).in('id', ids)
    }
    if (Object.keys(tripFields).length > 0) {
      // Upsert a contact_trips row for each contact
      const upsertRows = ids.map(contactId => ({
        trip_id: tripId,
        contact_id: contactId,
        user_id: userId,
        ...tripFields,
      }))
      await supabase.from('contact_trips').upsert(upsertRows, { onConflict: 'trip_id,contact_id' })
    }
    setContacts(prev => prev.map(c => ids.includes(c.id) ? { ...c, ...data } : c))
  }, [tripId])

  // Used when ensuring all existing contacts have a contact_trips row for a newly created trip
  const ensureAllContactTrips = useCallback(async (newTripId: string): Promise<void> => {
    const userId = await getCurrentUserId()
    const rows = contacts.map(c => ({
      trip_id: newTripId,
      contact_id: c.id,
      user_id: userId,
    }))
    if (rows.length === 0) return
    await supabase.from('contact_trips').upsert(rows, { onConflict: 'trip_id,contact_id' })
    // Reset per-trip state in local state
    setContacts(prev => prev.map(c => ({ ...c, ...TRIP_DEFAULTS, contactTripId: undefined })))
  }, [contacts])

  return {
    contacts, loading, error,
    addContact, updateContact, deleteContact,
    importContacts, replaceAll, deleteAll, deleteMany, updateMany,
    ensureAllContactTrips,
    ensureContactTrip,
  }
}
