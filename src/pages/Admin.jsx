import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const ADMIN_EMAILS = ['1lclink2@att.net', 'georgeclinkscalesdev@proton.me']

export default function Admin() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sort, setSort] = useState({ key: 'last_seen', dir: 'desc' })

  useEffect(() => {
    if (!user || !ADMIN_EMAILS.includes(user.email)) {
      navigate('/dashboard')
      return
    }
    load()
  }, [user])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.rpc('admin_user_stats')
    if (error) {
      setError(error.message)
    } else {
      setUsers(data)
    }
    setLoading(false)
  }

  function toggleSort(key) {
    setSort(prev => ({
      key,
      dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc'
    }))
  }

  const sorted = [...users].sort((a, b) => {
    const av = a[sort.key] ?? ''
    const bv = b[sort.key] ?? ''
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return sort.dir === 'desc' ? -cmp : cmp
  })

  const totalUsers = users.length
  const activeThisWeek = users.filter(u => {
    if (!u.last_seen) return false
    const d = new Date(u.last_seen)
    return (Date.now() - d.getTime()) < 7 * 24 * 60 * 60 * 1000
  }).length
  const usersWithSessions = users.filter(u => u.sessions_count > 0).length
  const totalSessions = users.reduce((sum, u) => sum + Number(u.sessions_count), 0)
  const totalHours = users.reduce((sum, u) => sum + Number(u.hours_tracked), 0)

  // Signup trend — group by week
  const weekCounts = {}
  users.forEach(u => {
    if (!u.signed_up) return
    const d = new Date(u.signed_up)
    const monday = new Date(d)
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    const key = monday.toISOString().split('T')[0]
    weekCounts[key] = (weekCounts[key] ?? 0) + 1
  })
  const weeks = Object.entries(weekCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
  const maxWeek = Math.max(...weeks.map(([, v]) => v), 1)

  function SortIcon({ col }) {
    if (sort.key !== col) return <span style={{ opacity: 0.3 }}>↕</span>
    return <span>{sort.dir === 'desc' ? '↓' : '↑'}</span>
  }

  if (loading) return <div className="page-header"><p>Loading…</p></div>
  if (error) return <div className="page-header"><p style={{ color: 'var(--color-danger)' }}>{error}</p></div>

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Admin</h1>
        <p className="page-subtitle">Real users only · excludes demo and test accounts</p>
      </div>

      {/* Stat tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {[
          { label: 'Total signups', value: totalUsers },
          { label: 'Active this week', value: activeThisWeek },
          { label: 'Ever logged time', value: usersWithSessions },
          { label: 'Total sessions', value: totalSessions },
          { label: 'Total hours', value: totalHours.toFixed(1) },
        ].map(({ label, value }) => (
          <div key={label} className="card" style={{ textAlign: 'center', padding: '1rem' }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-primary)' }}>{value}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Weekly signup chart */}
      <div className="card" style={{ marginBottom: '2rem', padding: '1.25rem' }}>
        <div style={{ fontWeight: 600, marginBottom: '1rem' }}>Signups by week</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', height: '80px' }}>
          {weeks.map(([week, count]) => (
            <div key={week} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>{count}</div>
              <div style={{
                width: '100%',
                height: `${Math.max(4, (count / maxWeek) * 60)}px`,
                background: 'var(--color-primary)',
                borderRadius: '3px 3px 0 0',
                opacity: 0.85
              }} />
              <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                {new Date(week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* User table */}
      <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
              {[
                { key: 'email', label: 'Email' },
                { key: 'signed_up', label: 'Signed up' },
                { key: 'last_seen', label: 'Last seen' },
                { key: 'sessions_count', label: 'Sessions' },
                { key: 'hours_tracked', label: 'Hours' },
              ].map(({ key, label }) => (
                <th
                  key={key}
                  onClick={() => toggleSort(key)}
                  style={{ padding: '0.75rem 1rem', textAlign: 'left', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', color: 'var(--color-text-muted)', fontWeight: 600 }}
                >
                  {label} <SortIcon col={key} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((u, i) => {
              const daysSinceSeen = u.last_seen
                ? Math.floor((Date.now() - new Date(u.last_seen).getTime()) / (1000 * 60 * 60 * 24))
                : null
              const isActive = daysSinceSeen !== null && daysSinceSeen <= 7
              const isChurned = daysSinceSeen !== null && daysSinceSeen > 30
              return (
                <tr key={u.email} style={{ borderBottom: i < sorted.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                  <td style={{ padding: '0.65rem 1rem', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                    <span style={{
                      display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                      background: isActive ? '#22c55e' : isChurned ? 'var(--color-text-muted)' : '#f59e0b',
                      marginRight: '0.5rem'
                    }} />
                    {u.email}
                  </td>
                  <td style={{ padding: '0.65rem 1rem', color: 'var(--color-text-muted)' }}>{u.signed_up}</td>
                  <td style={{ padding: '0.65rem 1rem', color: isActive ? '#22c55e' : 'var(--color-text-muted)' }}>
                    {u.last_seen ?? '—'}
                    {daysSinceSeen !== null && <span style={{ marginLeft: '0.35rem', fontSize: '0.75rem' }}>({daysSinceSeen}d ago)</span>}
                  </td>
                  <td style={{ padding: '0.65rem 1rem' }}>{u.sessions_count}</td>
                  <td style={{ padding: '0.65rem 1rem' }}>{u.hours_tracked}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p style={{ marginTop: '1rem', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
        🟢 active ≤7d · 🟡 active 8–30d · ⚫ seen &gt;30d ago
      </p>
    </div>
  )
}
