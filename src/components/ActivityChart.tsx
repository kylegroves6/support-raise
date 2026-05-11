import { useMemo, useState } from 'react'
import type { ActivityEntry } from '../hooks/useActivityLog'

interface Props {
  entries: ActivityEntry[]
}

const EVENT_LABELS: Record<string, string> = {
  contact_added: 'Contact added',
  sent: 'Contacted',
  follow_up: 'Follow-up',
  gift: 'Gift received',
  thank_you: 'Thank-you sent',
}

function getColor(total: number): string {
  if (total === 0) return 'bg-cream-200'
  if (total === 1) return 'bg-sage-200'
  if (total <= 3) return 'bg-sage-400'
  return 'bg-sage-600'
}

function buildWeeks(): string[][] {
  // Build 52 complete weeks ending today (Sunday-first)
  const today = new Date()
  const days: string[] = []
  for (let i = 363; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    days.push(d.toISOString().slice(0, 10))
  }
  // Pad front so the grid starts on Sunday
  const firstDow = new Date(days[0]).getDay() // 0=Sun
  const padded: (string | null)[] = [...Array(firstDow).fill(null), ...days]
  const weeks: string[][] = []
  for (let i = 0; i < padded.length; i += 7) {
    weeks.push((padded.slice(i, i + 7) as (string | null)[]).map(d => d ?? '') as string[])
  }
  return weeks
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

export default function ActivityChart({ entries }: Props) {
  const [tooltip, setTooltip] = useState<{
    date: string
    total: number
    breakdown: Record<string, number>
    x: number
    y: number
  } | null>(null)

  const { byDate, weeks } = useMemo(() => {
    const byDate = new Map<string, Record<string, number>>()
    for (const e of entries) {
      if (!byDate.has(e.date)) byDate.set(e.date, {})
      byDate.get(e.date)![e.eventType] = (byDate.get(e.date)![e.eventType] ?? 0) + e.count
    }
    return { byDate, weeks: buildWeeks() }
  }, [entries])

  const monthLabels = useMemo(() => {
    const labels: { col: number; label: string }[] = []
    let lastMonth = -1
    weeks.forEach((week, col) => {
      const firstReal = week.find(d => d !== '')
      if (!firstReal) return
      const m = new Date(firstReal + 'T00:00:00').getMonth()
      if (m !== lastMonth) {
        labels.push({ col, label: new Date(firstReal + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' }) })
        lastMonth = m
      }
    })
    return labels
  }, [weeks])

  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-stone-dark mb-3">Activity — Last 52 Weeks</h3>
      <div className="relative overflow-x-auto">
        {/* Month labels */}
        <div className="flex mb-1" style={{ gap: '2px' }}>
          {weeks.map((_, col) => {
            const label = monthLabels.find(l => l.col === col)
            return (
              <div key={col} className="flex-none" style={{ width: 12 }}>
                {label && <span className="text-[9px] text-stone-warm whitespace-nowrap">{label.label}</span>}
              </div>
            )
          })}
        </div>

        {/* Day-of-week labels + grid */}
        <div className="flex gap-[2px]">
          {/* Day labels column */}
          <div className="flex flex-col gap-[2px] mr-1">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <div key={i} className="text-[9px] text-stone-light h-3 flex items-center" style={{ width: 8 }}>{i % 2 === 1 ? d : ''}</div>
            ))}
          </div>

          {/* Weeks */}
          {weeks.map((week, col) => (
            <div key={col} className="flex flex-col gap-[2px]">
              {week.map((date, row) => {
                if (!date) return <div key={row} className="w-3 h-3 rounded-sm opacity-0" />
                const breakdown = byDate.get(date) ?? {}
                const total = Object.values(breakdown).reduce((s, n) => s + n, 0)
                return (
                  <div
                    key={row}
                    className={`w-3 h-3 rounded-sm cursor-pointer transition-opacity hover:opacity-80 ${getColor(total)}`}
                    onMouseEnter={e => {
                      const rect = (e.target as HTMLElement).getBoundingClientRect()
                      setTooltip({ date, total, breakdown, x: rect.left + rect.width / 2, y: rect.top })
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  />
                )
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[10px] text-stone-warm">Less</span>
          {[0, 1, 2, 4].map(n => (
            <div key={n} className={`w-3 h-3 rounded-sm ${getColor(n)}`} />
          ))}
          <span className="text-[10px] text-stone-warm">More</span>
        </div>
      </div>

      {/* Tooltip (fixed position) */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none bg-stone-dark text-white text-xs rounded-lg px-3 py-2 shadow-lg"
          style={{ left: tooltip.x, top: tooltip.y - 8, transform: 'translate(-50%, -100%)' }}
        >
          <p className="font-semibold mb-1">{fmtDate(tooltip.date)}</p>
          {tooltip.total === 0 ? (
            <p className="text-stone-light">No activity</p>
          ) : (
            <>
              <p className="text-stone-light mb-0.5">{tooltip.total} event{tooltip.total === 1 ? '' : 's'}</p>
              {Object.entries(tooltip.breakdown).map(([type, count]) => (
                <p key={type}>{EVENT_LABELS[type] ?? type}: {count}</p>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
