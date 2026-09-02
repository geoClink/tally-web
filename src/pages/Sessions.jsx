import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useSubscription } from '../context/SubscriptionContext'
import { formatHours } from '../lib/utils'
import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import ClientSelect from '../components/ClientSelect'

function escapeCSV(value) {
  const str = String(value ?? '')
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export default function Sessions() {
  const { user } = useAuth()
  const { isPro } = useSubscription()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState(null)
  const [deleteError, setDeleteError] = useState('')

  // Filter state
  const [filterClient, setFilterClient] = useState('')
  const [filterStart, setFilterStart] = useState('')
  const [filterEnd, setFilterEnd] = useState('')

  // Edit state
  const [editingId, setEditingId] = useState(null)
  const [editFields, setEditFields] = useState({ date: '', client: '', hours: '', task_note: '' })
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  // Inline delete confirmation — replaces confirm() which is blocked on Android Capacitor
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null)

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

  const allClients = useMemo(
    () => [...new Set(sessions.map(s => s.client))].sort(),
    [sessions]
  )

  const filtered = useMemo(() => {
    return sessions.filter(s => {
      if (filterClient && s.client !== filterClient) return false
      if (filterStart && s.date < filterStart) return false
      if (filterEnd && s.date > filterEnd) return false
      return true
    })
  }, [sessions, filterClient, filterStart, filterEnd])

  const hasFilters = filterClient || filterStart || filterEnd

  async function deleteSession(id) {
    setConfirmingDeleteId(null)
    setDeletingId(id)
    setDeleteError('')
    const { error } = await supabase.from('sessions').delete().eq('id', id).eq('user_id', user.id)
    setDeletingId(null)
    if (error) {
      setDeleteError('Failed to delete session. Please try again.')
    } else {
      setSessions(prev => prev.filter(s => s.id !== id))
    }
  }

  function startEdit(session) {
    setEditingId(session.id)
    setConfirmingDeleteId(null)
    setEditError('')
    setEditFields({
      date: session.date,
      client: session.client,
      hours: String(session.hours),
      task_note: session.task_note ?? '',
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditError('')
  }

  async function saveEdit(id) {
    const hours = parseFloat(editFields.hours)
    if (!editFields.client.trim()) { setEditError('Client is required'); return }
    if (isNaN(hours) || hours <= 0) { setEditError('Enter valid hours (e.g. 1.5)'); return }

    setEditSaving(true)
    setEditError('')
    const { error } = await supabase
      .from('sessions')
      .update({
        date: editFields.date,
        client: editFields.client.trim(),
        hours: parseFloat(hours.toFixed(4)),
        task_note: editFields.task_note.trim() || null,
      })
      .eq('id', id)
      .eq('user_id', user.id)
    setEditSaving(false)

    if (error) {
      setEditError('Failed to save changes. Please try again.')
    } else {
      setSessions(prev => prev.map(s =>
        s.id === id
          ? { ...s, date: editFields.date, client: editFields.client.trim(), hours: parseFloat(hours.toFixed(4)), task_note: editFields.task_note.trim() || null }
          : s
      ))
      setEditingId(null)
    }
  }

  async function exportCSV() {
    const header = ['Date', 'Client', 'Hours', 'Minutes', 'Task Note'].map(escapeCSV).join(',')
    const rows = filtered.map(s => {
      const totalMins = Math.round((s.hours ?? 0) * 60)
      const h = Math.floor(totalMins / 60)
      const m = totalMins % 60
      return [s.date, s.client, h, m, s.task_note ?? ''].map(escapeCSV).join(',')
    })
    const csv = [header, ...rows].join('\n')
    const fileName = `tally-sessions-${new Date().toISOString().split('T')[0]}.csv`

    if (Capacitor.isNativePlatform()) {
      const base64 = btoa(unescape(encodeURIComponent(csv)))
      await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Cache })
      const { uri } = await Filesystem.getUri({ path: fileName, directory: Directory.Cache })
      await Share.share({ title: 'Tally Sessions', url: uri })
    } else {
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  if (loading) return <div className="loading">Loading…</div>

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h1 className="page-title">Sessions</h1>
            <p className="page-subtitle">
              {hasFilters ? `${filtered.length} of ${sessions.length}` : sessions.length} session{sessions.length !== 1 ? 's' : ''}
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

      {/* Filter bar */}
      <div className="card" style={{ padding: '0.875rem 1rem', marginBottom: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: '0.78rem' }}>Client</label>
            <select value={filterClient} onChange={e => setFilterClient(e.target.value)}>
              <option value="">All clients</option>
              {allClients.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: '0.78rem' }}>From</label>
            <input type="date" value={filterStart} onChange={e => setFilterStart(e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: '0.78rem' }}>To</label>
            <input type="date" value={filterEnd} onChange={e => setFilterEnd(e.target.value)} />
          </div>
          {hasFilters && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => { setFilterClient(''); setFilterStart(''); setFilterEnd('') }}
              style={{ alignSelf: 'flex-end' }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {!isPro && (
        <div className="alert alert-info">
          Free tier shows the last 7 days. <Link to="/billing">Upgrade to Pro</Link> for full history and CSV export.
        </div>
      )}

      {deleteError && (
        <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>{deleteError}</div>
      )}

      {filtered.length === 0 ? (
        <div className="empty-state">
          {hasFilters ? 'No sessions match your filters.' : 'No sessions found. Track time in the Tally app.'}
        </div>
      ) : (
        <div className="table-wrapper dashboard-sessions">
          <table>
            <thead>
              <tr>
                <th style={{ whiteSpace: 'nowrap' }}>Date</th>
                <th>Client</th>
                <th>Hours</th>
                <th className="hide-mobile">Note</th>
                <th className="hide-mobile">Source</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                if (editingId === s.id) {
                  return (
                    <tr key={s.id} style={{ background: 'var(--color-bg-alt, var(--bg-alt, rgba(0,0,0,0.03)))' }}>
                      <td data-label="Date">
                        <input
                          type="date"
                          value={editFields.date}
                          onChange={e => setEditFields(f => ({ ...f, date: e.target.value }))}
                          style={{ minWidth: '130px' }}
                        />
                      </td>
                      <td data-label="Client">
                        <ClientSelect
                          clients={allClients}
                          value={editFields.client}
                          onChange={v => setEditFields(f => ({ ...f, client: v }))}
                        />
                      </td>
                      <td data-label="Hours">
                        <input
                          type="number"
                          value={editFields.hours}
                          onChange={e => setEditFields(f => ({ ...f, hours: e.target.value }))}
                          step="0.01"
                          min="0.01"
                          style={{ width: '80px' }}
                        />
                      </td>
                      <td className="hide-mobile">
                        <input
                          type="text"
                          value={editFields.task_note}
                          onChange={e => setEditFields(f => ({ ...f, task_note: e.target.value }))}
                          placeholder="Note"
                        />
                      </td>
                      <td className="hide-mobile" />
                      <td className="session-action-cell">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'flex-start' }}>
                          {editError && (
                            <span style={{ fontSize: '0.73rem', color: 'var(--danger, #dc2626)' }}>{editError}</span>
                          )}
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => saveEdit(s.id)}
                              disabled={editSaving}
                            >
                              {editSaving ? '…' : 'Save'}
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={cancelEdit}
                              disabled={editSaving}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )
                }

                return (
                  <tr key={s.id}>
                    <td data-label="Date" style={{ whiteSpace: 'nowrap' }}>{s.date}</td>
                    <td data-label="Client">{s.client}</td>
                    <td data-label="Hours" style={{ whiteSpace: 'nowrap' }}>{formatHours(s.hours)}</td>
                    <td className="text-muted hide-mobile">{s.task_note || '—'}</td>
                    <td className="text-muted hide-mobile">
                      <span style={{ fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px', background: s.is_manual ? 'var(--bg-alt, #f3f4f6)' : 'transparent', color: 'var(--text-muted)' }}>
                        {s.is_manual ? 'Manual' : 'Timer'}
                      </span>
                    </td>
                    <td className="session-action-cell">
                      {confirmingDeleteId === s.id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Delete?</span>
                          <button className="btn btn-danger btn-sm" onClick={() => deleteSession(s.id)}>Yes</button>
                          <button className="btn btn-secondary btn-sm" onClick={() => setConfirmingDeleteId(null)}>No</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => startEdit(s)}
                            disabled={!!editingId || !!deletingId}
                          >
                            Edit
                          </button>
                          <button
                            className="btn-icon"
                            onClick={() => setConfirmingDeleteId(s.id)}
                            disabled={!!deletingId || !!editingId}
                            title="Delete session"
                          >
                            {deletingId === s.id ? '…' : (
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                                <path d="M10 11v6M14 11v6"/>
                                <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                              </svg>
                            )}
                          </button>
                        </div>
                      )}
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
