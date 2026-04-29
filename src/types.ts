export interface Contact {
  id: string
  fullName: string
  relationship: string
  returning: boolean
  topPriority: number | null
  addressStatus: string
  sent: boolean
  letterAddressName: string
  salutation: string
  letterPrinted: boolean
  mainEnvelopePrinted: boolean
  thankYouSent: boolean
  notes: string
  streetAddress: string
  city: string
  state: string
  zip: string
  concatenatedAddress: string
  phone: string
  callMade: boolean
  email: string
  responded: boolean
  financialPartner: boolean
  prayerPartner: boolean
  pledgedToGive: boolean
  formOfGift: string
  giftAmount: number
  dateReceived: string
  createdAt?: string
  updatedAt?: string
}

export interface Goals {
  tripCost: number
  foodReimbursement: number
  sfFlight: number
}

export type ImportMode = 'append' | 'replace'
