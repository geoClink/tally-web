import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Settings() {
  const { user } = useAuth()
  const [weeklyGoal, setWeeklyGoal] = useState('')
  const [clientGoals, setClientGoals] = useState([]) // [{ client, weekly_hours }]
  const [clients, setClients] = useState([])
  const [newClientGoalName, setNewClientGoalName] = useState('')
  const [newClientGoalHours, setNewClientGoalHours] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    loadAll()
  }, [user])

  async function loadAll() {
    setLoading(true)
    const [{ data: config }, { data: rates }, { data: sessions }] = await Promise.all([
      supabase.from('config').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('client_rates').select('client').eq('user_id', user.id),
      supabase.from('sessions').select('client').eq('user_id', user.id),
    ])

    if (config?.weekly_goal) setWeeklyGoal(config.weekly_goal)
    if (config?.client_goals) setClientGoals(config.client_goals)

    // Build unique client list from both sources
    const all = [
      ...(rates?.map(r => r.client) ?? []),
      ...(sessions?.map(s => s.client) ?? []),
    ]
    setClients([...new Set(all)].sort())
    setLoading(false)
  }

  async function saveSettings(e) {
    e.preventDefault()
    setError('')
    const goal = parseFloat(weeklyGoal)
    if (isNaN(goal) || goal <= 0) { setError('Enter a valid number of hours'); return }

    setSaving(true)
    const { error: err } = await supabase
      .from('config')
      .upsert({ user_id: user.id, weekly_goal: goal, client_goals: clientGoals }, { onConflict: 'user_id' })
    setSaving(false)

    if (err) { setError(err.message); return }
    setSuccess('Settings saved!')
    setTimeout(() => setSuccess(''), 3000)
  }

  function addClientGoal(e) {
    e.preventDefault()
    if (!newClientGoalName || !newClientGoalHours) return
    const hours = parseFloat(newClientGoalHours)
    if (isNaN(hours) || hours <= 0) return
    setClientGoals(prev => {
      const filtered = prev.filter(g => g.client !== newClientGoalName)
      return [...filtered, { client: newClientGoalName, weekly_hours: hours }]
    })
    setNewClientGoalName('')
    setNewClientGoalHours('')
  }

  function removeClientGoal(client) {
    setClientGoals(prev => prev.filter(g => g.client !== client))
  }

  if (loading) return <div className="loading">Loading…</div>

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Configure your Tally preferences</p>
      </div>

      {error && <div className="auth-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <form onSubmit={saveSettings}>
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Weekly Hour Goal</h2>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <input
              type="number"
              value={weeklyGoal}
              onChange={e => setWeeklyGoal(e.target.value)}
              placeholder="40"
              step="0.5"
              min="1"
              style={{ maxWidth: '160px' }}
            />
            <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.4rem' }}>
              Total hours per week across all clients. Shows as a progress bar on your dashboard.
            </p>
          </div>
        </div>

        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.25rem' }}>Per-Client Weekly Goals</h2>
          <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
            Set how many hours per week you want to work for each client.
          </p>

          {clientGoals.length > 0 && (
            <div className="table-wrapper" style={{ marginBottom: '1rem' }}>
              <table>
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Weekly Hours</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {clientGoals.map(g => (
                    <tr key={g.client}>
                      <td>{g.client}</td>
                      <td>{g.weekly_hours}h</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => removeClientGoal(g.client)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="inline-form">
            <div className="form-group">
              <label>Client</label>
              <input
                list="settings-clients"
                value={newClientGoalName}
                onChange={e => setNewClientGoalName(e.target.value)}
                placeholder="Select or type client"
              />
              <datalist id="settings-clients">
                {clients.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div className="form-group">
              <label>Hours / week</label>
              <input
                type="number"
                value={newClientGoalHours}
                onChange={e => setNewClientGoalHours(e.target.value)}
                placeholder="20"
                step="0.5"
                min="0.5"
              />
            </div>
            <button type="button" className="btn btn-secondary" onClick={addClientGoal}>Add</button>
          </div>
        </div>

        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </form>
    </div>
  )
}
