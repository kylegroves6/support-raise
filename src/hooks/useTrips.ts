import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Trip } from '../types'

type DbTripRow = {
  id: string
  user_id: string
  mission_name: string
  mission_start: string | null
  mission_end: string | null
  trip_cost: number
  is_active: boolean
  created_at: string
}

function fromDb(row: DbTripRow): Trip {
  return {
    id: row.id,
    userId: row.user_id,
    missionName: row.mission_name,
    missionStart: row.mission_start,
    missionEnd: row.mission_end,
    tripCost: row.trip_cost,
    isActive: row.is_active,
    createdAt: row.created_at,
  }
}

async function getCurrentUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  return user.id
}

export function useTrips() {
  const [activeTrip, setActiveTrip] = useState<Trip | null | undefined>(undefined)

  useEffect(() => {
    supabase
      .from('trips')
      .select('*')
      .eq('is_active', true)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) console.error(error)
        setActiveTrip(data ? fromDb(data as DbTripRow) : null)
      })
  }, [])

  const createTrip = useCallback(async (trip: Omit<Trip, 'id' | 'userId' | 'isActive' | 'createdAt'>): Promise<Trip> => {
    const userId = await getCurrentUserId()
    // Deactivate current active trip first
    await supabase.from('trips').update({ is_active: false }).eq('user_id', userId).eq('is_active', true)
    const { data, error } = await supabase
      .from('trips')
      .insert({
        user_id: userId,
        mission_name: trip.missionName,
        mission_start: trip.missionStart || null,
        mission_end: trip.missionEnd || null,
        trip_cost: trip.tripCost,
        is_active: true,
      })
      .select()
      .single()
    if (error) throw error
    const newTrip = fromDb(data as DbTripRow)
    setActiveTrip(newTrip)
    return newTrip
  }, [])

  const updateActiveTrip = useCallback(async (updates: Partial<Omit<Trip, 'id' | 'userId' | 'isActive' | 'createdAt'>>): Promise<void> => {
    if (!activeTrip) return
    const row: Record<string, unknown> = {}
    if (updates.missionName !== undefined) row['mission_name'] = updates.missionName
    if (updates.missionStart !== undefined) row['mission_start'] = updates.missionStart || null
    if (updates.missionEnd !== undefined) row['mission_end'] = updates.missionEnd || null
    if (updates.tripCost !== undefined) row['trip_cost'] = updates.tripCost
    const { error } = await supabase.from('trips').update(row).eq('id', activeTrip.id)
    if (error) throw error
    setActiveTrip(prev => prev ? { ...prev, ...updates } : prev)
  }, [activeTrip])

  return { activeTrip, createTrip, updateActiveTrip }
}
