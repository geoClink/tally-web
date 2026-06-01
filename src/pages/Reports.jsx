import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useSubscription } from '../context/SubscriptionContext'
import { formatHours, weekStartString, monthStartString } from '../lib/utils'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend)

const FILTERS = [
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'month' },
  { label: 'All Time', value: 'all', requiresPro: true },
]

export default function Reports() {
  const { user } = useAuth()
  const { isPro } = useSubscription()
  const [filter, setFilter] = useState('week')
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSessions()
  }, [filter, user])

  async function fetchSessions() {
    setLoading(true)
    let query = supabase
      .from('sessions')
      .select('client, hours, date')
      .eq('user_id', user.id)

    if (filter === 'week') query = query.gte('date', weekStartString())
    if (filter === 'month') query = query.gte('date', monthStartString())

    const { data } = await query
    setSessions(data ?? [])
    setLoading(false)
  }

  // Group sessions by client and sum hours
  const byClient = sessions.reduce((acc, s) => {
    acc[s.client] = (acc[s.client] ?? 0) + (s.hours ?? 0)
    return acc
  }, {})

  const clients = Object.keys(byClient).sort((a, b) => byClient[b] - byClient[a])
  const totalHours = Object.values(byClient).reduce((sum, h) => sum + h, 0)

  const chartData = {
    labels: clients,
    datasets: [{
      label: 'Hours',
      data: clients.map(c => parseFloat(byClient[c].toFixed(2))),
      backgroundColor: 'rgba(37, 99, 235, 0.7)',
      borderColor: 'rgba(37, 99, 235, 1)',
      borderWidth: 1,
      borderRadius: 4,
    }],
  }

  const chartOptions = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      y: { beginAtZero: true, ticks: { callback: v => `${v}h` } },
    },
  }

  const activeFilter = FILTERS.find(f => f.value === filter)

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Reports</h1>
        <p className="page-subtitle">Hours breakdown by client</p>
      </div>

      <div className="filter-bar">
        {FILTERS.map(f => {
          const locked = f.requiresPro && !isPro
          return (
            <button
              key={f.value}
              className={`filter-btn${filter === f.value ? ' active' : ''}`}
              onClick={() => !locked && setFilter(f.value)}
              title={locked ? 'Requires Pro' : ''}
            >
              {f.label}
              {locked && ' 🔒'}
            </button>
          )
        })}
      </div>

      {activeFilter?.requiresPro && !isPro && (
        <div className="alert alert-info">
          All-time reports require Pro. <Link to="/billing">Upgrade to Pro →</Link>
        </div>
      )}

      {loading ? (
        <div className="loading">Loading…</div>
      ) : clients.length === 0 ? (
        <div className="empty-state">No sessions found for this period.</div>
      ) : (
        <>
          <div className="chart-card">
            <Bar data={chartData} options={chartOptions} />
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Hours</th>
                  <th>% of Total</th>
                </tr>
              </thead>
              <tbody>
                {clients.map(client => (
                  <tr key={client}>
                    <td>{client}</td>
                    <td>{formatHours(byClient[client])}</td>
                    <td className="text-muted">
                      {totalHours > 0 ? `${Math.round((byClient[client] / totalHours) * 100)}%` : '—'}
                    </td>
                  </tr>
                ))}
                <tr style={{ fontWeight: 600 }}>
                  <td>Total</td>
                  <td>{formatHours(totalHours)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
