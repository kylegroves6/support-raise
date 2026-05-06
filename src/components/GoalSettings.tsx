import { useState } from 'react'
import type { Trip, AdditionalRaisingItem } from '../types'

interface Props {
  activeTrip: Trip
  additionalItems: AdditionalRaisingItem[]
  onUpdateTrip: (updates: Partial<Omit<Trip, 'id' | 'userId' | 'isActive' | 'createdAt'>>) => Promise<void>
  onAddItem: (label: string, amount: number) => Promise<void>
  onUpdateItem: (id: string, label: string, amount: number) => Promise<void>
  onDeleteItem: (id: string) => Promise<void>
  onClose: () => void
}

export default function GoalSettings({
  activeTrip, additionalItems,
  onUpdateTrip, onAddItem, onUpdateItem, onDeleteItem, onClose,
}: Props) {
  const [missionName, setMissionName] = useState(activeTrip.missionName)
  const [missionStart, setMissionStart] = useState(activeTrip.missionStart ?? '')
  const [missionEnd, setMissionEnd] = useState(activeTrip.missionEnd ?? '')
  const [tripCost, setTripCost] = useState(activeTrip.tripCost)
  const [newLabel, setNewLabel] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editAmount, setEditAmount] = useState('')

  const computedTotal = tripCost + additionalItems.reduce((s, i) => s + i.amount, 0)

  function handleSaveMission() {
    onUpdateTrip({
      missionName: missionName.trim() || activeTrip.missionName,
      missionStart: missionStart || null,
      missionEnd: missionEnd || null,
    })
  }

  function handleSaveTripCost() {
    onUpdateTrip({ tripCost: parseFloat(String(tripCost)) || 0 })
  }

  async function handleAddItem() {
    const label = newLabel.trim()
    const amount = parseFloat(newAmount) || 0
    if (!label || amount <= 0) return
    await onAddItem(label, amount)
    setNewLabel('')
    setNewAmount('')
  }

  function startEdit(item: AdditionalRaisingItem) {
    setEditingId(item.id)
    setEditLabel(item.label)
    setEditAmount(String(item.amount))
  }

  async function saveEdit(id: string) {
    await onUpdateItem(id, editLabel.trim(), parseFloat(editAmount) || 0)
    setEditingId(null)
  }

  return (
    <div className="fixed inset-0 bg-stone-dark/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-modal w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-stone-dark">Goal Settings</h2>
          <button onClick={onClose} className="btn-ghost text-stone-warm text-lg leading-none">×</button>
        </div>

        <div className="space-y-5">
          <div>
            <label className="label">Mission Name</label>
            <div className="flex gap-2">
              <input
                className="input-field flex-1"
                type="text"
                value={missionName}
                onChange={e => setMissionName(e.target.value)}
                placeholder="e.g. Tokyo Mission 2026"
              />
              <button className="btn-primary px-4" onClick={handleSaveMission}>Save</button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Start Date</label>
              <input
                className="input-field"
                type="date"
                value={missionStart}
                onChange={e => setMissionStart(e.target.value)}
              />
            </div>
            <div>
              <label className="label">End Date</label>
              <input
                className="input-field"
                type="date"
                value={missionEnd}
                onChange={e => setMissionEnd(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end -mt-3">
            <button className="btn-primary px-4 text-sm" onClick={handleSaveMission}>Save dates</button>
          </div>

          <div>
            <label className="label">Trip Cost</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-warm text-sm">$</span>
                <input
                  className="input-field pl-7"
                  type="number"
                  value={tripCost}
                  onChange={e => setTripCost(parseFloat(e.target.value) || 0)}
                />
              </div>
              <button className="btn-primary px-4" onClick={handleSaveTripCost}>Save</button>
            </div>
          </div>

          <div>
            <label className="label">Additional Raising</label>
            <p className="text-xs text-stone-warm mb-2">Extra amounts to raise beyond the trip cost (postage, deposits, etc.)</p>

            {additionalItems.length > 0 && (
              <div className="space-y-1.5 mb-3">
                {additionalItems.map(item => (
                  <div key={item.id} className="flex items-center gap-2">
                    {editingId === item.id ? (
                      <>
                        <input
                          className="input-field flex-1 text-sm py-1.5"
                          value={editLabel}
                          onChange={e => setEditLabel(e.target.value)}
                          placeholder="Label"
                        />
                        <div className="relative w-24">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-stone-warm text-sm">$</span>
                          <input
                            className="input-field pl-5 text-sm py-1.5 w-full"
                            type="number"
                            value={editAmount}
                            onChange={e => setEditAmount(e.target.value)}
                          />
                        </div>
                        <button
                          className="btn-primary text-xs px-2 py-1.5"
                          onClick={() => saveEdit(item.id)}
                        >✓</button>
                        <button
                          className="btn-ghost text-xs px-2 py-1.5 text-stone-warm"
                          onClick={() => setEditingId(null)}
                        >✕</button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-sm text-stone-dark">{item.label}</span>
                        <span className="text-sm font-mono text-stone-warm">${item.amount.toLocaleString()}</span>
                        <button
                          className="text-xs text-sage-500 hover:text-sage-600 px-1"
                          onClick={() => startEdit(item)}
                        >Edit</button>
                        <button
                          className="text-xs text-red-400 hover:text-red-600 px-1"
                          onClick={() => onDeleteItem(item.id)}
                        >✕</button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                className="input-field flex-1 text-sm"
                placeholder="Label (e.g. Postage)"
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddItem()}
              />
              <div className="relative w-24">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-stone-warm text-sm">$</span>
                <input
                  className="input-field pl-5 text-sm w-full"
                  type="number"
                  placeholder="0"
                  value={newAmount}
                  onChange={e => setNewAmount(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddItem()}
                />
              </div>
              <button className="btn-primary px-3 text-sm" onClick={handleAddItem}>Add</button>
            </div>
          </div>

          <div className="pt-2 border-t border-cream-200">
            <div className="flex justify-between text-sm">
              <span className="text-stone-warm">Total Goal</span>
              <span className="font-semibold text-stone-dark">${computedTotal.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button className="btn-secondary flex-1" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
