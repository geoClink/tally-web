import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import TrashIcon from '../components/TrashIcon'
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
  const [editBillingCycle, setEditBillingCycle] = useState('monthly')
  const [editBillingStartDay, setEditBillingStartDay] = useState('')
  const [editBillingWeekday, setEditBillingWeekday] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [newClient, setNewClient] = useState('')
  const [newRate, setNewRate] = useState('')
  const [newBudget, setNewBudget] = useState('')
  const [newBillingCycle, setNewBillingCycle] = useState('monthly')
  const [newBillingStartDay, setNewBillingStartDay] = useState('')
  const [newBillingWeekday, setNewBillingWeekday] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null)

  const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

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
    setEditBillingCycle(r.billing_cycle ?? 'monthly')
    setEditBillingStartDay(r.billing_start_day ?? '')
    setEditBillingWeekday(r.billing_weekday ?? '')
    setEditEmail(r.client_email ?? '')
  }

  async function saveEdit(id) {
    const rate = parseFloat(editRate)
    if (isNaN(rate) || rate < 0) { setError('Enter a valid rate'); return }
    const budget = editBudget !== '' ? parseFloat(editBudget) : null
    if (budget !== null && (isNaN(budget) || budget < 0)) { setError('Enter a valid budget'); return }
    const billingDay = (editBillingCycle === 'monthly' && editBillingStartDay !== '') ? parseInt(editBillingStartDay) : null
    if (billingDay !== null && (isNaN(billingDay) || billingDay < 1 || billingDay > 28)) { setError('Billing start day must be 1–28'); return }
    const billingWeekday = (editBillingCycle === 'weekly' && editBillingWeekday !== '') ? parseInt(editBillingWeekday) : null
    setSaving(true)
    const { error: err } = await supabase
      .from('client_rates')
      .update({ hourly_rate: rate, budget_hours: budget, billing_cycle: editBillingCycle, billing_start_day: billingDay, billing_weekday: billingWeekday, client_email: editEmail.trim() || null })
      .eq('id', id)
      .eq('user_id', user.id)
    setSaving(false)
    if (err) { setError(err.message); return }
    setRates(prev => prev.map(r => r.id === id ? { ...r, hourly_rate: rate, budget_hours: budget, billing_cycle: editBillingCycle, billing_start_day: billingDay, billing_weekday: billingWeekday, client_email: editEmail.trim() || null } : r))
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
    const billingDay = (newBillingCycle === 'monthly' && newBillingStartDay !== '') ? parseInt(newBillingStartDay) : null
    if (billingDay !== null && (isNaN(billingDay) || billingDay < 1 || billingDay > 28)) { setError('Billing start day must be 1–28'); return }
    const billingWeekday = (newBillingCycle === 'weekly' && newBillingWeekday !== '') ? parseInt(newBillingWeekday) : null

    if (!isPro && rates.length >= 5) {
      setError('Free tier allows up to 5 clients. Upgrade to Pro for unlimited clients.')
      return
    }

    setSaving(true)
    const { data, error: err } = await supabase
      .from('client_rates')
      .insert({ user_id: user.id, client: newClient.trim(), hourly_rate: rate, budget_hours: budget, billing_cycle: newBillingCycle, billing_start_day: billingDay, billing_weekday: billingWeekday, client_email: newEmail.trim() || null })
      .select()
      .single()
    setSaving(false)
    if (err) { setError(err.message); return }
    setRates(prev => [...prev, data].sort((a, b) => a.client.localeCompare(b.client)))
    setNewClient('')
    setNewRate('')
    setNewBudget('')
    setNewBillingCycle('monthly')
    setNewBillingStartDay('')
    setNewBillingWeekday('')
    setNewEmail('')
  }

  async function deleteRate(id) {
    setConfirmingDeleteId(null)
    await supabase.from('client_rates').delete().eq('id', id).eq('user_id', user.id)
    setRates(prev => prev.filter(r => r.id !== id))
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Client Rates</h1>
        <p className="page-subtitle">Hourly rates and project budgets</p>
      </div>

      {loading ? (
        <div className="loading">Loading…</div>
      ) : (<>

      {error && <div className="auth-error">{error}</div>}

      {!isPro && (
        <div className="alert alert-info">
          Free tier: up to 5 clients. <a href="/billing">Upgrade to Pro</a> for unlimited clients.
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
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Billing Cycle <span className="add-client-optional">optional</span></label>
                        <select value={editBillingCycle} onChange={e => setEditBillingCycle(e.target.value)}>
                          <option value="monthly">Monthly</option>
                          <option value="weekly">Weekly</option>
                        </select>
                      </div>
                      {editBillingCycle === 'monthly' ? (
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label>Start Day <span className="add-client-optional">1–28</span></label>
                          <input
                            type="number"
                            value={editBillingStartDay}
                            onChange={e => setEditBillingStartDay(e.target.value)}
                            min="1"
                            max="28"
                            placeholder="1"
                          />
                        </div>
                      ) : (
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label>Billing Day</label>
                          <select value={editBillingWeekday} onChange={e => setEditBillingWeekday(e.target.value)}>
                            <option value="">Pick a day</option>
                            {WEEKDAY_NAMES.map((name, i) => (
                              <option key={i} value={i}>{name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Client Email <span className="add-client-optional">optional</span></label>
                        <input
                          type="email"
                          value={editEmail}
                          onChange={e => setEditEmail(e.target.value)}
                          placeholder="client@example.com"
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
                          {r.billing_cycle === 'weekly' && r.billing_weekday != null && (
                            <span> · Bills every {WEEKDAY_NAMES[r.billing_weekday]}</span>
                          )}
                          {(r.billing_cycle == null || r.billing_cycle === 'monthly') && r.billing_start_day != null && (
                            <span> · Bills from the {r.billing_start_day}{r.billing_start_day === 1 ? 'st' : r.billing_start_day === 2 ? 'nd' : r.billing_start_day === 3 ? 'rd' : 'th'}</span>
                          )}
                        </div>
                        {r.client_email && (
                          <div className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.1rem' }}>{r.client_email}</div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', flexShrink: 0 }}>
                        {confirmingDeleteId === r.id ? (
                          <>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Remove?</span>
                            <button className="btn btn-danger btn-sm" onClick={() => deleteRate(r.id)}>Yes</button>
                            <button className="btn btn-secondary btn-sm" onClick={() => setConfirmingDeleteId(null)}>No</button>
                          </>
                        ) : (
                          <>
                            <button className="btn btn-secondary btn-sm" onClick={() => startEdit(r)}>Edit</button>
                            <button
                              className="btn-icon"
                              onClick={() => setConfirmingDeleteId(r.id)}
                              title="Remove client"
                              aria-label={`Remove ${r.client}`}
                            >
                              <TrashIcon />
                            </button>
                          </>
                        )}
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

      <div className="card add-client-card">
        <div className="add-client-header">
          <div className="add-client-icon">+</div>
          <div>
            <h2 className="add-client-title">Add Client</h2>
            <p className="add-client-sub">Set a rate and optional hour budget</p>
          </div>
        </div>
        <form onSubmit={addRate}>
          <div className="add-client-fields">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="new-client-name">Client Name</label>
              <input
                id="new-client-name"
                type="text"
                value={newClient}
                onChange={e => setNewClient(e.target.value)}
                placeholder="Acme Corp"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="new-client-rate">Hourly Rate ($)</label>
              <input
                id="new-client-rate"
                type="number"
                value={newRate}
                onChange={e => setNewRate(e.target.value)}
                placeholder="100"
                step="0.01"
                min="0"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Budget Hours <span className="add-client-optional">optional</span></label>
              <input
                type="number"
                value={newBudget}
                onChange={e => setNewBudget(e.target.value)}
                placeholder="No limit"
                step="0.5"
                min="0"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Billing Cycle <span className="add-client-optional">optional</span></label>
              <select value={newBillingCycle} onChange={e => setNewBillingCycle(e.target.value)}>
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>
            {newBillingCycle === 'monthly' ? (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Start Day <span className="add-client-optional">1–28</span></label>
                <input
                  type="number"
                  value={newBillingStartDay}
                  onChange={e => setNewBillingStartDay(e.target.value)}
                  placeholder="1"
                  min="1"
                  max="28"
                />
              </div>
            ) : (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Billing Day</label>
                <select value={newBillingWeekday} onChange={e => setNewBillingWeekday(e.target.value)}>
                  <option value="">Pick a day</option>
                  {WEEKDAY_NAMES.map((name, i) => (
                    <option key={i} value={i}>{name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Client Email <span className="add-client-optional">optional</span></label>
              <input
                type="email"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                placeholder="client@example.com"
              />
            </div>
          </div>
          <button type="submit" className="btn btn-primary add-client-btn" disabled={saving}>
            {saving ? 'Adding…' : '+ Add Client'}
          </button>
        </form>
      </div>
      </>)}
    </div>
  )
}
