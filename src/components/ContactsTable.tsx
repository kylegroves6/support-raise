import { useState, useMemo } from 'react'
import { exportCSV } from '../utils/csvParser'
import type { Contact } from '../types'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const RELATIONSHIPS = [
  "Friend's Parents", "Sumner Teacher", "Family", "Friend", "Professor",
  "Western Other", "Family Friend", "Home", "Living Hope",
]

const ADDRESS_STATUSES = [
  "Documented", "Need to Look", "Unavailable",
  "Contacted", "Hand Delivery", "Email", "Text",
]

type ChipColor = 'green' | 'amber' | 'red' | 'blue' | 'gray' | 'cream'

function Chip({ label, color }: { label: string; color: ChipColor }) {
  const colors: Record<ChipColor, string> = {
    green: 'bg-sage-100 text-sage-600',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-500',
    blue: 'bg-blue-50 text-blue-500',
    gray: 'bg-stone-100 text-stone-500',
    cream: 'bg-cream-200 text-stone-warm',
  }
  return (
    <span className={`chip ${colors[color]}`}>{label}</span>
  )
}

type SortDir = 'asc' | 'desc'
type SortField = keyof Contact

function SortIcon({ dir }: { dir: SortDir | null }) {
  if (!dir) return <span className="text-stone-light ml-1">↕</span>
  return <span className="text-sage-500 ml-1">{dir === 'asc' ? '↑' : '↓'}</span>
}

interface ThProps {
  label: string
  field: SortField
  sort: { field: SortField; dir: SortDir }
  onSort: (field: SortField) => void
}

function Th({ label, field, sort, onSort }: ThProps) {
  return (
    <th
      className="text-left px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-stone-warm cursor-pointer hover:text-stone-dark select-none whitespace-nowrap"
      onClick={() => onSort(field)}
    >
      {label}
      <SortIcon dir={sort.field === field ? sort.dir : null} />
    </th>
  )
}

interface Filters {
  relationship: string
  addressStatus: string
  sent: string
  callMade: string
  partner: '' | 'financial' | 'prayer' | 'none'
}

interface Props {
  contacts: Contact[]
  onEdit: (contact: Contact) => void
  onAdd: () => void
  onImport: () => void
  onDeleteAll: () => void
}

export default function ContactsTable({ contacts, onEdit, onAdd, onImport, onDeleteAll }: Props) {
  function handleExport() {
    exportCSV(contacts)
  }
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Filters>({
    relationship: '',
    addressStatus: '',
    sent: '',
    callMade: '',
    partner: '',
  })
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({ field: 'fullName', dir: 'asc' })
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 25

  function setFilter(key: keyof Filters, val: string) {
    setFilters(f => ({ ...f, [key]: val }))
    setPage(1)
  }

  function handleSort(field: SortField) {
    setSort(s => ({
      field,
      dir: s.field === field && s.dir === 'asc' ? 'desc' : 'asc',
    }))
    setPage(1)
  }

  const filtered = useMemo(() => {
    let rows = contacts

    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter(c =>
        (c.fullName || '').toLowerCase().includes(q) ||
        (c.relationship || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.notes || '').toLowerCase().includes(q)
      )
    }

    if (filters.relationship) rows = rows.filter(c => c.relationship === filters.relationship)
    if (filters.addressStatus) rows = rows.filter(c => c.addressStatus === filters.addressStatus)
    if (filters.sent !== '') rows = rows.filter(c => c.sent === (filters.sent === 'true'))
    if (filters.callMade !== '') rows = rows.filter(c => c.callMade === (filters.callMade === 'true'))
    if (filters.partner === 'financial') rows = rows.filter(c => c.financialPartner)
    if (filters.partner === 'prayer') rows = rows.filter(c => c.prayerPartner && !c.financialPartner)
    if (filters.partner === 'none') rows = rows.filter(c => !c.financialPartner && !c.prayerPartner)

    rows = [...rows].sort((a, b) => {
      let va: string | number | boolean | null | undefined = a[sort.field]
      let vb: string | number | boolean | null | undefined = b[sort.field]
      if (typeof va === 'boolean') va = va ? 1 : 0
      if (typeof vb === 'boolean') vb = vb ? 1 : 0
      va = va ?? ''
      vb = vb ?? ''
      if (va < vb) return sort.dir === 'asc' ? -1 : 1
      if (va > vb) return sort.dir === 'asc' ? 1 : -1
      return 0
    })

    return rows
  }, [contacts, search, filters, sort])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const activeFilters = Object.values(filters).filter(Boolean).length

  function clearFilters() {
    setFilters({ relationship: '', addressStatus: '', sent: '', callMade: '', partner: '' })
    setSearch('')
    setPage(1)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          className="input-field flex-1"
          placeholder="Search by name, relationship, email…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
        />
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={onImport}>Import CSV</button>
          <button className="btn-secondary" onClick={handleExport} disabled={contacts.length === 0}>Export CSV</button>
          <button className="btn-primary" onClick={onAdd}>+ Add Contact</button>
        </div>
      </div>

      <div className="card py-3">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-medium text-stone-warm">Filter:</span>

          <Select value={filters.relationship} onValueChange={v => setFilter('relationship', v === '__all__' ? '' : v)}>
            <SelectTrigger className="w-auto min-w-[140px] h-8 text-xs">
              <SelectValue placeholder="All Relationships" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Relationships</SelectItem>
              {RELATIONSHIPS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filters.addressStatus} onValueChange={v => setFilter('addressStatus', v === '__all__' ? '' : v)}>
            <SelectTrigger className="w-auto min-w-[140px] h-8 text-xs">
              <SelectValue placeholder="All Address Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Address Status</SelectItem>
              {ADDRESS_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filters.sent} onValueChange={v => setFilter('sent', v === '__all__' ? '' : v)}>
            <SelectTrigger className="w-auto min-w-[110px] h-8 text-xs">
              <SelectValue placeholder="Sent?" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Any</SelectItem>
              <SelectItem value="true">Sent</SelectItem>
              <SelectItem value="false">Not Sent</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.callMade} onValueChange={v => setFilter('callMade', v === '__all__' ? '' : v)}>
            <SelectTrigger className="w-auto min-w-[130px] h-8 text-xs">
              <SelectValue placeholder="Followed Up?" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Any</SelectItem>
              <SelectItem value="true">Followed Up</SelectItem>
              <SelectItem value="false">Not Followed Up</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.partner} onValueChange={v => setFilter('partner', v === '__all__' ? '' : v as Filters['partner'])}>
            <SelectTrigger className="w-auto min-w-[150px] h-8 text-xs">
              <SelectValue placeholder="Partner Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Any Partner Status</SelectItem>
              <SelectItem value="financial">Financial Partner</SelectItem>
              <SelectItem value="prayer">Prayer Partner Only</SelectItem>
              <SelectItem value="none">No Partner</SelectItem>
            </SelectContent>
          </Select>

          {(activeFilters > 0 || search) && (
            <button className="text-xs text-red-400 hover:text-red-600 transition-colors" onClick={clearFilters}>
              Clear filters
            </button>
          )}

          <span className="ml-auto text-xs text-stone-warm">{filtered.length} contacts</span>

          {contacts.length > 0 && (
            <button
              className="text-xs text-stone-light hover:text-red-500 transition-colors"
              onClick={onDeleteAll}
              title="Delete all contacts"
            >
              Delete all
            </button>
          )}
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-cream-100 border-b border-cream-200">
              <tr>
                <Th label="Name" field="fullName" sort={sort} onSort={handleSort} />
                <Th label="Relationship" field="relationship" sort={sort} onSort={handleSort} />
                <Th label="Priority" field="topPriority" sort={sort} onSort={handleSort} />
                <Th label="Address" field="addressStatus" sort={sort} onSort={handleSort} />
                <th className="text-left px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-stone-warm whitespace-nowrap">Status</th>
                <Th label="Gift" field="giftAmount" sort={sort} onSort={handleSort} />
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-100">
              {paged.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-stone-warm text-sm">
                    {contacts.length === 0 ? 'No contacts yet. Add one or import a CSV.' : 'No contacts match these filters.'}
                  </td>
                </tr>
              ) : (
                paged.map(c => (
                  <tr
                    key={c.id}
                    className="hover:bg-cream-50 cursor-pointer transition-colors"
                    onClick={() => onEdit(c)}
                  >
                    <td className="px-3 py-2.5 max-w-[180px]">
                      <p className="font-medium text-stone-dark truncate" title={c.fullName}>{c.fullName}</p>
                      {c.email && <p className="text-xs text-stone-warm truncate" title={c.email}>{c.email}</p>}
                    </td>
                    <td className="px-3 py-2.5 text-stone-warm text-xs whitespace-nowrap">{c.relationship}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {c.topPriority != null && (
                        <Chip label={`P${c.topPriority}`} color="amber" />
                      )}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {c.addressStatus && (
                        <Chip
                          label={c.addressStatus}
                          color={c.addressStatus === 'Documented' ? 'green' : c.addressStatus === 'Unavailable' ? 'red' : 'cream'}
                        />
                      )}
                    </td>
                    <td className="px-3 py-2.5 min-w-[140px]">
                      <div className="flex flex-wrap gap-1">
                        {c.sent && <Chip label="Sent" color="blue" />}
                        {c.callMade && <Chip label="Followed Up" color="green" />}
                        {c.responded && !c.financialPartner && !c.prayerPartner && <Chip label="Responded" color="amber" />}
                        {c.financialPartner && <Chip label="Partner" color="green" />}
                        {c.prayerPartner && <Chip label="Prayer" color="cream" />}
                        {c.pledgedToGive && !c.financialPartner && <Chip label="Pledged" color="amber" />}
                        {c.thankYouSent && <Chip label="TY Sent" color="cream" />}
                        {c.returning && <Chip label="Returning" color="cream" />}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap">
                      {c.giftAmount != null && c.giftAmount !== 0 && (
                        <span className={c.giftAmount < 0 ? 'text-red-500' : 'text-sage-600'}>
                          {c.giftAmount < 0
                            ? `(${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(Math.abs(c.giftAmount))})`
                            : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(c.giftAmount)
                          }
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-cream-200 bg-cream-50">
            <button
              className="btn-ghost text-xs"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              ← Previous
            </button>
            <span className="text-xs text-stone-warm">
              Page {page} of {totalPages}
            </span>
            <button
              className="btn-ghost text-xs"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
