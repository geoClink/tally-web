import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { formatHours } from '../lib/utils'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// Returns 0–5 based on hours tracked that day
function intensityLevel(hours) {
  if (!hours || hours <= 0) return 0
  if (hours < 2) return 1
  if (hours < 4) return 2
  if (hours < 6) return 3
  if (hours < 8) return 4
  return 5
}

export default function Calendar() {
  const { user } = useAuth()
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth()) // 0-indexed
  const [hoursByDay, setHoursByDay] = useState({})
  const [loading, setLoading] = useState(true)
  const [hoveredDay, setHoveredDay] = useState(null)

  useEffect(() => { loadMonth() }, [year, month, user])

  async function loadMonth() {
    setLoading(true)
    const firstDay = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const lastDayDate = new Date(year, month + 1, 0)
    const lastDay = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDayDate.getDate()).padStart(2, '0')}`

    const { data } = await supabase
      .from('sessions')
      .select('date, hours')
      .eq('user_id', user.id)
      .gte('date', firstDay)
      .lte('date', lastDay)

    const byDay = {}
    data?.forEach(s => {
      byDay[s.date] = (byDay[s.date] ?? 0) + (s.hours ?? 0)
    })
    setHoursByDay(byDay)
    setLoading(false)
  }

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }

  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  // Build the grid: empty cells for days before month starts, then 1–daysInMonth
  const firstOfMonth = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  // ISO weekday: Mon=0 … Sun=6
  const startDow = (firstOfMonth.getDay() + 6) % 7
  const cells = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const todayStr = today.toISOString().split('T')[0]
  const monthTotal = Object.values(hoursByDay).reduce((sum, h) => sum + h, 0)

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Activity</h1>
        <p className="page-subtitle">Hours tracked by day</p>
      </div>

      <div className="card">
        <div className="cal-nav">
          <button className="btn btn-secondary btn-sm" onClick={prevMonth}>←</button>
          <div style={{ textAlign: 'center' }}>
            <div className="cal-month-label">{MONTH_NAMES[month]} {year}</div>
            {monthTotal > 0 && (
              <div className="text-muted" style={{ fontSize: '0.78rem', marginTop: '0.15rem' }}>
                {formatHours(monthTotal)} this month
              </div>
            )}
          </div>
          <button className="btn btn-secondary btn-sm" onClick={nextMonth}>→</button>
        </div>

        {loading ? (
          <div className="loading" style={{ padding: '2rem 0' }}>Loading…</div>
        ) : (
          <div className="cal-grid">
            {DAY_LABELS.map(d => (
              <div key={d} className="cal-day-header">{d}</div>
            ))}
            {cells.map((day, i) => {
              if (!day) return <div key={`empty-${i}`} className="cal-cell cal-empty" />
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const hours = hoursByDay[dateStr] ?? 0
              const level = intensityLevel(hours)
              const isToday = dateStr === todayStr
              const isHovered = hoveredDay === dateStr

              return (
                <div
                  key={day}
                  className={`cal-cell cal-cell-${level}${isToday ? ' cal-today' : ''}`}
                  onMouseEnter={() => hours > 0 && setHoveredDay(dateStr)}
                  onMouseLeave={() => setHoveredDay(null)}
                  title={hours > 0 ? `${formatHours(hours)}` : ''}
                >
                  <span className="cal-day-num">{day}</span>
                  {isHovered && hours > 0 && (
                    <span className="cal-tooltip">{formatHours(hours)}</span>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="cal-legend">
          <span className="text-muted" style={{ fontSize: '0.75rem' }}>Less</span>
          {[0, 1, 2, 3, 4, 5].map(l => (
            <span key={l} className={`cal-legend-swatch cal-cell-${l}`} />
          ))}
          <span className="text-muted" style={{ fontSize: '0.75rem' }}>More</span>
        </div>
        <div className="cal-legend-labels">
          <span className="text-muted" style={{ fontSize: '0.72rem' }}>0h</span>
          <span className="text-muted" style={{ fontSize: '0.72rem' }}>2h</span>
          <span className="text-muted" style={{ fontSize: '0.72rem' }}>4h</span>
          <span className="text-muted" style={{ fontSize: '0.72rem' }}>6h</span>
          <span className="text-muted" style={{ fontSize: '0.72rem' }}>8h</span>
          <span className="text-muted" style={{ fontSize: '0.72rem' }}>8h+</span>
        </div>
      </div>
    </div>
  )
}
