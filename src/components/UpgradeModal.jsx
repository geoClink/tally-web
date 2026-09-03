import { useNavigate } from 'react-router-dom'

export default function UpgradeModal({ onClose }) {
  const navigate = useNavigate()

  function goToBilling() {
    onClose()
    navigate('/billing')
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="card" style={{ width: '100%', maxWidth: '440px', padding: '2rem', textAlign: 'center' }}>
        {/* Icon */}
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--accent)15', border: '1.5px solid var(--accent)40', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', fontSize: '1.5rem' }}>
          ⏱
        </div>

        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>You've hit the 5-client limit</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
          The free tier includes 5 clients. Upgrade to Pro for unlimited clients, full session history, and CSV export.
        </p>

        {/* Plan comparison */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem', textAlign: 'left' }}>
          <div style={{ padding: '1rem', borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Free</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>$0</div>
            {['5 clients', '7-day history', 'Basic timer'].map(f => (
              <div key={f} style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>✓ {f}</div>
            ))}
          </div>
          <div style={{ padding: '1rem', borderRadius: 10, background: 'color-mix(in srgb, var(--accent) 8%, transparent)', border: '1.5px solid var(--accent)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Pro</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>$9.99 <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)' }}>one-time</span></div>
            {['Unlimited clients', 'Full history', 'CSV export', 'Apple Watch', 'Widgets'].map(f => (
              <div key={f} style={{ fontSize: '0.8rem', marginBottom: '0.25rem' }}>✓ {f}</div>
            ))}
          </div>
        </div>

        <button
          onClick={goToBilling}
          className="btn btn-primary"
          style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' }}
        >
          Upgrade to Pro — $9.99
        </button>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.875rem' }}
        >
          Maybe later
        </button>
      </div>
    </div>
  )
}
