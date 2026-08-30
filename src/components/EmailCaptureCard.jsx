import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function EmailCaptureCard({ userId, onDone }) {
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim()) return
    const trimmed = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Please enter a valid email address.')
      return
    }
    setSaving(true)
    const { error: err } = await supabase
      .from('config')
      .upsert({ user_id: userId, contact_email: trimmed }, { onConflict: 'user_id' })
    setSaving(false)
    if (err) {
      setError('Could not save — try again.')
      return
    }
    onDone()
  }

  async function handleSkip() {
    await supabase
      .from('config')
      .upsert({ user_id: userId, contact_email: 'dismissed' }, { onConflict: 'user_id' })
    onDone()
  }

  return (
    <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '3px solid var(--color-primary)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
        <div style={{ fontWeight: 600 }}>Stay in the loop</div>
        <button
          onClick={handleSkip}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '1.1rem', lineHeight: 1, padding: 0 }}
          aria-label="Dismiss"
        >×</button>
      </div>
      <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: '0 0 0.75rem' }}>
        Add a contact email to receive updates and tips about Tally. This is optional and separate from your login.
      </p>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <input
          type="email"
          value={email}
          onChange={e => { setEmail(e.target.value); setError('') }}
          placeholder="your@email.com"
          style={{ flex: '1 1 180px', minWidth: 0 }}
          autoComplete="email"
        />
        <button type="submit" className="btn btn-primary" disabled={saving} style={{ whiteSpace: 'nowrap' }}>
          {saving ? 'Saving…' : 'Save email'}
        </button>
      </form>
      {error && <p style={{ color: 'var(--color-danger)', fontSize: '0.8rem', margin: '0.4rem 0 0' }}>{error}</p>}
    </div>
  )
}
