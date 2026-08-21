export default function AndroidModal({ onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🤖</div>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>Join the Android Beta</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '1.25rem' }}>
          Tally is in closed testing on Google Play. Follow these three steps to get early access:
        </p>
        <ol style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <li style={{ fontSize: '0.875rem', lineHeight: 1.5 }}>
            <strong>Join the tester group</strong><br />
            <a href="https://groups.google.com/g/tally-time-tracker" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
              groups.google.com/g/tally-time-tracker
            </a>
          </li>
          <li style={{ fontSize: '0.875rem', lineHeight: 1.5 }}>
            <strong>Opt into testing</strong><br />
            <a href="https://play.google.com/apps/testing/name.georgeclinkscales.tally" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
              play.google.com/apps/testing/…
            </a>
          </li>
          <li style={{ fontSize: '0.875rem', lineHeight: 1.5 }}>
            <strong>Download on Google Play</strong><br />
            <a href="https://play.google.com/store/apps/details?id=name.georgeclinkscales.tally" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
              play.google.com/store/apps/…
            </a>
          </li>
        </ol>
      </div>
    </div>
  )
}
