import { useState } from 'react'
import type { Contact } from '../types'

const RELATIONSHIPS = [
  "Friend's Parents", "Sumner Teacher", "Family", "Friend", "Professor",
  "Western Other", "Family Friend", "Home", "Living Hope",
]

const ADDRESS_STATUSES = [
  "", "Documented", "Need to Look", "Unavailable",
  "Contacted", "Hand Delivery", "Email", "Text",
]

const GIFT_FORMS = ["", "Online Donation", "Check", "Cash"]

type ContactFormState = Omit<Contact, 'id' | 'topPriority' | 'giftAmount' | 'createdAt' | 'updatedAt'> & {
  topPriority: string
  giftAmount: string
}

const BLANK_CONTACT: ContactFormState = {
  fullName: '', relationship: '', returning: false, topPriority: '',
  addressStatus: '', sent: false, letterAddressName: '', salutation: '',
  letterPrinted: false, mainEnvelopePrinted: false, thankYouSent: false,
  notes: '', streetAddress: '', city: '', state: '', zip: '',
  concatenatedAddress: '', phone: '', callMade: false, email: '',
  responded: false, financialPartner: false, prayerPartner: false, pledgedToGive: false,
  formOfGift: '', giftAmount: '', dateReceived: '',
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
                <select className="input-field" value={form.relationship} onChange={e => set('relationship', e.target.value)}>
                  <option value="">— Select —</option>
                  {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Address Status">
                <select className="input-field" value={form.addressStatus} onChange={e => set('addressStatus', e.target.value)}>
                  {ADDRESS_STATUSES.map(s => <option key={s} value={s}>{s || '— Unknown —'}</option>)}
                </select>
              </Field>
              <Field label="Street Address">
                <input className="input-field" value={form.streetAddress} onChange={e => set('streetAddress', e.target.value)} />
              </Field>
              <Field label="City">
                <input className="input-field" value={form.city} onChange={e => set('city', e.target.value)} />
              </Field>
              <Field label="State">
                <input className="input-field" value={form.state} onChange={e => set('state', e.target.value)} />
              </Field>
              <Field label="Zip">
                <input className="input-field" value={form.zip} onChange={e => set('zip', e.target.value)} />
              </Field>
              <Field label="Concatenated Address">
                <input className="input-field" value={form.concatenatedAddress} onChange={e => set('concatenatedAddress', e.target.value)} />
              </Field>
            </div>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-stone-warm mb-3">Communication</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Toggle label="Returning" checked={form.returning} onChange={v => set('returning', v)} />
              <Toggle label="Sent" checked={form.sent} onChange={v => set('sent', v)} />
              <Toggle label="Letter Printed" checked={form.letterPrinted} onChange={v => set('letterPrinted', v)} />
              <Toggle label="Envelope Printed" checked={form.mainEnvelopePrinted} onChange={v => set('mainEnvelopePrinted', v)} />
              <Toggle label="Followed Up" checked={form.callMade} onChange={v => set('callMade', v)} />
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
                <select className="input-field" value={form.formOfGift} onChange={e => set('formOfGift', e.target.value)}>
                  {GIFT_FORMS.map(g => <option key={g} value={g}>{g || '— None —'}</option>)}
                </select>
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
