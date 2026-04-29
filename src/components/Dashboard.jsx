import { useMemo, useState } from 'react'
import GoalSettings from './GoalSettings'

function fmt(n) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtAccounting(n) {
  const abs = Math.abs(n)
  const formatted = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return n < 0 ? `($${formatted})` : `$${formatted}`
}

function StatCard({ label, value, sub, color }) {
  return (
    <div className="card flex flex-col gap-1">
      <p className="text-xs font-medium uppercase tracking-wide text-stone-warm">{label}</p>
      <p className={`text-2xl font-bold ${color || 'text-stone-dark'}`}>{value}</p>
      {sub && <p className="text-xs text-stone-warm">{sub}</p>}
    </div>
  )
}

function ContactRow({ contact, onEdit, showPledged }) {
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

export default function Dashboard({ contacts, goals, totalGoal, onUpdateGoals, onEditContact }) {
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
      called: contacts.filter(c => c.callMade).length,
      partners: partners.length,
      prayerPartners: prayerPartners.length,
      totalReceived,
      pledgedNotReceived,
      pledgedNotReceivedCount,
    }
  }, [contacts])

  const lists = useMemo(() => {
    const needFollowUp = contacts.filter(
      c => c.sent && !c.callMade && !c.financialPartner
    )
    const pledgedFollowUp = needFollowUp.filter(c => c.pledgedToGive)
    const nonPledgedFollowUp = needFollowUp.filter(c => !c.pledgedToGive)
    const followUpNow = [
      ...pledgedFollowUp,
      ...nonPledgedFollowUp.filter(c => c.phone && c.phone.trim() !== ''),
    ]
    const getContactInfo = nonPledgedFollowUp.filter(c => !c.phone || c.phone.trim() === '')
    const reachOutNext = contacts
      .filter(c => !c.sent && c.topPriority != null)
      .sort((a, b) => a.topPriority - b.topPriority)
    const awaitingGift = contacts.filter(c => c.pledgedToGive && !c.financialPartner)
    const sendThankYou = contacts.filter(c => c.financialPartner && !c.thankYouSent)

    return { followUpNow, getContactInfo, reachOutNext, awaitingGift, sendThankYou }
  }, [contacts])

  const pctReceived = Math.min((stats.totalReceived / totalGoal) * 100, 100)
  const tripPct = Math.min((goals.tripCost / totalGoal) * 100, 100)
  const foodPct = Math.min((goals.foodReimbursement / totalGoal) * 100, 100)
  const sfPct = Math.min((goals.sfFlight / totalGoal) * 100, 100)

  return (
    <div className="space-y-6">
      {/* Progress Section */}
      <div className="card">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-stone-dark">Support Goal</h2>
            <p className="text-sm text-stone-warm mt-0.5">Tokyo Mission Trip 2026</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-sage-600 font-mono">{fmtAccounting(stats.totalReceived)}</p>
            <p className="text-sm text-stone-warm">of ${fmt(totalGoal)}</p>
          </div>
        </div>

        {/* Segmented progress bar */}
        <div className="relative h-6 rounded-full bg-cream-200 overflow-hidden mb-3">
          <div
            className="absolute left-0 top-0 h-full bg-sage-400 transition-all duration-500"
            style={{ width: `${pctReceived}%` }}
          />
          {/* Segment dividers */}
          <div
            className="absolute top-0 bottom-0 w-px bg-white/60"
            style={{ left: `${tripPct}%` }}
          />
          <div
            className="absolute top-0 bottom-0 w-px bg-white/60"
            style={{ left: `${tripPct + foodPct}%` }}
          />
        </div>

        <div className="flex gap-4 text-xs text-stone-warm flex-wrap">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-sage-400" />
            <span>Trip Cost: ${fmt(goals.tripCost)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-sage-300" />
            <span>Food: ${fmt(goals.foodReimbursement)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-cream-300" />
            <span>SF Flight: ${fmt(goals.sfFlight)}</span>
          </div>
          <button
            className="ml-auto text-sage-500 hover:text-sage-600 font-medium underline underline-offset-2 transition-colors"
            onClick={() => setShowGoalSettings(true)}
          >
            Edit goals
          </button>
        </div>

      </div>

      {/* Gifts Received Breakdown */}
      <div className="card">
        <h3 className="text-sm font-semibold text-stone-dark mb-3">Gifts Received</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
          <div className="rounded-lg bg-cream-200 border border-cream-300 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-stone-warm mb-1">Prayer Partners</p>
            <p className="text-xl font-bold text-stone-dark">{stats.prayerPartners}</p>
            <p className="text-xs text-stone-warm mt-0.5">supporting in prayer</p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <StatCard label="Total Contacts" value={stats.total} />
        <StatCard label="People Contacted" value={stats.sent} sub={`${stats.total - stats.sent} remaining`} />
        <StatCard label="Follow-Ups Made" value={stats.called} />
        <StatCard label="Partners" value={stats.partners} color="text-sage-600" />
      </div>

      {/* Action Lists */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ActionList
          title="Follow Up Now"
          description="Sent — follow-up to make"
          items={lists.followUpNow}
          onEdit={onEditContact}
          emptyMsg="No follow-ups pending"
          badgeColor="bg-red-50 text-red-600 border border-red-100"
          showPledged
        />
        <ActionList
          title="Get Contact Info"
          description="Sent — no phone number on file"
          items={lists.getContactInfo}
          onEdit={onEditContact}
          emptyMsg="Everyone has a phone number"
          badgeColor="bg-orange-50 text-orange-600 border border-orange-100"
          showPledged
        />
        <ActionList
          title="Reach Out Next"
          description="Not yet sent, by priority"
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
          goals={goals}
          totalGoal={totalGoal}
          onUpdate={onUpdateGoals}
          onClose={() => setShowGoalSettings(false)}
        />
      )}
    </div>
  )
}

function ActionList({ title, description, items, onEdit, emptyMsg, badgeColor, showPledged }) {
  return (
    <div className="card">
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
        <div className="divide-y divide-cream-200 -mx-1">
          {items.slice(0, 8).map(c => (
            <ContactRow key={c.id} contact={c} onEdit={onEdit} showPledged={showPledged} />
          ))}
          {items.length > 8 && (
            <p className="text-xs text-stone-warm pt-2 text-center">
              +{items.length - 8} more
            </p>
          )}
        </div>
      )}
    </div>
  )
}
