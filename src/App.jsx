import { useState } from 'react'
import { useContacts } from './hooks/useContacts'
import { useGoalSettings } from './hooks/useGoalSettings'
import { useSession } from './lib/AuthContext'
import { supabase } from './lib/supabase'
import Dashboard from './components/Dashboard'
import ContactsTable from './components/ContactsTable'
import ContactModal from './components/ContactModal'
import CSVImport from './components/CSVImport'
import LoginPage from './components/LoginPage'

const TABS = ['Dashboard', 'Contacts']

export default function App() {
  const session = useSession()

  if (session === undefined) return null // loading
  if (!session) return <LoginPage />

  return <AuthenticatedApp />
}

function AuthenticatedApp() {
  const { contacts, addContact, updateContact, deleteContact, importContacts, replaceAll } = useContacts()
  const { goals, totalGoal, updateGoals } = useGoalSettings()

  const [tab, setTab] = useState('Dashboard')
  const [editingContact, setEditingContact] = useState(null)
  const [addingContact, setAddingContact] = useState(false)
  const [showImport, setShowImport] = useState(false)

  function handleEditContact(contact) {
    setEditingContact(contact)
  }

  function handleSaveContact(data) {
    if (editingContact) {
      updateContact(editingContact.id, data)
    } else {
      addContact(data)
    }
    setEditingContact(null)
    setAddingContact(false)
  }

  function handleDeleteContact(id) {
    deleteContact(id)
    setEditingContact(null)
  }

  function handleImport(contacts, mode) {
    if (mode === 'replace') {
      replaceAll(contacts)
    } else {
      importContacts(contacts)
    }
  }

  function closeModal() {
    setEditingContact(null)
    setAddingContact(false)
  }

  return (
    <div className="min-h-screen bg-cream-100">
      {/* Header */}
      <header className="bg-white border-b border-cream-300 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-sage-500 flex items-center justify-center text-white text-xs font-bold">
                T
              </div>
              <div>
                <h1 className="text-sm font-semibold text-stone-dark leading-tight">Tokyo Mission</h1>
                <p className="text-xs text-stone-warm leading-tight">Support Tracker</p>
              </div>
            </div>

            <nav className="flex items-center gap-1">
              {TABS.map(t => (
                <button
                  key={t}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    tab === t
                      ? 'bg-sage-100 text-sage-600'
                      : 'text-stone-warm hover:text-stone-dark hover:bg-cream-200'
                  }`}
                  onClick={() => setTab(t)}
                >
                  {t}
                </button>
              ))}
              <button
                onClick={() => supabase.auth.signOut()}
                className="ml-2 px-3 py-1.5 rounded-lg text-sm font-medium text-stone-warm hover:text-stone-dark hover:bg-cream-200 transition-colors"
              >
                Sign out
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {tab === 'Dashboard' && (
          <Dashboard
            contacts={contacts}
            goals={goals}
            totalGoal={totalGoal}
            onUpdateGoals={updateGoals}
            onEditContact={(c) => { handleEditContact(c); setTab('Contacts') }}
          />
        )}
        {tab === 'Contacts' && (
          <ContactsTable
            contacts={contacts}
            onEdit={handleEditContact}
            onAdd={() => setAddingContact(true)}
            onImport={() => setShowImport(true)}
          />
        )}
      </main>

      {/* Modals */}
      {(editingContact || addingContact) && (
        <ContactModal
          contact={editingContact}
          onSave={handleSaveContact}
          onDelete={handleDeleteContact}
          onClose={closeModal}
        />
      )}

      {showImport && (
        <CSVImport
          onImport={handleImport}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  )
}
