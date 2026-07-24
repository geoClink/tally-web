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
  const { signIn, signUp, signInWithApple, signInWithGoogle, user, loading: authLoading } = useAuth()
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
          className="gsi-material-button"
          onClick={signInWithGoogle}
          disabled={loading}
        >
          <div className="gsi-material-button-state"></div>
          <div className="gsi-material-button-content-wrapper">
            <div className="gsi-material-button-icon">
              <svg version="1.1" viewBox="0 0 48 48" style={{ display: 'block' }}>
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
            </div>
            <span className="gsi-material-button-contents">Sign in with Google</span>
          </div>
        </button>

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
