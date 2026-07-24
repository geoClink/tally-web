import { useState, useEffect } from 'react'

export default function BugReportModal({ onClose }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, message }),
    })

    setLoading(false)

    if (!res.ok) {
      setError('Something went wrong. Try again or email us directly.')
    } else {
      setSent(true)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>

        <h2 className="modal-title">Report a bug</h2>

        {sent ? (
          <p className="modal-success">Thanks — we got it and will look into it.</p>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && <div className="auth-error">{error}</div>}
            <div className="form-group">
              <label htmlFor="br-name">Name</label>
              <input
                id="br-name"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                placeholder="Your name"
              />
            </div>
            <div className="form-group">
              <label htmlFor="br-email">Email</label>
              <input
                id="br-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
              />
            </div>
            <div className="form-group">
              <label htmlFor="br-message">What went wrong?</label>
              <textarea
                id="br-message"
                value={message}
                onChange={e => setMessage(e.target.value)}
                required
                rows={5}
                placeholder="Describe the issue..."
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Sending…' : 'Send Report'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
