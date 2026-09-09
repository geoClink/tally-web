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
  const [push, setPush] = useState({ title: '', body: '', target: 'all' })
  const [pushStatus, setPushStatus] = useState(null) // null | 'sending' | { sent, failed, total } | { error }


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

  const churned = users.filter(u => {
    if (!u.last_seen || u.sessions_count < 1) return false
    return (Date.now() - new Date(u.last_seen).getTime()) > 30 * 24 * 60 * 60 * 1000
  })

  const filtered = filter === 'reachable'
    ? users.filter(u => isReachable(u.email))
    : filter === 'churned'
    ? churned
    : users

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
  const paidUsers = users.filter(u => u.plan && u.plan !== 'free' && u.plan !== null).length
  const conversionRate = usersWithSessions > 0 ? ((paidUsers / usersWithSessions) * 100).toFixed(1) : '0.0'
  const pushEnabled = users.filter(u => u.has_push).length
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

  async function sendPushNotification() {
    if (!push.title.trim() || !push.body.trim()) return
    setPushStatus('sending')
    const { data, error } = await supabase.functions.invoke('send-push-notification', {
      body: { title: push.title.trim(), body: push.body.trim(), target: push.target },
    })
    if (error) {
      setPushStatus({ error: error.message || 'Unknown error' })
    } else {
      setPushStatus(data)
    }
  }

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
                className="btn btn-primary"
                style={{ textDecoration: 'none' }}
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
          { label: 'Paid users', value: paidUsers, highlight: true },
          { label: 'Conversion rate', value: `${conversionRate}%`, highlight: true },
          { label: 'Push enabled', value: pushEnabled },
          { label: 'Total sessions', value: totalSessions },
          { label: 'Total hours', value: totalHours.toFixed(1) },
        ].map(({ label, value, highlight }) => (
          <div key={label} className="card" style={{ textAlign: 'center', padding: '1rem', borderColor: highlight ? 'var(--color-primary)' : undefined }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: highlight ? '#22c55e' : 'var(--color-primary)' }}>{value}</div>
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

      {/* Push notifications */}
      <div className="card" style={{ marginBottom: '2rem', padding: '1.25rem' }}>
        <div style={{ fontWeight: 600, marginBottom: '1rem' }}>Send push notification</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.25rem' }}>Title</label>
            <input
              value={push.title}
              onChange={e => { setPush(p => ({ ...p, title: e.target.value })); setPushStatus(null) }}
              placeholder="e.g. Tally for web is here"
              style={{ width: '100%', boxSizing: 'border-box' }}
              maxLength={100}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.25rem' }}>Body</label>
            <textarea
              value={push.body}
              onChange={e => { setPush(p => ({ ...p, body: e.target.value })); setPushStatus(null) }}
              placeholder="e.g. Track time, send invoices, and more — now in your browser."
              rows={3}
              style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', fontSize: '0.875rem' }}
              maxLength={300}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.25rem' }}>Audience</label>
            <select
              value={push.target}
              onChange={e => { setPush(p => ({ ...p, target: e.target.value })); setPushStatus(null) }}
              style={{ padding: '0.5rem 0.75rem', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: '0.875rem', background: 'var(--color-surface)', color: 'var(--color-text)', cursor: 'pointer' }}
            >
              <option value="all">All users</option>
              <option value="paid_inactive">Paid · never logged a session</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              className="btn btn-primary"
              onClick={sendPushNotification}
              disabled={!push.title.trim() || !push.body.trim() || pushStatus === 'sending'}
              style={{ opacity: (!push.title.trim() || !push.body.trim()) ? 0.5 : 1 }}
            >
              {pushStatus === 'sending' ? 'Sending…' : 'Send notification'}
            </button>
            {pushStatus && pushStatus !== 'sending' && (
              pushStatus.error
                ? <span style={{ fontSize: '0.8rem', color: 'var(--color-danger)' }}>Error: {pushStatus.error}</span>
                : <span style={{ fontSize: '0.8rem', color: '#22c55e' }}>
                    Sent {pushStatus.sent}/{pushStatus.total} · {pushStatus.failed} failed
                    {pushStatus.removedStale > 0 ? ` · ${pushStatus.removedStale} stale removed` : ''}
                  </span>
            )}
          </div>
        </div>
      </div>

      {/* Filter toggle */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
        {[
          { key: 'all', label: `All (${users.length})` },
          { key: 'reachable', label: `Reachable (${users.filter(u => isReachable(u.email)).length})` },
          { key: 'churned', label: `Churned (${churned.length})`, color: '#f59e0b' },
        ].map(({ key, label, color }) => (
          <button
            key={key}
            onClick={() => {
              setFilter(key)
              if (key === 'churned') setSort({ key: 'sessions_count', dir: 'desc' })
            }}
            style={{
              padding: '0.35rem 0.85rem', borderRadius: 6, border: `1px solid ${filter === key && color ? color : 'var(--color-border)'}`, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500,
              background: filter === key ? (color ?? 'var(--color-primary)') : 'transparent',
              color: filter === key ? '#fff' : (color ?? 'var(--color-text-muted)'),
            }}
          >
            {label}
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
              <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>🔔</th>
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
                  <td style={{ padding: '0.65rem 1rem', color: 'var(--color-text-muted)' }}>
                    {u.signed_up ? new Date(u.signed_up).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                  </td>
                  <td style={{ padding: '0.65rem 1rem', color: isActive ? '#22c55e' : 'var(--color-text-muted)' }}>
                    {u.last_seen
                      ? daysSinceSeen === 0
                        ? 'Today'
                        : `${daysSinceSeen}d ago`
                      : '—'}
                  </td>
                  <td style={{ padding: '0.65rem 1rem' }}>{u.sessions_count}</td>
                  <td style={{ padding: '0.65rem 1rem' }}>{Number(u.hours_tracked).toFixed(1)}</td>
                  <td style={{ padding: '0.65rem 1rem', textAlign: 'center' }}>
                    {u.has_push ? '🔔' : <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>—</span>}
                  </td>
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
