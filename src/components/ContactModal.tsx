import { useState, useRef, useEffect } from 'react'
import type { Contact } from '../types'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const RELATIONSHIP_SUGGESTIONS = [
  "Family", "Friend", "Family Friend", "Friend's Parents",
  "Church Friend", "Neighbor", "Coworker", "Coach",
  "Teacher / Professor", "Mentor", "Community Leader", "Former Employer",
]

// Country list — abbreviated but covers the vast majority of use cases
const COUNTRIES = [
  "United States", "Canada", "Mexico", "United Kingdom", "Australia",
  "New Zealand", "Ireland", "Germany", "France", "Spain", "Italy",
  "Netherlands", "Belgium", "Switzerland", "Sweden", "Norway", "Denmark",
  "Finland", "Austria", "Portugal", "Poland", "Czech Republic", "Hungary",
  "Romania", "Greece", "Turkey", "Israel", "South Africa", "Nigeria",
  "Kenya", "Ghana", "Egypt", "Brazil", "Argentina", "Colombia", "Chile",
  "Peru", "Venezuela", "Ecuador", "Bolivia", "Paraguay", "Uruguay",
  "Japan", "China", "South Korea", "India", "Pakistan", "Bangladesh",
  "Indonesia", "Philippines", "Thailand", "Vietnam", "Malaysia", "Singapore",
  "Hong Kong", "Taiwan", "Russia", "Ukraine", "Kazakhstan", "Saudi Arabia",
  "UAE", "Qatar", "Kuwait", "Jordan", "Lebanon", "Iraq", "Iran",
]

const DELIVERY_INTENTS = ['Send by Mail', 'Hand Delivery', 'Digital Contact'] as const
type DeliveryIntent = typeof DELIVERY_INTENTS[number]

function parseDeliveryIntents(status: string): Set<DeliveryIntent> {
  const set = new Set<DeliveryIntent>()
  for (const part of status.split(',')) {
    const trimmed = part.trim() as DeliveryIntent
    if ((DELIVERY_INTENTS as readonly string[]).includes(trimmed)) set.add(trimmed)
  }
  return set
}

const GIFT_FORMS = ["", "Online Donation", "Check", "Cash"]

export function validateEmail(email: string): string | null {
  if (!email) return null
  // RFC-5321-lenient: must have @ with non-empty local and domain parts
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Invalid email address'
  return null
}

export function validatePhone(phone: string): string | null {
  if (!phone) return null
  // Strip common formatting; must have 7–15 digits (international range)
  const digits = phone.replace(/[\s().+\-]/g, '')
  if (!/^\d{7,15}$/.test(digits)) return 'Invalid phone number'
  return null
}

export interface GiftValidationError {
  formOfGift?: string
  dateReceived?: string
  partnerStatus?: string
}

export function validateGiftFields(
  giftAmount: number,
  formOfGift: string,
  dateReceived: string,
  financialPartner: boolean,
  pledgedToGive: boolean,
): GiftValidationError {
  if (giftAmount <= 0) return {}
  const errors: GiftValidationError = {}
  if (!formOfGift) errors.formOfGift = 'Form of Gift is required when a gift amount is entered'
  if (!dateReceived) errors.dateReceived = 'Date Received is required when a gift amount is entered'
  if (!financialPartner && !pledgedToGive) errors.partnerStatus = 'Mark as Financial Partner or Pledged to Give when a gift amount is entered'
  return errors
}

type ContactFormState = Omit<Contact, 'id' | 'topPriority' | 'giftAmount' | 'createdAt' | 'updatedAt'> & {
  topPriority: string
  giftAmount: string
}

const BLANK_CONTACT: ContactFormState = {
  firstName: '', lastName: '', organization: '', relationship: '', returning: false, topPriority: '',
  addressStatus: '', sent: false, salutation: '',
  thankYouSent: false,
  notes: '', streetAddress: '', city: '', state: '', zip: '', country: 'United States',
  concatenatedAddress: '', phone: '', followedUp: false, email: '',
  responded: false, financialPartner: false, prayerPartner: false, pledgedToGive: false,
  formOfGift: '', giftAmount: '', dateReceived: '',
}

// ── Relationship select with "Add new…" escape hatch ─────────────────────────

function RelationshipSelect({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const [customValue, setCustomValue] = useState('')
  const [addingNew, setAddingNew] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const knownSuggestions = RELATIONSHIP_SUGGESTIONS.includes(value)
  const displayValue = value && !knownSuggestions ? value : value

  useEffect(() => {
    if (addingNew) inputRef.current?.focus()
  }, [addingNew])

  function commitCustom() {
    const v = customValue.trim()
    if (v) onChange(v)
    setAddingNew(false)
    setCustomValue('')
  }

  if (addingNew) {
    return (
      <div className="flex gap-2">
        <input
          ref={inputRef}
          className="input-field flex-1"
          placeholder="Enter relationship…"
          value={customValue}
          onChange={e => setCustomValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); commitCustom() }
            if (e.key === 'Escape') { setAddingNew(false); setCustomValue('') }
          }}
        />
        <button type="button" className="btn-secondary text-sm px-3" onClick={commitCustom}>OK</button>
        <button type="button" className="btn-ghost text-sm px-3" onClick={() => { setAddingNew(false); setCustomValue('') }}>✕</button>
      </div>
    )
  }

  return (
    <Select
      value={value}
      onValueChange={v => {
        if (v === '__add_new__') { setAddingNew(true); return }
        onChange(v === '__none__' ? '' : v)
      }}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Choose…">
          {value && !RELATIONSHIP_SUGGESTIONS.includes(value) ? value : undefined}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">— None —</SelectItem>
        {RELATIONSHIP_SUGGESTIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
        {value && !RELATIONSHIP_SUGGESTIONS.includes(value) && (
          <SelectItem value={value}>{value}</SelectItem>
        )}
        <SelectItem value="__add_new__" className="text-sage-600 font-medium">Add new…</SelectItem>
      </SelectContent>
    </Select>
  )
}

// ── Country searchable select ─────────────────────────────────────────────────

function CountrySelect({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = query.trim()
    ? COUNTRIES.filter(c => c.toLowerCase().includes(query.toLowerCase()))
    : COUNTRIES

  function select(country: string) {
    onChange(country)
    setQuery('')
    setOpen(false)
  }

  function clear() {
    onChange('')
    setQuery('')
    setOpen(false)
  }

  return (
    <div className="relative" ref={ref}>
      <div className="relative flex items-center">
        <input
          className="input-field pr-8"
          value={open ? query : (value || '')}
          placeholder="Search country…"
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => { setQuery(''); setOpen(true) }}
          autoComplete="off"
          aria-label="Country"
        />
        {value && !open && (
          <button
            type="button"
            className="absolute right-2 text-stone-warm hover:text-stone-dark text-lg leading-none"
            onClick={clear}
            tabIndex={-1}
            aria-label="Clear country"
          >
            ×
          </button>
        )}
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-cream-200 rounded-xl shadow-modal overflow-hidden">
          <div className="max-h-48 overflow-y-auto [scrollbar-width:thin]">
            <button
              type="button"
              className="w-full text-left px-3 py-1.5 text-sm text-stone-warm hover:bg-sage-50 border-b border-cream-100"
              onMouseDown={e => { e.preventDefault(); clear() }}
            >
              — None / Unknown —
            </button>
            {filtered.map(c => (
              <button
                key={c}
                type="button"
                className={`w-full text-left px-3 py-1.5 text-sm transition-colors hover:bg-sage-50 hover:text-sage-700 ${value === c ? 'text-sage-700 font-medium' : 'text-stone-dark'}`}
                onMouseDown={e => { e.preventDefault(); select(c) }}
              >
                {c}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-2 text-sm text-stone-warm">No matches</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Shared primitives ─────────────────────────────────────────────────────────

interface ToggleProps {
  label: string
  checked: boolean
  onChange: (val: boolean) => void
}

function Toggle({ label, checked, onChange }: ToggleProps) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <div
        className={`relative w-9 h-5 rounded-full transition-colors ${checked ? 'bg-sage-400' : 'bg-stone-light'}`}
        onClick={() => onChange(!checked)}
      >
        <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </div>
      <span className="text-sm text-stone-dark">{label}</span>
    </label>
  )
}

function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string | null }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </label>
  )
}

interface Props {
  contact: Contact | null
  onSave: (data: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>) => void
  onDelete: (id: string) => void
  onClose: () => void
}

export default function ContactModal({ contact, onSave, onDelete, onClose }: Props) {
  const isNew = !contact
  const [form, setForm] = useState<ContactFormState>(
    contact
      ? { ...contact, giftAmount: contact.giftAmount != null ? String(contact.giftAmount) : '', topPriority: contact.topPriority != null ? String(contact.topPriority) : '', country: contact.country || 'United States' }
      : BLANK_CONTACT
  )
  const [errors, setErrors] = useState<{
    email?: string | null
    phone?: string | null
    giftFormOfGift?: string
    giftDateReceived?: string
    giftPartnerStatus?: string
  }>({})

  function set<K extends keyof ContactFormState>(key: K, val: ContactFormState[K]) {
    setForm(f => {
      const next = { ...f, [key]: val }
      // Auto-populate salutation from first name when adding a new contact and salutation is blank
      if (key === 'firstName' && isNew && !f.salutation) {
        next.salutation = val as string
      }
      // Financial Partner auto-sets Contacted
      if (key === 'financialPartner' && val === true) {
        next.sent = true
      }
      return next
    })
    // Clear relevant errors on change
    if (key === 'email') setErrors(e => ({ ...e, email: null }))
    if (key === 'phone') setErrors(e => ({ ...e, phone: null }))
    if (key === 'formOfGift') setErrors(e => ({ ...e, giftFormOfGift: undefined }))
    if (key === 'dateReceived') setErrors(e => ({ ...e, giftDateReceived: undefined }))
    if (key === 'financialPartner' || key === 'pledgedToGive') setErrors(e => ({ ...e, giftPartnerStatus: undefined }))
    if (key === 'giftAmount') setErrors(e => ({ ...e, giftFormOfGift: undefined, giftDateReceived: undefined, giftPartnerStatus: undefined }))
  }

  function handleSave() {
    const giftAmount = form.giftAmount === '' ? 0 : parseFloat(String(form.giftAmount).replace(/[$,]/g, '')) || 0
    const topPriority = form.topPriority === '' ? null : parseInt(form.topPriority, 10)
    const responded = form.responded || form.financialPartner || form.prayerPartner || giftAmount > 0

    // Validate
    const emailErr = validateEmail(form.email)
    const phoneErr = validatePhone(form.phone)
    const giftErrors = validateGiftFields(giftAmount, form.formOfGift, form.dateReceived, form.financialPartner, form.pledgedToGive)
    const hasErrors = emailErr || phoneErr || Object.keys(giftErrors).length > 0

    setErrors({
      email: emailErr,
      phone: phoneErr,
      giftFormOfGift: giftErrors.formOfGift,
      giftDateReceived: giftErrors.dateReceived,
      giftPartnerStatus: giftErrors.partnerStatus,
    })

    if (hasErrors) return

    onSave({ ...form, giftAmount, topPriority, responded })
  }

  const isNonUS = form.country && form.country !== 'United States'

  return (
    <div className="fixed inset-0 bg-stone-dark/40 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div role="dialog" aria-modal="true" className="bg-white rounded-2xl shadow-modal w-full max-w-2xl my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-cream-200">
          <h2 className="text-lg font-semibold text-stone-dark">
            {isNew ? 'Add Contact' : [form.firstName, form.lastName].filter(Boolean).join(' ') || form.organization || 'Edit Contact'}
          </h2>
          <button onClick={onClose} className="btn-ghost text-stone-warm text-xl leading-none">×</button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-stone-warm mb-3">Contact Info</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="First Name">
                <input className="input-field" value={form.firstName} onChange={e => set('firstName', e.target.value)} />
              </Field>
              <Field label="Last Name">
                <input className="input-field" value={form.lastName} onChange={e => set('lastName', e.target.value)} />
              </Field>
              <Field label="Organization (optional)">
                <input className="input-field" value={form.organization ?? ''} onChange={e => set('organization', e.target.value)} />
              </Field>
              <Field label="Relationship">
                <RelationshipSelect value={form.relationship} onChange={v => set('relationship', v)} />
              </Field>
              <Field label="Salutation">
                <input className="input-field" value={form.salutation} onChange={e => set('salutation', e.target.value)} />
              </Field>
              <Field label="Top Priority (1=highest)">
                <input className="input-field" type="number" min="1" max="3" placeholder="1–3 or blank"
                  value={form.topPriority} onChange={e => set('topPriority', e.target.value)} />
              </Field>
              <Field label="Email" error={errors.email}>
                <input className={`input-field ${errors.email ? 'border-red-400 focus:ring-red-200' : ''}`} type="email" value={form.email} onChange={e => set('email', e.target.value)} />
              </Field>
              <Field label="Phone" error={errors.phone}>
                <input className={`input-field ${errors.phone ? 'border-red-400 focus:ring-red-200' : ''}`} type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} />
              </Field>
            </div>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-stone-warm mb-3">Address</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Street Address">
                  <input className="input-field" value={form.streetAddress} onChange={e => set('streetAddress', e.target.value)} />
                </Field>
                <Field label="City">
                  <input className="input-field" value={form.city} onChange={e => set('city', e.target.value)} />
                </Field>
                <Field label={isNonUS ? 'County / Region' : 'State'}>
                  <input className="input-field" value={form.state} onChange={e => set('state', e.target.value)} />
                </Field>
                <Field label={isNonUS ? 'Postcode' : 'Zip'}>
                  <input className="input-field" value={form.zip} onChange={e => set('zip', e.target.value)} />
                </Field>
                <Field label="Country">
                  <CountrySelect value={form.country} onChange={v => set('country', v)} />
                </Field>
              </div>
              <div>
                <p className="label mb-2">Delivery Intent</p>
                <div className="flex flex-wrap gap-3">
                  {DELIVERY_INTENTS.map(intent => {
                    const current = parseDeliveryIntents(form.addressStatus)
                    const checked = current.has(intent)
                    function select() {
                      set('addressStatus', checked ? '' : intent)
                    }
                    return (
                      <label key={intent} className="flex items-center gap-2 cursor-pointer select-none group">
                        <span
                          onClick={select}
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors cursor-pointer
                            ${checked ? 'border-sage-400' : 'bg-white border-cream-300 group-hover:border-sage-300'}`}
                        >
                          {checked && <span className="w-2.5 h-2.5 rounded-full bg-sage-400" />}
                        </span>
                        <span className="text-sm text-stone-dark">{intent}</span>
                      </label>
                    )
                  })}
                </div>
                {parseDeliveryIntents(form.addressStatus).has('Digital Contact') && !form.email && !form.phone && (
                  <p className="mt-2 text-xs text-amber-600 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 3a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 018 4zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                    No email or phone on file for this contact.
                  </p>
                )}
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-stone-warm mb-3">Communication</h3>
            {form.returning && (
              <p className="text-xs text-stone-warm mb-3 flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-sage-400" />
                Returning donor — gave on a previous trip
              </p>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Toggle label="Contacted" checked={form.sent} onChange={v => set('sent', v)} />
              <Toggle label="Followed Up" checked={form.followedUp} onChange={v => set('followedUp', v)} />
              <Toggle label="Thank-You Sent" checked={form.thankYouSent} onChange={v => set('thankYouSent', v)} />
            </div>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-stone-warm mb-3">Partnership</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Toggle label="Financial Partner" checked={form.financialPartner} onChange={v => set('financialPartner', v)} />
              <Toggle label="Prayer Partner" checked={form.prayerPartner} onChange={v => set('prayerPartner', v)} />
              <Toggle label="Pledged to Give" checked={form.pledgedToGive} onChange={v => set('pledgedToGive', v)} />
            </div>
            <p className="text-xs text-stone-warm mt-2">
              Use <strong>Prayer Partner</strong> or <strong>Financial Partner</strong> to record their decision. Prayer-only means they're supportive but not giving financially.
            </p>
            {errors.giftPartnerStatus && (
              <p className="mt-2 text-xs text-red-500">{errors.giftPartnerStatus}</p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
              <Field label="Form of Gift" error={errors.giftFormOfGift}>
                <Select value={form.formOfGift} onValueChange={v => set('formOfGift', v === '__none__' ? '' : v)}>
                  <SelectTrigger className={`w-full ${errors.giftFormOfGift ? 'border-red-400' : ''}`}>
                    <SelectValue placeholder="— None —" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— None —</SelectItem>
                    {GIFT_FORMS.filter(Boolean).map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Gift Amount">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-warm text-sm">$</span>
                  <input className="input-field pl-7" type="number" min="0" step="0.01"
                    value={form.giftAmount} onChange={e => set('giftAmount', e.target.value)} />
                </div>
              </Field>
              <Field label="Date Received" error={errors.giftDateReceived}>
                <input className={`input-field ${errors.giftDateReceived ? 'border-red-400' : ''}`} type="date" value={form.dateReceived}
                  onChange={e => set('dateReceived', e.target.value)} />
              </Field>
            </div>
          </section>

          <section>
            <Field label="Notes">
              <textarea
                className="input-field resize-none h-20"
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
              />
            </Field>
          </section>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-cream-200">
          <div>
            {!isNew && (
              <button
                className="text-sm text-red-400 hover:text-red-600 transition-colors"
                onClick={() => { if (window.confirm(`Delete ${[form.firstName, form.lastName].filter(Boolean).join(' ') || 'this contact'}?`)) onDelete(contact.id) }}
              >
                Delete contact
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={handleSave}>
              {isNew ? 'Add Contact' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
