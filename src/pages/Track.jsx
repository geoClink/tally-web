import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useSubscription } from '../context/SubscriptionContext'
import { todayString } from '../lib/utils'
import ClientSelect from '../components/ClientSelect'
import useVoiceControl from '../hooks/useVoiceControl'

const STORAGE_KEY = 'tally_active_timer'

export default function Track() {
  const { user } = useAuth()
  const { isPro } = useSubscription()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState('timer')
  const [clients, setClients] = useState([])
  const [workspaceClients, setWorkspaceClients] = useState([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)

  // Voice control — refs so commands can access latest state
  const runningRef = useRef(false)
  const elapsedRef = useRef(0)
  const startTimeRef = useRef(null)
  const timerClientRef = useRef('')
  const pausedRef = useRef(false)

  // --- Timer state ---
  const [timerClient, setTimerClient] = useState('')
  const [timerNote, setTimerNote] = useState('')
  const [running, setRunning] = useState(false)
  const [paused, setPaused] = useState(false)
  const [startTime, setStartTime] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const intervalRef = useRef(null)

  // --- Manual entry state ---
  const [manualDate, setManualDate] = useState(todayString())
  const [manualClient, setManualClient] = useState('')
  const [manualHours, setManualHours] = useState('')
  const [manualNote, setManualNote] = useState('')

  useEffect(() => {
    fetchClients()

    // Pre-fill from "Log again" link on Dashboard
    const prefillClient = searchParams.get('client')
    const prefillNote   = searchParams.get('note')
    if (prefillClient) {
      setTab('manual')
      setManualClient(prefillClient)
      if (prefillNote) setManualNote(prefillNote)
      setSearchParams({}, { replace: true })
    }

    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const { start, client, note, paused: wasPaused, pausedElapsed } = JSON.parse(saved)
      setTimerClient(client || '')
      setTimerNote(note || '')
      setRunning(true)
      if (wasPaused && pausedElapsed !== undefined) {
        setElapsed(pausedElapsed)
        setPaused(true)
        pausedRef.current = true
        setStartTime(new Date(Date.now() - pausedElapsed * 1000))
      } else {
        const startDate = new Date(start)
        setStartTime(startDate)
        setElapsed(Math.floor((Date.now() - startDate.getTime()) / 1000))
      }
    }
  }, [])

  useEffect(() => {
    if (running && startTime && !paused) {
      intervalRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTime.getTime()) / 1000))
      }, 1000)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [running, startTime, paused])

  async function fetchClients() {
    const [{ data: rates }, { data: sessions }, { data: ownedWs }] = await Promise.all([
      supabase.from('client_rates').select('client').eq('user_id', user.id),
      supabase.from('sessions').select('client').eq('user_id', user.id),
      supabase.from('workspaces').select('client_name').eq('owner_id', user.id),
    ])

    // Also fetch workspace client names for workspaces user has joined
    const { data: memberOf } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('invited_email', user.email)
      .not('accepted_at', 'is', null)

    let wsClientNames = ownedWs?.filter(w => w.client_name).map(w => w.client_name) ?? []
    if (memberOf?.length) {
      const { data: memberWs } = await supabase
        .from('workspaces')
        .select('client_name')
        .in('id', memberOf.map(m => m.workspace_id))
      wsClientNames = [...wsClientNames, ...(memberWs?.filter(w => w.client_name).map(w => w.client_name) ?? [])]
    }
    wsClientNames = [...new Set(wsClientNames)]
    setWorkspaceClients(wsClientNames)

    const all = [
      ...(rates?.map(r => r.client) ?? []),
      ...(sessions?.map(s => s.client) ?? []),
    ]
    // Workspace client names appear first so members can easily find them
    const otherClients = [...new Set(all)].sort().filter(c => !wsClientNames.includes(c))
    setClients([...wsClientNames, ...otherClients])
  }

  // Returns an error string if the free-tier 3-client limit would be exceeded, or null if OK
  async function checkClientLimit(newClient) {
    if (isPro) return null
    const { data } = await supabase.from('sessions').select('client').eq('user_id', user.id)
    const existing = [...new Set(data?.map(s => s.client) ?? [])]
    if (existing.length >= 3 && !existing.includes(newClient.trim())) {
      return 'Free tier is limited to 3 clients. Upgrade to Pro for unlimited clients.'
    }
    return null
  }

  function startTimer() {
    setError('')
    const now = new Date()
    setStartTime(now)
    startTimeRef.current = now
    setRunning(true)
    runningRef.current = true
    setPaused(false)
    pausedRef.current = false
    setElapsed(0)
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      start: now.toISOString(),
      client: timerClient,
      note: timerNote,
    }))
  }

  function pauseTimer() {
    setPaused(true)
    pausedRef.current = true
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...saved, paused: true, pausedElapsed: elapsedRef.current }))
  }

  function resumeFromPause() {
    const newStart = new Date(Date.now() - elapsedRef.current * 1000)
    setStartTime(newStart)
    startTimeRef.current = newStart
    setPaused(false)
    pausedRef.current = false
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...saved, start: newStart.toISOString(), paused: false, pausedElapsed: undefined }))
  }

  function stopTimer() {
    setRunning(false)
    runningRef.current = false
    setPaused(false)
    pausedRef.current = false
  }

  function resumeTimer() {
    setRunning(true)
    runningRef.current = true
  }

  useEffect(() => { runningRef.current = running }, [running])
  useEffect(() => { elapsedRef.current = elapsed }, [elapsed])
  useEffect(() => { startTimeRef.current = startTime }, [startTime])
  useEffect(() => { timerClientRef.current = timerClient }, [timerClient])
  useEffect(() => { pausedRef.current = paused }, [paused])

  function handleVoiceCommand(text) {
    if (text.includes('start')) {
      if (!runningRef.current && timerClientRef.current) startTimer()
      else if (!timerClientRef.current) showSuccess('Say a client name first')
    } else if (text.includes('stop')) {
      if (runningRef.current) stopTimer()
    } else if (text.includes('pause')) {
      if (runningRef.current && !pausedRef.current) pauseTimer()
    } else if (text.includes('save')) {
      if (!runningRef.current && elapsedRef.current > 0) saveTimer()
    } else if (text.includes('resume')) {
      if (runningRef.current && pausedRef.current) resumeFromPause()
      else if (!runningRef.current && elapsedRef.current > 0) resumeTimer()
    } else if (text.includes('discard')) {
      discardTimer()
    } else {
      const match = clients.find(c => text.includes(c.toLowerCase()))
      if (match) {
        setTimerClient(match)
        timerClientRef.current = match
        showSuccess(`Client set to ${match}`)
      }
    }
  }

  const { listening, supported, transcript, toggleListening } = useVoiceControl({
    onCommand: handleVoiceCommand,
  })

  async function saveTimer() {
    setError('')
    if (!timerClient.trim()) { setError('Select a client before saving'); return }
    const hours = elapsed / 3600
    if (hours < 0.001) { setError('No time recorded yet'); return }

    setSaving(true)
    const limitErr = await checkClientLimit(timerClient)
    if (limitErr) { setError(limitErr); setSaving(false); return }

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
    fetchClients()
    showSuccess('Session saved!')
  }

  function discardTimer() {
    if (!confirm('Discard this session?')) return
    localStorage.removeItem(STORAGE_KEY)
    setRunning(false)
    runningRef.current = false
    setPaused(false)
    pausedRef.current = false
    setElapsed(0)
    setStartTime(null)
    setTimerClient('')
    setTimerNote('')
  }

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
    const limitErr = await checkClientLimit(manualClient)
    if (limitErr) { setError(limitErr); setSaving(false); return }

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
    fetchClients()
    showSuccess('Session saved!')
  }

  function showSuccess(msg) {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 3000)
  }

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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0' }}>
        <div className="tab-bar" style={{ marginBottom: 0, borderBottom: 'none' }}>
          <button className={`tab-btn${tab === 'timer' ? ' active' : ''}`} onClick={() => { setTab('timer'); setError('') }}>
            Timer
          </button>
          <button className={`tab-btn${tab === 'manual' ? ' active' : ''}`} onClick={() => { setTab('manual'); setError('') }}>
            Manual Entry
          </button>
        </div>
        {supported && tab === 'timer' && (
          <button
            className={`btn btn-secondary btn-sm${listening ? ' voice-active' : ''}`}
            onClick={toggleListening}
            title="Voice control"
            style={{ gap: '0.35rem' }}
          >
            {listening ? '🎙 Listening…' : '🎙 Voice'}
          </button>
        )}
      </div>
      <div style={{ borderBottom: '1px solid var(--border)', marginBottom: '1.25rem' }} />

      {transcript && (
        <div className="alert alert-info" style={{ fontSize: '0.82rem' }}>
          Heard: "{transcript}"
        </div>
      )}

      {!isPro && (
        <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
          Free tier: up to 3 clients. <Link to="/billing" className="alert-link">Upgrade to Pro</Link> for unlimited.
        </div>
      )}

      {error && <div className="auth-error" style={{ marginTop: '0.5rem' }}>{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {tab === 'timer' && (
        <div className="card">
          <div className={`timer-display${running && !paused ? ' timer-running' : ''}`}>{timerDisplay}</div>
          {running && (
            <p style={{ textAlign: 'center', fontSize: '0.8rem', color: paused ? 'var(--warning, #d97706)' : 'var(--success, #16a34a)', marginTop: '0.25rem' }}>
              {paused ? 'Paused' : 'Running'}
            </p>
          )}

          <div className="form-group" style={{ marginTop: '1.5rem' }}>
            <label>Client</label>
            <ClientSelect
              clients={clients}
              value={timerClient}
              onChange={v => updateTimerField('client', v)}
              placeholder={workspaceClients.length ? `Select client (e.g. ${workspaceClients[0]})` : 'Select or type client'}
            />
            {workspaceClients.length > 0 && !timerClient && (
              <p className="text-muted" style={{ fontSize: '0.78rem', marginTop: '0.35rem' }}>
                Team clients: {workspaceClients.join(', ')} — use the exact name for hours to roll up to your workspace.
              </p>
            )}
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
              <>
                {!paused ? (
                  <button className="btn btn-secondary" onClick={pauseTimer}>Pause</button>
                ) : (
                  <button className="btn btn-primary" onClick={resumeFromPause}>Resume</button>
                )}
                <button className="btn btn-danger" onClick={stopTimer}>Stop</button>
              </>
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
                <ClientSelect
                  clients={clients}
                  value={manualClient}
                  onChange={v => setManualClient(v)}
                />
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
