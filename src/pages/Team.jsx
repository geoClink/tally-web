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
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (isBusiness) fetchWorkspace()
    else setLoading(false)
  }, [user, isBusiness])

  async function fetchWorkspace() {
    setLoading(true)
    const { data } = await supabase
      .from('workspaces')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    setWorkspace(data)
    if (data) await fetchMembers(data.id)
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

  async function createWorkspace(e) {
    e.preventDefault()
    if (!newWorkspaceName.trim()) return
    setCreating(true)
    const { data, error: err } = await supabase
      .from('workspaces')
      .insert({ name: newWorkspaceName.trim(), owner_id: user.id })
      .select()
      .single()
    setCreating(false)
    if (err) { setError(err.message); return }
    setWorkspace(data)
    setNewWorkspaceName('')
  }

  async function inviteMember(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!inviteEmail.trim()) return
    setInviting(true)

    const { error: err } = await supabase
      .from('workspace_members')
      .insert({ workspace_id: workspace.id, invited_email: inviteEmail.trim(), role: inviteRole })

    if (err) { setInviting(false); setError(err.message); return }

    // Send the invite email via Supabase Edge Function
    const { data: { session } } = await supabase.auth.getSession()
    await supabase.functions.invoke('send-invite-email', {
      body: {
        invitedEmail: inviteEmail.trim(),
        workspaceName: workspace.name,
        inviterEmail: session?.user?.email ?? 'A teammate',
      },
    })

    setInviting(false)
    setSuccess(`Invite sent to ${inviteEmail}`)
    setInviteEmail('')
    await fetchMembers(workspace.id)
  }

  async function removeMember(id) {
    if (!confirm('Remove this member?')) return
    await supabase.from('workspace_members').delete().eq('id', id)
    setMembers(prev => prev.filter(m => m.id !== id))
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
        <h1 className="page-title">Team</h1>
        {workspace && <p className="page-subtitle">{workspace.name}</p>}
      </div>

      {!workspace ? (
        <div className="card">
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Create a Workspace</h2>
          {error && <div className="auth-error">{error}</div>}
          <form onSubmit={createWorkspace}>
            <div className="inline-form">
              <div className="form-group">
                <label>Workspace Name</label>
                <input
                  type="text"
                  value={newWorkspaceName}
                  onChange={e => setNewWorkspaceName(e.target.value)}
                  placeholder="My Agency"
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={creating}>Create</button>
            </div>
          </form>
        </div>
      ) : (
        <>
          {error && <div className="auth-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

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
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <button type="submit" className="btn btn-primary" disabled={inviting}>Invite</button>
              </div>
            </form>
          </div>

          {members.length === 0 ? (
            <div className="empty-state">No members yet. Invite someone above.</div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {members.map(m => (
                    <tr key={m.id}>
                      <td>{m.invited_email}</td>
                      <td style={{ textTransform: 'capitalize' }}>{m.role}</td>
                      <td>
                        <span className={m.accepted_at ? 'badge-success' : 'badge-pending'}>
                          {m.accepted_at ? 'Accepted' : 'Pending'}
                        </span>
                      </td>
                      <td>
                        <button className="btn btn-danger btn-sm" onClick={() => removeMember(m.id)}>Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
