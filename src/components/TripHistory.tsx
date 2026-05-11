import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useContacts } from '../hooks/useContacts'
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

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n)
}

type SortKey = 'name' | 'relationship' | 'gift'
type SortDir = 'asc' | 'desc'

interface TripDetailProps {
  trip: Trip
  onBack: () => void
}

function TripDetail({ trip, onBack }: TripDetailProps) {
  const { contacts, loading } = useContacts(trip.id)
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const partners = contacts.filter(c => c.financialPartner)
  const totalGiven = partners.reduce((sum, c) => sum + (c.giftAmount ?? 0), 0)
  const prayerOnly = contacts.filter(c => c.prayerPartner && !c.financialPartner)

  const sorted = useMemo(() => {
    return [...contacts].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name') cmp = `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
      else if (sortKey === 'relationship') cmp = (a.relationship ?? '').localeCompare(b.relationship ?? '')
      else if (sortKey === 'gift') cmp = (a.giftAmount ?? 0) - (b.giftAmount ?? 0)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [contacts, sortKey, sortDir])

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span className="opacity-30">↕</span>
    return <span>{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-3 mb-5 shrink-0">
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
          <div className="grid grid-cols-3 gap-3 mb-5 shrink-0">
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

          <div className="overflow-y-auto flex-1 min-h-0 [scrollbar-width:thin]">
            {contacts.length === 0 ? (
              <p className="text-sm text-stone-warm text-center py-8">No contact data for this trip.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="border-b border-cream-200">
                    <th className="text-left px-2 py-2 text-xs font-semibold text-stone-warm">
                      <button onClick={() => handleSort('name')} className="flex items-center gap-1 hover:text-stone-dark">
                        Name <SortIcon col="name" />
                      </button>
                    </th>
                    <th className="text-left px-2 py-2 text-xs font-semibold text-stone-warm">
                      <button onClick={() => handleSort('relationship')} className="flex items-center gap-1 hover:text-stone-dark">
                        Relationship <SortIcon col="relationship" />
                      </button>
                    </th>
                    <th className="text-right px-2 py-2 text-xs font-semibold text-stone-warm">
                      <button onClick={() => handleSort('gift')} className="flex items-center gap-1 justify-end hover:text-stone-dark ml-auto">
                        Gift <SortIcon col="gift" />
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream-100">
                  {sorted.map(c => (
                    <tr key={c.id} className="hover:bg-cream-50 transition-colors">
                      <td className="px-2 py-2 font-medium text-stone-dark">
                        {c.organization || `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim()}
                      </td>
                      <td className="px-2 py-2 text-stone-warm text-xs">{c.relationship}</td>
                      <td className="px-2 py-2 text-right font-mono text-xs text-sage-600">
                        {c.giftAmount != null && c.giftAmount !== 0 ? fmt(c.giftAmount) : ''}
                      </td>
                    </tr>
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

        <div className="px-6 py-5 flex-1 flex flex-col min-h-0 overflow-hidden">
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
