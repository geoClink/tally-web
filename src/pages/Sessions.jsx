import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useSubscription } from '../context/SubscriptionContext'
import { formatHours } from '../lib/utils'

export default function Sessions() {
  const { user } = useAuth()
  const { isPro } = useSubscription()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState(null)

  const historyStart = isPro
    ? null
    : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  useEffect(() => {
    fetchSessions()
  }, [user, isPro])

  async function fetchSessions() {
    setLoading(true)
    let query = supabase
      .from('sessions')
      .select('id, date, client, hours, task_note, is_manual')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })

    if (historyStart) query = query.gte('date', historyStart)

    const { data } = await query
    setSessions(data ?? [])
    setLoading(false)
  }

  async function deleteSession(id) {
    if (!confirm('Delete this session? This cannot be undone.')) return
    setDeletingId(id)
    const { error } = await supabase.from('sessions').delete().eq('id', id).eq('user_id', user.id)
    setDeletingId(null)
    if (!error) setSessions(prev => prev.filter(s => s.id !== id))
  }

  function exportCSV() {
    const header = 'Date,Client,Hours,Minutes,Task Note'
    const rows = sessions.map(s => {
      const mins = Math.round((s.hours ?? 0) * 60)
      const h = Math.floor(mins / 60)
      const m = mins % 60
      const note = (s.task_note ?? '').replace(/,/g, ' ')
      return `${s.date},${s.client},${h},${m},${note}`
    })
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tally-sessions-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <div className="loading">Loading…</div>

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h1 className="page-title">Sessions</h1>
            <p className="page-subtitle">
              {sessions.length} session{sessions.length !== 1 ? 's' : ''}
              {!isPro && ' (last 7 days)'}
            </p>
          </div>
          {isPro ? (
            <button className="btn btn-secondary" onClick={exportCSV}>Export CSV</button>
          ) : (
            <Link to="/billing" className="btn btn-secondary">Upgrade for CSV Export</Link>
          )}
        </div>
      </div>

      {!isPro && (
        <div className="alert alert-info">
          Free tier shows the last 7 days. <Link to="/billing">Upgrade to Pro</Link> for full history and CSV export.
        </div>
      )}

      {sessions.length === 0 ? (
        <div className="empty-state">No sessions found. Track time in the Tally iOS app.</div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Client</th>
                <th>Hours</th>
                <th>Note</th>
                <th>Source</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sessions.map(s => (
                <tr key={s.id}>
                  <td>{s.date}</td>
                  <td>{s.client}</td>
                  <td>{formatHours(s.hours)}</td>
                  <td className="text-muted">{s.task_note || '—'}</td>
                  <td className="text-muted">{s.is_manual ? 'Manual' : 'Timer'}</td>
                  <td>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => deleteSession(s.id)}
                      disabled={deletingId === s.id}
                    >
                      {deletingId === s.id ? '…' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
