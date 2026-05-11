import { useState, useRef, useEffect } from 'react'
import type { Contact } from '../types'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const RELATIONSHIP_SUGGESTIONS = [
  "Family", "Friend", "Family Friend", "Friend's Parents",
  "Church Friend", "Neighbor", "Coworker", "Coach",
  "Teacher / Professor", "Mentor", "Community Leader", "Former Employer",
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

type ContactFormState = Omit<Contact, 'id' | 'topPriority' | 'giftAmount' | 'createdAt' | 'updatedAt'> & {
  topPriority: string
  giftAmount: string
}

const BLANK_CONTACT: ContactFormState = {
  firstName: '', lastName: '', organization: '', relationship: '', returning: false, topPriority: '',
  addressStatus: '', sent: false, salutation: '',
  thankYouSent: false,
  notes: '', streetAddress: '', city: '', state: '', zip: '', country: '',
  concatenatedAddress: '', phone: '', followedUp: false, email: '',
  responded: false, financialPartner: false, prayerPartner: false, pledgedToGive: false,
  formOfGift: '', giftAmount: '', dateReceived: '',
}

function RelationshipCombobox({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => { setQuery(value) }, [value])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = query.trim()
    ? RELATIONSHIP_SUGGESTIONS.filter(r => r.toLowerCase().includes(query.toLowerCase()))
    : RELATIONSHIP_SUGGESTIONS

  function select(val: string) {
    onChange(val)
    setQuery(val)
    setOpen(false)
  }

  return (
    <div className="relative" ref={ref}>
      <input
        className="input-field"
        value={query}
        placeholder="Type or choose…"
        onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-cream-200 rounded-xl shadow-modal overflow-hidden">
          <div className="max-h-48 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:#c4b5a8_transparent] [&::-webkit-scrollbar]:block [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-stone-light">
            {filtered.map(r => (
              <button
                key={r}
                type="button"
                className={`w-full text-left px-3 py-1.5 text-sm transition-colors hover:bg-sage-50 hover:text-sage-700 ${value === r ? 'text-sage-700 font-medium' : 'text-stone-dark'}`}
                onMouseDown={e => { e.preventDefault(); select(r) }}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
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
      ? { ...contact, giftAmount: contact.giftAmount != null ? String(contact.giftAmount) : '', topPriority: contact.topPriority != null ? String(contact.topPriority) : '' }
      : BLANK_CONTACT
  )

  function set<K extends keyof ContactFormState>(key: K, val: ContactFormState[K]) {
    setForm(f => {
      const next = { ...f, [key]: val }
      // Auto-populate salutation from first name when adding a new contact and salutation is blank
      if (key === 'firstName' && isNew && !f.salutation) {
        next.salutation = val as string
      }
      return next
    })
  }

  function handleSave() {
    const giftAmount = form.giftAmount === '' ? 0 : parseFloat(String(form.giftAmount).replace(/[$,]/g, '')) || 0
    const topPriority = form.topPriority === '' ? null : parseInt(form.topPriority, 10)
    const responded = form.responded || form.financialPartner || form.prayerPartner || giftAmount > 0
    onSave({ ...form, giftAmount, topPriority, responded })
  }

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
                <RelationshipCombobox value={form.relationship} onChange={v => set('relationship', v)} />
              </Field>
              <Field label="Salutation">
                <input className="input-field" value={form.salutation} onChange={e => set('salutation', e.target.value)} />
              </Field>
              <Field label="Top Priority (1=highest)">
                <input className="input-field" type="number" min="1" max="3" placeholder="1–3 or blank"
                  value={form.topPriority} onChange={e => set('topPriority', e.target.value)} />
              </Field>
              <Field label="Email">
                <input className="input-field" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
              </Field>
              <Field label="Phone">
                <input className="input-field" type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} />
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
                <Field label={form.country && form.country.toLowerCase() !== 'us' && form.country.toLowerCase() !== 'usa' && form.country !== '' ? 'County / Region' : 'State'}>
                  <input className="input-field" value={form.state} onChange={e => set('state', e.target.value)} />
                </Field>
                <Field label={form.country && form.country.toLowerCase() !== 'us' && form.country.toLowerCase() !== 'usa' && form.country !== '' ? 'Postcode' : 'Zip'}>
                  <input className="input-field" value={form.zip} onChange={e => set('zip', e.target.value)} />
                </Field>
                <Field label="Country">
                  <input className="input-field" placeholder="Leave blank for US" value={form.country} onChange={e => set('country', e.target.value)} />
                </Field>
              </div>
              <div>
                <p className="label mb-2">Delivery Intent</p>
                <div className="flex flex-wrap gap-3">
                  {DELIVERY_INTENTS.map(intent => {
                    const current = parseDeliveryIntents(form.addressStatus)
                    const checked = current.has(intent)
                    function select() {
                      // clicking the active option deselects; otherwise exclusively selects
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
              <Field label="Form of Gift">
                <Select value={form.formOfGift} onValueChange={v => set('formOfGift', v === '__none__' ? '' : v)}>
                  <SelectTrigger className="w-full">
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
              <Field label="Date Received">
                <input className="input-field" type="date" value={form.dateReceived}
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
