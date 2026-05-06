import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useContacts } from '../hooks/useContacts'
import type { Trip, Contact } from '../types'

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

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n)
}

interface TripDetailProps {
  trip: Trip
  onBack: () => void
}

function TripDetail({ trip, onBack }: TripDetailProps) {
  const { contacts, loading } = useContacts(trip.id)

  const partners = contacts.filter(c => c.financialPartner)
  const totalGiven = partners.reduce((sum, c) => sum + (c.giftAmount ?? 0), 0)
  const prayerOnly = contacts.filter(c => c.prayerPartner && !c.financialPartner)

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onBack} className="text-stone-warm hover:text-stone-dark transition-colors text-sm flex items-center gap-1">
          ← Back
        </button>
        <div>
          <h3 className="text-base font-semibold text-stone-dark">{trip.missionName}</h3>
          <p className="text-xs text-stone-warm">{formatDate(trip.missionStart)} – {formatDate(trip.missionEnd)}</p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-stone-warm py-8 text-center">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-cream-100 rounded-xl p-3 text-center">
              <p className="text-xl font-semibold text-stone-dark">{partners.length}</p>
              <p className="text-xs text-stone-warm mt-0.5">Financial Partners</p>
            </div>
            <div className="bg-cream-100 rounded-xl p-3 text-center">
              <p className="text-xl font-semibold text-sage-600">{fmt(totalGiven)}</p>
              <p className="text-xs text-stone-warm mt-0.5">Total Raised</p>
            </div>
            <div className="bg-cream-100 rounded-xl p-3 text-center">
              <p className="text-xl font-semibold text-stone-dark">{prayerOnly.length}</p>
              <p className="text-xs text-stone-warm mt-0.5">Prayer Partners</p>
            </div>
          </div>

          <div className="overflow-y-auto flex-1 [scrollbar-width:thin]">
            {contacts.length === 0 ? (
              <p className="text-sm text-stone-warm text-center py-8">No contact data for this trip.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-cream-200">
                    <th className="text-left px-2 py-2 text-xs font-semibold text-stone-warm">Name</th>
                    <th className="text-left px-2 py-2 text-xs font-semibold text-stone-warm">Relationship</th>
                    <th className="text-left px-2 py-2 text-xs font-semibold text-stone-warm">Status</th>
                    <th className="text-right px-2 py-2 text-xs font-semibold text-stone-warm">Gift</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream-100">
                  {contacts.map(c => (
                    <ContactRow key={c.id} contact={c} />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function ContactRow({ contact: c }: { contact: Contact }) {
  const tags: { label: string; color: string }[] = []
  if (c.financialPartner) tags.push({ label: 'Partner', color: 'bg-sage-100 text-sage-600' })
  if (c.prayerPartner && !c.financialPartner) tags.push({ label: 'Prayer', color: 'bg-cream-200 text-stone-warm' })
  if (c.pledgedToGive && !c.financialPartner) tags.push({ label: 'Pledged', color: 'bg-amber-50 text-amber-700' })

  return (
    <tr className="hover:bg-cream-50 transition-colors">
      <td className="px-2 py-2 font-medium text-stone-dark">{c.fullName}</td>
      <td className="px-2 py-2 text-stone-warm text-xs">{c.relationship}</td>
      <td className="px-2 py-2">
        <div className="flex flex-wrap gap-1">
          {tags.map(t => (
            <span key={t.label} className={`chip ${t.color}`}>{t.label}</span>
          ))}
        </div>
      </td>
      <td className="px-2 py-2 text-right font-mono text-xs text-sage-600">
        {c.giftAmount != null && c.giftAmount !== 0 ? fmt(c.giftAmount) : ''}
      </td>
    </tr>
  )
}

interface Props {
  onClose: () => void
}

export default function TripHistory({ onClose }: Props) {
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Trip | null>(null)

  useEffect(() => {
    supabase
      .from('trips')
      .select('*')
      .eq('is_active', false)
      .order('mission_start', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setTrips((data as DbTripRow[]).map(fromDb))
        setLoading(false)
      })
  }, [])

  return (
    <div className="fixed inset-0 bg-stone-dark/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-modal w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-cream-200 shrink-0">
          <h2 className="text-lg font-semibold text-stone-dark">
            {selected ? selected.missionName : 'Trip History'}
          </h2>
          <button onClick={onClose} className="btn-ghost text-stone-warm text-xl leading-none">×</button>
        </div>

        <div className="px-6 py-5 flex-1 overflow-hidden flex flex-col min-h-0">
          {selected ? (
            <TripDetail trip={selected} onBack={() => setSelected(null)} />
          ) : loading ? (
            <p className="text-sm text-stone-warm py-8 text-center">Loading…</p>
          ) : trips.length === 0 ? (
            <p className="text-sm text-stone-warm py-8 text-center">No past trips yet.</p>
          ) : (
            <ul className="space-y-2 overflow-y-auto [scrollbar-width:thin]">
              {trips.map(t => (
                <li key={t.id}>
                  <button
                    className="w-full text-left px-4 py-3 rounded-xl border border-cream-200 hover:border-sage-300 hover:bg-sage-50 transition-colors group"
                    onClick={() => setSelected(t)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-stone-dark group-hover:text-sage-700 transition-colors">{t.missionName}</p>
                        <p className="text-xs text-stone-warm mt-0.5">{formatDate(t.missionStart)} – {formatDate(t.missionEnd)}</p>
                      </div>
                      <div className="text-right">
                        {t.tripCost > 0 && (
                          <p className="text-sm font-medium text-stone-dark">{fmt(t.tripCost)} goal</p>
                        )}
                        <p className="text-xs text-stone-warm mt-0.5">View details →</p>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
