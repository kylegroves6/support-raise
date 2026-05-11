export interface HouseholdMember {
  id: string
  contactId: string
  firstName: string
  lastName?: string  // null = shares contact's last name
  role: 'spouse' | 'partner' | 'child' | 'other'
  createdAt?: string
}

export interface Contact {
  id: string
  firstName: string
  lastName: string
  organization?: string
  relationship: string
  returning: boolean
  topPriority: number | null
  addressStatus: string
  salutation: string
  notes: string
  streetAddress: string
  city: string
  state: string
  zip: string
  country: string
  concatenatedAddress: string
  phone: string
  email: string
  createdAt?: string
  updatedAt?: string
  // per-trip fields — populated from contact_trips for the active trip
  sent: boolean
thankYouSent: boolean
  followedUp: boolean
  responded: boolean
  financialPartner: boolean
  prayerPartner: boolean
  pledgedToGive: boolean
  formOfGift: string
  giftAmount: number
  dateReceived: string
  // present when loaded with trip data
  contactTripId?: string
  // household members loaded alongside the contact
  householdMembers?: HouseholdMember[]
}

export interface Trip {
  id: string
  userId: string
  missionName: string
  missionStart: string | null
  missionEnd: string | null
  tripCost: number
  isActive: boolean
  createdAt?: string
}

export interface AdditionalRaisingItem {
  id: string
  label: string
  amount: number
}

export type ImportMode = 'append' | 'replace'
