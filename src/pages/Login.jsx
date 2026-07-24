import { useState } from 'react'
import { useNavigate, Navigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const APP_STORE_URL = 'https://apps.apple.com/us/app/tally-time-tracker/id6775275483'

export default function Login() {
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn, signUp, signInWithApple, user, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  if (!authLoading && user) return <Navigate to="/dashboard" replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: authError } = mode === 'signin'
      ? await signIn(email, password)
      : await signUp(email, password)

    setLoading(false)

    if (authError) {
      setError(authError.message)
    } else {
      navigate('/dashboard')
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Tally</h1>
        <p className="auth-tagline">Track every hour. Get paid for all of it.</p>
        <p className="auth-subtitle">
          {mode === 'signin' ? 'Sign in to your account' : 'Create your free account'}
        </p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              placeholder="••••••••"
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Loading…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="auth-divider">
          <span>or</span>
        </div>

        <button
          type="button"
          className="btn-apple"
          onClick={signInWithApple}
          disabled={loading}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M11.182 0c.074.732-.189 1.46-.676 1.986-.482.521-1.211.917-1.94.859-.088-.717.214-1.46.676-1.975C9.73.358 10.474-.036 11.182 0zM8.557 2.724c.643 0 1.83.441 2.496 1.7-.065.04-1.49.87-1.474 2.594.017 2.057 1.802 2.742 1.82 2.749-.018.057-.284.977-.94 1.924-.567.825-1.157 1.644-2.087 1.66-.916.015-1.21-.544-2.258-.544-1.047 0-1.374.527-2.241.557-.898.03-1.584-.882-2.156-1.704C.35 9.497-.235 6.95.894 4.993c.553-.969 1.54-1.583 2.613-1.599.898-.015 1.749.605 2.298.605.55 0 1.583-.748 2.666-.748l.086.003z"/>
          </svg>
          Sign in with Apple
        </button>

        <div className="auth-toggle">
          {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}
          {' '}
          <button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError('') }}>
            {mode === 'signin' ? 'Sign up free' : 'Sign in'}
          </button>
        </div>

        <div className="auth-links">
          <Link to="/demo">Try demo</Link>
          <span className="auth-links-dot">·</span>
          <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer">App Store</a>
        </div>
      </div>
    </div>
  )
}
