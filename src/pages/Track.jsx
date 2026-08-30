import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useSubscription } from '../context/SubscriptionContext'
import { todayString } from '../lib/utils'
import ClientSelect from '../components/ClientSelect'

const STORAGE_KEY = 'tally_active_timer'

function playTone(frequency, duration, type = 'sine') {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = type
    osc.frequency.setValueAtTime(frequency, ctx.currentTime)
    gain.gain.setValueAtTime(0.18, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + duration)
  } catch {}
}

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
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)

  const runningRef = useRef(false)
  const elapsedRef = useRef(0)
  const startTimeRef = useRef(null)
  const pausedRef = useRef(false)

  // Voice control
  const recognitionRef = useRef(null)
  const voiceCommandRef = useRef(null)
  const [listening, setListening] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState('')

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

  // Returns an error string if the free-tier 5-client limit would be exceeded, or null if OK
  function checkClientLimit(newClient) {
    if (isPro) return null
    if (clients.length >= 5 && !clients.includes(newClient.trim())) {
      return 'Free tier is limited to 5 clients. Upgrade to Pro for unlimited clients.'
    }
    return null
  }

  function startTimer() {
    playTone(880, 0.12)
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
    playTone(440, 0.18)
    setRunning(false)
    runningRef.current = false
    setPaused(false)
    pausedRef.current = false
  }

  function resumeTimer() {
    const newStart = new Date(Date.now() - elapsed * 1000)
    setStartTime(newStart)
    startTimeRef.current = newStart
    setRunning(true)
    runningRef.current = true
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...saved, start: newStart.toISOString(), paused: false }))
  }

  useEffect(() => { runningRef.current = running }, [running])
  useEffect(() => { elapsedRef.current = elapsed }, [elapsed])
  useEffect(() => { startTimeRef.current = startTime }, [startTime])
  useEffect(() => { pausedRef.current = paused }, [paused])

  // Keep voice command handler fresh so it always sees current state
  useEffect(() => {
    voiceCommandRef.current = (transcript) => {
      if (transcript.includes('start') && !running && elapsed === 0) startTimer()
      else if (transcript.includes('pause') && running && !paused) pauseTimer()
      else if (transcript.includes('resume') && paused) resumeFromPause()
      else if (transcript.includes('resume') && !running && elapsed > 0) resumeTimer()
      else if (transcript.includes('save') && !running && elapsed > 0) saveTimer()
      else if (transcript.includes('stop') && running) stopTimer()
      else if (transcript.includes('discard')) discardTimer()
    }
  }, [running, paused, elapsed, timerClient])

  useEffect(() => {
    return () => recognitionRef.current?.stop()
  }, [])

  function toggleVoice() {
    if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      setError('Voice control is not supported in this browser. Try Chrome or Edge.')
      return
    }
    if (listening) {
      recognitionRef.current?.stop()
      setListening(false)
      setVoiceStatus('')
      return
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SR()
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = 'en-US'
    recognition.onresult = (e) => {
      const transcript = e.results[e.results.length - 1][0].transcript.trim().toLowerCase()
      setVoiceStatus(`"${transcript}"`)
      voiceCommandRef.current?.(transcript)
    }
    recognition.onerror = () => { setListening(false); setVoiceStatus('') }
    recognition.onend = () => { setListening(false); setVoiceStatus('') }
    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
    setVoiceStatus('Listening…')
  }

  async function saveTimer() {
    setError('')
    if (!timerClient.trim()) { setError('Select a client before saving'); return }
    const hours = elapsed / 3600
    if (hours < 0.001) { setError('No time recorded yet'); return }

    setSaving(true)
    const limitErr = checkClientLimit(timerClient)
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
    localStorage.removeItem(STORAGE_KEY)
    setRunning(false)
    runningRef.current = false
    setPaused(false)
    pausedRef.current = false
    setElapsed(0)
    setStartTime(null)
    setTimerClient('')
    setTimerNote('')
    setShowDiscardConfirm(false)
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

      <div className="tab-bar" style={{ marginBottom: 0, borderBottom: 'none' }}>
        <button className={`tab-btn${tab === 'timer' ? ' active' : ''}`} onClick={() => { setTab('timer'); setError('') }}>
          Timer
        </button>
        <button className={`tab-btn${tab === 'manual' ? ' active' : ''}`} onClick={() => { setTab('manual'); setError('') }}>
          Manual Entry
        </button>
      </div>
      <div style={{ borderBottom: '1px solid var(--border)', marginBottom: '1.25rem' }} />

      {!isPro && (
        <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
          Free tier: up to 5 clients. <Link to="/billing" className="alert-link">Upgrade to Pro</Link> for unlimited.
        </div>
      )}

      {error && <div className="auth-error" style={{ marginTop: '0.5rem' }}>{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {tab === 'timer' && (
        <div className="card">
          <div className={`timer-display${running && !paused ? ' timer-running' : ''}`}>
            {running && !paused && <span className="timer-dot" aria-hidden="true" />}
            {timerDisplay}
          </div>
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

          <div className="timer-actions" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {!running && elapsed === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <button
                  className="btn btn-primary"
                  onClick={startTimer}
                  disabled={!timerClient.trim()}
                >
                  Start Timer
                </button>
                {!timerClient.trim() && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: 0 }}>
                    Type a client name above to unlock
                  </p>
                )}
              </div>
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
                {showDiscardConfirm ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Discard session?</span>
                    <button className="btn btn-danger btn-sm" onClick={discardTimer}>Yes, discard</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setShowDiscardConfirm(false)}>Cancel</button>
                  </div>
                ) : (
                  <button className="btn btn-secondary" onClick={() => setShowDiscardConfirm(true)}>Discard</button>
                )}
              </>
            )}
          </div>

          {running && (
            <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '1rem' }}>
              Timer keeps running if you navigate away.
            </p>
          )}

          <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
            <button
              className={`btn ${listening ? 'btn-danger' : 'btn-secondary'}`}
              onClick={toggleVoice}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              title="Say: start, pause, resume, save, stop, discard"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
              {listening ? 'Stop Listening' : 'Voice Control'}
            </button>
            {voiceStatus && (
              <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
                {voiceStatus}
              </p>
            )}
            {!listening && (
              <p className="text-muted" style={{ fontSize: '0.75rem', marginTop: '0.4rem' }}>
                Say: "start", "pause", "resume", "save", "stop", or "discard"
              </p>
            )}
          </div>
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
