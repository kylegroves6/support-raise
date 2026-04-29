import { useState } from 'react'
import type { Goals } from '../types'

interface Props {
  goals: Goals
  totalGoal: number
  onUpdate: (updates: Partial<Goals>) => void
  onClose: () => void
}

export default function GoalSettings({ goals, onUpdate, onClose }: Props) {
  const [form, setForm] = useState({
    tripCost: goals.tripCost,
    foodReimbursement: goals.foodReimbursement,
    sfFlight: goals.sfFlight,
  })

  function handleSave() {
    onUpdate({
      tripCost: parseFloat(String(form.tripCost)) || 0,
      foodReimbursement: parseFloat(String(form.foodReimbursement)) || 0,
      sfFlight: parseFloat(String(form.sfFlight)) || 0,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-stone-dark/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-modal w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-stone-dark">Goal Settings</h2>
          <button onClick={onClose} className="btn-ghost text-stone-warm text-lg leading-none">×</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">Trip Cost</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-warm text-sm">$</span>
              <input
                className="input-field pl-7"
                type="number"
                value={form.tripCost}
                onChange={e => setForm(f => ({ ...f, tripCost: parseFloat(e.target.value) || 0 }))}
              />
            </div>
          </div>
          <div>
            <label className="label">Food Reimbursement</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-warm text-sm">$</span>
              <input
                className="input-field pl-7"
                type="number"
                value={form.foodReimbursement}
                onChange={e => setForm(f => ({ ...f, foodReimbursement: parseFloat(e.target.value) || 0 }))}
              />
            </div>
          </div>
          <div>
            <label className="label">SF Flight Reimbursement</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-warm text-sm">$</span>
              <input
                className="input-field pl-7"
                type="number"
                value={form.sfFlight}
                onChange={e => setForm(f => ({ ...f, sfFlight: parseFloat(e.target.value) || 0 }))}
              />
            </div>
          </div>

          <div className="pt-2 border-t border-cream-200">
            <div className="flex justify-between text-sm">
              <span className="text-stone-warm">Total Goal</span>
              <span className="font-semibold text-stone-dark">
                ${(form.tripCost + form.foodReimbursement + form.sfFlight).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
          <button className="btn-primary flex-1" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  )
}
