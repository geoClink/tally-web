import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useSubscription } from '../context/SubscriptionContext'
import { formatCurrency, formatHours } from '../lib/utils'

export default function ClientRates() {
  const { user } = useAuth()
  const { isPro } = useSubscription()
  const [rates, setRates] = useState([])
  const [hoursUsed, setHoursUsed] = useState({}) // client → total hours all time
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editRate, setEditRate] = useState('')
  const [editBudget, setEditBudget] = useState('')
  const [newClient, setNewClient] = useState('')
  const [newRate, setNewRate] = useState('')
  const [newBudget, setNewBudget] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchAll()
  }, [user])

  async function fetchAll() {
    setLoading(true)
    const [{ data: rateData }, { data: sessionData }] = await Promise.all([
      supabase.from('client_rates').select('*').eq('user_id', user.id).order('client'),
      supabase.from('sessions').select('client, hours').eq('user_id', user.id),
    ])
    setRates(rateData ?? [])

    const totals = {}
    sessionData?.forEach(s => {
      totals[s.client] = (totals[s.client] ?? 0) + (s.hours ?? 0)
    })
    setHoursUsed(totals)
    setLoading(false)
  }

  function startEdit(r) {
    setEditingId(r.id)
    setEditRate(r.hourly_rate)
    setEditBudget(r.budget_hours ?? '')
  }

  async function saveEdit(id) {
    const rate = parseFloat(editRate)
    if (isNaN(rate) || rate < 0) { setError('Enter a valid rate'); return }
    const budget = editBudget !== '' ? parseFloat(editBudget) : null
    if (budget !== null && (isNaN(budget) || budget < 0)) { setError('Enter a valid budget'); return }
    setSaving(true)
    const { error: err } = await supabase
      .from('client_rates')
      .update({ hourly_rate: rate, budget_hours: budget })
      .eq('id', id)
      .eq('user_id', user.id)
    setSaving(false)
    if (err) { setError(err.message); return }
    setRates(prev => prev.map(r => r.id === id ? { ...r, hourly_rate: rate, budget_hours: budget } : r))
    setEditingId(null)
    setError('')
  }

  async function addRate(e) {
    e.preventDefault()
    setError('')
    if (!newClient.trim()) { setError('Enter a client name'); return }
    const rate = parseFloat(newRate)
    if (isNaN(rate) || rate < 0) { setError('Enter a valid rate'); return }
    const budget = newBudget !== '' ? parseFloat(newBudget) : null
    if (budget !== null && (isNaN(budget) || budget < 0)) { setError('Enter a valid budget'); return }

    if (!isPro && rates.length >= 1) {
      setError('Free tier allows 1 client. Upgrade to Pro for unlimited clients.')
      return
    }

    setSaving(true)
    const { data, error: err } = await supabase
      .from('client_rates')
      .insert({ user_id: user.id, client: newClient.trim(), hourly_rate: rate, budget_hours: budget })
      .select()
      .single()
    setSaving(false)
    if (err) { setError(err.message); return }
    setRates(prev => [...prev, data].sort((a, b) => a.client.localeCompare(b.client)))
    setNewClient('')
    setNewRate('')
    setNewBudget('')
  }

  async function deleteRate(id) {
    if (!confirm('Remove this client rate?')) return
    await supabase.from('client_rates').delete().eq('id', id).eq('user_id', user.id)
    setRates(prev => prev.filter(r => r.id !== id))
  }

  if (loading) return <div className="loading">Loading…</div>

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Client Rates</h1>
        <p className="page-subtitle">Hourly rates and project budgets</p>
      </div>

      {error && <div className="auth-error">{error}</div>}

      {!isPro && (
        <div className="alert alert-info">
          Free tier: 1 client. <a href="/billing">Upgrade to Pro</a> for unlimited clients.
        </div>
      )}

      {rates.length === 0 ? (
        <div className="empty-state">No clients yet. Add one below.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {rates.map(r => {
            const used = hoursUsed[r.client] ?? 0
            const hasBudget = r.budget_hours != null && r.budget_hours > 0
            const progress = hasBudget ? Math.min((used / r.budget_hours) * 100, 100) : 0
            const isOver = hasBudget && used > r.budget_hours
            const isEditing = editingId === r.id

            return (
              <div key={r.id} className="card" style={{ padding: '1rem' }}>
                {isEditing ? (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Hourly Rate ($)</label>
                        <input
                          type="number"
                          value={editRate}
                          onChange={e => setEditRate(e.target.value)}
                          step="0.01"
                          min="0"
                          autoFocus
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Budget Hours</label>
                        <input
                          type="number"
                          value={editBudget}
                          onChange={e => setEditBudget(e.target.value)}
                          step="0.5"
                          min="0"
                          placeholder="No limit"
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn btn-primary btn-sm" onClick={() => saveEdit(r.id)} disabled={saving}>Save</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{r.client}</div>
                        <div className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.15rem' }}>
                          {formatCurrency(r.hourly_rate)}/hr
                          {hasBudget && (
                            <span> · {formatHours(used)} of {formatHours(r.budget_hours)} used</span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => startEdit(r)}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => deleteRate(r.id)}>Delete</button>
                      </div>
                    </div>

                    {hasBudget && (
                      <div style={{ marginTop: '0.6rem' }}>
                        <div className="progress-bar">
                          <div
                            className={`progress-fill${progress >= 100 ? ' complete' : ''}`}
                            style={{
                              width: `${progress}%`,
                              background: isOver ? 'var(--danger)' : undefined,
                            }}
                          />
                        </div>
                        <div style={{ fontSize: '0.75rem', marginTop: '0.25rem', color: isOver ? 'var(--danger)' : 'var(--text-muted)' }}>
                          {isOver
                            ? `${formatHours(used - r.budget_hours)} over budget`
                            : `${formatHours(r.budget_hours - used)} remaining`}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="card">
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Add Client</h2>
        <form onSubmit={addRate}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Client Name</label>
              <input
                type="text"
                value={newClient}
                onChange={e => setNewClient(e.target.value)}
                placeholder="Acme Corp"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Hourly Rate ($)</label>
              <input
                type="number"
                value={newRate}
                onChange={e => setNewRate(e.target.value)}
                placeholder="100"
                step="0.01"
                min="0"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Budget Hours</label>
              <input
                type="number"
                value={newBudget}
                onChange={e => setNewBudget(e.target.value)}
                placeholder="No limit"
                step="0.5"
                min="0"
              />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving}>Add Client</button>
        </form>
      </div>
    </div>
  )
}
