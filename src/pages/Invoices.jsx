import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useSubscription } from '../context/SubscriptionContext'
import { formatHours, formatCurrency, todayString, monthStartString } from '../lib/utils'

export default function Invoices() {
  const { user } = useAuth()
  const { isBusiness } = useSubscription()
  const [clients, setClients] = useState([])
  const [selectedClient, setSelectedClient] = useState('')
  const [startDate, setStartDate] = useState(monthStartString())
  const [endDate, setEndDate] = useState(todayString())
  const [sessions, setSessions] = useState([])
  const [rate, setRate] = useState(0)
  const [generated, setGenerated] = useState(false)
  const [loading, setLoading] = useState(false)
  const [yourName, setYourName] = useState('')
  const [clientName, setClientName] = useState('')

  useEffect(() => {
    if (isBusiness) fetchClients()
  }, [user, isBusiness])

  async function fetchClients() {
    const [{ data: rates }, { data: sessions }] = await Promise.all([
      supabase.from('client_rates').select('client, hourly_rate').eq('user_id', user.id),
      supabase.from('sessions').select('client').eq('user_id', user.id),
    ])
    // Merge unique clients from both sources
    const rateMap = {}
    rates?.forEach(r => { rateMap[r.client] = r.hourly_rate })
    const allClients = [...new Set([
      ...(rates?.map(r => r.client) ?? []),
      ...(sessions?.map(s => s.client) ?? []),
    ])].sort().map(c => ({ client: c, hourly_rate: rateMap[c] ?? 0 }))
    setClients(allClients)
  }

  function handleClientChange(e) {
    const name = e.target.value
    setSelectedClient(name)
    setClientName(name)
    const found = clients.find(c => c.client === name)
    setRate(found?.hourly_rate ?? 0)
    setGenerated(false)
  }

  async function generateInvoice(e) {
    e.preventDefault()
    if (!selectedClient) return
    setLoading(true)
    const { data } = await supabase
      .from('sessions')
      .select('date, hours, task_note')
      .eq('user_id', user.id)
      .eq('client', selectedClient)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date')
    setSessions(data ?? [])
    setGenerated(true)
    setLoading(false)
  }

  if (!isBusiness) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">Invoices</h1>
        </div>
        <div className="paywall">
          <div className="paywall-title">Invoice generation requires Business tier</div>
          <p className="paywall-desc">Generate professional invoices from your tracked sessions.</p>
          <Link to="/billing" className="btn btn-primary">Upgrade to Business</Link>
        </div>
      </div>
    )
  }

  const totalHours = sessions.reduce((sum, s) => sum + (s.hours ?? 0), 0)
  const totalAmount = totalHours * rate
  const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Invoices</h1>
        <p className="page-subtitle">Generate invoices from tracked sessions</p>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <form onSubmit={generateInvoice}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Your Name / Company</label>
              <input
                type="text"
                value={yourName}
                onChange={e => setYourName(e.target.value)}
                placeholder="Jane Smith"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Client</label>
              <select value={selectedClient} onChange={handleClientChange} required>
                <option value="">Select client…</option>
                {clients.map(c => (
                  <option key={c.client} value={c.client}>{c.client}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Hourly Rate ($)</label>
              <input
                type="number"
                value={rate || ''}
                onChange={e => setRate(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                min="0"
                step="0.01"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Start Date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>End Date</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required />
            </div>
          </div>
          <div style={{ marginTop: '1rem' }}>
            <button type="submit" className="btn btn-primary" disabled={loading || !selectedClient}>
              {loading ? 'Loading…' : 'Generate Invoice'}
            </button>
          </div>
        </form>
      </div>

      {generated && (
        <div className="invoice-preview" id="invoice-print">
          <div className="invoice-header">
            <div>
              <div style={{ fontWeight: 700, fontSize: '1.25rem' }}>{yourName || 'Your Name'}</div>
              <div className="text-muted" style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
                {startDate} — {endDate}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 700 }}>INVOICE</div>
              <div className="text-muted" style={{ fontSize: '0.85rem' }}>{invoiceNumber}</div>
              <div className="text-muted" style={{ fontSize: '0.85rem' }}>
                {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <div className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '0.25rem' }}>BILL TO</div>
            <div style={{ fontWeight: 500 }}>{clientName}</div>
          </div>

          {sessions.length === 0 ? (
            <div className="empty-state">No sessions found for this client and date range.</div>
          ) : (
            <>
              <div className="table-wrapper" style={{ marginBottom: '1rem' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Hours</th>
                      <th>Description</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s, i) => (
                      <tr key={i}>
                        <td>{s.date}</td>
                        <td>{formatHours(s.hours)}</td>
                        <td className="text-muted">{s.task_note || '—'}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency((s.hours ?? 0) * rate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="text-muted" style={{ fontSize: '0.85rem' }}>
                  {formatHours(totalHours)} @ {formatCurrency(rate)}/hr
                </div>
                <div className="invoice-total">{formatCurrency(totalAmount)}</div>
              </div>
            </>
          )}
        </div>
      )}

      {generated && sessions.length > 0 && (
        <div style={{ marginTop: '1rem' }} className="no-print">
          <button className="btn btn-secondary" onClick={() => window.print()}>Print / Save as PDF</button>
        </div>
      )}
    </div>
  )
}
