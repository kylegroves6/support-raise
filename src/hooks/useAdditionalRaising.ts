import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { getCurrentUserId } from '../lib/auth'
import type { AdditionalRaisingItem } from '../types'

type DbRow = { id: string; label: string; amount: number }

function fromDb(row: DbRow): AdditionalRaisingItem {
  return { id: row.id, label: row.label, amount: row.amount }
}

export function useAdditionalRaising() {
  const [items, setItems] = useState<AdditionalRaisingItem[]>([])

  useEffect(() => {
    getCurrentUserId().then(userId =>
      supabase
        .from('additional_raising')
        .select('id, label, amount')
        .eq('user_id', userId)
        .order('created_at')
    ).then(({ data, error }) => {
      if (error) console.error(error)
      if (data) setItems((data as DbRow[]).map(fromDb))
    })
  }, [])

  const addItem = useCallback(async (label: string, amount: number) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    const { data, error } = await supabase
      .from('additional_raising')
      .insert({ user_id: user.id, label, amount })
      .select('id, label, amount')
      .single()
    if (error) throw error
    setItems(prev => [...prev, fromDb(data as DbRow)])
  }, [])

  const updateItem = useCallback(async (id: string, label: string, amount: number) => {
    const { error } = await supabase
      .from('additional_raising')
      .update({ label, amount })
      .eq('id', id)
    if (error) throw error
    setItems(prev => prev.map(i => i.id === id ? { id, label, amount } : i))
  }, [])

  const deleteItem = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('additional_raising')
      .delete()
      .eq('id', id)
    if (error) throw error
    setItems(prev => prev.filter(i => i.id !== id))
  }, [])

  const additionalTotal = items.reduce((s, i) => s + i.amount, 0)

  return { items, additionalTotal, addItem, updateItem, deleteItem }
}
