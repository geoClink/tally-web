import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { todayString } from '../lib/utils'

// Timer state is persisted in localStorage so navigating away doesn't lose it
const STORAGE_KEY = 'tally_active_timer'

export default function Track() {
  const { user } = useAuth()
  const [tab, setTab] = useState('timer')
  const [clients, setClients] = useState([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)

  // --- Timer state ---
  const [timerClient, setTimerClient] = useState('')
  const [timerNote, setTimerNote] = useState('')
  const [running, setRunning] = useState(false)
  const [startTime, setStartTime] = useState(null) // Date object
  const [elapsed, setElapsed] = useState(0) // seconds
  const intervalRef = useRef(null)

  // --- Manual entry state ---
  const [manualDate, setManualDate] = useState(todayString())
  const [manualClient, setManualClient] = useState('')
  const [manualHours, setManualHours] = useState('')
  const [manualNote, setManualNote] = useState('')

  useEffect(() => {
    fetchClients()

    // Restore a running timer from localStorage (survives page navigation)
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const { start, client, note } = JSON.parse(saved)
      const startDate = new Date(start)
      setStartTime(startDate)
      setTimerClient(client || '')
      setTimerNote(note || '')
      setRunning(true)
      setElapsed(Math.floor((Date.now() - startDate.getTime()) / 1000))
    }
  }, [])

  // Tick every second while running
  useEffect(() => {
    if (running && startTime) {
      intervalRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTime.getTime()) / 1000))
      }, 1000)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [running, startTime])

  async function fetchClients() {
    const { data } = await supabase
      .from('client_rates')
      .select('client')
      .eq('user_id', user.id)
      .order('client')
    setClients(data?.map(c => c.client) ?? [])
  }

  function startTimer() {
    setError('')
    const now = new Date()
    setStartTime(now)
    setRunning(true)
    setElapsed(0)
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      start: now.toISOString(),
      client: timerClient,
      note: timerNote,
    }))
  }

  function stopTimer() {
    setRunning(false)
    // Keep localStorage so they can save or resume
  }

  function resumeTimer() {
    setRunning(true)
  }

  async function saveTimer() {
    setError('')
    if (!timerClient.trim()) { setError('Select a client before saving'); return }
    const hours = elapsed / 3600
    if (hours < 0.001) { setError('No time recorded yet'); return }

    setSaving(true)
    const { error: err } = await supabase.from('sessions').insert({
      user_id: user.id,
      client: timerClient.trim(),
      start_time: startTime.toISOString(),
      end_time: new Date().toISOString(),
      hours: parseFloat(hours.toFixed(4)),
      date: startTime.toISOString().split('T')[0],
      task_note: timerNote.trim() || null,
      is_manual: false,
    })
    setSaving(false)

    if (err) { setError(err.message); return }

    localStorage.removeItem(STORAGE_KEY)
    setRunning(false)
    setElapsed(0)
    setStartTime(null)
    setTimerClient('')
    setTimerNote('')
    showSuccess('Session saved!')
  }

  function discardTimer() {
    if (!confirm('Discard this session?')) return
    localStorage.removeItem(STORAGE_KEY)
    setRunning(false)
    setElapsed(0)
    setStartTime(null)
    setTimerClient('')
    setTimerNote('')
  }

  // Update localStorage when client/note change while timer is running
  function updateTimerField(field, value) {
    if (field === 'client') setTimerClient(value)
    else setTimerNote(value)
    if (running || startTime) {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...saved, [field]: value }))
    }
  }

  async function saveManual(e) {
    e.preventDefault()
    setError('')
    if (!manualClient.trim()) { setError('Enter a client name'); return }
    const hours = parseFloat(manualHours)
    if (isNaN(hours) || hours <= 0) { setError('Enter valid hours (e.g. 1.5)'); return }

    setSaving(true)
    const { error: err } = await supabase.from('sessions').insert({
      user_id: user.id,
      client: manualClient.trim(),
      hours: parseFloat(hours.toFixed(4)),
      date: manualDate,
      task_note: manualNote.trim() || null,
      is_manual: true,
    })
    setSaving(false)

    if (err) { setError(err.message); return }

    setManualHours('')
    setManualNote('')
    showSuccess('Session saved!')
  }

  function showSuccess(msg) {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 3000)
  }

  // Format elapsed seconds → HH:MM:SS
  const hrs = Math.floor(elapsed / 3600)
  const mins = Math.floor((elapsed % 3600) / 60)
  const secs = elapsed % 60
  const timerDisplay = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Track Time</h1>
        <p className="page-subtitle">Start a timer or log time manually</p>
      </div>

      <div className="tab-bar">
        <button className={`tab-btn${tab === 'timer' ? ' active' : ''}`} onClick={() => { setTab('timer'); setError('') }}>
          Timer
        </button>
        <button className={`tab-btn${tab === 'manual' ? ' active' : ''}`} onClick={() => { setTab('manual'); setError('') }}>
          Manual Entry
        </button>
      </div>

      {error && <div className="auth-error" style={{ marginTop: '1rem' }}>{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {tab === 'timer' && (
        <div className="card">
          <div className={`timer-display${running ? ' timer-running' : ''}`}>{timerDisplay}</div>

          <div className="form-group" style={{ marginTop: '1.5rem' }}>
            <label>Client</label>
            <input
              list="timer-clients"
              value={timerClient}
              onChange={e => updateTimerField('client', e.target.value)}
              placeholder="Select or type a client name"
            />
            <datalist id="timer-clients">
              {clients.map(c => <option key={c} value={c} />)}
            </datalist>
          </div>

          <div className="form-group">
            <label>Task Note (optional)</label>
            <input
              type="text"
              value={timerNote}
              onChange={e => updateTimerField('note', e.target.value)}
              placeholder="What are you working on?"
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {!running && elapsed === 0 && (
              <button
                className="btn btn-primary"
                onClick={startTimer}
                disabled={!timerClient.trim()}
              >
                Start Timer
              </button>
            )}
            {running && (
              <button className="btn btn-danger" onClick={stopTimer}>Stop</button>
            )}
            {!running && elapsed > 0 && (
              <>
                <button className="btn btn-primary" onClick={saveTimer} disabled={saving}>
                  {saving ? 'Saving…' : 'Save Session'}
                </button>
                <button className="btn btn-secondary" onClick={resumeTimer}>Resume</button>
                <button className="btn btn-secondary" onClick={discardTimer}>Discard</button>
              </>
            )}
          </div>

          {running && (
            <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '1rem' }}>
              Timer keeps running if you navigate away.
            </p>
          )}
        </div>
      )}

      {tab === 'manual' && (
        <div className="card">
          <form onSubmit={saveManual}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Date</label>
                <input
                  type="date"
                  value={manualDate}
                  onChange={e => setManualDate(e.target.value)}
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Client</label>
                <input
                  list="manual-clients"
                  value={manualClient}
                  onChange={e => setManualClient(e.target.value)}
                  placeholder="Select or type a client name"
                  required
                />
                <datalist id="manual-clients">
                  {clients.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Hours</label>
                <input
                  type="number"
                  value={manualHours}
                  onChange={e => setManualHours(e.target.value)}
                  placeholder="1.5"
                  step="0.01"
                  min="0.01"
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label>Task Note (optional)</label>
              <input
                type="text"
                value={manualNote}
                onChange={e => setManualNote(e.target.value)}
                placeholder="What did you work on?"
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save Session'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
