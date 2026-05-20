import { useState, useRef, useEffect } from 'react'
import { useContacts } from './hooks/useContacts'
import { useTrips } from './hooks/useTrips'
import { useAdditionalRaising } from './hooks/useAdditionalRaising'
import { useActivityLog } from './hooks/useActivityLog'
import { useSession } from './lib/AuthContext'
import { supabase } from './lib/supabase'
import Dashboard from './components/Dashboard'
import ContactsTable from './components/ContactsTable'
import ContactModal from './components/ContactModal'
import CSVImport from './components/CSVImport'
import LoginPage from './components/LoginPage'
import MissionSetup from './components/MissionSetup'
import TripRollover from './components/TripRollover'
import TripHistory from './components/TripHistory'
import NameStorm from './components/NameStorm'
import type { Contact, Trip, ImportMode } from './types'

const TABS = ['Dashboard', 'Contacts', 'Name Storm'] as const
type Tab = typeof TABS[number]

const TAB_ICONS: Record<Tab, JSX.Element> = {
  Dashboard: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  Contacts: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  'Name Storm': (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  ),
}

export default function App() {
  const session = useSession()

  if (session === undefined) return null
  if (!session) return <LoginPage />

  return <AuthenticatedApp />
}

function AuthenticatedApp() {
  const { activeTrip, createTrip, updateActiveTrip } = useTrips()
  const { contacts, addContact, updateContact, deleteContact, importContacts, replaceAll, deleteAll, deleteMany, updateMany, ensureAllContactTrips } = useContacts(activeTrip?.id)
  const { items: additionalItems, additionalTotal, addItem, updateItem, deleteItem } = useAdditionalRaising()
  const { followUpNeeded } = useActivityLog()
  const totalGoal = (activeTrip?.tripCost ?? 0) + additionalTotal

  const [tab, setTab] = useState<Tab>('Dashboard')
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [addingContact, setAddingContact] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showRollover, setShowRollover] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [tripMenuOpen, setTripMenuOpen] = useState(false)
  const tripMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!tripMenuOpen) return
    function handleClick(e: MouseEvent) {
      if (tripMenuRef.current && !tripMenuRef.current.contains(e.target as Node)) {
        setTripMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [tripMenuOpen])

  // activeTrip === undefined means still loading; null means no trip yet
  if (activeTrip === undefined) return null
  if (activeTrip === null) {
    return (
      <MissionSetup
        onSave={async updates => { await createTrip(updates) }}
      />
    )
  }

  async function handleSaveContact(data: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>) {
    try {
      if (editingContact) {
        await updateContact(editingContact.id, data)
      } else {
        await addContact(data)
      }
      setEditingContact(null)
      setAddingContact(false)
    } catch (err) {
      alert(`Failed to save contact: ${(err as Error).message}`)
    }
  }

  async function handleDeleteContact(id: string) {
    try {
      await deleteContact(id)
      setEditingContact(null)
    } catch (err) {
      alert(`Failed to delete contact: ${(err as Error).message}`)
    }
  }

  async function handleImport(contacts: Contact[], mode: ImportMode) {
    try {
      if (mode === 'replace') {
        await replaceAll(contacts)
      } else {
        await importContacts(contacts)
      }
    } catch (err) {
      alert(`Import failed: ${(err as Error).message}`)
    }
  }

  async function handleRollover(tripData: Omit<Trip, 'id' | 'userId' | 'isActive' | 'createdAt'>) {
    const newTrip = await createTrip(tripData)
    await ensureAllContactTrips(newTrip.id)
    setShowRollover(false)
  }

  function closeModal() {
    setEditingContact(null)
    setAddingContact(false)
  }

  const initials = activeTrip.missionName
    .split(' ')
    .filter(w => w.length > 0)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('')

  return (
    <div className="min-h-screen bg-cream-100">
      <header className="bg-white border-b border-cream-300 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            {/* Mobile: current tab name centered */}
            <span className="sm:hidden absolute left-1/2 -translate-x-1/2 text-sm font-semibold text-stone-dark pointer-events-none">
              {tab}
            </span>
            <div className="relative" ref={tripMenuRef}>
              <button
                className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-cream-100 transition-colors text-left"
                onClick={() => setTripMenuOpen(v => !v)}
              >
                <div className="w-7 h-7 rounded-lg bg-sage-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {initials || '?'}
                </div>
                {/* Mission name: visible on sm+ only */}
                <div className="hidden sm:block min-w-0">
                  <h1 className="text-sm font-semibold text-stone-dark leading-tight truncate max-w-[160px]">{activeTrip.missionName}</h1>
                  <p className="text-xs text-stone-warm leading-tight">Support Tracker</p>
                </div>
                <svg className="w-3.5 h-3.5 text-stone-warm shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {tripMenuOpen && (
                <div className="absolute left-0 top-full mt-1.5 w-44 bg-white border border-cream-300 rounded-xl shadow-lg py-1 z-20">
                  <button
                    className="w-full text-left px-4 py-2 text-sm text-stone-dark hover:bg-cream-100 transition-colors"
                    onClick={() => { setTripMenuOpen(false); setShowRollover(true) }}
                  >
                    New trip
                  </button>
                  <button
                    className="w-full text-left px-4 py-2 text-sm text-stone-dark hover:bg-cream-100 transition-colors"
                    onClick={() => { setTripMenuOpen(false); setShowHistory(true) }}
                  >
                    Trip history
                  </button>
                  <div className="border-t border-cream-200 my-1" />
                  <button
                    className="w-full text-left px-4 py-2 text-sm text-stone-warm hover:bg-cream-100 transition-colors"
                    onClick={() => supabase.auth.signOut()}
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>

            {/* Desktop nav — hidden on mobile */}
            <nav className="hidden sm:flex items-center gap-1">
              {TABS.map(t => (
                <button
                  key={t}
                  className={`relative px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    tab === t
                      ? 'bg-sage-100 text-sage-600'
                      : 'text-stone-warm hover:text-stone-dark hover:bg-cream-200'
                  }`}
                  onClick={() => setTab(t)}
                >
                  {t}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-24 sm:pb-6">
        {tab === 'Dashboard' && (
          <Dashboard
            contacts={contacts}
            activeTrip={activeTrip}
            totalGoal={totalGoal}
            additionalItems={additionalItems}
            onUpdateTrip={updateActiveTrip}
            onAddAdditionalItem={addItem}
            onUpdateAdditionalItem={updateItem}
            onDeleteAdditionalItem={deleteItem}
            onEditContact={contact => setEditingContact(contact)}
          />
        )}
        {tab === 'Contacts' && (
          <ContactsTable
            contacts={contacts}
            followUpNeeded={followUpNeeded}
            onEdit={contact => setEditingContact(contact)}
            onAdd={() => setAddingContact(true)}
            onImport={() => setShowImport(true)}
            onDeleteAll={async () => {
              if (!confirm(`Delete all ${contacts.length} contacts? This cannot be undone.`)) return
              try { await deleteAll() } catch (err) { alert(`Failed: ${(err as Error).message}`) }
            }}
            onDeleteMany={deleteMany}
            onUpdateMany={updateMany}
          />
        )}
        {tab === 'Name Storm' && (
          <NameStorm
            activeTrip={activeTrip}
            contacts={contacts}
            addContact={addContact}
            onCreateTrip={() => setShowRollover(true)}
          />
        )}

      </main>

      {(editingContact || addingContact) && (
        <ContactModal
          contact={editingContact}
          onSave={handleSaveContact}
          onDelete={handleDeleteContact}
          onClose={closeModal}
        />
      )}

      {showImport && (
        <CSVImport onImport={handleImport} onClose={() => setShowImport(false)} />
      )}

      {showRollover && (
        <TripRollover
          currentMission={activeTrip.missionName}
          onRollover={handleRollover}
          onClose={() => setShowRollover(false)}
        />
      )}

      {showHistory && (
        <TripHistory onClose={() => setShowHistory(false)} />
      )}

      {/* Mobile bottom nav — hidden on sm+ */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-cream-300 z-10">
        <div className="flex">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              aria-label={t}
              className={`flex-1 flex items-center justify-center py-3 transition-colors ${
                tab === t
                  ? 'text-cru-blue'
                  : 'text-stone-warm'
              }`}
            >
              {TAB_ICONS[t]}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
