import { useMemo, useState } from 'react'
import GoalSettings from './GoalSettings'
import type { Contact, Trip, AdditionalRaisingItem } from '../types'

function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtAccounting(n: number): string {
  const abs = Math.abs(n)
  const formatted = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return n < 0 ? `($${formatted})` : `$${formatted}`
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const target = new Date(dateStr + 'T00:00:00')
  const diff = target.getTime() - new Date().getTime()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return ''
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

interface StatCardProps {
  label: string
  value: number
  sub?: string
  color?: string
}

function StatCard({ label, value, sub, color }: StatCardProps) {
  return (
    <div className="card flex flex-col gap-1">
      <p className="text-xs font-medium uppercase tracking-wide text-stone-warm">{label}</p>
      <p className={`text-2xl font-bold ${color || 'text-stone-dark'}`}>{value}</p>
      {sub && <p className="text-xs text-stone-warm">{sub}</p>}
    </div>
  )
}

interface FractionCardProps {
  label: string
  numerator: number
  denominator: number
  remaining: number
  color?: string
}

function FractionCard({ label, numerator, denominator, remaining, color }: FractionCardProps) {
  const pct = denominator > 0 ? Math.round((numerator / denominator) * 100) : 0
  return (
    <div className="card flex flex-col gap-1">
      <p className="text-xs font-medium uppercase tracking-wide text-stone-warm">{label}</p>
      <p className={`text-2xl font-bold ${color || 'text-stone-dark'}`}>
        {numerator} <span className="text-base font-medium text-stone-warm">/ {denominator}</span>
      </p>
      <p className="text-xs text-stone-warm">{remaining} remaining · {pct}%</p>
    </div>
  )
}

interface ContactRowProps {
  contact: Contact
  onEdit: (contact: Contact) => void
  showPledged?: boolean
}

function ContactRow({ contact, onEdit, showPledged }: ContactRowProps) {
  return (
    <div
      className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-cream-100 cursor-pointer transition-colors"
      onClick={() => onEdit(contact)}
    >
      <div>
        <p className="text-sm font-medium text-stone-dark">{contact.fullName}</p>
        <p className="text-xs text-stone-warm">{contact.relationship}</p>
      </div>
      <div className="flex items-center gap-1.5">
        {showPledged && contact.pledgedToGive && (
          <span className="chip bg-amber-100 text-amber-700 text-xs border border-amber-200">Pledged</span>
        )}
        {contact.topPriority != null && (
          <span className="chip bg-amber-100 text-amber-700 text-xs">P{contact.topPriority}</span>
        )}
      </div>
    </div>
  )
}

interface DashboardProps {
  contacts: Contact[]
  activeTrip: Trip
  totalGoal: number
  additionalItems: AdditionalRaisingItem[]
  additionalTotal: number
  onUpdateTrip: (updates: Partial<Omit<Trip, 'id' | 'userId' | 'isActive' | 'createdAt'>>) => Promise<void>
  onAddAdditionalItem: (label: string, amount: number) => Promise<void>
  onUpdateAdditionalItem: (id: string, label: string, amount: number) => Promise<void>
  onDeleteAdditionalItem: (id: string) => Promise<void>
  onEditContact: (contact: Contact) => void
}

export default function Dashboard({
  contacts, activeTrip, totalGoal, additionalItems,
  onUpdateTrip, onAddAdditionalItem, onUpdateAdditionalItem, onDeleteAdditionalItem,
  onEditContact,
}: DashboardProps) {
  const [showGoalSettings, setShowGoalSettings] = useState(false)

  const stats = useMemo(() => {
    const partners = contacts.filter(c => c.financialPartner)
    const totalReceived = partners.reduce((s, c) => s + (c.giftAmount || 0), 0)
    const pledgedNotReceived = contacts
      .filter(c => c.pledgedToGive && !c.financialPartner)
      .reduce((s, c) => s + (c.giftAmount || 0), 0)

    const prayerPartners = contacts.filter(c => c.prayerPartner)
    const pledgedNotReceivedCount = contacts.filter(c => c.pledgedToGive && !c.financialPartner).length

    return {
      total: contacts.length,
      sent: contacts.filter(c => c.sent).length,
      called: contacts.filter(c => c.followedUp).length,
      partners: partners.length,
      prayerPartners: prayerPartners.length,
      totalReceived,
      pledgedNotReceived,
      pledgedNotReceivedCount,
    }
  }, [contacts])

  const lists = useMemo(() => {
    const needFollowUp = contacts.filter(
      c => c.sent && !c.followedUp && !c.financialPartner && !c.responded
    )
    const hasContactMethod = (c: Contact) =>
      (c.phone && c.phone.trim() !== '') || (c.email && c.email.trim() !== '')
    const pledgedFollowUp = needFollowUp.filter(c => c.pledgedToGive)
    const nonPledgedFollowUp = needFollowUp.filter(c => !c.pledgedToGive)
    const followUpNow = [
      ...pledgedFollowUp,
      ...nonPledgedFollowUp.filter(hasContactMethod),
    ]
    const noContactMethod = nonPledgedFollowUp.filter(c => !hasContactMethod(c))
    const reachOutNext = contacts
      .filter(c => !c.sent && c.topPriority != null)
      .sort((a, b) => (a.topPriority ?? 0) - (b.topPriority ?? 0))
    const awaitingGift = contacts.filter(c => c.pledgedToGive && !c.financialPartner)
    const sendThankYou = contacts.filter(c => c.financialPartner && !c.thankYouSent)

    return { followUpNow, noContactMethod, reachOutNext, awaitingGift, sendThankYou }
  }, [contacts])

  const pctReceived = Math.min((stats.totalReceived / totalGoal) * 100, 100)
  const pctRounded = Math.round(pctReceived)
  const remaining = Math.max(totalGoal - stats.totalReceived, 0)
  const days = daysUntil(activeTrip.missionStart)
  const perDay = days != null && days > 0 ? remaining / days : null

  // Gradient stop color based on completion
  const barColor =
    pctReceived >= 100
      ? 'from-sage-500 to-sage-600'
      : pctReceived >= 66
      ? 'from-sage-400 to-sage-500'
      : pctReceived >= 33
      ? 'from-amber-400 to-sage-400'
      : 'from-amber-500 to-amber-400'

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-stone-dark">Support Goal</h2>
            {activeTrip.missionStart && (
              <p className="text-sm text-stone-warm mt-0.5">
                {fmtDate(activeTrip.missionStart)}{activeTrip.missionEnd ? ` – ${fmtDate(activeTrip.missionEnd)}` : ''}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-sage-600 font-mono">{fmtAccounting(stats.totalReceived)}</p>
            <p className="text-sm text-stone-warm">of ${fmt(totalGoal)}</p>
          </div>
        </div>

        <div className="relative h-7 rounded-full bg-cream-200 overflow-hidden mb-2">
          <div
            className={`absolute left-0 top-0 h-full bg-gradient-to-r ${barColor} transition-all duration-500`}
            style={{ width: `${pctReceived}%` }}
          />
          {pctReceived > 8 && (
            <div
              className="absolute top-0 h-full flex items-center pr-2 pointer-events-none"
              style={{ left: 0, width: `${pctReceived}%` }}
            >
              <span className="ml-auto text-xs font-bold text-white drop-shadow">{pctRounded}%</span>
            </div>
          )}
          {pctReceived <= 8 && pctReceived > 0 && (
            <div
              className="absolute top-0 h-full flex items-center pl-2 pointer-events-none"
              style={{ left: `${pctReceived}%` }}
            >
              <span className="text-xs font-bold text-stone-warm">{pctRounded}%</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-warm mb-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-sage-400" />
            <span>Trip Cost: ${fmt(activeTrip.tripCost)}</span>
          </div>
          {additionalItems.map(item => (
            <div key={item.id} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm bg-amber-300" />
              <span>{item.label}: ${fmt(item.amount)}</span>
            </div>
          ))}
          <button
            className="ml-auto text-sage-500 hover:text-sage-600 font-medium underline underline-offset-2 transition-colors"
            onClick={() => setShowGoalSettings(true)}
          >
            Edit goals
          </button>
        </div>

        <div className={`grid gap-3 pt-3 border-t border-cream-200 ${days != null ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
          {days != null && (
            <div className="text-center">
              <p className="text-2xl font-bold text-stone-dark font-mono">{days}</p>
              <p className="text-xs text-stone-warm mt-0.5">days until departure</p>
              {activeTrip.missionStart && <p className="text-xs text-stone-light">{fmtDate(activeTrip.missionStart)}</p>}
            </div>
          )}
          <div className="text-center">
            <p className="text-2xl font-bold font-mono text-amber-600">{fmtAccounting(remaining)}</p>
            <p className="text-xs text-stone-warm mt-0.5">still needed</p>
          </div>
          {perDay != null && (
            <div className="text-center col-span-2 sm:col-span-1">
              <p className="text-2xl font-bold font-mono text-sage-600">${fmt(Math.ceil(perDay))}</p>
              <p className="text-xs text-stone-warm mt-0.5">needed per day</p>
              <p className="text-xs text-stone-light">rough projection</p>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-stone-dark mb-3">Gifts Received</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-lg bg-sage-50 border border-sage-100 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-sage-600 mb-1">Received</p>
            <p className="text-xl font-bold font-mono text-sage-700">{fmtAccounting(stats.totalReceived)}</p>
            <p className="text-xs text-stone-warm mt-0.5">{stats.partners} financial {stats.partners === 1 ? 'partner' : 'partners'}</p>
          </div>
          <div className="rounded-lg bg-amber-50 border border-amber-100 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-amber-700 mb-1">Pledged</p>
            <p className="text-xl font-bold font-mono text-amber-700">{fmtAccounting(stats.pledgedNotReceived)}</p>
            <p className="text-xs text-stone-warm mt-0.5">{stats.pledgedNotReceivedCount} {stats.pledgedNotReceivedCount === 1 ? 'person' : 'people'} committed</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <FractionCard
          label="Contacted"
          numerator={stats.sent}
          denominator={stats.total}
          remaining={stats.total - stats.sent}
        />
        <StatCard label="Follow-Ups Made" value={stats.called} />
        <StatCard label="Partners" value={stats.partners} color="text-sage-600" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ActionList
          title="Follow Up Now"
          description="Contacted — follow-up to make"
          items={lists.followUpNow}
          onEdit={onEditContact}
          emptyMsg="No follow-ups pending"
          badgeColor="bg-red-50 text-red-600 border border-red-100"
          showPledged
        />
        <ActionList
          title="No Contact Method"
          description="Contacted — no phone or email on file"
          items={lists.noContactMethod}
          onEdit={onEditContact}
          emptyMsg="Everyone has a contact method"
          badgeColor="bg-orange-50 text-orange-600 border border-orange-100"
          showPledged
        />
        <ActionList
          title="Reach Out Next"
          description="Not yet contacted, by priority"
          items={lists.reachOutNext}
          onEdit={onEditContact}
          emptyMsg="All contacts reached"
          badgeColor="bg-amber-50 text-amber-700 border border-amber-100"
        />
        <ActionList
          title="Awaiting Gift"
          description="Pledged but not received"
          items={lists.awaitingGift}
          onEdit={onEditContact}
          emptyMsg="No pending pledges"
          badgeColor="bg-blue-50 text-blue-600 border border-blue-100"
        />
        <ActionList
          title="Send Thank You"
          description="Gift received, no thank-you yet"
          items={lists.sendThankYou}
          onEdit={onEditContact}
          emptyMsg="All thank-yous sent!"
          badgeColor="bg-sage-50 text-sage-600 border border-sage-200"
        />
      </div>

      {showGoalSettings && (
        <GoalSettings
          activeTrip={activeTrip}
          additionalItems={additionalItems}
          onUpdateTrip={onUpdateTrip}
          onAddItem={onAddAdditionalItem}
          onUpdateItem={onUpdateAdditionalItem}
          onDeleteItem={onDeleteAdditionalItem}
          onClose={() => setShowGoalSettings(false)}
        />
      )}
    </div>
  )
}

interface ActionListProps {
  title: string
  description: string
  items: Contact[]
  onEdit: (contact: Contact) => void
  emptyMsg: string
  badgeColor: string
  showPledged?: boolean
}

function ActionList({ title, description, items, onEdit, emptyMsg, badgeColor, showPledged }: ActionListProps) {
  return (
    <div className="card flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-stone-dark text-sm">{title}</h3>
          <p className="text-xs text-stone-warm">{description}</p>
        </div>
        {items.length > 0 && (
          <span className={`chip ${badgeColor} font-semibold`}>{items.length}</span>
        )}
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-stone-light italic py-2">{emptyMsg}</p>
      ) : (
        <div className="divide-y divide-cream-200 -mx-1 overflow-y-auto max-h-72">
          {items.map(c => (
            <ContactRow key={c.id} contact={c} onEdit={onEdit} showPledged={showPledged} />
          ))}
        </div>
      )}
    </div>
  )
}
