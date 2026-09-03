import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useSubscription } from '../context/SubscriptionContext'
import { formatHours, weekStartString, monthStartString } from '../lib/utils'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

const FILTERS = [
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'month' },
  { label: 'All Time', value: 'all' },
]

export default function TeamDashboard() {
  const { user } = useAuth()
  const { isBusiness } = useSubscription()
  const [workspace, setWorkspace] = useState(null)
  const [memberSessions, setMemberSessions] = useState([])
  const [filter, setFilter] = useState('week')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isBusiness) loadTeamData()
    else setLoading(false)
  }, [user, isBusiness, filter])

  async function loadTeamData() {
    setLoading(true)

    if (user.email === import.meta.env.VITE_DEMO_EMAIL) {
      setWorkspace({ name: 'Design Team', client_name: 'Acme Corp' })
      const demoHours = {
        week:  [28.5, 22.0, 15.5],
        month: [112,  87,   63],
        all:   [340,  265,  198],
      }[filter]
      setMemberSessions([
        { userId: 'demo',  email: 'demo@tally.app',        hours: demoHours[0] },
        { userId: 'alice', email: 'alice@designteam.co',   hours: demoHours[1] },
        { userId: 'bob',   email: 'bob@designteam.co',     hours: demoHours[2] },
      ])
      setLoading(false)
      return
    }

    const { data: config } = await supabase
      .from('config')
      .select('week_start')
      .eq('user_id', user.id)
      .maybeSingle()
    const weekStart = config?.week_start ?? 1

    let ws = null
    const { data: owned } = await supabase
      .from('workspaces')
      .select('*')
      .eq('owner_id', user.id)
      .maybeSingle()

    if (owned) {
      ws = owned
    } else {
      const { data: memberOf } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('invited_email', user.email)
        .maybeSingle()
      if (memberOf) {
        const { data: foundWs } = await supabase
          .from('workspaces')
          .select('*')
          .eq('id', memberOf.workspace_id)
          .maybeSingle()
        ws = foundWs
      }
    }

    if (!ws) { setLoading(false); return }
    setWorkspace(ws)

    const { data: membersData } = await supabase
      .from('workspace_members')
      .select('invited_email, role, user_id, accepted_at')
      .eq('workspace_id', ws.id)
      .not('accepted_at', 'is', null)

    const userIds = [
      ws.owner_id,
      ...(membersData?.filter(m => m.user_id).map(m => m.user_id) ?? []),
    ]

    // Build session query — filter by client_name so only workspace-related hours count
    let sessionQuery = supabase
      .from('sessions')
      .select('user_id, client, hours, date')
      .in('user_id', userIds)

    if (filter === 'week') sessionQuery = sessionQuery.gte('date', weekStartString(weekStart))
    if (filter === 'month') sessionQuery = sessionQuery.gte('date', monthStartString())
    if (ws.client_name) sessionQuery = sessionQuery.eq('client', ws.client_name)

    const { data: sessions } = await sessionQuery

    const byUser = {}
    userIds.forEach(id => { byUser[id] = { hours: 0, sessions: [] } })
    sessions?.forEach(s => {
      if (byUser[s.user_id]) {
        byUser[s.user_id].hours += s.hours ?? 0
        byUser[s.user_id].sessions.push(s)
      }
    })

    const emailMap = {
      [ws.owner_id]: membersData?.find(m => m.user_id === ws.owner_id)?.invited_email ?? user.email,
      ...(membersData?.reduce((acc, m) => ({ ...acc, [m.user_id]: m.invited_email }), {}) ?? {}),
    }

    const result = userIds
      .filter(id => byUser[id])
      .map(id => ({
        userId: id,
        email: emailMap[id] ?? id,
        hours: byUser[id].hours,
      }))
      .sort((a, b) => b.hours - a.hours)

    setMemberSessions(result)
    setLoading(false)
  }

  if (!isBusiness) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">Team Dashboard</h1>
        </div>
        <div className="paywall">
          <div className="paywall-title">Team dashboard requires Business tier</div>
          <p className="paywall-desc">See your whole team's hours in one place.</p>
          <Link to="/billing" className="btn btn-primary">Upgrade to Business</Link>
        </div>
      </div>
    )
  }

  if (loading) return <div className="loading">Loading…</div>

  if (!workspace) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">Team Dashboard</h1>
        </div>
        <div className="empty-state">
          No workspace found. <Link to="/team">Set up your team first →</Link>
        </div>
      </div>
    )
  }

  const totalHours = memberSessions.reduce((sum, m) => sum + m.hours, 0)

  const MEMBER_COLORS = [
    { bg: 'rgba(37, 99, 235, 0.75)',  border: 'rgba(37, 99, 235, 1)',  avatar: '#2563eb' },
    { bg: 'rgba(16, 185, 129, 0.75)', border: 'rgba(16, 185, 129, 1)', avatar: '#10b981' },
    { bg: 'rgba(245, 158, 11, 0.75)', border: 'rgba(245, 158, 11, 1)', avatar: '#f59e0b' },
    { bg: 'rgba(139, 92, 246, 0.75)', border: 'rgba(139, 92, 246, 1)', avatar: '#8b5cf6' },
    { bg: 'rgba(239, 68, 68, 0.75)',  border: 'rgba(239, 68, 68, 1)',  avatar: '#ef4444' },
  ]

  const chartData = {
    labels: memberSessions.map(m => m.email.split('@')[0]),
    datasets: [{
      label: 'Hours',
      data: memberSessions.map(m => parseFloat(m.hours.toFixed(2))),
      backgroundColor: memberSessions.map((_, i) => MEMBER_COLORS[i % MEMBER_COLORS.length].bg),
      borderColor: memberSessions.map((_, i) => MEMBER_COLORS[i % MEMBER_COLORS.length].border),
      borderWidth: 1,
      borderRadius: 6,
    }],
  }

  const chartOptions = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true, ticks: { callback: v => `${v}h` } } },
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Team Dashboard</h1>
        <p className="page-subtitle">
          {workspace.name}
          {workspace.client_name && (
            <span className="text-muted"> · {workspace.client_name}</span>
          )}
        </p>
      </div>

      {!workspace.client_name && (
        <div className="alert alert-warning">
          No client name is set for this workspace — hours shown are unfiltered.{' '}
          <Link to="/team">Set a client name →</Link>
        </div>
      )}

      <div className="filter-bar">
        {FILTERS.map(f => (
          <button
            key={f.value}
            className={`filter-btn${filter === f.value ? ' active' : ''}`}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="card-grid">
        <div className="card">
          <div className="card-title">Team Total</div>
          <div className="card-value">{formatHours(totalHours)}</div>
          <div className="card-subtitle">
            {filter === 'week' ? 'this week' : filter === 'month' ? 'this month' : 'all time'}
          </div>
        </div>
        <div className="card">
          <div className="card-title">Active Members</div>
          <div className="card-value">{memberSessions.filter(m => m.hours > 0).length}</div>
          <div className="card-subtitle">of {memberSessions.length} total</div>
        </div>
        <div className="card">
          <div className="card-title">Avg / Member</div>
          <div className="card-value">
            {memberSessions.filter(m => m.hours > 0).length > 0
              ? formatHours(totalHours / memberSessions.filter(m => m.hours > 0).length)
              : '—'}
          </div>
          <div className="card-subtitle">per active member</div>
        </div>
        <div className="card">
          <div className="card-title">Top Contributor</div>
          <div className="card-value" style={{ fontSize: '1.1rem' }}>
            {memberSessions[0]?.hours > 0 ? memberSessions[0].email.split('@')[0] : '—'}
          </div>
          <div className="card-subtitle">
            {memberSessions[0]?.hours > 0 ? formatHours(memberSessions[0].hours) : 'no sessions yet'}
          </div>
        </div>
      </div>

      {memberSessions.length === 0 ? (
        <div className="empty-state">No sessions tracked by any team member yet.</div>
      ) : (
        <>
          <div className="chart-card">
            <Bar data={chartData} options={chartOptions} />
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Hours</th>
                  <th className="hide-mobile">% of Team</th>
                </tr>
              </thead>
              <tbody>
                {memberSessions.map((m, i) => {
                  const color = MEMBER_COLORS[i % MEMBER_COLORS.length].avatar
                  const pct = totalHours > 0 ? Math.round((m.hours / totalHours) * 100) : 0
                  return (
                    <tr key={m.userId}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <div style={{
                            width: '1.75rem', height: '1.75rem', borderRadius: '50%',
                            background: color, color: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 600, fontSize: '0.75rem', flexShrink: 0,
                          }}>
                            {m.email.charAt(0).toUpperCase()}
                          </div>
                          <span style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {m.email}
                          </span>
                        </div>
                      </td>
                      <td style={{ fontWeight: 500 }}>{formatHours(m.hours)}</td>
                      <td className="hide-mobile">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ height: '6px', width: '60px', borderRadius: '3px', background: 'var(--border, #e5e7eb)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '3px' }} />
                          </div>
                          <span className="text-muted" style={{ fontSize: '0.82rem', minWidth: '2rem' }}>{pct}%</span>
                        </div>
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
