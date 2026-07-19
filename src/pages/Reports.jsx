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
import { formatHours, formatCurrency, weekStartString, monthStartString } from '../lib/utils'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend)

const FILTERS = [
  { label: 'This Week',  value: 'week' },
  { label: 'This Month', value: 'month' },
  { label: 'All Time',   value: 'all', requiresPro: true },
]

function lastWeekRange() {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const thisMonday = new Date(now); thisMonday.setDate(now.getDate() + diff)
  const lastMonday = new Date(thisMonday); lastMonday.setDate(thisMonday.getDate() - 7)
  const lastSunday = new Date(lastMonday); lastSunday.setDate(lastMonday.getDate() + 6)
  return {
    start: lastMonday.toISOString().split('T')[0],
    end:   lastSunday.toISOString().split('T')[0],
  }
}

function lastMonthRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const end   = new Date(now.getFullYear(), now.getMonth(), 0)
  return {
    start: start.toISOString().split('T')[0],
    end:   end.toISOString().split('T')[0],
  }
}

function monthProjection(hours) {
  const now = new Date()
  const dayOfMonth  = now.getDate()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  if (dayOfMonth === 0) return hours
  return (hours / dayOfMonth) * daysInMonth
}

function ChangeBadge({ current, prev, label }) {
  if (!prev || prev === 0) return <span className="text-muted">No prior {label}</span>
  const pct = Math.round(((current - prev) / prev) * 100)
  const up = pct >= 0
  return (
    <span style={{ color: up ? 'var(--success)' : 'var(--danger)', fontWeight: 500, fontSize: '0.8rem' }}>
      {up ? '↑' : '↓'} {Math.abs(pct)}% vs last {label}
    </span>
  )
}

export default function Reports() {
  const { user } = useAuth()
  const { isPro } = useSubscription()
  const [filter, setFilter] = useState('week')
  const [sessions, setSessions] = useState([])
  const [prevSessions, setPrevSessions] = useState([])
  const [rateMap, setRateMap] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRates()
  }, [user])

  useEffect(() => {
    fetchSessions()
  }, [filter, user])

  async function fetchRates() {
    const { data } = await supabase
      .from('client_rates')
      .select('client, hourly_rate')
      .eq('user_id', user.id)
    const map = {}
    data?.forEach(r => { map[r.client] = r.hourly_rate })
    setRateMap(map)
  }

  async function fetchSessions() {
    setLoading(true)

    let query = supabase.from('sessions').select('client, hours, date').eq('user_id', user.id)
    if (filter === 'week')  query = query.gte('date', weekStartString())
    if (filter === 'month') query = query.gte('date', monthStartString())
    const { data } = await query
    setSessions(data ?? [])

    // Fetch comparison period
    if (filter === 'week') {
      const { start, end } = lastWeekRange()
      const { data: prev } = await supabase
        .from('sessions').select('client, hours')
        .eq('user_id', user.id).gte('date', start).lte('date', end)
      setPrevSessions(prev ?? [])
    } else if (filter === 'month') {
      const { start, end } = lastMonthRange()
      const { data: prev } = await supabase
        .from('sessions').select('client, hours')
        .eq('user_id', user.id).gte('date', start).lte('date', end)
      setPrevSessions(prev ?? [])
    } else {
      setPrevSessions([])
    }

    setLoading(false)
  }

  function sumByClient(rows) {
    return rows.reduce((acc, s) => {
      acc[s.client] = (acc[s.client] ?? 0) + (s.hours ?? 0)
      return acc
    }, {})
  }

  function totalEarnings(byClient) {
    return Object.entries(byClient).reduce((sum, [client, hours]) => {
      return sum + hours * (rateMap[client] ?? 0)
    }, 0)
  }

  const byClient   = sumByClient(sessions)
  const prevByClient = sumByClient(prevSessions)
  const clients    = Object.keys(byClient).sort((a, b) => byClient[b] - byClient[a])
  const totalHours = Object.values(byClient).reduce((sum, h) => sum + h, 0)
  const prevHours  = Object.values(prevByClient).reduce((sum, h) => sum + h, 0)
  const earnings     = totalEarnings(byClient)
  const prevEarnings = totalEarnings(prevByClient)
  const hasRates     = Object.keys(rateMap).length > 0
  const periodLabel  = filter === 'week' ? 'week' : 'month'

  const projected        = filter === 'month' ? monthProjection(totalHours) : 0
  const projectedEarnings = filter === 'month' ? monthProjection(earnings)   : 0

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
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true, ticks: { callback: v => `${v}h` } } },
  }

  function exportCSV() {
    const header = 'Client,Hours'
    const rows = clients.map(c => `${c},${byClient[c].toFixed(2)}`)
    const csv = [header, ...rows, `Total,${totalHours.toFixed(2)}`].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `tally-report-${filter}-${new Date().toISOString().split('T')[0]}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  const activeFilter = FILTERS.find(f => f.value === filter)

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h1 className="page-title">Reports</h1>
            <p className="page-subtitle">Hours breakdown by client</p>
          </div>
          {isPro && clients.length > 0 && (
            <button className="btn btn-secondary" onClick={exportCSV}>Export CSV</button>
          )}
          {!isPro && (
            <Link to="/billing" className="btn btn-secondary">Upgrade for CSV</Link>
          )}
        </div>
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
              {f.label}{locked && ' 🔒'}
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
          {/* Comparison + projection stats */}
          {filter !== 'all' && (
            <div className="card-grid" style={{ marginBottom: '1.5rem' }}>
              <div className="card">
                <div className="card-title">Hours</div>
                <div className="card-value">{formatHours(totalHours)}</div>
                <div className="card-subtitle">
                  <ChangeBadge current={totalHours} prev={prevHours} label={periodLabel} />
                </div>
              </div>

              {hasRates && earnings > 0 && (
                <div className="card">
                  <div className="card-title">Earnings</div>
                  <div className="card-value">{formatCurrency(earnings)}</div>
                  <div className="card-subtitle">
                    <ChangeBadge current={earnings} prev={prevEarnings} label={periodLabel} />
                  </div>
                </div>
              )}

              {filter === 'month' && (
                <div className="card">
                  <div className="card-title">Projected Month End</div>
                  <div className="card-value">{formatHours(projected)}</div>
                  <div className="card-subtitle">
                    {hasRates && projectedEarnings > 0
                      ? `${formatCurrency(projectedEarnings)} projected`
                      : 'at current pace'}
                  </div>
                </div>
              )}
            </div>
          )}

          {filter === 'all' && (
            <div className="card-grid" style={{ marginBottom: '1.5rem' }}>
              <div className="card">
                <div className="card-title">Total Hours</div>
                <div className="card-value">{formatHours(totalHours)}</div>
              </div>
              {hasRates && earnings > 0 && (
                <div className="card">
                  <div className="card-title">Total Earnings</div>
                  <div className="card-value">{formatCurrency(earnings)}</div>
                </div>
              )}
            </div>
          )}

          <div className="chart-card">
            <Bar data={chartData} options={chartOptions} />
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Hours</th>
                  {hasRates && <th>Earnings</th>}
                  <th>% of Total</th>
                </tr>
              </thead>
              <tbody>
                {clients.map(client => (
                  <tr key={client}>
                    <td>{client}</td>
                    <td>{formatHours(byClient[client])}</td>
                    {hasRates && (
                      <td>{rateMap[client] ? formatCurrency(byClient[client] * rateMap[client]) : '—'}</td>
                    )}
                    <td className="text-muted">
                      {totalHours > 0 ? `${Math.round((byClient[client] / totalHours) * 100)}%` : '—'}
                    </td>
                  </tr>
                ))}
                <tr style={{ fontWeight: 600 }}>
                  <td>Total</td>
                  <td>{formatHours(totalHours)}</td>
                  {hasRates && <td>{earnings > 0 ? formatCurrency(earnings) : '—'}</td>}
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
