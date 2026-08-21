import { Link } from 'react-router-dom'

export default function DeleteAccount() {
  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '3rem 1.5rem' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Delete Your Account</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
        You can permanently delete your Tally account and all associated data at any time.
      </p>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Delete from the app</h2>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
          The fastest way to delete your account is directly from the app:
        </p>
        <ol style={{ fontSize: '0.9rem', color: 'var(--text-muted)', paddingLeft: '1.25rem', lineHeight: 1.8 }}>
          <li>Sign in to your account</li>
          <li>Go to <strong>Settings</strong></li>
          <li>Scroll to the bottom and tap <strong>Delete My Account</strong></li>
          <li>Confirm — your account and all data are deleted immediately</li>
        </ol>
        <Link to="/login" className="btn btn-primary" style={{ display: 'inline-block', marginTop: '1rem' }}>
          Sign in to delete →
        </Link>
      </div>

      <div className="card">
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Request deletion by email</h2>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
          If you can't access your account, email us and we'll delete your data manually within 7 days.
        </p>
        <a
          href="mailto:help@tallytimetracker.com?subject=Account Deletion Request"
          className="btn btn-secondary"
          style={{ display: 'inline-block' }}
        >
          Email help@tallytimetracker.com
        </a>
      </div>

      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2rem' }}>
        Deletion removes your sessions, client rates, goals, subscription, and workspace data permanently. This cannot be undone.
      </p>
    </div>
  )
}
