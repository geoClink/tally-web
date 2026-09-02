import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Demo() {
  const navigate = useNavigate()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const email = import.meta.env.VITE_DEMO_EMAIL
    const password = import.meta.env.VITE_DEMO_PASSWORD
    if (!email || !password) { setFailed(true); return }
    supabase.auth
      .signInWithPassword({ email, password })
      .then(({ error }) => {
        if (error) setFailed(true)
        else navigate('/dashboard', { replace: true })
      })
  }, [])

  if (failed) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '1rem', padding: '2rem', textAlign: 'center' }}>
        <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>Demo unavailable right now</p>
        <p style={{ color: 'var(--text-muted)', maxWidth: '320px' }}>Sign up for free — no credit card required.</p>
        <Link to="/login" className="btn btn-primary">Get started free</Link>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <p style={{ color: 'var(--text-muted)' }}>Loading demo...</p>
    </div>
  )
}
