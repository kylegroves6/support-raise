import { useState, type FormEvent } from 'react'
import type { Trip } from '../types'

interface Props {
  currentMission: string
  onRollover: (trip: Omit<Trip, 'id' | 'userId' | 'isActive' | 'createdAt'>) => Promise<void>
  onClose: () => void
}

const CARRIED_OVER = [
  'Contact info (name, address, phone, email)',
  'Relationship & priority',
  'Returning donor flag',
  'Notes',
]

const RESET_FIELDS = [
  'Contacted',
  'Thank-you sent',
  'Follow-up made',
  'Financial / prayer partner',
  'Pledged to give',
  'Gift amount & date',
]

export default function TripRollover({ currentMission, onRollover, onClose }: Props) {
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
      await onRollover({
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
    <div className="fixed inset-0 bg-stone-dark/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-modal w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-stone-dark">Start a new trip</h2>
          <button onClick={onClose} className="btn-ghost text-stone-warm text-lg leading-none">×</button>
        </div>

        <p className="text-sm text-stone-warm mb-3">
          Starting a new trip from <span className="font-medium text-stone-dark">{currentMission}</span>. Your contacts and their history are preserved — each trip tracks its own data.
        </p>

        <div className="grid grid-cols-2 gap-4 mb-5 text-xs">
          <div>
            <p className="font-semibold text-stone-dark mb-1.5">Carries over</p>
            <ul className="space-y-1">
              {CARRIED_OVER.map(f => (
                <li key={f} className="text-stone-warm flex items-start gap-1.5">
                  <span className="mt-0.5 text-sage-500">✓</span>{f}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-semibold text-stone-dark mb-1.5">Starts fresh</p>
            <ul className="space-y-1">
              {RESET_FIELDS.map(f => (
                <li key={f} className="text-stone-warm flex items-start gap-1.5">
                  <span className="mt-0.5 text-amber-400">↺</span>{f}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-stone-warm mb-1">New mission name</label>
            <input
              type="text"
              required
              placeholder="e.g. Tokyo Mission 2027"
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

          <div className="flex gap-3 pt-1">
            <button type="button" className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="flex-1 py-2 text-sm font-medium bg-sage-500 text-white rounded-lg hover:bg-sage-600 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Starting…' : 'Start new trip'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
