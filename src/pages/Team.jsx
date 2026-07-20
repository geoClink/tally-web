import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useSubscription } from '../context/SubscriptionContext'

export default function Team() {
  const { user } = useAuth()
  const { isBusiness } = useSubscription()
  const [workspace, setWorkspace] = useState(null)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [inviting, setInviting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [teamWeekHours, setTeamWeekHours] = useState(null)

  // Create workspace
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [newClientName, setNewClientName] = useState('')
  const [newWeeklyGoal, setNewWeeklyGoal] = useState('')
  const [creating, setCreating] = useState(false)

  // Edit workspace
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editClientName, setEditClientName] = useState('')
  const [editWeeklyGoal, setEditWeeklyGoal] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isBusiness) { setLoading(false); return }
    fetchWorkspace()
  }, [user, isBusiness])

  async function fetchWorkspace() {
    setLoading(true)

    const { data: owned } = await supabase
      .from('workspaces')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (owned) {
      setWorkspace(owned)
      await Promise.all([fetchMembers(owned.id), fetchTeamHours(owned.id)])
      setLoading(false)
      return
    }

    const { data: memberOf } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('invited_email', user.email)
      .maybeSingle()

    if (memberOf) {
      const { data: ws } = await supabase
        .from('workspaces')
        .select('*')
        .eq('id', memberOf.workspace_id)
        .maybeSingle()
      setWorkspace(ws)
      if (ws) {
        await Promise.all([fetchMembers(ws.id), fetchTeamHours(ws.id)])
        await supabase
          .from('workspace_members')
          .update({ accepted_at: new Date().toISOString(), user_id: user.id })
          .eq('workspace_id', ws.id)
          .eq('invited_email', user.email)
          .is('accepted_at', null)
      }
    }

    setLoading(false)
  }

  async function fetchMembers(workspaceId) {
    const { data } = await supabase
      .from('workspace_members')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('invited_email')
    setMembers(data ?? [])
  }

  async function fetchTeamHours(workspaceId) {
    const monday = new Date()
    const day = monday.getDay()
    monday.setDate(monday.getDate() - (day === 0 ? 6 : day - 1))
    const startDate = monday.toISOString().split('T')[0]
    const { data } = await supabase.rpc('get_team_hours', {
      p_workspace_id: workspaceId,
      p_start_date: startDate,
    })
    if (data) setTeamWeekHours(data.reduce((sum, r) => sum + (r.total_hours ?? 0), 0))
  }

  const isDemo = user.email === import.meta.env.VITE_DEMO_EMAIL
  function demoGuard() {
    if (isDemo) { setError('Changes are disabled in demo mode.'); return true }
    return false
  }

  const isOwner = workspace?.owner_id === user.id
  const currentMember = members.find(m => m.invited_email === user.email)
  const isAdmin = isOwner || currentMember?.role === 'admin'

  function showSuccess(msg) {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 4000)
  }

  async function createWorkspace(e) {
    e.preventDefault()
    if (demoGuard()) return
    if (!newWorkspaceName.trim() || !newClientName.trim()) return
    setCreating(true)
    const { data, error: err } = await supabase
      .from('workspaces')
      .insert({ name: newWorkspaceName.trim(), client_name: newClientName.trim(), owner_id: user.id, weekly_goal: parseFloat(newWeeklyGoal) || 0 })
      .select()
      .single()
    setCreating(false)
    if (err) { setError(err.message); return }
    setWorkspace(data)
    setNewWorkspaceName('')
    setNewClientName('')
    setNewWeeklyGoal('')
  }

  async function saveEdit(e) {
    e.preventDefault()
    if (demoGuard()) return
    if (!editName.trim() || !editClientName.trim()) return
    setSaving(true)
    const { error: err } = await supabase
      .from('workspaces')
      .update({ name: editName.trim(), client_name: editClientName.trim(), weekly_goal: parseFloat(editWeeklyGoal) || 0 })
      .eq('id', workspace.id)
    setSaving(false)
    if (err) { setError(err.message); return }
    setWorkspace(prev => ({ ...prev, name: editName.trim(), client_name: editClientName.trim(), weekly_goal: parseFloat(editWeeklyGoal) || 0 }))
    setEditing(false)
    showSuccess('Workspace updated.')
  }

  function startEdit() {
    setEditName(workspace.name)
    setEditClientName(workspace.client_name ?? '')
    setEditWeeklyGoal(workspace.weekly_goal > 0 ? String(workspace.weekly_goal) : '')
    setEditing(true)
  }

  async function inviteMember(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (demoGuard()) return
    if (!inviteEmail.trim()) return
    setInviting(true)

    const { error: err } = await supabase
      .from('workspace_members')
      .insert({ workspace_id: workspace.id, invited_email: inviteEmail.trim(), role: inviteRole })

    if (err) { setInviting(false); setError(err.message); return }

    const { data: { session } } = await supabase.auth.getSession()
    const { error: fnError } = await supabase.functions.invoke('send-invite-email', {
      body: {
        invitedEmail: inviteEmail.trim(),
        workspaceName: workspace.name,
        inviterEmail: session?.user?.email ?? 'A teammate',
      },
      headers: { Authorization: `Bearer ${session?.access_token}` },
    })
    if (fnError) console.error('Edge Function error:', fnError)

    setInviting(false)
    showSuccess(`Invite created for ${inviteEmail}. Ask them to sign up using that email address.`)
    setInviteEmail('')
    await fetchMembers(workspace.id)
  }

  async function removeMember(id) {
    if (demoGuard()) return
    if (!confirm('Remove this member?')) return
    await supabase.from('workspace_members').delete().eq('id', id)
    setMembers(prev => prev.filter(m => m.id !== id))
  }

  async function changeRole(id, newRole) {
    if (demoGuard()) return
    const { error: err } = await supabase
      .from('workspace_members')
      .update({ role: newRole })
      .eq('id', id)
    if (err) { setError(err.message); return }
    setMembers(prev => prev.map(m => m.id === id ? { ...m, role: newRole } : m))
  }

  async function leaveWorkspace() {
    if (demoGuard()) return
    if (!confirm('Leave this workspace? You will lose access to the team.')) return
    const myMember = members.find(m => m.invited_email === user.email)
    if (!myMember) return
    const { error: err } = await supabase.from('workspace_members').delete().eq('id', myMember.id)
    if (err) { setError(err.message); return }
    setWorkspace(null)
    setMembers([])
  }

  async function deleteWorkspace() {
    if (demoGuard()) return
    if (!confirm('Delete this workspace? All members will lose access. This cannot be undone.')) return
    if (!confirm('Are you sure? This permanently deletes the workspace.')) return
    // Delete members first, then workspace
    await supabase.from('workspace_members').delete().eq('workspace_id', workspace.id)
    const { error: err } = await supabase.from('workspaces').delete().eq('id', workspace.id)
    if (err) { setError(err.message); return }
    setWorkspace(null)
    setMembers([])
  }

  if (!isBusiness) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">Team</h1>
        </div>
        <div className="paywall">
          <div className="paywall-title">Team workspaces require Business tier</div>
          <p className="paywall-desc">Collaborate with your team, invite members, and manage workspace access.</p>
          <Link to="/billing" className="btn btn-primary">Upgrade to Business</Link>
        </div>
      </div>
    )
  }

  if (loading) return <div className="loading">Loading…</div>

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h1 className="page-title">Team</h1>
            {workspace && (
              <p className="page-subtitle">
                {workspace.name}
                {workspace.client_name && (
                  <span className="text-muted"> · client: <strong style={{ color: 'var(--text)' }}>{workspace.client_name}</strong></span>
                )}
              </p>
            )}
          </div>
          {workspace && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span className={`current-tier ${isOwner ? 'tier-business' : 'tier-pro'}`}>
                {isOwner ? 'Owner' : currentMember?.role ?? 'Member'}
              </span>
              {isOwner && (
                <button className="btn btn-secondary btn-sm" onClick={startEdit}>Edit</button>
              )}
              {!isOwner && (
                <button className="btn btn-secondary btn-sm" onClick={leaveWorkspace}>Leave</button>
              )}
            </div>
          )}
        </div>
      </div>

      {error && <div className="auth-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {!workspace ? (
        <div className="card">
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.25rem' }}>Create a Workspace</h2>
          <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
            The client name links your team's sessions together — all members must log time under this exact name.
          </p>
          <form onSubmit={createWorkspace}>
            <div className="form-group">
              <label>Workspace Name</label>
              <input
                type="text"
                value={newWorkspaceName}
                onChange={e => setNewWorkspaceName(e.target.value)}
                placeholder="My Agency"
                required
              />
            </div>
            <div className="form-group">
              <label>Client Name</label>
              <input
                type="text"
                value={newClientName}
                onChange={e => setNewClientName(e.target.value)}
                placeholder="Acme Corp"
                required
              />
              <p className="text-muted" style={{ fontSize: '0.78rem', marginTop: '0.35rem' }}>
                Team hours are tracked to this client name. Members must log time under this exact name.
              </p>
            </div>
            <div className="form-group">
              <label>Weekly Hour Goal <span className="text-muted" style={{ fontWeight: 400 }}>(optional)</span></label>
              <input
                type="number"
                min="0"
                step="1"
                value={newWeeklyGoal}
                onChange={e => setNewWeeklyGoal(e.target.value)}
                placeholder="e.g. 80"
              />
              <p className="text-muted" style={{ fontSize: '0.78rem', marginTop: '0.35rem' }}>
                Total hours your team aims to log per week for this client.
              </p>
            </div>
            <button type="submit" className="btn btn-primary" disabled={creating}>
              {creating ? 'Creating…' : 'Create Workspace'}
            </button>
          </form>
        </div>
      ) : (
        <>
          {editing && (
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Edit Workspace</h2>
              <form onSubmit={saveEdit}>
                <div className="form-group">
                  <label>Workspace Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Client Name</label>
                  <input
                    type="text"
                    value={editClientName}
                    onChange={e => setEditClientName(e.target.value)}
                    required
                  />
                  <p className="text-muted" style={{ fontSize: '0.78rem', marginTop: '0.35rem' }}>
                    Changing this will affect how team hours are counted — existing sessions won't move.
                  </p>
                </div>
                <div className="form-group">
                  <label>Weekly Hour Goal <span className="text-muted" style={{ fontWeight: 400 }}>(optional)</span></label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={editWeeklyGoal}
                    onChange={e => setEditWeeklyGoal(e.target.value)}
                    placeholder="e.g. 80"
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
                </div>
              </form>
            </div>
          )}

          {!editing && workspace.weekly_goal > 0 && teamWeekHours !== null && (
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Team Hours This Week</span>
                <span className="text-muted" style={{ fontSize: '0.85rem' }}>
                  {teamWeekHours.toFixed(1)}h of {workspace.weekly_goal}h goal
                </span>
              </div>
              <div className="progress-bar">
                <div
                  className={`progress-fill${teamWeekHours >= workspace.weekly_goal ? ' complete' : ''}`}
                  style={{ width: `${Math.min((teamWeekHours / workspace.weekly_goal) * 100, 100)}%` }}
                />
              </div>
              <div className="text-muted" style={{ fontSize: '0.78rem', marginTop: '0.3rem' }}>
                {teamWeekHours >= workspace.weekly_goal
                  ? 'Goal reached!'
                  : `${(workspace.weekly_goal - teamWeekHours).toFixed(1)}h remaining`}
              </div>
            </div>
          )}

          {!editing && !workspace.client_name && (
            <div className="alert alert-warning" style={{ marginBottom: '1.5rem' }}>
              This workspace has no client name set — team hours won't roll up until you add one.{' '}
              {isOwner && <button className="alert-link" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 600, fontSize: 'inherit', padding: 0 }} onClick={startEdit}>Set client name →</button>}
            </div>
          )}

          {!isAdmin && (
            <div className="alert alert-info" style={{ marginBottom: '1.5rem' }}>
              You are a member of this workspace. Contact an admin to make changes.
            </div>
          )}

          {isAdmin && (
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Invite Member</h2>
              <form onSubmit={inviteMember}>
                <div className="inline-form">
                  <div className="form-group">
                    <label>Email</label>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      placeholder="teammate@example.com"
                    />
                  </div>
                  <div className="form-group">
                    <label>Role</label>
                    <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
                      <option value="member">Member — view only</option>
                      <option value="admin">Admin — can invite & remove</option>
                    </select>
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={inviting}>
                    {inviting ? 'Sending…' : 'Invite'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {members.length === 0 ? (
            <div className="empty-state">No members yet. Invite someone above.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {members.map(m => (
                <div key={m.id} className="card" style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontWeight: 500, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.invited_email}
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem', alignItems: 'center' }}>
                        <span className={m.accepted_at ? 'badge-success' : 'badge-pending'}>
                          {m.accepted_at ? 'Accepted' : 'Pending'}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
                      {isOwner && m.invited_email !== user.email ? (
                        <select
                          value={m.role}
                          onChange={e => changeRole(m.id, e.target.value)}
                          style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                        >
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                        </select>
                      ) : (
                        <span style={{ textTransform: 'capitalize', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{m.role}</span>
                      )}
                      {isAdmin && m.invited_email !== user.email && (
                        <button className="btn btn-danger btn-sm" onClick={() => removeMember(m.id)}>Remove</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {isOwner && (
            <div className="card" style={{ marginTop: '2rem', borderColor: 'var(--danger)' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--danger)' }}>
                Delete Workspace
              </h2>
              <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
                Permanently removes the workspace and removes all members. Sessions are not deleted.
              </p>
              <button className="btn btn-danger" onClick={deleteWorkspace}>Delete Workspace</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
