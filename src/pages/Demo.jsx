import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Demo() {
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth
      .signInWithPassword({
        email: import.meta.env.VITE_DEMO_EMAIL,
        password: import.meta.env.VITE_DEMO_PASSWORD,
      })
      .then(({ error }) => {
        if (error) {
          console.error('Demo login failed:', error.message)
        } else {
          navigate('/dashboard', { replace: true })
        }
      })
  }, [])

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <p style={{ color: 'var(--text-muted)' }}>Loading demo...</p>
    </div>
  )
}
