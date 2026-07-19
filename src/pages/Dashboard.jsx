import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useSubscription } from '../context/SubscriptionContext'
import { formatHours, todayString, weekStartString } from '../lib/utils'

export default function Dashboard() {
  const { user } = useAuth()
  const { isPro } = useSubscription()
  const [todayHours, setTodayHours] = useState(0)
  const [weekHours, setWeekHours] = useState(0)
  const [weekGoal, setWeekGoal] = useState(40)
  const [clientGoals, setClientGoals] = useState([])
  const [weekByClient, setWeekByClient] = useState({})
  const [recentSessions, setRecentSessions] = useState([])
  const [loading, setLoading] = useState(true)

  const today = todayString()
  const weekStart = weekStartString()
  const historyStart = isPro ? null : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  useEffect(() => {
    async function load() {
      setLoading(true)
      await Promise.all([fetchTodaySessions(), fetchWeekSessions(), fetchGoal(), fetchRecentSessions()])
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

  if (loading) return <div className="loading">Loading…</div>

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
      </div>

      <div className="card-grid">
        <div className="card">
          <div className="card-title">Today</div>
          <div className="card-value">{formatHours(todayHours)}</div>
          <div className="card-subtitle">tracked today</div>
        </div>

        <div className="card">
          <div className="card-title">This Week</div>
          <div className="card-value">{formatHours(weekHours)}</div>
          <div className="card-subtitle">of {formatHours(weekGoal)} goal</div>
          <div className="progress-bar">
            <div
              className={`progress-fill${weekProgress >= 100 ? ' complete' : ''}`}
              style={{ width: `${weekProgress}%` }}
            />
          </div>
        </div>

        <div className="card">
          <div className="card-title">Weekly Goal</div>
          <div className="card-value">{Math.round(weekProgress)}%</div>
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
                      className={`progress-fill${progress >= 100 ? ' complete' : ''}`}
                      style={{ width: `${progress}%` }}
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
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th style={{ whiteSpace: 'nowrap' }}>Date</th>
                <th>Client</th>
                <th>Hours</th>
                <th className="hide-mobile">Note</th>
              </tr>
            </thead>
            <tbody>
              {recentSessions.map(s => (
                <tr key={s.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{s.date}</td>
                  <td>{s.client}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{formatHours(s.hours)}</td>
                  <td className="text-muted hide-mobile">{s.task_note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
