import { useState } from 'react'
import { useContacts } from './hooks/useContacts'
import { useTrips } from './hooks/useTrips'
import { useAdditionalRaising } from './hooks/useAdditionalRaising'
import { useSession } from './lib/AuthContext'
import { supabase } from './lib/supabase'
import Dashboard from './components/Dashboard'
import ContactsTable from './components/ContactsTable'
import ContactModal from './components/ContactModal'
import CSVImport from './components/CSVImport'
import LoginPage from './components/LoginPage'
import MissionSetup from './components/MissionSetup'
import NoResponsePage from './components/NoResponsePage'
import TripRollover from './components/TripRollover'
import type { Contact, Trip, ImportMode } from './types'

const TABS = ['Dashboard', 'Contacts', 'No Response'] as const
type Tab = typeof TABS[number]

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
  const totalGoal = (activeTrip?.tripCost ?? 0) + additionalTotal

  const noResponseCount = contacts.filter(
    c => c.followedUp && !c.responded && !c.financialPartner && !c.prayerPartner
  ).length

  const [tab, setTab] = useState<Tab>('Dashboard')
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [addingContact, setAddingContact] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showRollover, setShowRollover] = useState(false)

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
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-sage-500 flex items-center justify-center text-white text-xs font-bold">
                {initials || '?'}
              </div>
              <div>
                <h1 className="text-sm font-semibold text-stone-dark leading-tight">{activeTrip.missionName}</h1>
                <p className="text-xs text-stone-warm leading-tight">Support Tracker</p>
              </div>
            </div>

            <nav className="flex items-center gap-1">
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
                  {t === 'No Response' && noResponseCount > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                      {noResponseCount > 9 ? '9+' : noResponseCount}
                    </span>
                  )}
                </button>
              ))}
              <button
                onClick={() => setShowRollover(true)}
                className="ml-2 px-3 py-1.5 rounded-lg text-sm font-medium text-stone-warm hover:text-stone-dark hover:bg-cream-200 transition-colors"
              >
                New trip
              </button>
              <button
                onClick={() => supabase.auth.signOut()}
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-stone-warm hover:text-stone-dark hover:bg-cream-200 transition-colors"
              >
                Sign out
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {tab === 'Dashboard' && (
          <Dashboard
            contacts={contacts}
            activeTrip={activeTrip}
            totalGoal={totalGoal}
            additionalItems={additionalItems}
            additionalTotal={additionalTotal}
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
        {tab === 'No Response' && (
          <NoResponsePage contacts={contacts} onEdit={contact => setEditingContact(contact)} />
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
    </div>
  )
}
