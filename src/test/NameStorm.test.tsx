import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NameStorm from '../components/NameStorm'
import type { Contact, HouseholdMember, Trip } from '../types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: 'trip-1',
    userId: 'user-1',
    missionName: 'Test Mission',
    missionStart: null,
    missionEnd: null,
    tripCost: 0,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeContact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: 'c-existing',
    firstName: 'John',
    lastName: 'Smith',
    organization: undefined,
    relationship: 'Friend',
    returning: false,
    topPriority: null,
    addressStatus: '',
    salutation: '',
    notes: '',
    streetAddress: '',
    city: '',
    state: '',
    zip: '',
    country: '',
    concatenatedAddress: '',
    phone: '',
    email: '',
    sent: false,
    thankYouSent: false,
    followedUp: false,
    responded: false,
    financialPartner: false,
    prayerPartner: false,
    pledgedToGive: false,
    formOfGift: '',
    giftAmount: 0,
    dateReceived: '',
    householdMembers: [],
    ...overrides,
  }
}

function makeHouseholdMember(overrides: Partial<HouseholdMember> = {}): HouseholdMember {
  return {
    id: 'hm-1',
    contactId: 'c-existing',
    firstName: 'Sue',
    lastName: undefined,
    role: 'spouse',
    ...overrides,
  }
}

function makeAddContact(result: Partial<Contact> = {}) {
  return vi.fn().mockResolvedValue({
    ...makeContact(),
    id: 'new-contact-1',
    ...result,
  } as Contact)
}

function makeAddHouseholdMember(result: Partial<HouseholdMember> = {}) {
  return vi.fn().mockResolvedValue({
    ...makeHouseholdMember(),
    ...result,
  } as HouseholdMember)
}

const noop = vi.fn()
const noContacts: Contact[] = []
const noopHousehold = vi.fn().mockResolvedValue(makeHouseholdMember())

beforeEach(() => {
  vi.clearAllMocks()
})

// ── No active trip ────────────────────────────────────────────────────────────

describe('no active trip', () => {
  it('shows a prompt to create a trip when activeTrip is null', () => {
    render(<NameStorm activeTrip={null} contacts={noContacts} addContact={noop as never} addHouseholdMember={noopHousehold} onCreateTrip={noop} />)
    expect(screen.getByText(/no active trip/i)).toBeInTheDocument()
    expect(screen.getByTestId('create-trip-btn')).toBeInTheDocument()
  })

  it('calls onCreateTrip when the button is clicked', async () => {
    const onCreateTrip = vi.fn()
    render(<NameStorm activeTrip={null} contacts={noContacts} addContact={noop as never} addHouseholdMember={noopHousehold} onCreateTrip={onCreateTrip} />)
    await userEvent.click(screen.getByTestId('create-trip-btn'))
    expect(onCreateTrip).toHaveBeenCalledOnce()
  })

  it('does not render the name entry form when there is no trip', () => {
    render(<NameStorm activeTrip={null} contacts={noContacts} addContact={noop as never} addHouseholdMember={noopHousehold} onCreateTrip={noop} />)
    expect(screen.queryByTestId('first-name-input')).not.toBeInTheDocument()
  })
})

// ── Category tabs ─────────────────────────────────────────────────────────────

describe('category tabs', () => {
  it('renders one tab per RELATIONSHIP_SUGGESTIONS entry', () => {
    render(<NameStorm activeTrip={makeTrip()} contacts={noContacts} addContact={noop as never} addHouseholdMember={noopHousehold} onCreateTrip={noop} />)
    expect(screen.getByTestId('tab-Family')).toBeInTheDocument()
    expect(screen.getByTestId('tab-Friend')).toBeInTheDocument()
    expect(screen.getByTestId('tab-Church Friend')).toBeInTheDocument()
  })

  it('marks the clicked tab as active (aria-pressed)', async () => {
    render(<NameStorm activeTrip={makeTrip()} contacts={noContacts} addContact={noop as never} addHouseholdMember={noopHousehold} onCreateTrip={noop} />)
    const friendTab = screen.getByTestId('tab-Friend')
    expect(friendTab).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(friendTab)
    expect(friendTab).toHaveAttribute('aria-pressed', 'true')
  })

  it('switching tabs deactivates the previous one', async () => {
    render(<NameStorm activeTrip={makeTrip()} contacts={noContacts} addContact={noop as never} addHouseholdMember={noopHousehold} onCreateTrip={noop} />)
    await userEvent.click(screen.getByTestId('tab-Family'))
    await userEvent.click(screen.getByTestId('tab-Friend'))
    expect(screen.getByTestId('tab-Family')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('tab-Friend')).toHaveAttribute('aria-pressed', 'true')
  })
})

// ── Thought provokers ─────────────────────────────────────────────────────────

describe('contextual thought provokers', () => {
  it('are hidden when no category is selected', () => {
    render(<NameStorm activeTrip={makeTrip()} contacts={noContacts} addContact={noop as never} addHouseholdMember={noopHousehold} onCreateTrip={noop} />)
    expect(screen.queryByTestId('thought-provokers')).not.toBeInTheDocument()
  })

  it('shows thought provokers for Family tab', async () => {
    render(<NameStorm activeTrip={makeTrip()} contacts={noContacts} addContact={noop as never} addHouseholdMember={noopHousehold} onCreateTrip={noop} />)
    await userEvent.click(screen.getByTestId('tab-Family'))
    const tp = screen.getByTestId('thought-provokers')
    expect(tp).toBeInTheDocument()
    expect(tp).toHaveTextContent('Parents')
    expect(tp).toHaveTextContent('Siblings')
  })

  it('shows thought provokers for Friend tab', async () => {
    render(<NameStorm activeTrip={makeTrip()} contacts={noContacts} addContact={noop as never} addHouseholdMember={noopHousehold} onCreateTrip={noop} />)
    await userEvent.click(screen.getByTestId('tab-Friend'))
    const tp = screen.getByTestId('thought-provokers')
    expect(tp).toHaveTextContent('High school friends')
    expect(tp).toHaveTextContent('College friends')
  })

  it('updates thought provokers when switching tabs', async () => {
    render(<NameStorm activeTrip={makeTrip()} contacts={noContacts} addContact={noop as never} addHouseholdMember={noopHousehold} onCreateTrip={noop} />)
    await userEvent.click(screen.getByTestId('tab-Family'))
    expect(screen.getByTestId('thought-provokers')).toHaveTextContent('Parents')
    await userEvent.click(screen.getByTestId('tab-Friend'))
    expect(screen.getByTestId('thought-provokers')).toHaveTextContent('High school friends')
    expect(screen.getByTestId('thought-provokers')).not.toHaveTextContent('Parents')
  })

  it('shows no thought provokers for a category without a mapping', async () => {
    render(<NameStorm activeTrip={makeTrip()} contacts={noContacts} addContact={noop as never} addHouseholdMember={noopHousehold} onCreateTrip={noop} />)
    await userEvent.click(screen.getByTestId('tab-Former Employer'))
    expect(screen.queryByTestId('thought-provokers')).not.toBeInTheDocument()
  })
})

// ── Duplicate detection — inline warnings ─────────────────────────────────────

describe('duplicate detection — exact match', () => {
  it('shows a warning when first + last name exactly matches an existing contact', async () => {
    const existing = [makeContact({ firstName: 'John', lastName: 'Smith' })]
    render(<NameStorm activeTrip={makeTrip()} contacts={existing} addContact={noop as never} addHouseholdMember={noopHousehold} onCreateTrip={noop} />)

    fireEvent.change(screen.getByTestId('first-name-input'), { target: { value: 'John' } })
    fireEvent.change(screen.getByTestId('last-name-input'), { target: { value: 'Smith' } })

    await waitFor(() =>
      expect(screen.getByTestId('duplicate-warning')).toHaveTextContent(/john smith is already in your contacts/i)
    )
  })

  it('is case-insensitive', async () => {
    const existing = [makeContact({ firstName: 'John', lastName: 'Smith' })]
    render(<NameStorm activeTrip={makeTrip()} contacts={existing} addContact={noop as never} addHouseholdMember={noopHousehold} onCreateTrip={noop} />)

    fireEvent.change(screen.getByTestId('first-name-input'), { target: { value: 'john' } })
    fireEvent.change(screen.getByTestId('last-name-input'), { target: { value: 'SMITH' } })

    await waitFor(() =>
      expect(screen.getByTestId('duplicate-warning')).toBeInTheDocument()
    )
  })

  it('shows existing note alongside the warning when the matched contact has notes', async () => {
    const existing = [makeContact({ firstName: 'John', lastName: 'Smith', notes: 'from First Baptist' })]
    render(<NameStorm activeTrip={makeTrip()} contacts={existing} addContact={noop as never} addHouseholdMember={noopHousehold} onCreateTrip={noop} />)

    fireEvent.change(screen.getByTestId('first-name-input'), { target: { value: 'John' } })
    fireEvent.change(screen.getByTestId('last-name-input'), { target: { value: 'Smith' } })

    await waitFor(() =>
      expect(screen.getByTestId('duplicate-warning')).toHaveTextContent(/from First Baptist/i)
    )
  })

  it('clears the warning when the name no longer matches', async () => {
    const existing = [makeContact({ firstName: 'John', lastName: 'Smith' })]
    render(<NameStorm activeTrip={makeTrip()} contacts={existing} addContact={noop as never} addHouseholdMember={noopHousehold} onCreateTrip={noop} />)

    fireEvent.change(screen.getByTestId('first-name-input'), { target: { value: 'John' } })
    fireEvent.change(screen.getByTestId('last-name-input'), { target: { value: 'Smith' } })
    await waitFor(() => expect(screen.getByTestId('duplicate-warning')).toBeInTheDocument())

    fireEvent.change(screen.getByTestId('last-name-input'), { target: { value: 'Jones' } })
    await waitFor(() => expect(screen.queryByTestId('duplicate-warning')).not.toBeInTheDocument())
  })

  it('shows no warning when contacts list is empty', async () => {
    render(<NameStorm activeTrip={makeTrip()} contacts={noContacts} addContact={noop as never} addHouseholdMember={noopHousehold} onCreateTrip={noop} />)
    fireEvent.change(screen.getByTestId('first-name-input'), { target: { value: 'John' } })
    fireEvent.change(screen.getByTestId('last-name-input'), { target: { value: 'Smith' } })
    await waitFor(() => expect(screen.queryByTestId('duplicate-warning')).not.toBeInTheDocument())
  })

  it('still allows saving a duplicate (soft warning, not a block)', async () => {
    const existing = [makeContact({ firstName: 'John', lastName: 'Smith' })]
    const addContact = makeAddContact({ firstName: 'John', lastName: 'Smith' })
    render(<NameStorm activeTrip={makeTrip()} contacts={existing} addContact={addContact} addHouseholdMember={noopHousehold} onCreateTrip={noop} />)

    await userEvent.click(screen.getByTestId('tab-Friend'))
    fireEvent.change(screen.getByTestId('first-name-input'), { target: { value: 'John' } })
    fireEvent.change(screen.getByTestId('last-name-input'), { target: { value: 'Smith' } })

    await waitFor(() => expect(screen.getByTestId('duplicate-warning')).toBeInTheDocument())
    await userEvent.click(screen.getByTestId('add-btn'))
    await waitFor(() => expect(addContact).toHaveBeenCalledOnce())
  })
})

describe('duplicate detection — same first name, different last name', () => {
  it('does NOT warn when first names match but last names differ', async () => {
    const existing = [makeContact({ firstName: 'Kevin', lastName: 'Smith' })]
    render(<NameStorm activeTrip={makeTrip()} contacts={existing} addContact={noop as never} addHouseholdMember={noopHousehold} onCreateTrip={noop} />)

    fireEvent.change(screen.getByTestId('first-name-input'), { target: { value: 'Kevin' } })
    fireEvent.change(screen.getByTestId('last-name-input'), { target: { value: 'Jones' } })

    await waitFor(() => expect(screen.queryByTestId('duplicate-warning')).not.toBeInTheDocument())
  })
})

describe('duplicate detection — first name only (no last name typed)', () => {
  it('warns against ALL contacts sharing the first name when last name is empty', async () => {
    const existing = [
      makeContact({ id: 'c-1', firstName: 'Kevin', lastName: 'Smith' }),
      makeContact({ id: 'c-2', firstName: 'Kevin', lastName: 'Jones' }),
    ]
    render(<NameStorm activeTrip={makeTrip()} contacts={existing} addContact={noop as never} addHouseholdMember={noopHousehold} onCreateTrip={noop} />)

    fireEvent.change(screen.getByTestId('first-name-input'), { target: { value: 'Kevin' } })
    // Leave last name empty

    await waitFor(() => {
      const warning = screen.getByTestId('duplicate-warning')
      expect(warning).toHaveTextContent(/Kevin Smith/i)
      expect(warning).toHaveTextContent(/Kevin Jones/i)
    })
  })

  it('uses "Is this the same as…" phrasing for first-name-only matches', async () => {
    const existing = [makeContact({ firstName: 'Kevin', lastName: 'Smith' })]
    render(<NameStorm activeTrip={makeTrip()} contacts={existing} addContact={noop as never} addHouseholdMember={noopHousehold} onCreateTrip={noop} />)

    fireEvent.change(screen.getByTestId('first-name-input'), { target: { value: 'Kevin' } })

    await waitFor(() =>
      expect(screen.getByTestId('duplicate-warning')).toHaveTextContent(/is this the same as Kevin Smith/i)
    )
  })

  it('warning disappears once a non-matching last name is typed', async () => {
    const existing = [makeContact({ firstName: 'Kevin', lastName: 'Smith' })]
    render(<NameStorm activeTrip={makeTrip()} contacts={existing} addContact={noop as never} addHouseholdMember={noopHousehold} onCreateTrip={noop} />)

    fireEvent.change(screen.getByTestId('first-name-input'), { target: { value: 'Kevin' } })
    await waitFor(() => expect(screen.getByTestId('duplicate-warning')).toBeInTheDocument())

    fireEvent.change(screen.getByTestId('last-name-input'), { target: { value: 'Jones' } })
    await waitFor(() => expect(screen.queryByTestId('duplicate-warning')).not.toBeInTheDocument())
  })

  it('first-name-only match shows the note from the existing contact', async () => {
    const existing = [makeContact({ firstName: 'Kevin', lastName: 'Smith', notes: 'church small group' })]
    render(<NameStorm activeTrip={makeTrip()} contacts={existing} addContact={noop as never} addHouseholdMember={noopHousehold} onCreateTrip={noop} />)

    fireEvent.change(screen.getByTestId('first-name-input'), { target: { value: 'Kevin' } })

    await waitFor(() =>
      expect(screen.getByTestId('duplicate-warning')).toHaveTextContent(/church small group/i)
    )
  })
})

describe('duplicate detection — household member (spouse) match', () => {
  it('warns when typed name matches a household member (spouse) on an existing contact', async () => {
    const existing = [makeContact({
      id: 'c-kevin',
      firstName: 'Kevin',
      lastName: 'Smith',
      organization: 'Kevin & Sue Smith',
      householdMembers: [makeHouseholdMember({ contactId: 'c-kevin', firstName: 'Sue', lastName: undefined })],
    })]
    render(<NameStorm activeTrip={makeTrip()} contacts={existing} addContact={noop as never} addHouseholdMember={noopHousehold} onCreateTrip={noop} />)

    fireEvent.change(screen.getByTestId('first-name-input'), { target: { value: 'Sue' } })
    fireEvent.change(screen.getByTestId('last-name-input'), { target: { value: 'Smith' } })

    await waitFor(() =>
      expect(screen.getByTestId('duplicate-warning')).toHaveTextContent(/part of Kevin & Sue Smith/i)
    )
  })

  it('does not warn for household member match when last name differs', async () => {
    const existing = [makeContact({
      id: 'c-kevin',
      firstName: 'Kevin',
      lastName: 'Smith',
      organization: 'Kevin & Sue Smith',
      householdMembers: [makeHouseholdMember({ contactId: 'c-kevin', firstName: 'Sue', lastName: undefined })],
    })]
    render(<NameStorm activeTrip={makeTrip()} contacts={existing} addContact={noop as never} addHouseholdMember={noopHousehold} onCreateTrip={noop} />)

    fireEvent.change(screen.getByTestId('first-name-input'), { target: { value: 'Sue' } })
    fireEvent.change(screen.getByTestId('last-name-input'), { target: { value: 'Jones' } })

    await waitFor(() => expect(screen.queryByTestId('duplicate-warning')).not.toBeInTheDocument())
  })

  it('warns when typed name matches a household member with an explicit different last name', async () => {
    // Member has her own last name (e.g. kept maiden name)
    const existing = [makeContact({
      id: 'c-kevin',
      firstName: 'Kevin',
      lastName: 'Smith',
      householdMembers: [makeHouseholdMember({ contactId: 'c-kevin', firstName: 'Sue', lastName: 'Williams' })],
    })]
    render(<NameStorm activeTrip={makeTrip()} contacts={existing} addContact={noop as never} addHouseholdMember={noopHousehold} onCreateTrip={noop} />)

    fireEvent.change(screen.getByTestId('first-name-input'), { target: { value: 'Sue' } })
    fireEvent.change(screen.getByTestId('last-name-input'), { target: { value: 'Williams' } })

    await waitFor(() =>
      expect(screen.getByTestId('duplicate-warning')).toBeInTheDocument()
    )
  })

  it('shows multiple warnings when both exact and household member conflicts exist', async () => {
    // Kevin Smith exists as a standalone contact
    // AND Kevin is a household member on a different record (Sue's record)
    const existing = [
      makeContact({ id: 'c-1', firstName: 'Kevin', lastName: 'Smith', householdMembers: [] }),
      makeContact({
        id: 'c-sue',
        firstName: 'Sue',
        lastName: 'Smith',
        organization: 'Sue & Kevin Smith',
        householdMembers: [makeHouseholdMember({ contactId: 'c-sue', firstName: 'Kevin', lastName: undefined })],
      }),
    ]
    render(<NameStorm activeTrip={makeTrip()} contacts={existing} addContact={noop as never} addHouseholdMember={noopHousehold} onCreateTrip={noop} />)

    fireEvent.change(screen.getByTestId('first-name-input'), { target: { value: 'Kevin' } })
    fireEvent.change(screen.getByTestId('last-name-input'), { target: { value: 'Smith' } })

    await waitFor(() => {
      const warning = screen.getByTestId('duplicate-warning')
      expect(warning).toHaveTextContent(/kevin smith is already in your contacts/i)
      expect(warning).toHaveTextContent(/part of Sue & Kevin Smith/i)
    })
  })
})

// ── Space-to-advance ──────────────────────────────────────────────────────────

describe('space-to-advance from first name to last name', () => {
  it('focuses last name when Space is pressed at end of first name', () => {
    render(<NameStorm activeTrip={makeTrip()} contacts={noContacts} addContact={noop as never} addHouseholdMember={noopHousehold} onCreateTrip={noop} />)
    const firstNameInput = screen.getByTestId('first-name-input')
    const lastNameInput = screen.getByTestId('last-name-input')

    fireEvent.change(firstNameInput, { target: { value: 'Kyle' } })
    Object.defineProperty(firstNameInput, 'selectionEnd', { value: 4, configurable: true })
    fireEvent.keyDown(firstNameInput, { key: ' ', code: 'Space' })

    expect(document.activeElement).toBe(lastNameInput)
  })

  it('does NOT advance when Space is pressed on an empty first name field', () => {
    render(<NameStorm activeTrip={makeTrip()} contacts={noContacts} addContact={noop as never} addHouseholdMember={noopHousehold} onCreateTrip={noop} />)
    const firstNameInput = screen.getByTestId('first-name-input')

    firstNameInput.focus()
    Object.defineProperty(firstNameInput, 'selectionEnd', { value: 0, configurable: true })
    fireEvent.keyDown(firstNameInput, { key: ' ', code: 'Space' })

    expect(document.activeElement).toBe(firstNameInput)
  })

  it('does NOT add a trailing space to the first name value when Space advances', () => {
    render(<NameStorm activeTrip={makeTrip()} contacts={noContacts} addContact={noop as never} addHouseholdMember={noopHousehold} onCreateTrip={noop} />)
    const firstNameInput = screen.getByTestId('first-name-input')

    fireEvent.change(firstNameInput, { target: { value: 'Kyle' } })
    Object.defineProperty(firstNameInput, 'selectionEnd', { value: 4, configurable: true })
    fireEvent.keyDown(firstNameInput, { key: ' ', code: 'Space' })

    expect(firstNameInput).toHaveValue('Kyle')
  })

  it('does NOT advance when Space is pressed mid-string (cursor not at end)', () => {
    render(<NameStorm activeTrip={makeTrip()} contacts={noContacts} addContact={noop as never} addHouseholdMember={noopHousehold} onCreateTrip={noop} />)
    const firstNameInput = screen.getByTestId('first-name-input')
    const lastNameInput = screen.getByTestId('last-name-input')

    fireEvent.change(firstNameInput, { target: { value: 'KyleJohn' } })
    firstNameInput.focus()
    // Cursor at position 4, value length is 8 → mid-string
    Object.defineProperty(firstNameInput, 'selectionEnd', { value: 4, configurable: true })
    fireEvent.keyDown(firstNameInput, { key: ' ', code: 'Space' })

    expect(document.activeElement).not.toBe(lastNameInput)
  })
})

// ── Notes field ───────────────────────────────────────────────────────────────

describe('notes field', () => {
  it('renders the notes input', () => {
    render(<NameStorm activeTrip={makeTrip()} contacts={noContacts} addContact={noop as never} addHouseholdMember={noopHousehold} onCreateTrip={noop} />)
    expect(screen.getByTestId('notes-input')).toBeInTheDocument()
  })

  it('passes notes to addContact when filled in', async () => {
    const addContact = makeAddContact()
    render(<NameStorm activeTrip={makeTrip()} contacts={noContacts} addContact={addContact} addHouseholdMember={noopHousehold} onCreateTrip={noop} />)

    await userEvent.click(screen.getByTestId('tab-Friend'))
    fireEvent.change(screen.getByTestId('first-name-input'), { target: { value: 'Alice' } })
    fireEvent.change(screen.getByTestId('notes-input'), { target: { value: 'from First Baptist' } })

    await userEvent.click(screen.getByTestId('add-btn'))
    await waitFor(() =>
      expect(addContact).toHaveBeenCalledWith(
        expect.objectContaining({ notes: 'from First Baptist' })
      )
    )
  })

  it('shows notes in the saved list', async () => {
    const addContact = makeAddContact({ id: 'c-notes', firstName: 'Alice' })
    render(<NameStorm activeTrip={makeTrip()} contacts={noContacts} addContact={addContact} addHouseholdMember={noopHousehold} onCreateTrip={noop} />)

    await userEvent.click(screen.getByTestId('tab-Friend'))
    fireEvent.change(screen.getByTestId('first-name-input'), { target: { value: 'Alice' } })
    fireEvent.change(screen.getByTestId('notes-input'), { target: { value: 'from First Baptist' } })

    await userEvent.click(screen.getByTestId('add-btn'))
    await waitFor(() => expect(screen.getByTestId('saved-list')).toBeInTheDocument())
    expect(screen.getByText('from First Baptist')).toBeInTheDocument()
  })

  it('clears notes after a successful add', async () => {
    const addContact = makeAddContact()
    render(<NameStorm activeTrip={makeTrip()} contacts={noContacts} addContact={addContact} addHouseholdMember={noopHousehold} onCreateTrip={noop} />)

    await userEvent.click(screen.getByTestId('tab-Friend'))
    fireEvent.change(screen.getByTestId('first-name-input'), { target: { value: 'Alice' } })
    fireEvent.change(screen.getByTestId('notes-input'), { target: { value: 'some note' } })

    await userEvent.click(screen.getByTestId('add-btn'))
    await waitFor(() => expect(screen.getByTestId('notes-input')).toHaveValue(''))
  })
})

// ── Empty first name blocked ──────────────────────────────────────────────────

describe('empty first name blocked', () => {
  it('shows an error when Add is clicked with no first name', async () => {
    render(<NameStorm activeTrip={makeTrip()} contacts={noContacts} addContact={noop as never} addHouseholdMember={noopHousehold} onCreateTrip={noop} />)
    await userEvent.click(screen.getByTestId('tab-Friend'))
    await userEvent.click(screen.getByTestId('add-btn'))
    expect(screen.getByTestId('error-msg')).toHaveTextContent(/first name is required/i)
    expect(noop).not.toHaveBeenCalled()
  })

  it('shows an error when Enter is pressed with no first name', async () => {
    render(<NameStorm activeTrip={makeTrip()} contacts={noContacts} addContact={noop as never} addHouseholdMember={noopHousehold} onCreateTrip={noop} />)
    await userEvent.click(screen.getByTestId('tab-Friend'))
    const input = screen.getByTestId('first-name-input')
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })
    expect(screen.getByTestId('error-msg')).toHaveTextContent(/first name is required/i)
  })
})

// ── No category selected ──────────────────────────────────────────────────────

describe('no category selected', () => {
  it('blocks add and shows error when no category tab is active', async () => {
    render(<NameStorm activeTrip={makeTrip()} contacts={noContacts} addContact={noop as never} addHouseholdMember={noopHousehold} onCreateTrip={noop} />)
    fireEvent.change(screen.getByTestId('first-name-input'), { target: { value: 'Jane' } })
    await userEvent.click(screen.getByTestId('add-btn'))
    expect(screen.getByTestId('error-msg')).toHaveTextContent(/select a category/i)
    expect(noop).not.toHaveBeenCalled()
  })
})

// ── Successful add ────────────────────────────────────────────────────────────

describe('successful add', () => {
  it('calls addContact with correct fields and appends entry to list', async () => {
    const addContact = makeAddContact({ id: 'c-1', firstName: 'Jane', lastName: 'Smith', relationship: 'Friend' })
    render(<NameStorm activeTrip={makeTrip()} contacts={noContacts} addContact={addContact} addHouseholdMember={noopHousehold} onCreateTrip={noop} />)

    await userEvent.click(screen.getByTestId('tab-Friend'))
    fireEvent.change(screen.getByTestId('first-name-input'), { target: { value: 'Jane' } })
    fireEvent.change(screen.getByTestId('last-name-input'), { target: { value: 'Smith' } })

    await userEvent.click(screen.getByTestId('add-btn'))

    await waitFor(() => expect(addContact).toHaveBeenCalledOnce())
    expect(addContact).toHaveBeenCalledWith(
      expect.objectContaining({ firstName: 'Jane', lastName: 'Smith', relationship: 'Friend' })
    )

    await waitFor(() => expect(screen.getByTestId('saved-list')).toBeInTheDocument())
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
  })

  it('clears first name and last name after a successful add', async () => {
    const addContact = makeAddContact()
    render(<NameStorm activeTrip={makeTrip()} contacts={noContacts} addContact={addContact} addHouseholdMember={noopHousehold} onCreateTrip={noop} />)

    await userEvent.click(screen.getByTestId('tab-Family'))
    fireEvent.change(screen.getByTestId('first-name-input'), { target: { value: 'Bob' } })
    fireEvent.change(screen.getByTestId('last-name-input'), { target: { value: 'Jones' } })

    await userEvent.click(screen.getByTestId('add-btn'))
    await waitFor(() => expect(addContact).toHaveBeenCalledOnce())

    await waitFor(() => {
      expect(screen.getByTestId('first-name-input')).toHaveValue('')
      expect(screen.getByTestId('last-name-input')).toHaveValue('')
    })
  })

  it('uses organization field as display name in saved list when set', async () => {
    const addContact = makeAddContact({ id: 'c-2', firstName: 'Kevin', organization: 'Kevin & Sue Smith' })
    render(<NameStorm activeTrip={makeTrip()} contacts={noContacts} addContact={addContact} addHouseholdMember={noopHousehold} onCreateTrip={noop} />)

    await userEvent.click(screen.getByTestId('tab-Family'))
    fireEvent.change(screen.getByTestId('first-name-input'), { target: { value: 'Kevin' } })
    await userEvent.click(screen.getByTestId('couple-checkbox'))
    fireEvent.change(screen.getByTestId('spouse-first-name-input'), { target: { value: 'Sue' } })
    fireEvent.change(screen.getByTestId('last-name-input'), { target: { value: 'Smith' } })

    await userEvent.click(screen.getByTestId('add-btn'))
    await waitFor(() => screen.getByText('Kevin & Sue Smith'))
  })

  it('passes organization to addContact when set', async () => {
    const addContact = makeAddContact()
    render(<NameStorm activeTrip={makeTrip()} contacts={noContacts} addContact={addContact} addHouseholdMember={noopHousehold} onCreateTrip={noop} />)

    await userEvent.click(screen.getByTestId('tab-Church Friend'))
    fireEvent.change(screen.getByTestId('first-name-input'), { target: { value: 'Mike' } })
    await userEvent.click(screen.getByTestId('couple-checkbox'))
    fireEvent.change(screen.getByTestId('spouse-first-name-input'), { target: { value: 'Amy' } })
    fireEvent.change(screen.getByTestId('last-name-input'), { target: { value: 'Brown' } })

    await userEvent.click(screen.getByTestId('add-btn'))
    await waitFor(() =>
      expect(addContact).toHaveBeenCalledWith(
        expect.objectContaining({ organization: 'Mike & Amy Brown' })
      )
    )
  })
})

// ── Couple auto-generation + household member save ────────────────────────────

describe('couple auto-generation', () => {
  it('couple checkbox reveals spouse first name input', async () => {
    render(<NameStorm activeTrip={makeTrip()} contacts={noContacts} addContact={noop as never} addHouseholdMember={noopHousehold} onCreateTrip={noop} />)
    expect(screen.queryByTestId('spouse-first-name-input')).not.toBeInTheDocument()
    await userEvent.click(screen.getByTestId('couple-checkbox'))
    expect(screen.getByTestId('spouse-first-name-input')).toBeInTheDocument()
  })

  it('auto-generates organization with last name', async () => {
    render(<NameStorm activeTrip={makeTrip()} contacts={noContacts} addContact={noop as never} addHouseholdMember={noopHousehold} onCreateTrip={noop} />)
    await userEvent.click(screen.getByTestId('couple-checkbox'))
    fireEvent.change(screen.getByTestId('first-name-input'), { target: { value: 'Kevin' } })
    fireEvent.change(screen.getByTestId('last-name-input'), { target: { value: 'Smith' } })
    fireEvent.change(screen.getByTestId('spouse-first-name-input'), { target: { value: 'Sue' } })
    await waitFor(() => {
      expect(screen.getByTestId('organization-input')).toHaveValue('Kevin & Sue Smith')
    })
  })

  it('auto-generates organization without last name', async () => {
    render(<NameStorm activeTrip={makeTrip()} contacts={noContacts} addContact={noop as never} addHouseholdMember={noopHousehold} onCreateTrip={noop} />)
    await userEvent.click(screen.getByTestId('couple-checkbox'))
    fireEvent.change(screen.getByTestId('first-name-input'), { target: { value: 'Kevin' } })
    fireEvent.change(screen.getByTestId('spouse-first-name-input'), { target: { value: 'Sue' } })
    await waitFor(() => {
      expect(screen.getByTestId('organization-input')).toHaveValue('Kevin & Sue')
    })
  })

  it('clears auto-generated org when couple checkbox is unchecked', async () => {
    render(<NameStorm activeTrip={makeTrip()} contacts={noContacts} addContact={noop as never} addHouseholdMember={noopHousehold} onCreateTrip={noop} />)
    await userEvent.click(screen.getByTestId('couple-checkbox'))
    fireEvent.change(screen.getByTestId('first-name-input'), { target: { value: 'Kevin' } })
    fireEvent.change(screen.getByTestId('spouse-first-name-input'), { target: { value: 'Sue' } })
    await waitFor(() => expect(screen.getByTestId('organization-input')).toHaveValue('Kevin & Sue'))

    await userEvent.click(screen.getByTestId('couple-checkbox'))
    expect(screen.queryByTestId('spouse-first-name-input')).not.toBeInTheDocument()
  })

  it('clears couple state after a successful add', async () => {
    const addContact = makeAddContact()
    render(<NameStorm activeTrip={makeTrip()} contacts={noContacts} addContact={addContact} addHouseholdMember={noopHousehold} onCreateTrip={noop} />)
    await userEvent.click(screen.getByTestId('tab-Family'))
    await userEvent.click(screen.getByTestId('couple-checkbox'))
    fireEvent.change(screen.getByTestId('first-name-input'), { target: { value: 'Kevin' } })
    fireEvent.change(screen.getByTestId('spouse-first-name-input'), { target: { value: 'Sue' } })

    await userEvent.click(screen.getByTestId('add-btn'))
    await waitFor(() => expect(addContact).toHaveBeenCalledOnce())

    await waitFor(() => {
      expect(screen.queryByTestId('spouse-first-name-input')).not.toBeInTheDocument()
      expect(screen.getByTestId('couple-checkbox')).not.toBeChecked()
    })
  })

  it('calls addHouseholdMember with spouse data when couple is saved', async () => {
    const addContact = makeAddContact({ id: 'c-kevin' })
    const addHouseholdMember = makeAddHouseholdMember()
    render(<NameStorm activeTrip={makeTrip()} contacts={noContacts} addContact={addContact} addHouseholdMember={addHouseholdMember} onCreateTrip={noop} />)

    await userEvent.click(screen.getByTestId('tab-Family'))
    fireEvent.change(screen.getByTestId('first-name-input'), { target: { value: 'Kevin' } })
    fireEvent.change(screen.getByTestId('last-name-input'), { target: { value: 'Smith' } })
    await userEvent.click(screen.getByTestId('couple-checkbox'))
    fireEvent.change(screen.getByTestId('spouse-first-name-input'), { target: { value: 'Sue' } })

    await userEvent.click(screen.getByTestId('add-btn'))

    await waitFor(() => expect(addHouseholdMember).toHaveBeenCalledWith(
      'c-kevin',
      expect.objectContaining({ firstName: 'Sue', role: 'spouse' })
    ))
  })

  it('does NOT call addHouseholdMember when couple checkbox is not checked', async () => {
    const addContact = makeAddContact()
    const addHouseholdMember = makeAddHouseholdMember()
    render(<NameStorm activeTrip={makeTrip()} contacts={noContacts} addContact={addContact} addHouseholdMember={addHouseholdMember} onCreateTrip={noop} />)

    await userEvent.click(screen.getByTestId('tab-Friend'))
    fireEvent.change(screen.getByTestId('first-name-input'), { target: { value: 'Alice' } })

    await userEvent.click(screen.getByTestId('add-btn'))
    await waitFor(() => expect(addContact).toHaveBeenCalledOnce())
    expect(addHouseholdMember).not.toHaveBeenCalled()
  })
})

// ── Supabase error surfaced ───────────────────────────────────────────────────

describe('Supabase error surfaced', () => {
  it('shows error message when addContact rejects', async () => {
    const addContact = vi.fn().mockRejectedValue(new Error('DB connection failed'))
    render(<NameStorm activeTrip={makeTrip()} contacts={noContacts} addContact={addContact} addHouseholdMember={noopHousehold} onCreateTrip={noop} />)

    await userEvent.click(screen.getByTestId('tab-Friend'))
    fireEvent.change(screen.getByTestId('first-name-input'), { target: { value: 'Alice' } })

    await userEvent.click(screen.getByTestId('add-btn'))

    await waitFor(() =>
      expect(screen.getByTestId('error-msg')).toHaveTextContent(/DB connection failed/i)
    )
    expect(screen.queryByTestId('saved-list')).not.toBeInTheDocument()
  })
})

// ── Enter key ─────────────────────────────────────────────────────────────────

describe('Enter key triggers add', () => {
  it('submits when Enter is pressed in the first name field', async () => {
    const addContact = makeAddContact()
    render(<NameStorm activeTrip={makeTrip()} contacts={noContacts} addContact={addContact} addHouseholdMember={noopHousehold} onCreateTrip={noop} />)

    await userEvent.click(screen.getByTestId('tab-Neighbor'))
    const input = screen.getByTestId('first-name-input')
    fireEvent.change(input, { target: { value: 'Tom' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    await waitFor(() => expect(addContact).toHaveBeenCalledOnce())
  })
})
