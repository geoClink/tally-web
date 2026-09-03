import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useSubscription } from '../context/SubscriptionContext'
import { usePendingInvite } from '../context/PendingInviteContext'
import { formatHours, formatCurrency, todayString, weekStartString, monthStartString } from '../lib/utils'
import { useCountUp } from '../hooks/useCountUp'
import EmailCaptureCard from '../components/EmailCaptureCard'

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
  const [weekEarnings, setWeekEarnings] = useState(0)
  const [clientRateMap, setClientRateMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [streak, setStreak] = useState(0)
  const [showEmailCapture, setShowEmailCapture] = useState(false)

  const historyStart = isPro ? null : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  useEffect(() => {
    async function load() {
      setLoading(true)
      setLoadError(false)
      try {
        const [configResult, sessionsResult, ratesResult] = await Promise.all([
          supabase
            .from('config')
            .select('weekly_goal, client_goals, contact_email, week_start')
            .eq('user_id', user.id)
            .maybeSingle(),
          (() => {
            let q = supabase
              .from('sessions')
              .select('id, date, client, hours, task_note, created_at')
              .eq('user_id', user.id)
              .order('date', { ascending: false })
              .order('created_at', { ascending: false })
            if (historyStart) q = q.gte('date', historyStart)
            return q
          })(),
          supabase.from('client_rates').select('client, hourly_rate').eq('user_id', user.id),
        ])

        const config = configResult.data
        const allSessions = sessionsResult.data ?? []
        const rateMap = {}
        ;(ratesResult.data ?? []).forEach(r => { rateMap[r.client] = r.hourly_rate ?? 0 })
        setClientRateMap(rateMap)

        // Config
        const ws = config?.week_start ?? 1
        if (config?.client_goals?.length > 0) {
          setClientGoals(config.client_goals)
          setWeekGoal(config.client_goals.reduce((sum, g) => sum + (g.weekly_hours ?? 0), 0))
        } else if (config?.weekly_goal) {
          setWeekGoal(config.weekly_goal)
        }
        if (!config?.contact_email) setShowEmailCapture(true)

        const today = todayString()
        const weekStartDate = weekStartString(ws)
        const monthStart = monthStartString()

        // Today
        setTodayHours(
          allSessions.filter(s => s.date === today).reduce((sum, s) => sum + (s.hours ?? 0), 0)
        )

        // This week
        const weekSessions = allSessions.filter(s => s.date >= weekStartDate)
        setWeekHours(weekSessions.reduce((sum, s) => sum + (s.hours ?? 0), 0))
        const byClient = {}
        weekSessions.forEach(s => { byClient[s.client] = (byClient[s.client] ?? 0) + (s.hours ?? 0) })
        setWeekByClient(byClient)
        setWeekEarnings(
          Object.entries(byClient).reduce((sum, [client, hours]) => sum + hours * (rateMap[client] ?? 0), 0)
        )

        // This month (for invoice nudges)
        const byClientMonth = {}
        allSessions
          .filter(s => s.date >= monthStart && (s.hours ?? 0) > 0)
          .forEach(s => { byClientMonth[s.client] = (byClientMonth[s.client] ?? 0) + (s.hours ?? 0) })
        setMonthByClient(byClientMonth)

        // Recent 5 sessions
        setRecentSessions(allSessions.slice(0, 5))

        // Streak — consecutive days with logged hours
        const workedDates = [...new Set(
          allSessions.filter(s => (s.hours ?? 0) > 0).map(s => s.date)
        )].sort().reverse()
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
        if (!workedDates.length || (workedDates[0] !== today && workedDates[0] !== yesterday)) {
          setStreak(0)
        } else {
          let count = 1
          for (let i = 1; i < workedDates.length; i++) {
            const diff = (new Date(workedDates[i - 1]) - new Date(workedDates[i])) / 86400000
            if (diff === 1) count++
            else break
          }
          setStreak(count)
        }
      } catch {
        setLoadError(true)
      }
      setLoading(false)
    }
    load()
  }, [user, isPro])

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

  // Daily reminder nudge — show after 3pm if nothing logged today
  const hour = new Date().getHours()
  const showDailyNudge = !loading && !loadError && hour >= 15 && todayHours === 0

  const animatedToday = useCountUp(todayHours, 700, !loading)
  const animatedWeek = useCountUp(weekHours, 700, !loading)
  const animatedProgress = useCountUp(weekProgress, 700, !loading)

  if (loading) return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle" style={{ background: 'var(--color-border)', borderRadius: 4, width: 160, height: 16, display: 'inline-block' }} />
      </div>
      <div className="card-grid">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="card" style={{ minHeight: 90 }}>
            <div style={{ background: 'var(--color-border)', borderRadius: 4, height: 12, width: '50%', marginBottom: '0.75rem' }} />
            <div style={{ background: 'var(--color-border)', borderRadius: 4, height: 28, width: '40%', marginBottom: '0.5rem' }} />
            <div style={{ background: 'var(--color-border)', borderRadius: 4, height: 10, width: '60%' }} />
          </div>
        ))}
      </div>
    </div>
  )

  if (loadError) return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
      </div>
      <div className="alert alert-danger">
        Something went wrong loading your data. <button className="alert-link" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }} onClick={() => window.location.reload()}>Reload</button>
      </div>
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
      </div>

      {showEmailCapture && (
        <EmailCaptureCard userId={user.id} onDone={() => setShowEmailCapture(false)} />
      )}

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

      {showDailyNudge && (
        <div className="alert alert-info" style={{ marginBottom: '1.5rem' }}>
          No time tracked today yet — don't forget to log your hours. <Link to="/track" className="alert-link">Start tracking →</Link>
        </div>
      )}

      {invoiceNudges.map(([client, hours]) => (
        <div key={client} className="alert alert-info" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <span>
            You have <strong>{formatHours(hours)}</strong>
            {clientRateMap[client] ? <> ({formatCurrency(hours * clientRateMap[client])})</> : null}
            {' '}logged for <strong>{client}</strong> this month — ready to invoice?
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

        <div className="card">
          <div className="card-title">Streak</div>
          <div className="card-value" style={{ color: streak >= 3 ? 'var(--accent)' : undefined }}>
            {streak} {streak === 1 ? 'day' : 'days'}
          </div>
          <div className="card-subtitle">{streak === 0 ? 'Track today to start' : streak >= 7 ? 'On fire!' : 'Keep it up'}</div>
        </div>

        <div className="card">
          <div className="card-title">Est. Earnings</div>
          <div className="card-value" style={{ color: weekEarnings > 0 ? 'var(--accent)' : undefined }}>
            {weekEarnings > 0 ? formatCurrency(weekEarnings) : '—'}
          </div>
          <div className="card-subtitle">
            {weekEarnings > 0 ? 'this week' : 'add rates in Client Rates'}
          </div>
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

      {recentSessions.length === 0 ? (
        <div className="onboarding-card card">
          <p className="onboarding-eyebrow">Getting started</p>
          <h2 className="onboarding-heading">Welcome to Tally</h2>
          <p className="onboarding-subtext">Track every hour you work so you always know exactly what to invoice. Here's how to get going:</p>
          <ol className="onboarding-steps">
            <li>
              <span className="onboarding-step-title">Add a client</span>
              <span className="onboarding-step-desc">Type a new client name on the Track page — no setup required</span>
            </li>
            <li>
              <span className="onboarding-step-title">Log your first session</span>
              <span className="onboarding-step-desc">Start the timer while you work, or enter hours manually after</span>
            </li>
            <li>
              <span className="onboarding-step-title">See your hours here</span>
              <span className="onboarding-step-desc">Your dashboard fills in automatically as you track</span>
            </li>
          </ol>
          <div className="onboarding-actions">
            <Link to="/track" className="btn btn-primary">Start tracking →</Link>
            <Link to="/demo" className="btn btn-secondary">Try the demo first</Link>
          </div>
        </div>
      ) : (
        <>
          <div className="section-header">
            <h2 className="section-title">Recent Sessions</h2>
            <Link to="/sessions" className="section-link">View all</Link>
          </div>
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
        </>
      )}
    </div>
  )
}
