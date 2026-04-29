import { useState, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'

const STORAGE_KEY = 'tokyo-mission-contacts'

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function save(contacts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(contacts))
}

export function useContacts() {
  const [contacts, setContacts] = useState(load)

  const persist = useCallback((updated) => {
    setContacts(updated)
    save(updated)
  }, [])

  const addContact = useCallback((data) => {
    const contact = { id: uuidv4(), ...data }
    persist([...load(), contact])
    return contact
  }, [persist])

  const updateContact = useCallback((id, data) => {
    const current = load()
    const updated = current.map(c => c.id === id ? { ...c, ...data } : c)
    persist(updated)
  }, [persist])

  const deleteContact = useCallback((id) => {
    const updated = load().filter(c => c.id !== id)
    persist(updated)
  }, [persist])

  const importContacts = useCallback((incoming) => {
    const current = load()
    const existingIds = new Set(current.map(c => c.id))
    const newOnes = incoming
      .filter(c => !existingIds.has(c.id))
      .map(c => ({ ...c, id: c.id || uuidv4() }))
    persist([...current, ...newOnes])
  }, [persist])

  const replaceAll = useCallback((incoming) => {
    const withIds = incoming.map(c => ({ ...c, id: c.id || uuidv4() }))
    persist(withIds)
  }, [persist])

  return { contacts, addContact, updateContact, deleteContact, importContacts, replaceAll }
}
