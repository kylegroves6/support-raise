import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Goals } from '../types'

const DEFAULTS: Goals = { tripCost: 5525, foodReimbursement: 400, sfFlight: 400 }

type DbGoalsRow = { trip_cost: number; food_reimbursement: number; sf_flight: number }

function fromDb(row: DbGoalsRow): Goals {
  return { tripCost: row.trip_cost, foodReimbursement: row.food_reimbursement, sfFlight: row.sf_flight }
}

function toDb(goals: Goals): DbGoalsRow {
  return { trip_cost: goals.tripCost, food_reimbursement: goals.foodReimbursement, sf_flight: goals.sfFlight }
}

export function useGoalSettings() {
  const [goals, setGoals] = useState<Goals>(DEFAULTS)

  useEffect(() => {
    supabase
      .from('goals')
      .select('*')
      .single()
      .then(({ data, error }) => {
        // PGRST116 = no rows; keep defaults until user saves
        if (error && error.code !== 'PGRST116') console.error(error)
        if (data) setGoals(fromDb(data as DbGoalsRow))
      })
  }, [])

  const updateGoals = useCallback(async (updates: Partial<Goals>): Promise<void> => {
    const next = { ...goals, ...updates }
    setGoals(next)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    const { error } = await supabase
      .from('goals')
      .upsert({ ...toDb(next), user_id: user.id }, { onConflict: 'user_id' })
    if (error) throw error
  }, [goals])

  const totalGoal = goals.tripCost + goals.foodReimbursement + goals.sfFlight

  return { goals, totalGoal, updateGoals }
}
