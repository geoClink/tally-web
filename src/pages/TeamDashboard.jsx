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
]

export default function TeamDashboard() {
  const { user } = useAuth()
  const { isBusiness } = useSubscription()
  const [workspace, setWorkspace] = useState(null)
  const [members, setMembers] = useState([])
  const [memberSessions, setMemberSessions] = useState([]) // { email, hours, sessions[] }
  const [filter, setFilter] = useState('week')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isBusiness) loadTeamData()
    else setLoading(false)
  }, [user, isBusiness, filter])

  async function loadTeamData() {
    setLoading(true)

    // Find workspace (owned or member of)
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

    // Get all accepted members with user_ids
    const { data: membersData } = await supabase
      .from('workspace_members')
      .select('invited_email, role, user_id, accepted_at')
      .eq('workspace_id', ws.id)
      .not('accepted_at', 'is', null)

    setMembers(membersData ?? [])

    // Collect all user_ids to query (owner + accepted members)
    const userIds = [
      ws.owner_id,
      ...(membersData?.filter(m => m.user_id).map(m => m.user_id) ?? []),
    ]

    const dateStart = filter === 'week' ? weekStartString() : monthStartString()

    // Query sessions for all team members
    const { data: sessions } = await supabase
      .from('sessions')
      .select('user_id, client, hours, date')
      .in('user_id', userIds)
      .gte('date', dateStart)

    // Group by user_id
    const byUser = {}
    userIds.forEach(id => { byUser[id] = { hours: 0, sessions: [] } })
    sessions?.forEach(s => {
      if (byUser[s.user_id]) {
        byUser[s.user_id].hours += s.hours ?? 0
        byUser[s.user_id].sessions.push(s)
      }
    })

    // Map to member emails for display
    const emailMap = {
      [ws.owner_id]: 'Owner (' + (membersData?.find(m => m.user_id === ws.owner_id)?.invited_email ?? 'you') + ')',
      ...(membersData?.reduce((acc, m) => ({ ...acc, [m.user_id]: m.invited_email }), {}) ?? {}),
    }

    const result = userIds
      .filter(id => byUser[id])
      .map(id => ({
        userId: id,
        email: emailMap[id] ?? id,
        hours: byUser[id].hours,
        sessions: byUser[id].sessions,
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

  const chartData = {
    labels: memberSessions.map(m => m.email.split('@')[0]),
    datasets: [{
      label: 'Hours',
      data: memberSessions.map(m => parseFloat(m.hours.toFixed(2))),
      backgroundColor: 'rgba(37, 99, 235, 0.7)',
      borderColor: 'rgba(37, 99, 235, 1)',
      borderWidth: 1,
      borderRadius: 4,
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
        <p className="page-subtitle">{workspace.name}</p>
      </div>

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
          <div className="card-subtitle">{filter === 'week' ? 'this week' : 'this month'}</div>
        </div>
        <div className="card">
          <div className="card-title">Active Members</div>
          <div className="card-value">{memberSessions.filter(m => m.hours > 0).length}</div>
          <div className="card-subtitle">of {memberSessions.length} total</div>
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
                {memberSessions.map(m => (
                  <tr key={m.userId}>
                    <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.email}
                    </td>
                    <td>{formatHours(m.hours)}</td>
                    <td className="hide-mobile text-muted">
                      {totalHours > 0 ? `${Math.round((m.hours / totalHours) * 100)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
