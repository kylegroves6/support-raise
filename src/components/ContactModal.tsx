import { useState, useRef, useEffect } from 'react'
import type { Contact } from '../types'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const RELATIONSHIP_SUGGESTIONS = [
  "Family", "Friend", "Family Friend", "Friend's Parents",
  "Church Friend", "Neighbor", "Coworker", "Coach",
  "Teacher / Professor", "Mentor", "Community Leader", "Former Employer",
]

const ADDRESS_METHOD_OPTIONS = ['Mailing Address', 'Known Email', 'Phone', 'Hand Delivery'] as const
type AddressMethod = typeof ADDRESS_METHOD_OPTIONS[number]

function parseAddressMethods(status: string): Set<AddressMethod> {
  const set = new Set<AddressMethod>()
  for (const part of status.split(',')) {
    const trimmed = part.trim() as AddressMethod
    if ((ADDRESS_METHOD_OPTIONS as readonly string[]).includes(trimmed)) set.add(trimmed)
  }
  return set
}

function serializeAddressMethods(methods: Set<AddressMethod>): string {
  return ADDRESS_METHOD_OPTIONS.filter(m => methods.has(m)).join(', ')
}

const GIFT_FORMS = ["", "Online Donation", "Check", "Cash"]

type ContactFormState = Omit<Contact, 'id' | 'topPriority' | 'giftAmount' | 'createdAt' | 'updatedAt'> & {
  topPriority: string
  giftAmount: string
}

const BLANK_CONTACT: ContactFormState = {
  fullName: '', relationship: '', returning: false, topPriority: '',
  addressStatus: '', sent: false, letterAddressName: '', salutation: '',
  letterPrinted: false, mainEnvelopePrinted: false, thankYouSent: false,
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
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
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
    setForm(f => ({ ...f, [key]: val }))
  }

  function handleSave() {
    const giftAmount = form.giftAmount === '' ? 0 : parseFloat(String(form.giftAmount).replace(/[$,]/g, '')) || 0
    const topPriority = form.topPriority === '' ? null : parseInt(form.topPriority, 10)
    const responded = form.responded || form.financialPartner || form.prayerPartner || giftAmount > 0
    onSave({ ...form, giftAmount, topPriority, responded })
  }

  return (
    <div className="fixed inset-0 bg-stone-dark/40 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-modal w-full max-w-2xl my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-cream-200">
          <h2 className="text-lg font-semibold text-stone-dark">
            {isNew ? 'Add Contact' : form.fullName || 'Edit Contact'}
          </h2>
          <button onClick={onClose} className="btn-ghost text-stone-warm text-xl leading-none">×</button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-stone-warm mb-3">Contact Info</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Full Name">
                <input className="input-field" value={form.fullName} onChange={e => set('fullName', e.target.value)} />
              </Field>
              <Field label="Relationship">
                <RelationshipCombobox value={form.relationship} onChange={v => set('relationship', v)} />
              </Field>
              <Field label="Letter Address Name">
                <input className="input-field" value={form.letterAddressName} onChange={e => set('letterAddressName', e.target.value)} />
              </Field>
              <Field label="Salutation">
                <input className="input-field" value={form.salutation} onChange={e => set('salutation', e.target.value)} />
              </Field>
              <Field label="Email">
                <input className="input-field" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
              </Field>
              <Field label="Phone">
                <input className="input-field" type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} />
              </Field>
              <Field label="Top Priority (1=highest)">
                <input className="input-field" type="number" min="1" max="3" placeholder="1–3 or blank"
                  value={form.topPriority} onChange={e => set('topPriority', e.target.value)} />
              </Field>
            </div>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-stone-warm mb-3">Address</h3>
            {(() => {
              const methods = parseAddressMethods(form.addressStatus)
              function toggleMethod(m: AddressMethod) {
                const next = new Set(methods)
                if (next.has(m)) next.delete(m); else next.add(m)
                set('addressStatus', serializeAddressMethods(next))
              }
              const hasMailingAddress = methods.has('Mailing Address')
              const isNonUS = form.country && form.country.toLowerCase() !== 'us' && form.country.toLowerCase() !== 'usa' && form.country !== ''
              return (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-4">
                    {ADDRESS_METHOD_OPTIONS.map(m => (
                      <label key={m} className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          className="rounded border-cream-300 accent-sage-500 w-4 h-4"
                          checked={methods.has(m)}
                          onChange={() => toggleMethod(m)}
                        />
                        <span className="text-sm text-stone-dark">{m}</span>
                      </label>
                    ))}
                  </div>
                  {hasMailingAddress && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 pl-1 border-l-2 border-cream-200">
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
                        <input className="input-field" placeholder="Leave blank for US" value={form.country} onChange={e => set('country', e.target.value)} />
                      </Field>
                    </div>
                  )}
                </div>
              )
            })()}
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-stone-warm mb-3">Communication</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Toggle label="Returning" checked={form.returning} onChange={v => set('returning', v)} />
              <Toggle label="Sent" checked={form.sent} onChange={v => set('sent', v)} />
              <Toggle label="Letter Printed" checked={form.letterPrinted} onChange={v => set('letterPrinted', v)} />
              <Toggle label="Envelope Printed" checked={form.mainEnvelopePrinted} onChange={v => set('mainEnvelopePrinted', v)} />
              <Toggle label="Followed Up" checked={form.followedUp} onChange={v => set('followedUp', v)} />
              <Toggle label="Thank-You Sent" checked={form.thankYouSent} onChange={v => set('thankYouSent', v)} />
            </div>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-stone-warm mb-3">Partnership</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Toggle label="Responded" checked={form.responded} onChange={v => set('responded', v)} />
              <Toggle label="Financial Partner" checked={form.financialPartner} onChange={v => set('financialPartner', v)} />
              <Toggle label="Prayer Partner" checked={form.prayerPartner} onChange={v => set('prayerPartner', v)} />
              <Toggle label="Pledged to Give" checked={form.pledgedToGive} onChange={v => set('pledgedToGive', v)} />
            </div>
            <p className="text-xs text-stone-warm mt-2">
              Mark <strong>Responded</strong> once you've heard back. Use <strong>Prayer Partner</strong> or <strong>Financial Partner</strong> to record their decision. Prayer-only means they're supportive but not giving financially.
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
                onClick={() => { if (window.confirm(`Delete ${form.fullName}?`)) onDelete(contact.id) }}
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
