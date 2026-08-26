// Think of this like a SwiftUI @EnvironmentObject that holds auth state globally.
// Any component in the tree can call useAuth() to get the user and auth functions.
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  // Initialize synchronously from the URL hash before Supabase clears it.
  // The PASSWORD_RECOVERY event fires during async Supabase startup, before
  // the onAuthStateChange listener (in useEffect) is registered — so we'd
  // miss it. Reading the hash here happens before Supabase clears it.
  const [recoveryMode, setRecoveryMode] = useState(
    () => window.location.hash.includes('type=recovery')
  )

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryMode(true)
      } else if (event === 'SIGNED_OUT') {
        setRecoveryMode(false)
      }
      setUser(session?.user ?? null)
    })

    // On Android, after Google OAuth the browser redirects back to the app via
    // the custom URL scheme. Extract the tokens from the URL hash and set the session.
    let appUrlListener
    if (Capacitor.isNativePlatform()) {
      App.addListener('appUrlOpen', async ({ url }) => {
        const hash = url.split('#')[1]
        if (!hash) return
        const params = new URLSearchParams(hash)
        const access_token = params.get('access_token')
        const refresh_token = params.get('refresh_token')
        if (access_token && refresh_token) {
          await supabase.auth.setSession({ access_token, refresh_token })
        }
      }).then(listener => { appUrlListener = listener })
    }

    return () => {
      subscription.unsubscribe()
      appUrlListener?.remove()
    }
  }, [])

  const signIn = (email, password) =>
    supabase.auth.signInWithPassword({ email, password })

  const signUp = (email, password) =>
    supabase.auth.signUp({ email, password })

  const signOut = () => supabase.auth.signOut()

  const signInWithApple = () =>
    supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    })

  const signInWithGoogle = () => {
    const redirectTo = Capacitor.isNativePlatform()
      ? 'name.georgeclinkscales.tally://login-callback'
      : `${window.location.origin}/dashboard`
    return supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })
  }

  return (
    <AuthContext.Provider value={{ user, loading, recoveryMode, signIn, signUp, signOut, signInWithApple, signInWithGoogle }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
