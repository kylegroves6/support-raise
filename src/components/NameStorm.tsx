import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import type { Contact, Trip } from '../types'

export const RELATIONSHIP_SUGGESTIONS = [
  'Family', 'Friend', 'Family Friend', "Friend's Parents",
  'Church Friend', 'Neighbor', 'Coworker', 'Coach',
  'Teacher / Professor', 'Mentor', 'Community Leader', 'Former Employer',
]

const TAB_THOUGHT_PROVOKERS: Record<string, string[]> = {
  'Family': ['Parents', 'Siblings', 'Relatives', 'Grandparents', 'Aunts & Uncles', 'Cousins'],
  'Friend': ['High school friends', 'College friends', 'Childhood friends', 'Old neighbors'],
  "Friend's Parents": ["Friends of parents", "Parents of friends", "Parents' employers"],
  'Church Friend': ['Church friends', 'Sunday school class', 'Small group', 'Missions board', 'Pastors & staff'],
  'Coworker': ['Former employers', 'Coworkers', 'Classmates'],
  'Coach': ['Coaches', 'Sports teammates'],
  'Teacher / Professor': ['Teachers / Professors', 'Classmates'],
  'Neighbor': ['Neighbors', 'Community leaders', 'Club members'],
  'Community Leader': ['Neighbors', 'Community leaders', 'Club members'],
  'Mentor': ['Cru staff', 'Campus ministry contacts', 'Missions partners'],
}

interface SavedEntry {
  id: string
  firstName: string
  lastName: string
  organization: string
  notes: string
  relationship: string
  createdAt: string
}

interface DuplicateWarning {
  message: string
  existingNote?: string
}

interface Props {
  activeTrip: Trip | null
  contacts: Contact[]
  addContact: (data: Partial<Contact>) => Promise<Contact>
  onCreateTrip: () => void
}

function buildCoupleOrg(firstName: string, lastName: string, spouseFirstName: string): string {
  const fn = firstName.trim()
  const sp = spouseFirstName.trim()
  const ln = lastName.trim()
  if (!fn || !sp) return ''
  return ln ? `${fn} & ${sp} ${ln}` : `${fn} & ${sp}`
}

function normalize(s: string) {
  return s.trim().toLowerCase()
}

function detectWarnings(contacts: Contact[], firstName: string, lastName: string, spouseFirstName = ''): DuplicateWarning[] {
  const fn = normalize(firstName)
  const ln = normalize(lastName)
  const sp = normalize(spouseFirstName)
  if (!fn) return []

  const warnings: DuplicateWarning[] = []
  const seen = new Set<string>()

  function addWarning(w: DuplicateWarning) {
    if (!seen.has(w.message)) {
      seen.add(w.message)
      warnings.push(w)
    }
  }

  for (const c of contacts) {
    const contactFirst = normalize(c.firstName)
    const contactLast = normalize(c.lastName)
    const displayName = [c.firstName, c.lastName].filter(Boolean).join(' ') || c.organization || c.firstName

    // Case: last name empty → warn against every contact sharing the first name
    if (ln === '' && contactFirst === fn) {
      addWarning({
        message: `Is this the same as ${displayName}?`,
        existingNote: c.notes || undefined,
      })
      continue
    }

    // Case: exact primary contact match
    if (contactFirst === fn && contactLast === ln) {
      addWarning({
        message: `${firstName.trim()} ${lastName.trim()} is already in your contacts.`,
        existingNote: c.notes || undefined,
      })
    }

    // Case: matches the spouse on a couple contact (spouse inherits contact's last name)
    if (c.isCouple && c.spouseFirstName) {
      const spouseFirst = normalize(c.spouseFirstName)
      if (spouseFirst === fn && (ln === '' || contactLast === ln)) {
        const coupleDisplay = c.organization || displayName
        addWarning({
          message: `${firstName.trim()} ${lastName.trim()} may already be in your contacts as part of ${coupleDisplay}.`,
          existingNote: c.notes || undefined,
        })
      }
    }

    // Case: form is a couple and both primary + spouse names match an existing couple contact
    if (sp && c.isCouple && c.spouseFirstName) {
      const contactSpouse = normalize(c.spouseFirstName)
      if (contactFirst === fn && contactLast === ln && contactSpouse === sp) {
        const coupleDisplay = c.organization || buildCoupleOrg(c.firstName, c.lastName, c.spouseFirstName)
        addWarning({
          message: `${coupleDisplay} is already in your contacts as a couple.`,
          existingNote: c.notes || undefined,
        })
      }
    }
  }

  return warnings
}

export default function NameStorm({ activeTrip, contacts, addContact, onCreateTrip }: Props) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [spouseFirstName, setSpouseFirstName] = useState('')
  const [organization, setOrganization] = useState('')
  const [isCouple, setIsCouple] = useState(false)
  const [notes, setNotes] = useState('')
  const [relationship, setRelationship] = useState('')
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [savedEntries, setSavedEntries] = useState<SavedEntry[]>([])
  const [recentlyAdded, setRecentlyAdded] = useState<Set<string>>(new Set())

  const firstNameRef = useRef<HTMLInputElement>(null)
  const lastNameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    firstNameRef.current?.focus()
  }, [])

  useEffect(() => {
    if (isCouple) {
      setOrganization(buildCoupleOrg(firstName, lastName, spouseFirstName))
    }
  }, [isCouple, firstName, lastName, spouseFirstName])

  // Compute warnings live as the user types
  const duplicateWarnings = useMemo(
    () => detectWarnings(contacts, firstName, lastName, spouseFirstName),
    [firstName, lastName, spouseFirstName, contacts]
  )

  const clearForm = useCallback(() => {
    setFirstName('')
    setLastName('')
    setSpouseFirstName('')
    setOrganization('')
    setIsCouple(false)
    setNotes('')
    setErrorMsg(null)
    firstNameRef.current?.focus()
  }, [])

  async function handleAdd() {
    const fn = firstName.trim()
    const ln = lastName.trim()
    const org = organization.trim()
    const nt = notes.trim()

    if (!fn) {
      setErrorMsg('First name is required.')
      firstNameRef.current?.focus()
      return
    }
    if (!relationship) {
      setErrorMsg('Select a category before adding.')
      return
    }
    if (!activeTrip) return

    setSaving(true)
    setErrorMsg(null)
    try {
      const contact = await addContact({
        firstName: fn,
        lastName: ln,
        organization: org || undefined,
        notes: nt || undefined,
        relationship,
        isCouple,
        spouseFirstName: isCouple && spouseFirstName.trim() ? spouseFirstName.trim() : undefined,
      })

      const entry: SavedEntry = {
        id: contact.id,
        firstName: fn,
        lastName: ln,
        organization: org,
        notes: nt,
        relationship,
        createdAt: contact.createdAt ?? new Date().toISOString(),
      }
      setSavedEntries(prev => [...prev, entry])
      setRecentlyAdded(prev => new Set(prev).add(contact.id))
      setTimeout(() => {
        setRecentlyAdded(prev => {
          const next = new Set(prev)
          next.delete(contact.id)
          return next
        })
      }, 2500)
      clearForm()
    } catch (err) {
      setErrorMsg(`Failed to save: ${(err as Error).message}`)
    } finally {
      setSaving(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      void handleAdd()
    }
  }

  // Space advances to last name only when the cursor is at the end of the input.
  // Mid-string spaces (e.g. editing) fall through to normal browser handling.
  function handleFirstNameKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === ' ') {
      const val = e.currentTarget.value
      const cursorAtEnd = e.currentTarget.selectionEnd === val.length
      if (val.trim().length > 0 && cursorAtEnd) {
        e.preventDefault()
        lastNameRef.current?.focus()
        return
      }
      return
    }
    handleKeyDown(e)
  }

  if (!activeTrip) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 3h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-stone-dark mb-2">No active trip</h2>
        <p className="text-stone-warm text-sm mb-6 max-w-sm">
          Name Storm requires an active trip to link contacts to. Create a trip first, then come back.
        </p>
        <button
          data-testid="create-trip-btn"
          className="btn-primary"
          onClick={onCreateTrip}
        >
          Create a trip
        </button>
      </div>
    )
  }

  const thoughtProvokers = relationship ? (TAB_THOUGHT_PROVOKERS[relationship] ?? []) : []

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-stone-dark">Name Storm</h2>
        <p className="text-sm text-stone-warm mt-0.5">
          Add names quickly — they'll all link to <span className="font-medium text-stone-dark">{activeTrip.missionName}</span>.
        </p>
      </div>

      {/* ── Category tab row ── */}
      <div className="space-y-1">
        <label className="label">Category <span className="text-red-400">*</span></label>
        <div
          data-testid="category-tabs"
          className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {RELATIONSHIP_SUGGESTIONS.map(cat => (
            <button
              key={cat}
              data-testid={`tab-${cat}`}
              onClick={() => setRelationship(cat)}
              className={[
                'shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap',
                relationship === cat
                  ? 'bg-sage-500 text-white'
                  : 'bg-stone-100 text-stone-warm hover:bg-stone-200',
              ].join(' ')}
              aria-pressed={relationship === cat}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* ── Name inputs ── */}
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="label">First Name <span className="text-red-400">*</span></label>
            <input
              ref={firstNameRef}
              data-testid="first-name-input"
              className="input-field"
              placeholder="First name"
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              onKeyDown={handleFirstNameKeyDown}
              autoComplete="off"
            />
            <p className="text-xs text-stone-light italic">For a church or org with no individual, put the name here.</p>
          </div>
          <div className="space-y-1">
            <label className="label">Last Name</label>
            <input
              ref={lastNameRef}
              data-testid="last-name-input"
              className="input-field"
              placeholder="Last name"
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="off"
            />
          </div>
        </div>

        {/* ── Couple / family section ── */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer w-fit">
            <input
              type="checkbox"
              data-testid="couple-checkbox"
              checked={isCouple}
              onChange={e => {
                setIsCouple(e.target.checked)
                if (!e.target.checked) {
                  setSpouseFirstName('')
                  setOrganization('')
                }
              }}
              className="rounded border-stone-300 text-sage-500 focus:ring-sage-400"
            />
            <span className="text-sm text-stone-warm">This is a couple or family</span>
          </label>

          {isCouple && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-1">
              <div className="space-y-1">
                <label className="label">Spouse / Partner First Name</label>
                <input
                  data-testid="spouse-first-name-input"
                  className="input-field"
                  placeholder="e.g. Sue"
                  value={spouseFirstName}
                  onChange={e => setSpouseFirstName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1">
                <label className="label">Display Name <span className="text-xs font-normal normal-case text-stone-warm">(auto-generated)</span></label>
                <input
                  data-testid="organization-input"
                  className="input-field bg-stone-50 text-stone-warm"
                  placeholder="Kevin & Sue Smith"
                  value={organization}
                  onChange={e => setOrganization(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoComplete="off"
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Notes ── */}
        <div className="space-y-1">
          <label className="label">Note <span className="text-xs font-normal normal-case text-stone-warm">(optional — e.g. "from First Baptist", "Kevin's mom")</span></label>
          <input
            data-testid="notes-input"
            className="input-field"
            placeholder="Any context that helps you remember them"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
          />
        </div>
      </div>

      {/* ── Contextual thought provokers ── */}
      {thoughtProvokers.length > 0 && (
        <div data-testid="thought-provokers" className="rounded-lg bg-stone-50 border border-stone-200 px-4 py-3 space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-widest text-stone-warm">
            Who to think of — {relationship}
          </p>
          <ul className="flex flex-wrap gap-x-4 gap-y-0.5">
            {thoughtProvokers.map(item => (
              <li key={item} className="text-xs text-stone-warm leading-relaxed">{item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Duplicate warnings (inline, stacked) ── */}
      {duplicateWarnings.length > 0 && (
        <ul data-testid="duplicate-warning" className="space-y-1">
          {duplicateWarnings.map((w, i) => (
            <li key={i} className="text-sm text-amber-600">
              <span>⚠ {w.message}</span>
              {w.existingNote && (
                <span className="ml-1 text-xs text-stone-warm italic">Note on file: &ldquo;{w.existingNote}&rdquo;</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {errorMsg && (
        <p data-testid="error-msg" className="text-sm text-red-500">{errorMsg}</p>
      )}

      <button
        data-testid="add-btn"
        className="btn-primary disabled:opacity-50"
        disabled={saving}
        onClick={() => void handleAdd()}
      >
        {saving ? 'Adding…' : 'Add Name'}
      </button>

      {/* ── Running list ── */}
      {savedEntries.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-stone-warm">
            Added this session ({savedEntries.length})
          </p>
          <ul className="space-y-1.5" data-testid="saved-list">
            {[...savedEntries].reverse().map(entry => (
              <li key={entry.id} className="flex items-center gap-2 text-sm text-stone-dark">
                <span
                  className={`w-4 h-4 shrink-0 flex items-center justify-center rounded-full transition-all duration-300 ${
                    recentlyAdded.has(entry.id) ? 'bg-sage-400 text-white scale-110' : 'bg-sage-100 text-sage-500'
                  }`}
                >
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 12 12">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
                  </svg>
                </span>
                <span className="font-medium">
                  {entry.organization || [entry.firstName, entry.lastName].filter(Boolean).join(' ')}
                </span>
                {entry.notes && (
                  <span className="text-xs text-stone-light italic">{entry.notes}</span>
                )}
                {entry.relationship && (
                  <span className="text-xs text-stone-warm">{entry.relationship}</span>
                )}
                <span className="text-xs text-stone-light ml-auto">
                  {new Date(entry.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
