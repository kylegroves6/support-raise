import { useState, type FormEvent } from 'react'
import type { Trip } from '../types'

interface Props {
  onSave: (trip: Omit<Trip, 'id' | 'userId' | 'isActive' | 'createdAt'>) => Promise<void>
}

export default function MissionSetup({ onSave }: Props) {
  const [name, setName] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [tripCost, setTripCost] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      await onSave({
        missionName: name.trim(),
        missionStart: start || null,
        missionEnd: end || null,
        tripCost: parseFloat(tripCost) || 0,
      })
    } catch (err) {
      setError((err as Error).message)
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white border border-cream-300 rounded-xl shadow-sm p-8">
        <div className="mb-8">
          <h1 className="text-lg font-semibold text-stone-dark">Set up your mission</h1>
          <p className="text-xs text-stone-warm mt-1">You can change these any time in settings.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-stone-warm mb-1">Mission name</label>
            <input
              type="text"
              required
              placeholder="e.g. Tokyo Mission 2026"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-cream-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-warm mb-1">Start date</label>
              <input
                type="date"
                value={start}
                onChange={e => setStart(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-cream-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-warm mb-1">End date</label>
              <input
                type="date"
                value={end}
                onChange={e => setEnd(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-cream-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-warm mb-1">Total trip cost</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-warm text-sm">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                value={tripCost}
                onChange={e => setTripCost(e.target.value)}
                className="w-full pl-7 pr-3 py-2 text-sm border border-cream-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-400"
              />
            </div>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="w-full py-2 text-sm font-medium bg-sage-500 text-white rounded-lg hover:bg-sage-600 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Get started'}
          </button>
        </form>
      </div>
    </div>
  )
}
