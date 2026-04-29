import { useState, useCallback } from 'react'

const STORAGE_KEY = 'tokyo-mission-goals'

const DEFAULTS = {
  tripCost: 5525,
  foodReimbursement: 400,
  sfFlight: 400,
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS
  } catch {
    return DEFAULTS
  }
}

export function useGoalSettings() {
  const [goals, setGoals] = useState(load)

  const updateGoals = useCallback((updates) => {
    const updated = { ...load(), ...updates }
    setGoals(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  }, [])

  const totalGoal = goals.tripCost + goals.foodReimbursement + goals.sfFlight

  return { goals, totalGoal, updateGoals }
}
