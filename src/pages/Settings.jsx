import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { createAvatar } from '@dicebear/core'
import { bottts } from '@dicebear/collection'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useAvatar } from '../context/AvatarContext'
import ClientSelect from '../components/ClientSelect'
import BugReportModal from '../components/BugReportModal'

function MonsterOption({ seed, color, selected, onSelect }) {
  const uri = useMemo(() => {
    const avatar = createAvatar(bottts, { seed, size: 96 })
    return `data:image/svg+xml;utf8,${encodeURIComponent(avatar.toString())}`
  }, [seed])

  return (
    <button
      type="button"
      onClick={() => onSelect(seed)}
      style={{
        width: '48px', height: '48px', borderRadius: '50%',
        background: color,
        border: 'none',
        outline: selected ? `3px solid ${color}` : '2px solid transparent',
        outlineOffset: '2px',
        cursor: 'pointer', padding: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
        opacity: selected ? 1 : 0.55,
        transition: 'opacity 0.15s, outline 0.15s',
      }}
    >
      <img src={uri} width="38" height="38" alt={seed} style={{ display: 'block' }} />
    </button>
  )
}

export default function Settings() {
  const { user, signOut } = useAuth()
  const { refresh: refreshAvatar } = useAvatar()
  const navigate = useNavigate()
  const [weeklyGoal, setWeeklyGoal] = useState('')
  const [weekStart, setWeekStart] = useState(1)
  const [clientGoals, setClientGoals] = useState([]) // [{ client, weekly_hours }]
  const [clients, setClients] = useState([])
  const [newClientGoalName, setNewClientGoalName] = useState('')
  const [newClientGoalHours, setNewClientGoalHours] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [yourName, setYourName] = useState('')
  const [avatarSeed, setAvatarSeed] = useState('felix')
  const [avatarColor, setAvatarColor] = useState('#2563eb')
  const [bugModalOpen, setBugModalOpen] = useState(false)
  const [theme, setTheme] = useState(() => localStorage.getItem('tally_theme') ?? 'system')
  const [bgEffect, setBgEffect] = useState(() => localStorage.getItem('tally_bg') === 'dynamic')

  const MONSTER_SEEDS = [
    'felix', 'luna', 'pixel', 'ghost', 'nova', 'blaze',
    'turbo', 'chip', 'byte', 'glitch', 'spark', 'zap',
  ]
  const AVATAR_COLORS = [
    '#2563eb', '#8b5cf6', '#10b981', '#0891b2',
    '#f59e0b', '#ec4899', '#ef4444', '#64748b',
  ]

  function makeUri(seed) {
    const avatar = createAvatar(bottts, { seed, size: 128 })
    return `data:image/svg+xml;utf8,${encodeURIComponent(avatar.toString())}`
  }

  const previewUri = useMemo(() => makeUri(avatarSeed), [avatarSeed])
  const [resetSent, setResetSent] = useState(false)
  const [sendingReset, setSendingReset] = useState(false)

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
    if (config?.week_start != null) setWeekStart(config.week_start)
    if (config?.your_name) setYourName(config.your_name)
    if (config?.avatar_seed) setAvatarSeed(config.avatar_seed)
    if (config?.avatar_color) setAvatarColor(config.avatar_color)

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
      .upsert({ user_id: user.id, weekly_goal: goal, client_goals: clientGoals, week_start: weekStart, your_name: yourName.trim() || null, avatar_seed: avatarSeed, avatar_color: avatarColor }, { onConflict: 'user_id' })
    setSaving(false)

    if (err) { setError(err.message); return }
    setSuccess('Settings saved!')
    setTimeout(() => setSuccess(''), 3000)
    refreshAvatar()
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

  function applyBg(enabled) {
    setBgEffect(enabled)
    if (enabled) {
      localStorage.setItem('tally_bg', 'dynamic')
      document.documentElement.setAttribute('data-bg', 'dynamic')
    } else {
      localStorage.removeItem('tally_bg')
      document.documentElement.removeAttribute('data-bg')
    }
  }

  function applyTheme(value) {
    setTheme(value)
    if (value === 'system') {
      localStorage.removeItem('tally_theme')
      document.documentElement.removeAttribute('data-theme')
    } else {
      localStorage.setItem('tally_theme', value)
      document.documentElement.setAttribute('data-theme', value)
    }
  }

  async function handleChangePassword() {
    setSendingReset(true)
    await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setSendingReset(false)
    setResetSent(true)
  }

  async function deleteAccount() {
    if (!confirm('This will permanently delete your account and all data. This cannot be undone. Continue?')) return
    if (!confirm('Last chance — are you absolutely sure?')) return
    setDeleting(true)

    // Delete owned workspaces and their members
    const { data: ownedWs } = await supabase.from('workspaces').select('id').eq('owner_id', user.id)
    if (ownedWs?.length) {
      for (const ws of ownedWs) {
        await supabase.from('workspace_members').delete().eq('workspace_id', ws.id)
      }
      await supabase.from('workspaces').delete().eq('owner_id', user.id)
    }

    // Remove this user from any workspaces they joined
    await supabase.from('workspace_members').delete().eq('invited_email', user.email)

    // Delete all user data
    await supabase.from('sessions').delete().eq('user_id', user.id)
    await supabase.from('config').delete().eq('user_id', user.id)
    await supabase.from('client_rates').delete().eq('user_id', user.id)
    // Subscriptions table blocks user-level deletes (service role only) — cleaned up server-side via RPC
    await supabase.rpc('delete_own_subscription')

    setDeleting(false)
    await signOut()
    navigate('/login')
  }

  if (loading) return <div className="loading">Loading…</div>

  return (
    <div className="settings-page">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Configure your Tally preferences</p>
      </div>

      {error && <div className="auth-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <form onSubmit={saveSettings}>
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Your Name / Company</h2>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <input
              type="text"
              value={yourName}
              onChange={e => setYourName(e.target.value)}
              placeholder="Jane Smith"
              style={{ maxWidth: '280px' }}
            />
            <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.4rem' }}>
              Used as the sender name on invoices you generate.
            </p>
          </div>
        </div>

        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.25rem' }}>Your Avatar</h2>
          <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            Choose a monster and a color — it shows on your team page.
          </p>

          {/* Preview */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: avatarColor,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, overflow: 'hidden',
              boxShadow: `0 0 0 3px ${avatarColor}40`,
            }}>
              <img
                src={previewUri}
                width="52" height="52"
                alt="avatar preview"
                style={{ display: 'block' }}
              />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{yourName || user.email}</div>
              <div className="text-muted" style={{ fontSize: '0.8rem' }}>Your profile</div>
            </div>
          </div>

          {/* Monster grid */}
          <div style={{ marginBottom: '1rem' }}>
            <div className="text-muted" style={{ fontSize: '0.78rem', fontWeight: 500, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Monster</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px', maxWidth: '320px' }}>
              {MONSTER_SEEDS.map(seed => (
                <MonsterOption
                  key={seed}
                  seed={seed}
                  color={avatarColor}
                  selected={avatarSeed === seed}
                  onSelect={setAvatarSeed}
                />
              ))}
            </div>
          </div>

          {/* Color swatches */}
          <div>
            <div className="text-muted" style={{ fontSize: '0.78rem', fontWeight: 500, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Color</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {AVATAR_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setAvatarColor(color)}
                  title={color}
                  style={{
                    width: '28px', height: '28px', borderRadius: '50%',
                    background: color, border: 'none', cursor: 'pointer',
                    outline: avatarColor === color ? `3px solid ${color}` : '2px solid transparent',
                    outlineOffset: '2px',
                    transition: 'outline 0.15s',
                  }}
                />
              ))}
            </div>
          </div>
        </div>

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
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.25rem' }}>Week Start Day</h2>
          <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
            Choose which day your week begins. Affects weekly totals and reports.
          </p>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <select value={weekStart} onChange={e => setWeekStart(parseInt(e.target.value))} style={{ maxWidth: '200px' }}>
              <option value={1}>Monday</option>
              <option value={2}>Tuesday</option>
              <option value={3}>Wednesday</option>
              <option value={4}>Thursday</option>
              <option value={5}>Friday</option>
              <option value={6}>Saturday</option>
              <option value={0}>Sunday</option>
            </select>
          </div>
        </div>

        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.25rem' }}>Appearance</h2>
          <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
            Choose how Tally looks. System follows your device setting.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ].map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => applyTheme(opt.value)}
                className={theme === opt.value ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>Dynamic background</div>
              <div className="text-muted" style={{ fontSize: '0.78rem', marginTop: '0.1rem' }}>Subtle animated gradient behind the page</div>
            </div>
            <button
              type="button"
              onClick={() => applyBg(!bgEffect)}
              className={bgEffect ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
            >
              {bgEffect ? 'On' : 'Off'}
            </button>
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
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => removeClientGoal(g.client)}
                          title="Remove goal"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                            <path d="M10 11v6M14 11v6"/>
                            <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                          </svg>
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
              <ClientSelect
                clients={clients}
                value={newClientGoalName}
                onChange={v => setNewClientGoalName(v)}
              />
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

      <div className="card" style={{ marginTop: '2rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.4rem' }}>Change Password</h2>
        <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
          We'll email a reset link to <strong>{user.email}</strong>.
        </p>
        {resetSent ? (
          <div className="alert alert-success">Check your email for a password reset link.</div>
        ) : (
          <button type="button" className="btn btn-secondary" onClick={handleChangePassword} disabled={sendingReset}>
            {sendingReset ? 'Sending…' : 'Send Reset Email'}
          </button>
        )}
      </div>

      <div className="card" style={{ marginTop: '2rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.4rem' }}>Report a Bug</h2>
        <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
          Found something broken? Let us know and we'll look into it.
        </p>
        <button type="button" className="btn btn-secondary" onClick={() => setBugModalOpen(true)}>
          Report a Bug
        </button>
      </div>

      <div className="card" style={{ marginTop: '2rem', borderColor: 'var(--danger)' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--danger)' }}>
          Delete Account
        </h2>
        <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
          Permanently deletes all your sessions, goals, subscriptions, and workspace data. This cannot be undone.
        </p>
        <button
          type="button"
          className="btn btn-danger"
          onClick={deleteAccount}
          disabled={deleting}
        >
          {deleting ? 'Deleting…' : 'Delete My Account'}
        </button>
      </div>
      {bugModalOpen && <BugReportModal onClose={() => setBugModalOpen(false)} />}
    </div>
  )
}
