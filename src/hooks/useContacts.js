import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useContacts() {
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    supabase
      .from('contacts')
      .select('*')
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (error) setError(error)
        else setContacts(data)
      })
      .finally(() => setLoading(false))
  }, [])

  const addContact = useCallback(async (data) => {
    const { data: created, error } = await supabase
      .from('contacts')
      .insert(data)
      .select()
      .single()
    if (error) throw error
    setContacts(prev => [...prev, created])
    return created
  }, [])

  const updateContact = useCallback(async (id, data) => {
    const { data: updated, error } = await supabase
      .from('contacts')
      .update(data)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    setContacts(prev => prev.map(c => c.id === id ? updated : c))
  }, [])

  const deleteContact = useCallback(async (id) => {
    const { error } = await supabase.from('contacts').delete().eq('id', id)
    if (error) throw error
    setContacts(prev => prev.filter(c => c.id !== id))
  }, [])

  const importContacts = useCallback(async (incoming) => {
    // upsert on id; rows with no id get a new UUID from Postgres default
    const { data, error } = await supabase
      .from('contacts')
      .upsert(incoming, { onConflict: 'id', ignoreDuplicates: true })
      .select()
    if (error) throw error
    setContacts(prev => {
      const existingIds = new Set(prev.map(c => c.id))
      const newOnes = data.filter(c => !existingIds.has(c.id))
      return [...prev, ...newOnes]
    })
  }, [])

  const replaceAll = useCallback(async (incoming) => {
    const { error: delError } = await supabase.from('contacts').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (delError) throw delError
    const { data, error } = await supabase.from('contacts').insert(incoming).select()
    if (error) throw error
    setContacts(data)
  }, [])

  return { contacts, loading, error, addContact, updateContact, deleteContact, importContacts, replaceAll }
}
