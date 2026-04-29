import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const DEFAULTS = { tripCost: 5525, foodReimbursement: 400, sfFlight: 400 }

function fromDb(row) {
  return { tripCost: row.trip_cost, foodReimbursement: row.food_reimbursement, sfFlight: row.sf_flight }
}

function toDb(goals) {
  return { trip_cost: goals.tripCost, food_reimbursement: goals.foodReimbursement, sf_flight: goals.sfFlight }
}

export function useGoalSettings() {
  const [goals, setGoals] = useState(DEFAULTS)

  useEffect(() => {
    supabase
      .from('goals')
      .select('*')
      .single()
      .then(({ data, error }) => {
        // PGRST116 = no rows; keep defaults until user saves
        if (error && error.code !== 'PGRST116') console.error(error)
        if (data) setGoals(fromDb(data))
      })
  }, [])

  const updateGoals = useCallback(async (updates) => {
    const next = { ...goals, ...updates }
    setGoals(next)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase
      .from('goals')
      .upsert({ ...toDb(next), user_id: user.id }, { onConflict: 'user_id' })
    if (error) throw error
  }, [goals])

  const totalGoal = goals.tripCost + goals.foodReimbursement + goals.sfFlight

  return { goals, totalGoal, updateGoals }
}
