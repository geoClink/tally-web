import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useSubscription } from '../context/SubscriptionContext'
import { usePendingInvite } from '../context/PendingInviteContext'
import { formatHours, todayString, weekStartString, monthStartString } from '../lib/utils'
import { useCountUp } from '../hooks/useCountUp'

export default function Dashboard() {
  const { user } = useAuth()
  const { isPro } = useSubscription()
  const { pendingInvite, dismiss } = usePendingInvite()
  const [todayHours, setTodayHours] = useState(0)
  const [weekHours, setWeekHours] = useState(0)
  const [weekGoal, setWeekGoal] = useState(40)
  const [clientGoals, setClientGoals] = useState([])
  const [weekByClient, setWeekByClient] = useState({})
  const [recentSessions, setRecentSessions] = useState([])
  const [monthByClient, setMonthByClient] = useState({})
  const [dismissedNudges, setDismissedNudges] = useState(() => {
    try { return JSON.parse(localStorage.getItem('tally_nudge_dismissed') ?? '{}') } catch { return {} }
  })
  const [loading, setLoading] = useState(true)

  const today = todayString()
  const weekStart = weekStartString()
  const monthStart = monthStartString()
  const historyStart = isPro ? null : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  useEffect(() => {
    async function load() {
      setLoading(true)
      await Promise.all([fetchTodaySessions(), fetchWeekSessions(), fetchGoal(), fetchRecentSessions(), fetchMonthSessions()])
      setLoading(false)
    }
    load()
  }, [user, isPro])

  async function fetchTodaySessions() {
    const { data } = await supabase
      .from('sessions')
      .select('hours')
      .eq('user_id', user.id)
      .eq('date', today)
    setTodayHours(data?.reduce((sum, s) => sum + (s.hours ?? 0), 0) ?? 0)
  }

  async function fetchWeekSessions() {
    let query = supabase
      .from('sessions')
      .select('hours, client')
      .eq('user_id', user.id)
      .gte('date', weekStart)
    if (historyStart && historyStart > weekStart) {
      query = query.gte('date', historyStart)
    }
    const { data } = await query
    setWeekHours(data?.reduce((sum, s) => sum + (s.hours ?? 0), 0) ?? 0)

    // Group by client for per-client progress
    const byClient = {}
    data?.forEach(s => {
      byClient[s.client] = (byClient[s.client] ?? 0) + (s.hours ?? 0)
    })
    setWeekByClient(byClient)
  }

  async function fetchGoal() {
    const { data } = await supabase
      .from('config')
      .select('weekly_goal, client_goals')
      .eq('user_id', user.id)
      .maybeSingle()
    if (data?.client_goals?.length > 0) {
      setClientGoals(data.client_goals)
      setWeekGoal(data.client_goals.reduce((sum, g) => sum + (g.weekly_hours ?? 0), 0))
    } else if (data?.weekly_goal) {
      setWeekGoal(data.weekly_goal)
    }
  }

  async function fetchMonthSessions() {
    const { data } = await supabase
      .from('sessions')
      .select('client, hours')
      .eq('user_id', user.id)
      .gte('date', monthStart)
      .gt('hours', 0)
    const byClient = {}
    data?.forEach(s => {
      byClient[s.client] = (byClient[s.client] ?? 0) + (s.hours ?? 0)
    })
    setMonthByClient(byClient)
  }

  async function fetchRecentSessions() {
    let query = supabase
      .from('sessions')
      .select('id, date, client, hours, task_note')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(5)
    if (historyStart) query = query.gte('date', historyStart)
    const { data } = await query
    setRecentSessions(data ?? [])
  }

  const weekProgress = weekGoal > 0 ? Math.min((weekHours / weekGoal) * 100, 100) : 0

  const NUDGE_THRESHOLD = 8
  const now = Date.now()
  const invoiceNudges = Object.entries(monthByClient)
    .filter(([client, hours]) => {
      if (hours < NUDGE_THRESHOLD) return false
      const dismissedUntil = dismissedNudges[client] ?? 0
      return now > dismissedUntil
    })
    .sort((a, b) => b[1] - a[1])
    .slice(0, 1)

  function dismissNudge(client) {
    const updated = { ...dismissedNudges, [client]: Date.now() + 7 * 24 * 60 * 60 * 1000 }
    setDismissedNudges(updated)
    try { localStorage.setItem('tally_nudge_dismissed', JSON.stringify(updated)) } catch {}
  }

  const animatedToday = useCountUp(todayHours, 700, !loading)
  const animatedWeek = useCountUp(weekHours, 700, !loading)
  const animatedProgress = useCountUp(weekProgress, 700, !loading)

  if (loading) return <div className="loading">Loading…</div>

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
      </div>

      {pendingInvite && (
        <div className="alert alert-info" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <span>
            You've been invited to join <strong>{pendingInvite.workspaces?.name}</strong>.
          </span>
          <Link to="/team" onClick={dismiss} className="btn btn-primary btn-sm" style={{ flexShrink: 0 }}>
            View Invite →
          </Link>
        </div>
      )}

      {invoiceNudges.map(([client, hours]) => (
        <div key={client} className="alert alert-info" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <span>
            You have <strong>{formatHours(hours)}</strong> logged for <strong>{client}</strong> this month — ready to invoice?
          </span>
          <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
            <Link to="/invoices" className="btn btn-primary btn-sm">Create Invoice →</Link>
            <button className="btn btn-secondary btn-sm" onClick={() => dismissNudge(client)}>Later</button>
          </div>
        </div>
      ))}

      <div className="card-grid">
        <div className="card">
          <div className="card-title">Today</div>
          <div className="card-value">{formatHours(animatedToday)}</div>
          <div className="card-subtitle">tracked today</div>
        </div>

        <div className="card">
          <div className="card-title">This Week</div>
          <div className="card-value">{formatHours(animatedWeek)}</div>
          <div className="card-subtitle">of {formatHours(weekGoal)} goal</div>
          <div className="progress-bar">
            <div
              className={`progress-fill progress-fill--anim${weekProgress >= 100 ? ' complete' : ''}`}
              style={{ '--fill': `${weekProgress}%` }}
            />
          </div>
        </div>

        <div className="card">
          <div className="card-title">Weekly Goal</div>
          <div className="card-value">{Math.round(animatedProgress)}%</div>
          <div className="card-subtitle">{weekProgress >= 100 ? 'Goal reached!' : `${formatHours(Math.max(weekGoal - weekHours, 0))} remaining`}</div>
        </div>
      </div>

      {!isPro && (
        <div className="alert alert-info" style={{ marginBottom: '1.5rem' }}>
          Free tier shows the last 7 days only. <Link to="/billing" className="alert-link">Upgrade to Pro</Link> for full history.
        </div>
      )}

      {clientGoals.length > 0 && (
        <>
          <div className="section-header" style={{ marginBottom: '0.75rem' }}>
            <h2 className="section-title">Client Goals This Week</h2>
            <Link to="/settings" className="section-link">Edit goals</Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {clientGoals.map(g => {
              const tracked = weekByClient[g.client] ?? 0
              const progress = g.weekly_hours > 0 ? Math.min((tracked / g.weekly_hours) * 100, 100) : 0
              return (
                <div key={g.client} className="card" style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                    <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{g.client}</span>
                    <span className="text-muted" style={{ fontSize: '0.85rem' }}>
                      {formatHours(tracked)} / {formatHours(g.weekly_hours)}
                    </span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className={`progress-fill progress-fill--anim${progress >= 100 ? ' complete' : ''}`}
                      style={{ '--fill': `${progress}%` }}
                    />
                  </div>
                  <div className="text-muted" style={{ fontSize: '0.78rem', marginTop: '0.3rem' }}>
                    {progress >= 100 ? 'Goal reached!' : `${formatHours(Math.max(g.weekly_hours - tracked, 0))} remaining`}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      <div className="section-header">
        <h2 className="section-title">Recent Sessions</h2>
        <Link to="/sessions" className="section-link">View all</Link>
      </div>

      {recentSessions.length === 0 ? (
        <div className="empty-state">No sessions yet. Track time using the timer or add one manually.</div>
      ) : (
        <div className="table-wrapper dashboard-sessions">
          <table>
            <thead>
              <tr>
                <th style={{ whiteSpace: 'nowrap' }}>Date</th>
                <th>Client</th>
                <th>Hours</th>
                <th className="hide-mobile">Note</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {recentSessions.map(s => {
                const params = new URLSearchParams({ client: s.client })
                if (s.task_note) params.set('note', s.task_note)
                return (
                  <tr key={s.id}>
                    <td data-label="Date" style={{ whiteSpace: 'nowrap' }}>{s.date}</td>
                    <td data-label="Client" style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.client}</td>
                    <td data-label="Hours" style={{ whiteSpace: 'nowrap' }}>{formatHours(s.hours)}</td>
                    <td className="text-muted hide-mobile">{s.task_note || '—'}</td>
                    <td className="session-action-cell">
                      <Link
                        to={`/track?${params.toString()}`}
                        className="btn btn-secondary btn-sm"
                        title="Log time for this client and task"
                        style={{ whiteSpace: 'nowrap' }}
                      >
                        Log again
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
