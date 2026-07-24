import { useState } from 'react'
import { useNavigate, Navigate, Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const APP_STORE_URL = 'https://apps.apple.com/us/app/tally-time-tracker/id6775275483'

export default function Login() {
  const [searchParams] = useSearchParams()
  const [mode, setMode] = useState(searchParams.get('mode') === 'signup' ? 'signup' : 'signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn, signUp, signInWithApple, signInWithGoogle, user, loading: authLoading, recoveryMode } = useAuth()
  const navigate = useNavigate()

  if (!authLoading && user && !recoveryMode) return <Navigate to="/dashboard" replace />

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
          <svg width="14" height="17" viewBox="0 0 814 1000" fill="currentColor" aria-hidden="true">
            <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-36.8-162.2-105.2C207.3 787.5 183 739.4 183 692c0-165.1 140.4-286.9 271.8-286.9 70.1 0 128.1 46.4 172.3 46.4 42.8 0 109.3-49 187.5-49zm-66.7-235.1c31.8-40.8 53.9-97 53.9-153.1 0-7.7-.6-15.5-1.9-23.2-50.8 1.9-112.1 33.8-150.6 85.1-28.1 35.5-53.9 89.7-53.9 147.4 0 8.4 1.3 16.7 1.9 19.3 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 136.9-77z"/>
          </svg>
          Sign in with Apple
        </button>

        {mode === 'signin' && (
          <div className="auth-links" style={{ marginTop: '0.75rem' }}>
            <Link to="/forgot-password">Forgot password?</Link>
          </div>
        )}

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
