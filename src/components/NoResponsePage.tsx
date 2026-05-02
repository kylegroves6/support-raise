import { useMemo } from 'react'
import type { Contact } from '../types'

interface Props {
  contacts: Contact[]
  onEdit: (contact: Contact) => void
}

function ContactCard({ contact, onEdit }: { contact: Contact; onEdit: (c: Contact) => void }) {
  return (
    <div
      className="flex items-center justify-between px-4 py-3 rounded-lg bg-white border border-cream-200 hover:border-sage-200 hover:shadow-sm cursor-pointer transition-all"
      onClick={() => onEdit(contact)}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-stone-dark truncate">{contact.fullName}</p>
        <p className="text-xs text-stone-warm truncate">{contact.relationship}</p>
        {contact.phone && (
          <p className="text-xs text-stone-light mt-0.5">{contact.phone}</p>
        )}
      </div>
      <div className="flex items-center gap-1.5 ml-3 shrink-0">
        {contact.pledgedToGive && (
          <span className="chip bg-amber-100 text-amber-700 border border-amber-200 text-xs">Pledged</span>
        )}
        {contact.topPriority != null && (
          <span className="chip bg-amber-100 text-amber-700 text-xs">P{contact.topPriority}</span>
        )}
        <span className="text-xs text-stone-light">→ edit</span>
      </div>
    </div>
  )
}

export default function NoResponsePage({ contacts, onEdit }: Props) {
  const { awaitingResponse, respondedLately, needFollowUpWithPhone, needFollowUpNoPhone } = useMemo(() => {
    // Followed up but no response yet, not a partner of any kind
    const awaitingResponse = contacts.filter(
      c => c.followedUp && !c.responded && !c.financialPartner && !c.prayerPartner
    )

    // Sort: pledged first, then by name
    awaitingResponse.sort((a, b) => {
      if (a.pledgedToGive && !b.pledgedToGive) return -1
      if (!a.pledgedToGive && b.pledgedToGive) return 1
      return a.fullName.localeCompare(b.fullName)
    })

    // Letter sent but no follow-up yet, no response
    const needFollowUp = contacts.filter(
      c => c.sent && !c.followedUp && !c.responded && !c.financialPartner && !c.prayerPartner
    ).sort((a, b) => a.fullName.localeCompare(b.fullName))

    const needFollowUpWithPhone = needFollowUp.filter(c => !!c.phone)
    const needFollowUpNoPhone = needFollowUp.filter(c => !c.phone)

    // People who have responded (followedUp + responded) — useful reference
    const respondedLately = contacts.filter(
      c => c.followedUp && c.responded
    ).sort((a, b) => a.fullName.localeCompare(b.fullName))

    return { awaitingResponse, respondedLately, needFollowUpWithPhone, needFollowUpNoPhone }
  }, [contacts])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-stone-dark">No Response Yet</h2>
        <p className="text-sm text-stone-warm mt-0.5">
          Followed up — waiting to hear back. Click any contact to mark them as responded or update their status.
        </p>
      </div>

      {(needFollowUpWithPhone.length > 0 || needFollowUpNoPhone.length > 0) && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-stone-dark text-sm">Ready to Follow Up</h3>
              <p className="text-xs text-stone-warm">Letter sent — reach out to check in</p>
            </div>
            <span className="chip bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
              {needFollowUpWithPhone.length + needFollowUpNoPhone.length}
            </span>
          </div>

          {needFollowUpWithPhone.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-medium text-stone-warm uppercase tracking-wide mb-2">Have phone number</p>
              <div className="space-y-2">
                {needFollowUpWithPhone.map(c => (
                  <ContactCard key={c.id} contact={c} onEdit={onEdit} />
                ))}
              </div>
            </div>
          )}

          {needFollowUpNoPhone.length > 0 && (
            <div>
              <p className="text-xs font-medium text-stone-warm uppercase tracking-wide mb-2">No phone on file</p>
              <div className="space-y-2">
                {needFollowUpNoPhone.map(c => (
                  <ContactCard key={c.id} contact={c} onEdit={onEdit} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-stone-dark text-sm">Awaiting Response</h3>
            <p className="text-xs text-stone-warm">Follow-up made, no reply received</p>
          </div>
          {awaitingResponse.length > 0 && (
            <span className="chip bg-red-50 text-red-600 border border-red-100 font-semibold">
              {awaitingResponse.length}
            </span>
          )}
        </div>

        {awaitingResponse.length === 0 ? (
          <p className="text-sm text-stone-light italic py-4 text-center">
            Everyone has responded — great work!
          </p>
        ) : (
          <div className="space-y-2">
            {awaitingResponse.map(c => (
              <ContactCard key={c.id} contact={c} onEdit={onEdit} />
            ))}
          </div>
        )}
      </div>

      {respondedLately.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-stone-dark text-sm">Have Responded</h3>
              <p className="text-xs text-stone-warm">Follow-up made and response recorded</p>
            </div>
            <span className="chip bg-sage-50 text-sage-600 border border-sage-200 font-semibold">
              {respondedLately.length}
            </span>
          </div>
          <div className="space-y-2">
            {respondedLately.map(c => (
              <div
                key={c.id}
                className="flex items-center justify-between px-4 py-3 rounded-lg bg-sage-50 border border-sage-100 hover:border-sage-200 cursor-pointer transition-all"
                onClick={() => onEdit(c)}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-stone-dark truncate">{c.fullName}</p>
                  <p className="text-xs text-stone-warm truncate">{c.relationship}</p>
                </div>
                <div className="flex items-center gap-1.5 ml-3 shrink-0">
                  {c.financialPartner && (
                    <span className="chip bg-sage-100 text-sage-700 border border-sage-200 text-xs">Partner</span>
                  )}
                  {c.prayerPartner && (
                    <span className="chip bg-blue-100 text-blue-700 border border-blue-200 text-xs">Prayer</span>
                  )}
                  {c.pledgedToGive && !c.financialPartner && (
                    <span className="chip bg-amber-100 text-amber-700 border border-amber-200 text-xs">Pledged</span>
                  )}
                  <span className="text-xs text-sage-500">✓</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
