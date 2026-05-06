import { useState, useMemo, useRef, useEffect } from 'react'
import { exportCSV, exportTemplate } from '../utils/csvParser'
import type { Contact } from '../types'
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select'

const DELIVERY_INTENTS = ['Send by Mail', 'Hand Delivery', 'Digital Contact']

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
  followedUp: string
  partner: '' | 'financial' | 'prayer' | 'none'
}

const BULK_FIELDS: { label: string; field: keyof Contact; type: 'boolean' | 'select'; options?: string[] }[] = [
  { label: 'Sent', field: 'sent', type: 'boolean' },
  { label: 'Followed Up', field: 'followedUp', type: 'boolean' },
  { label: 'Responded', field: 'responded', type: 'boolean' },
  { label: 'Financial Partner', field: 'financialPartner', type: 'boolean' },
  { label: 'Prayer Partner', field: 'prayerPartner', type: 'boolean' },
  { label: 'Pledged to Give', field: 'pledgedToGive', type: 'boolean' },
  { label: 'Thank-you Sent', field: 'thankYouSent', type: 'boolean' },
  { label: 'Delivery Intent', field: 'addressStatus', type: 'select', options: DELIVERY_INTENTS },
  { label: 'Relationship', field: 'relationship', type: 'select' },
]

interface BulkUpdatePanelProps {
  count: number
  relationshipOptions: string[]
  onUpdate: (field: keyof Contact, value: boolean | string) => void
  onDelete: () => void
  onClear: () => void
}

function BulkUpdatePanel({ count, relationshipOptions, onUpdate, onDelete, onClear }: BulkUpdatePanelProps) {
  const [field, setField] = useState<string>('')
  const [value, setValue] = useState<string>('')

  const selected = BULK_FIELDS.find(f => f.field === field)

  function handleApply() {
    if (!selected) return
    if (selected.type === 'boolean') {
      onUpdate(selected.field, value === 'true')
    } else {
      onUpdate(selected.field, value)
    }
    setField('')
    setValue('')
  }

  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 bg-sage-50 border border-sage-200 rounded-lg text-sm">
      <span className="font-medium text-sage-700">{count} selected</span>

      <div className="flex items-center gap-2 ml-2">
        <Select value={field} onValueChange={v => { setField(v); setValue('') }}>
          <SelectTrigger className="h-7 text-xs w-[160px]">
            <SelectValue placeholder="Set field…" />
          </SelectTrigger>
          <SelectContent>
            {BULK_FIELDS.map(f => (
              <SelectItem key={String(f.field)} value={String(f.field)}>{f.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selected && selected.type === 'boolean' && (
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger className="h-7 text-xs w-[100px]">
              <SelectValue placeholder="Value" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Yes</SelectItem>
              <SelectItem value="false">No</SelectItem>
            </SelectContent>
          </Select>
        )}

        {selected && selected.type === 'select' && (
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger className="h-7 text-xs w-[150px]">
              <SelectValue placeholder="Value" />
            </SelectTrigger>
            <SelectContent>
              {(selected.options ?? (selected.field === 'relationship' ? relationshipOptions : [])).map(o => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <button
          className="btn-primary text-xs h-7 px-3 disabled:opacity-40"
          disabled={!field || value === ''}
          onClick={handleApply}
        >
          Apply
        </button>
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <button
          className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
          onClick={onDelete}
        >
          Delete {count}
        </button>
        <button className="text-xs text-stone-warm hover:text-stone-dark transition-colors" onClick={onClear}>
          Clear
        </button>
      </div>
    </div>
  )
}



function DropdownMenu({ label, items, disabled }: {
  label: string
  disabled?: boolean
  items: { text: string; onClick: () => void }[]
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        className="btn-secondary flex items-center gap-1"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
      >
        {label}
        <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
          <path d="M6 8L2 4h8L6 8z" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-52 bg-white border border-cream-300 rounded-lg shadow-lg z-20 py-1">
          {items.map(item => (
            <button
              key={item.text}
              className="w-full text-left px-4 py-2 text-sm text-stone-dark hover:bg-cream-100 transition-colors"
              onClick={() => { item.onClick(); setOpen(false) }}
            >
              {item.text}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface Props {
  contacts: Contact[]
  onEdit: (contact: Contact) => void
  onAdd: () => void
  onImport: () => void
  onDeleteAll: () => void
  onDeleteMany: (ids: string[]) => Promise<void>
  onUpdateMany: (ids: string[], data: Partial<Contact>) => Promise<void>
}

export default function ContactsTable({ contacts, onEdit, onAdd, onImport, onDeleteAll, onDeleteMany, onUpdateMany }: Props) {
  const relationshipOptions = useMemo(() =>
    [...new Set(contacts.map(c => c.relationship).filter(Boolean))].sort() as string[]
  , [contacts])

  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Filters>({
    relationship: '',
    addressStatus: '',
    sent: '',
    followedUp: '',
    partner: '',
  })
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({ field: 'fullName', dir: 'asc' })
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 25
  const [selected, setSelected] = useState<Set<string>>(new Set())

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
    if (filters.addressStatus) rows = rows.filter(c => (c.addressStatus || '').split(',').map(s => s.trim()).includes(filters.addressStatus))
    if (filters.sent !== '') rows = rows.filter(c => c.sent === (filters.sent === 'true'))
    if (filters.followedUp !== '') rows = rows.filter(c => c.followedUp === (filters.followedUp === 'true'))
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
    setFilters({ relationship: '', addressStatus: '', sent: '', followedUp: '', partner: '' })
    setSearch('')
    setPage(1)
  }

  const pagedIds = paged.map(c => c.id)
  const allPageSelected = pagedIds.length > 0 && pagedIds.every(id => selected.has(id))
  const somePageSelected = pagedIds.some(id => selected.has(id))

  function toggleAll() {
    if (allPageSelected) {
      setSelected(prev => {
        const next = new Set(prev)
        pagedIds.forEach(id => next.delete(id))
        return next
      })
    } else {
      setSelected(prev => new Set([...prev, ...pagedIds]))
    }
  }

  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleBulkDelete() {
    const ids = [...selected]
    if (!confirm(`Delete ${ids.length} contact${ids.length === 1 ? '' : 's'}? This cannot be undone.`)) return
    try {
      await onDeleteMany(ids)
      setSelected(new Set())
    } catch (err) {
      alert(`Failed to delete: ${(err as Error).message}`)
    }
  }

  async function handleBulkUpdate(field: keyof Contact, value: boolean | string) {
    const ids = [...selected]
    try {
      await onUpdateMany(ids, { [field]: value })
      setSelected(new Set())
    } catch (err) {
      alert(`Failed to update: ${(err as Error).message}`)
    }
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
          <DropdownMenu
            label="Import"
            items={[
              { text: 'Import CSV', onClick: onImport },
              { text: 'Download template', onClick: exportTemplate },
            ]}
          />
          <button
            className="btn-secondary"
            disabled={contacts.length === 0}
            onClick={() => exportCSV(contacts)}
          >
            Export
          </button>
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
              <SelectItem value="__all__" className="font-medium text-stone-dark">All Relationships</SelectItem>
              {relationshipOptions.length > 0 && <SelectSeparator />}
              {relationshipOptions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filters.addressStatus} onValueChange={v => setFilter('addressStatus', v === '__all__' ? '' : v)}>
            <SelectTrigger className="w-auto min-w-[150px] h-8 text-xs">
              <SelectValue placeholder="All Delivery Intents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Delivery Intents</SelectItem>
              {DELIVERY_INTENTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
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

          <Select value={filters.followedUp} onValueChange={v => setFilter('followedUp', v === '__all__' ? '' : v)}>
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

      {selected.size > 0 && (
        <BulkUpdatePanel
          count={selected.size}
          relationshipOptions={relationshipOptions}
          onUpdate={handleBulkUpdate}
          onDelete={handleBulkDelete}
          onClear={() => setSelected(new Set())}
        />
      )}

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-cream-100 border-b border-cream-200">
              <tr>
                <th className="px-3 py-2.5 w-8">
                  <input
                    type="checkbox"
                    className="rounded border-cream-300 accent-sage-500"
                    checked={allPageSelected}
                    ref={el => { if (el) el.indeterminate = somePageSelected && !allPageSelected }}
                    onChange={toggleAll}
                  />
                </th>
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
                  <td colSpan={7} className="text-center py-12 text-stone-warm text-sm">
                    {contacts.length === 0 ? 'No contacts yet. Add one or import a CSV.' : 'No contacts match these filters.'}
                  </td>
                </tr>
              ) : (
                paged.map(c => (
                  <tr
                    key={c.id}
                    className={`hover:bg-cream-50 cursor-pointer transition-colors ${selected.has(c.id) ? 'bg-sage-50' : ''}`}
                    onClick={() => onEdit(c)}
                  >
                    <td className="px-3 py-2.5" onClick={e => { e.stopPropagation(); toggleOne(c.id) }}>
                      <input
                        type="checkbox"
                        className="rounded border-cream-300 accent-sage-500"
                        checked={selected.has(c.id)}
                        onChange={() => {}}
                      />
                    </td>
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
                      <div className="flex flex-wrap gap-1">
                        {(c.addressStatus || '').split(',').map(s => s.trim()).filter(Boolean).map(m => (
                          <Chip
                            key={m}
                            label={m === 'Send by Mail' ? 'Mail' : m === 'Hand Delivery' ? 'In Person' : m === 'Digital Contact' ? 'Digital' : m}
                            color={m === 'Send by Mail' ? 'green' : m === 'Hand Delivery' ? 'amber' : m === 'Digital Contact' ? 'blue' : 'gray'}
                          />
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 min-w-[140px]">
                      <div className="flex flex-wrap gap-1">
                        {c.sent && <Chip label="Sent" color="blue" />}
                        {c.followedUp && <Chip label="Followed Up" color="green" />}
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
