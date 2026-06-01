import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useSubscription } from '../context/SubscriptionContext'
import { formatCurrency } from '../lib/utils'

export default function ClientRates() {
  const { user } = useAuth()
  const { isPro } = useSubscription()
  const [rates, setRates] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editRate, setEditRate] = useState('')
  const [newClient, setNewClient] = useState('')
  const [newRate, setNewRate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchRates()
  }, [user])

  async function fetchRates() {
    setLoading(true)
    const { data } = await supabase
      .from('client_rates')
      .select('*')
      .eq('user_id', user.id)
      .order('client')
    setRates(data ?? [])
    setLoading(false)
  }

  async function saveEdit(id) {
    const rate = parseFloat(editRate)
    if (isNaN(rate) || rate < 0) { setError('Enter a valid rate'); return }
    setSaving(true)
    const { error: err } = await supabase
      .from('client_rates')
      .update({ hourly_rate: rate })
      .eq('id', id)
      .eq('user_id', user.id)
    setSaving(false)
    if (err) { setError(err.message); return }
    setRates(prev => prev.map(r => r.id === id ? { ...r, hourly_rate: rate } : r))
    setEditingId(null)
  }

  async function addRate(e) {
    e.preventDefault()
    setError('')
    if (!newClient.trim()) { setError('Enter a client name'); return }
    const rate = parseFloat(newRate)
    if (isNaN(rate) || rate < 0) { setError('Enter a valid rate'); return }

    // Free tier: only 1 client allowed
    if (!isPro && rates.length >= 1) {
      setError('Free tier allows 1 client. Upgrade to Pro for unlimited clients.')
      return
    }

    setSaving(true)
    const { data, error: err } = await supabase
      .from('client_rates')
      .insert({ user_id: user.id, client: newClient.trim(), hourly_rate: rate })
      .select()
      .single()
    setSaving(false)
    if (err) { setError(err.message); return }
    setRates(prev => [...prev, data].sort((a, b) => a.client.localeCompare(b.client)))
    setNewClient('')
    setNewRate('')
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
        <p className="page-subtitle">Hourly rates used for invoice calculations</p>
      </div>

      {error && <div className="auth-error">{error}</div>}

      {!isPro && (
        <div className="alert alert-info">
          Free tier: 1 client. <a href="/billing">Upgrade to Pro</a> for unlimited clients.
        </div>
      )}

      {rates.length === 0 ? (
        <div className="empty-state">No client rates yet. Add one below.</div>
      ) : (
        <div className="table-wrapper" style={{ marginBottom: '1.5rem' }}>
          <table>
            <thead>
              <tr>
                <th>Client</th>
                <th>Hourly Rate</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rates.map(r => (
                <tr key={r.id}>
                  <td>{r.client}</td>
                  <td>
                    {editingId === r.id ? (
                      <input
                        type="number"
                        value={editRate}
                        onChange={e => setEditRate(e.target.value)}
                        step="0.01"
                        min="0"
                        style={{ width: '100px' }}
                        autoFocus
                      />
                    ) : (
                      formatCurrency(r.hourly_rate)
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {editingId === r.id ? (
                        <>
                          <button className="btn btn-primary btn-sm" onClick={() => saveEdit(r.id)} disabled={saving}>Save</button>
                          <button className="btn btn-secondary btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
                        </>
                      ) : (
                        <>
                          <button className="btn btn-secondary btn-sm" onClick={() => { setEditingId(r.id); setEditRate(r.hourly_rate) }}>Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => deleteRate(r.id)}>Delete</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card">
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Add Client Rate</h2>
        <form onSubmit={addRate}>
          <div className="inline-form">
            <div className="form-group">
              <label>Client Name</label>
              <input
                type="text"
                value={newClient}
                onChange={e => setNewClient(e.target.value)}
                placeholder="Acme Corp"
              />
            </div>
            <div className="form-group">
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
            <button type="submit" className="btn btn-primary" disabled={saving}>Add</button>
          </div>
        </form>
      </div>
    </div>
  )
}
