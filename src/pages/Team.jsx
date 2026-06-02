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

    // Check if user owns a workspace
    const { data: owned } = await supabase
      .from('workspaces')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (owned) {
      setWorkspace(owned)
      await fetchMembers(owned.id)
      setLoading(false)
      return
    }

    // Check if user was invited to a workspace
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
        await fetchMembers(ws.id)
        // Auto-accept invite on first visit
        await supabase
          .from('workspace_members')
          .update({ accepted_at: new Date().toISOString() })
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

  // Determine current user's permission level
  const isOwner = workspace?.owner_id === user.id
  const currentMember = members.find(m => m.invited_email === user.email)
  const isAdmin = isOwner || currentMember?.role === 'admin'

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

    // Send invite email via Edge Function
    const { data: { session } } = await supabase.auth.getSession()
    const { error: fnError } = await supabase.functions.invoke('send-invite-email', {
      body: {
        invitedEmail: inviteEmail.trim(),
        workspaceName: workspace.name,
        inviterEmail: session?.user?.email ?? 'A teammate',
      },
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
      },
    })

    if (fnError) console.error('Edge Function error:', fnError)

    setInviting(false)
    setSuccess(`Invite created for ${inviteEmail}. Ask them to sign up at tally-web-nu.vercel.app using that email address.`)
    setInviteEmail('')
    await fetchMembers(workspace.id)
  }

  async function removeMember(id) {
    if (!confirm('Remove this member?')) return
    await supabase.from('workspace_members').delete().eq('id', id)
    setMembers(prev => prev.filter(m => m.id !== id))
  }

  async function changeRole(id, newRole) {
    const { error: err } = await supabase
      .from('workspace_members')
      .update({ role: newRole })
      .eq('id', id)
    if (err) { setError(err.message); return }
    setMembers(prev => prev.map(m => m.id === id ? { ...m, role: newRole } : m))
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
            {workspace && <p className="page-subtitle">{workspace.name}</p>}
          </div>
          {workspace && (
            <span className={`current-tier ${isOwner ? 'tier-business' : 'tier-pro'}`}>
              {isOwner ? 'Owner' : currentMember?.role ?? 'Member'}
            </span>
          )}
        </div>
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
                      {isAdmin && m.invited_email !== user.email ? (
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
        </>
      )}
    </div>
  )
}
