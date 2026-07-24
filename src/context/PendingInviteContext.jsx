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
    const { data } = await supabase
      .from('workspace_members')
      .select('workspace_id, workspaces(name)')
      .eq('invited_email', user.email)
      .is('accepted_at', null)
      .maybeSingle()
    setPendingInvite(data ?? null)
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
