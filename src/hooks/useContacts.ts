import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Contact } from '../types'

const CAMEL_TO_SNAKE: Record<keyof Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>, string> = {
  fullName: 'full_name',
  relationship: 'relationship',
  returning: 'returning',
  topPriority: 'top_priority',
  addressStatus: 'address_status',
  sent: 'sent',
  letterAddressName: 'letter_address_name',
  salutation: 'salutation',
  letterPrinted: 'letter_printed',
  mainEnvelopePrinted: 'main_envelope_printed',
  thankYouSent: 'thank_you_sent',
  notes: 'notes',
  streetAddress: 'street_address',
  city: 'city',
  state: 'state',
  zip: 'zip',
  concatenatedAddress: 'concatenated_address',
  phone: 'phone',
  callMade: 'call_made',
  email: 'email',
  responded: 'responded',
  financialPartner: 'financial_partner',
  prayerPartner: 'prayer_partner',
  pledgedToGive: 'pledged_to_give',
  formOfGift: 'form_of_gift',
  giftAmount: 'gift_amount',
  dateReceived: 'date_received',
}

const SNAKE_TO_CAMEL = Object.fromEntries(
  Object.entries(CAMEL_TO_SNAKE).map(([k, v]) => [v, k])
) as Record<string, string>

type DbRow = Record<string, unknown>

function toRow(contact: Partial<Contact>, userId: string): DbRow {
  const row: DbRow = { user_id: userId }
  for (const [camel, snake] of Object.entries(CAMEL_TO_SNAKE)) {
    if (camel in contact) row[snake] = contact[camel as keyof Contact]
  }
  if (contact.id) row['id'] = contact.id
  return row
}

function fromRow(row: DbRow): Contact {
  const contact: Partial<Contact> = {}
  for (const [snake, camel] of Object.entries(SNAKE_TO_CAMEL)) {
    if (snake in row) (contact as Record<string, unknown>)[camel] = row[snake]
  }
  contact.id = row['id'] as string
  contact.createdAt = row['created_at'] as string | undefined
  contact.updatedAt = row['updated_at'] as string | undefined
  return contact as Contact
}

async function getCurrentUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  return user.id
}

export function useContacts() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    getCurrentUserId()
      .then(userId =>
        supabase
          .from('contacts')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: true })
      )
      .then(({ data, error }) => {
        if (error) setError(error)
        else setContacts((data as DbRow[]).map(fromRow))
        setLoading(false)
      })
      .catch(err => {
        setError(err)
        setLoading(false)
      })
  }, [])

  const addContact = useCallback(async (data: Partial<Contact>): Promise<Contact> => {
    const userId = await getCurrentUserId()
    const { data: created, error } = await supabase
      .from('contacts')
      .insert(toRow(data, userId))
      .select()
      .single()
    if (error) throw error
    const contact = fromRow(created as DbRow)
    setContacts(prev => [...prev, contact])
    return contact
  }, [])

  const updateContact = useCallback(async (id: string, data: Partial<Contact>): Promise<void> => {
    const userId = await getCurrentUserId()
    const { data: updated, error } = await supabase
      .from('contacts')
      .update(toRow(data, userId))
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    const contact = fromRow(updated as DbRow)
    setContacts(prev => prev.map(c => c.id === id ? contact : c))
  }, [])

  const deleteContact = useCallback(async (id: string): Promise<void> => {
    const { error } = await supabase.from('contacts').delete().eq('id', id)
    if (error) throw error
    setContacts(prev => prev.filter(c => c.id !== id))
  }, [])

  const importContacts = useCallback(async (incoming: Contact[]): Promise<void> => {
    const userId = await getCurrentUserId()
    const { data: existing } = await supabase
      .from('contacts')
      .select('full_name')
      .eq('user_id', userId)
    const existingNames = new Set(
      (existing as DbRow[] | null ?? []).map(r => String(r['full_name'] ?? '').toLowerCase())
    )
    const newOnes = incoming.filter(c => !existingNames.has((c.fullName ?? '').toLowerCase()))
    if (newOnes.length === 0) return
    const rows = newOnes.map(c => toRow(c, userId))
    const { data, error } = await supabase.from('contacts').insert(rows).select()
    if (error) throw error
    const imported = (data as DbRow[]).map(fromRow)
    setContacts(prev => [...prev, ...imported])
  }, [])

  const replaceAll = useCallback(async (incoming: Contact[]): Promise<void> => {
    const userId = await getCurrentUserId()
    const { error: delError } = await supabase.from('contacts').delete().eq('user_id', userId)
    if (delError) throw delError
    const rows = incoming.map(c => toRow(c, userId))
    const { data, error } = await supabase.from('contacts').insert(rows).select()
    if (error) throw error
    setContacts((data as DbRow[]).map(fromRow))
  }, [])

  const deleteAll = useCallback(async (): Promise<void> => {
    const userId = await getCurrentUserId()
    const { error } = await supabase.from('contacts').delete().eq('user_id', userId)
    if (error) throw error
    setContacts([])
  }, [])

  return { contacts, loading, error, addContact, updateContact, deleteContact, importContacts, replaceAll, deleteAll }
}
