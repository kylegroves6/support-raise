import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getCurrentUserId } from '../lib/auth'

export interface ActivityEntry {
  date: string        // YYYY-MM-DD
  eventType: string
  count: number
}

export interface FollowUpNeeded {
  contactId: string
  sentDate: string
}

export function useActivityLog() {
  const [entries, setEntries] = useState<ActivityEntry[]>([])
  const [followUpNeeded, setFollowUpNeeded] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCurrentUserId().then(async userId => {
      // Fetch 52 weeks of activity grouped by date + event_type
      const since = new Date()
      since.setDate(since.getDate() - 364)
      const sinceStr = since.toISOString().slice(0, 10)

      const { data } = await supabase
        .from('activity_log')
        .select('occurred_at, event_type')
        .eq('user_id', userId)
        .gte('occurred_at', sinceStr)
        .order('occurred_at', { ascending: true })

      if (data) {
        const counts = new Map<string, Map<string, number>>()
        for (const row of data as { occurred_at: string; event_type: string }[]) {
          const date = row.occurred_at.slice(0, 10)
          if (!counts.has(date)) counts.set(date, new Map())
          const byType = counts.get(date)!
          byType.set(row.event_type, (byType.get(row.event_type) ?? 0) + 1)
        }
        const result: ActivityEntry[] = []
        for (const [date, byType] of counts) {
          for (const [eventType, count] of byType) {
            result.push({ date, eventType, count })
          }
        }
        setEntries(result)
      }

      // Determine which contacts need follow-up:
      // has a 'sent' event but no 'follow_up' event, and sent was >7 days ago
      const { data: allEvents } = await supabase
        .from('activity_log')
        .select('contact_id, event_type, occurred_at')
        .eq('user_id', userId)
        .in('event_type', ['sent', 'follow_up'])

      if (allEvents) {
        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() - 7)
        const cutoffStr = cutoff.toISOString().slice(0, 10)

        const sentDates = new Map<string, string>()
        const hasFollowUp = new Set<string>()

        for (const row of allEvents as { contact_id: string; event_type: string; occurred_at: string }[]) {
          if (!row.contact_id) continue
          if (row.event_type === 'sent') {
            const existing = sentDates.get(row.contact_id)
            if (!existing || row.occurred_at > existing) {
              sentDates.set(row.contact_id, row.occurred_at.slice(0, 10))
            }
          } else if (row.event_type === 'follow_up') {
            hasFollowUp.add(row.contact_id)
          }
        }

        const needsFollowUp = new Set<string>()
        for (const [contactId, sentDate] of sentDates) {
          if (!hasFollowUp.has(contactId) && sentDate <= cutoffStr) {
            needsFollowUp.add(contactId)
          }
        }
        setFollowUpNeeded(needsFollowUp)
      }

      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  return { entries, followUpNeeded, loading }
}
