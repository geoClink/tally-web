import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const PendingInviteContext = createContext(null)

export function PendingInviteProvider({ children }) {
  const { user } = useAuth()
  const [pendingInvite, setPendingInvite] = useState(null)

  useEffect(() => {
    if (!user) { setPendingInvite(null); return }
    checkForInvite()
  }, [user])

  async function checkForInvite() {
    const { data: member } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('invited_email', user.email)
      .is('accepted_at', null)
      .maybeSingle()

    if (!member) { setPendingInvite(null); return }

    const { data: ws } = await supabase
      .from('workspaces')
      .select('name')
      .eq('id', member.workspace_id)
      .maybeSingle()

    setPendingInvite(ws ? { workspace_id: member.workspace_id, workspaces: { name: ws.name } } : null)
  }

  function dismiss() {
    setPendingInvite(null)
  }

  return (
    <PendingInviteContext.Provider value={{ pendingInvite, dismiss }}>
      {children}
    </PendingInviteContext.Provider>
  )
}

export const usePendingInvite = () => useContext(PendingInviteContext)
