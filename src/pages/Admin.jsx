import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const ADMIN_EMAILS = ['1lclink2@att.net', 'georgeclinkscalesdev@proton.me']

const TEMPLATE_USED = (email) => ({
  subject: 'Quick question about Tally',
  body: `Hey — I'm George, I built Tally. I noticed you've been using it and wanted to check in personally.\n\nWhat brought you to Tally, and is there anything that's gotten in the way of using it regularly?\n\nEven a one-line reply means a lot.\n\n— George`,
})

const TEMPLATE_NOT_USED = (email) => ({
  subject: 'Quick question about Tally',
  body: `Hey — I'm George, I built Tally. I noticed you signed up but haven't had a chance to track any time yet.\n\nWas there anything confusing or that got in the way of getting started?\n\nEven a one-line reply helps a lot.\n\n— George`,
})

function mailtoLink(email, sessions_count) {
  const tpl = Number(sessions_count) > 0 ? TEMPLATE_USED(email) : TEMPLATE_NOT_USED(email)
  return `mailto:${email}?subject=${encodeURIComponent(tpl.subject)}&body=${encodeURIComponent(tpl.body)}`
}

export default function Admin() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sort, setSort] = useState({ key: 'last_seen', dir: 'desc' })
  const [compose, setCompose] = useState(null) // { email, subject, body }
  const [filter, setFilter] = useState('all') // all | reachable

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
    if (error) setError(error.message)
    else setUsers(data)
    setLoading(false)
  }

  function toggleSort(key) {
    setSort(prev => ({ key, dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc' }))
  }

  function isReachable(email) {
    return !email.includes('privaterelay.appleid.com') && !email.includes('designteam.co') && email !== 'test@testing.com'
  }

  function openCompose(u) {
    const tpl = Number(u.sessions_count) > 0 ? TEMPLATE_USED(u.email) : TEMPLATE_NOT_USED(u.email)
    setCompose({ email: u.email, subject: tpl.subject, body: tpl.body })
  }

  const filtered = filter === 'reachable' ? users.filter(u => isReachable(u.email)) : users

  const sorted = [...filtered].sort((a, b) => {
    const av = a[sort.key] ?? ''
    const bv = b[sort.key] ?? ''
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return sort.dir === 'desc' ? -cmp : cmp
  })

  const totalUsers = users.length
  const activeThisWeek = users.filter(u => {
    if (!u.last_seen) return false
    return (Date.now() - new Date(u.last_seen).getTime()) < 7 * 24 * 60 * 60 * 1000
  }).length
  const usersWithSessions = users.filter(u => u.sessions_count > 0).length
  const totalSessions = users.reduce((sum, u) => sum + Number(u.sessions_count), 0)
  const totalHours = users.reduce((sum, u) => sum + Number(u.hours_tracked), 0)

  const weekCounts = {}
  users.forEach(u => {
    if (!u.signed_up) return
    const d = new Date(u.signed_up)
    const monday = new Date(d)
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    const key = monday.toISOString().split('T')[0]
    weekCounts[key] = (weekCounts[key] ?? 0) + 1
  })
  const weeks = Object.entries(weekCounts).sort(([a], [b]) => a.localeCompare(b)).slice(-8)
  const maxWeek = Math.max(...weeks.map(([, v]) => v), 1)

  function SortIcon({ col }) {
    if (sort.key !== col) return <span style={{ opacity: 0.3 }}>↕</span>
    return <span>{sort.dir === 'desc' ? '↓' : '↑'}</span>
  }

  if (loading) return <div className="page-header"><p>Loading…</p></div>
  if (error) return <div className="page-header"><p style={{ color: 'var(--color-danger)' }}>{error}</p></div>

  return (
    <div>
      {/* Compose modal */}
      {compose && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '560px', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ fontWeight: 600 }}>Compose email</div>
              <button onClick={() => setCompose(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--color-text-muted)' }}>×</button>
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.25rem' }}>To</label>
              <input value={compose.email} readOnly style={{ width: '100%', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, padding: '0.5rem 0.75rem', fontSize: '0.875rem', color: 'var(--color-text-muted)', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.25rem' }}>Subject</label>
              <input value={compose.subject} onChange={e => setCompose(c => ({ ...c, subject: e.target.value }))} style={{ width: '100%', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.25rem' }}>Message</label>
              <textarea
                value={compose.body}
                onChange={e => setCompose(c => ({ ...c, body: e.target.value }))}
                rows={8}
                style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', fontSize: '0.875rem' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setCompose(null)}>Cancel</button>
              <a
                href={`mailto:${compose.email}?subject=${encodeURIComponent(compose.subject)}&body=${encodeURIComponent(compose.body)}`}
                className="btn-primary"
                style={{ textDecoration: 'none', padding: '0.5rem 1.25rem', borderRadius: 6, fontSize: '0.875rem', fontWeight: 600 }}
                onClick={() => setCompose(null)}
              >
                Open in Mail →
              </a>
            </div>
          </div>
        </div>
      )}

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
              <div style={{ width: '100%', height: `${Math.max(4, (count / maxWeek) * 60)}px`, background: 'var(--color-primary)', borderRadius: '3px 3px 0 0', opacity: 0.85 }} />
              <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                {new Date(week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filter toggle */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
        {['all', 'reachable'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '0.35rem 0.85rem', borderRadius: 6, border: '1px solid var(--color-border)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500,
              background: filter === f ? 'var(--color-primary)' : 'transparent',
              color: filter === f ? '#fff' : 'var(--color-text-muted)',
            }}
          >
            {f === 'all' ? `All (${users.length})` : `Reachable (${users.filter(u => isReachable(u.email)).length})`}
          </button>
        ))}
      </div>

      {/* User table */}
      <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
              {[
                { key: 'email', label: 'Email' },
                { key: 'plan', label: 'Plan' },
                { key: 'signed_up', label: 'Signed up' },
                { key: 'last_seen', label: 'Last seen' },
                { key: 'sessions_count', label: 'Sessions' },
                { key: 'hours_tracked', label: 'Hours' },
              ].map(({ key, label }) => (
                <th key={key} onClick={() => toggleSort(key)}
                  style={{ padding: '0.75rem 1rem', textAlign: 'left', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                  {label} <SortIcon col={key} />
                </th>
              ))}
              <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 600 }}></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((u, i) => {
              const daysSinceSeen = u.last_seen
                ? Math.floor((Date.now() - new Date(u.last_seen).getTime()) / (1000 * 60 * 60 * 24))
                : null
              const isActive = daysSinceSeen !== null && daysSinceSeen <= 7
              const isChurned = daysSinceSeen !== null && daysSinceSeen > 30
              const canEmail = isReachable(u.email)
              return (
                <tr key={u.email} style={{ borderBottom: i < sorted.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                  <td style={{ padding: '0.65rem 1rem', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: isActive ? '#22c55e' : isChurned ? 'var(--color-text-muted)' : '#f59e0b', marginRight: '0.5rem' }} />
                    {u.email}
                  </td>
                  <td style={{ padding: '0.65rem 1rem' }}>
                    {u.plan ? (
                      <span style={{
                        display: 'inline-block', padding: '0.15rem 0.55rem', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.03em',
                        background: u.plan === 'pro' ? '#1d4ed820' : u.plan === 'business' ? '#7c3aed20' : '#f3f4f6',
                        color: u.plan === 'pro' ? '#1d4ed8' : u.plan === 'business' ? '#7c3aed' : '#6b7280',
                        border: `1px solid ${u.plan === 'pro' ? '#1d4ed840' : u.plan === 'business' ? '#7c3aed40' : '#e5e7eb'}`,
                        textTransform: 'uppercase',
                      }}>
                        {u.plan}{u.plan_source ? ` · ${u.plan_source}` : ''}
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>free</span>
                    )}
                  </td>
                  <td style={{ padding: '0.65rem 1rem', color: 'var(--color-text-muted)' }}>{u.signed_up}</td>
                  <td style={{ padding: '0.65rem 1rem', color: isActive ? '#22c55e' : 'var(--color-text-muted)' }}>
                    {u.last_seen ?? '—'}
                    {daysSinceSeen !== null && <span style={{ marginLeft: '0.35rem', fontSize: '0.75rem' }}>({daysSinceSeen}d ago)</span>}
                  </td>
                  <td style={{ padding: '0.65rem 1rem' }}>{u.sessions_count}</td>
                  <td style={{ padding: '0.65rem 1rem' }}>{u.hours_tracked}</td>
                  <td style={{ padding: '0.65rem 1rem' }}>
                    {canEmail && (
                      <button
                        onClick={() => openCompose(u)}
                        title="Send email"
                        style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 6, padding: '0.25rem 0.6rem', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}
                      >
                        ✉
                      </button>
                    )}
                  </td>
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
