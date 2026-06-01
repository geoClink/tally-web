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
  const [recentSessions, setRecentSessions] = useState([])
  const [loading, setLoading] = useState(true)

  const today = todayString()
  const weekStart = weekStartString()
  // Free tier: cap history at 7 days ago
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
      .select('hours')
      .eq('user_id', user.id)
      .gte('date', weekStart)
    if (historyStart && historyStart > weekStart) {
      query = query.gte('date', historyStart)
    }
    const { data } = await query
    setWeekHours(data?.reduce((sum, s) => sum + (s.hours ?? 0), 0) ?? 0)
  }

  async function fetchGoal() {
    const { data } = await supabase
      .from('config')
      .select('weekly_goal')
      .eq('user_id', user.id)
      .maybeSingle()
    if (data?.weekly_goal) setWeekGoal(data.weekly_goal)
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

      <div className="section-header">
        <h2 className="section-title">Recent Sessions</h2>
        <Link to="/sessions" className="section-link">View all</Link>
      </div>

      {recentSessions.length === 0 ? (
        <div className="empty-state">No sessions yet. Track time in the Tally iOS app to see it here.</div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Client</th>
                <th>Hours</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {recentSessions.map(s => (
                <tr key={s.id}>
                  <td>{s.date}</td>
                  <td>{s.client}</td>
                  <td>{formatHours(s.hours)}</td>
                  <td className="text-muted">{s.task_note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
