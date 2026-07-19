import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useSubscription } from '../context/SubscriptionContext'
import { formatHours, formatCurrency, todayString, monthStartString } from '../lib/utils'

const STATUS_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Outstanding', value: 'outstanding' },
  { label: 'Paid', value: 'paid' },
]

function statusBadge(status) {
  const styles = {
    draft:  { background: 'var(--bg-secondary)', color: 'var(--text-muted)', border: '1px solid var(--border)' },
    sent:   { background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' },
    paid:   { background: '#d1fae5', color: '#065f46', border: '1px solid #a7f3d0' },
  }
  const labels = { draft: 'Draft', sent: 'Sent', paid: 'Paid' }
  return (
    <span style={{ ...styles[status], fontSize: '0.75rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: '99px' }}>
      {labels[status]}
    </span>
  )
}

export default function Invoices() {
  const { user } = useAuth()
  const { isBusiness } = useSubscription()

  // generator
  const [clients, setClients] = useState([])
  const [selectedClient, setSelectedClient] = useState('')
  const [startDate, setStartDate] = useState(monthStartString())
  const [endDate, setEndDate] = useState(todayString())
  const [sessions, setSessions] = useState([])
  const [rate, setRate] = useState(0)
  const [yourName, setYourName] = useState('')
  const [clientName, setClientName] = useState('')
  const [generated, setGenerated] = useState(false)
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [loading, setLoading] = useState(false)

  // history
  const [savedInvoices, setSavedInvoices] = useState([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [saving, setSaving] = useState(false)
  const [viewingInvoice, setViewingInvoice] = useState(null)

  useEffect(() => {
    if (isBusiness) {
      fetchClients()
      fetchSavedInvoices()
    }
  }, [user, isBusiness])

  async function fetchClients() {
    const [{ data: rates }, { data: sessionData }] = await Promise.all([
      supabase.from('client_rates').select('client, hourly_rate').eq('user_id', user.id),
      supabase.from('sessions').select('client').eq('user_id', user.id),
    ])
    const rateMap = {}
    rates?.forEach(r => { rateMap[r.client] = r.hourly_rate })
    const allClients = [...new Set([
      ...(rates?.map(r => r.client) ?? []),
      ...(sessionData?.map(s => s.client) ?? []),
    ])].sort().map(c => ({ client: c, hourly_rate: rateMap[c] ?? 0 }))
    setClients(allClients)
  }

  async function fetchSavedInvoices() {
    const { data } = await supabase
      .from('invoices')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setSavedInvoices(data ?? [])
  }

  function handleClientChange(e) {
    const name = e.target.value
    setSelectedClient(name)
    setClientName(name)
    const found = clients.find(c => c.client === name)
    setRate(found?.hourly_rate ?? 0)
    setGenerated(false)
    setViewingInvoice(null)
  }

  async function generateInvoice(e) {
    e.preventDefault()
    if (!selectedClient) return
    setLoading(true)
    setViewingInvoice(null)
    const { data } = await supabase
      .from('sessions')
      .select('date, hours, task_note')
      .eq('user_id', user.id)
      .eq('client', selectedClient)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date')
    setSessions(data ?? [])
    setInvoiceNumber(`INV-${Date.now().toString().slice(-6)}`)
    setGenerated(true)
    setLoading(false)
  }

  async function saveInvoice() {
    setSaving(true)
    const totalHours = sessions.reduce((sum, s) => sum + (s.hours ?? 0), 0)
    const { error } = await supabase.from('invoices').insert({
      user_id: user.id,
      invoice_number: invoiceNumber,
      your_name: yourName || null,
      client: selectedClient,
      start_date: startDate,
      end_date: endDate,
      total_hours: totalHours,
      hourly_rate: rate,
      total_amount: totalHours * rate,
      status: 'draft',
      line_items: sessions.map(s => ({
        date: s.date,
        hours: s.hours,
        task_note: s.task_note,
        amount: (s.hours ?? 0) * rate,
      })),
    })
    setSaving(false)
    if (error) { console.error(error); return }
    setGenerated(false)
    setSessions([])
    await fetchSavedInvoices()
  }

  async function updateStatus(id, status) {
    const update = { status, ...(status === 'paid' ? { paid_at: new Date().toISOString() } : {}) }
    const { error } = await supabase.from('invoices').update(update).eq('id', id)
    if (error) return
    setSavedInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, ...update } : inv))
    if (viewingInvoice?.id === id) setViewingInvoice(prev => ({ ...prev, ...update }))
  }

  async function deleteInvoice(id) {
    if (!confirm('Delete this invoice?')) return
    await supabase.from('invoices').delete().eq('id', id)
    setSavedInvoices(prev => prev.filter(inv => inv.id !== id))
    if (viewingInvoice?.id === id) setViewingInvoice(null)
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

  // What to show in the preview
  const previewItems     = viewingInvoice ? (viewingInvoice.line_items ?? []) : sessions
  const previewRate      = viewingInvoice ? viewingInvoice.hourly_rate   : rate
  const previewNumber    = viewingInvoice ? viewingInvoice.invoice_number : invoiceNumber
  const previewYourName  = viewingInvoice ? viewingInvoice.your_name     : yourName
  const previewClient    = viewingInvoice ? viewingInvoice.client         : clientName
  const previewStart     = viewingInvoice ? viewingInvoice.start_date    : startDate
  const previewEnd       = viewingInvoice ? viewingInvoice.end_date      : endDate
  const previewTotal     = previewItems.reduce((sum, s) => sum + (s.hours ?? 0), 0)
  const previewAmount    = viewingInvoice ? viewingInvoice.total_amount  : previewTotal * previewRate

  const showPreview = generated || viewingInvoice

  const filteredInvoices = savedInvoices.filter(inv => {
    if (statusFilter === 'outstanding') return inv.status !== 'paid'
    if (statusFilter === 'paid') return inv.status === 'paid'
    return true
  })

  const outstandingTotal = savedInvoices
    .filter(inv => inv.status !== 'paid')
    .reduce((sum, inv) => sum + (inv.total_amount ?? 0), 0)

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Invoices</h1>
        <p className="page-subtitle">Generate invoices from tracked sessions</p>
      </div>

      {outstandingTotal > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem', borderColor: 'var(--accent)' }}>
          <div className="card-title">Outstanding Balance</div>
          <div className="card-value">{formatCurrency(outstandingTotal)}</div>
          <div className="card-subtitle">
            {savedInvoices.filter(inv => inv.status !== 'paid').length} unpaid invoice(s)
          </div>
        </div>
      )}

      {savedInvoices.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h2 className="section-title" style={{ margin: 0 }}>Invoice History</h2>
            <div className="filter-bar" style={{ margin: 0 }}>
              {STATUS_FILTERS.map(f => (
                <button
                  key={f.value}
                  className={`filter-btn${statusFilter === f.value ? ' active' : ''}`}
                  onClick={() => setStatusFilter(f.value)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {filteredInvoices.length === 0 ? (
            <div className="empty-state">No invoices match this filter.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {filteredInvoices.map(inv => (
                <div key={inv.id} className="card" style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                        {inv.invoice_number} · {inv.client}
                      </div>
                      <div className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>
                        {inv.start_date} — {inv.end_date} · {formatHours(inv.total_hours)} · {formatCurrency(inv.total_amount)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
                      {statusBadge(inv.status)}
                      {inv.status === 'draft' && (
                        <button className="btn btn-secondary btn-sm" onClick={() => updateStatus(inv.id, 'sent')}>Mark Sent</button>
                      )}
                      {inv.status === 'sent' && (
                        <button className="btn btn-primary btn-sm" onClick={() => updateStatus(inv.id, 'paid')}>Mark Paid</button>
                      )}
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => { setViewingInvoice(inv); setGenerated(false) }}
                      >
                        View
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => deleteInvoice(inv.id)}>Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>New Invoice</h2>
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

      {showPreview && (
        <div className="invoice-preview" id="invoice-print">
          <div className="invoice-header">
            <div>
              <div style={{ fontWeight: 700, fontSize: '1.25rem' }}>{previewYourName || 'Your Name'}</div>
              <div className="text-muted" style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
                {previewStart} — {previewEnd}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 700 }}>INVOICE</div>
              <div className="text-muted" style={{ fontSize: '0.85rem' }}>{previewNumber}</div>
              <div className="text-muted" style={{ fontSize: '0.85rem' }}>
                {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <div className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '0.25rem' }}>BILL TO</div>
            <div style={{ fontWeight: 500 }}>{previewClient}</div>
          </div>

          {previewItems.length === 0 ? (
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
                    {previewItems.map((s, i) => (
                      <tr key={i}>
                        <td>{s.date}</td>
                        <td>{formatHours(s.hours)}</td>
                        <td className="text-muted">{s.task_note || '—'}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency((s.hours ?? 0) * previewRate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="text-muted" style={{ fontSize: '0.85rem' }}>
                  {formatHours(previewTotal)} @ {formatCurrency(previewRate)}/hr
                </div>
                <div className="invoice-total">{formatCurrency(previewAmount)}</div>
              </div>
            </>
          )}
        </div>
      )}

      {generated && sessions.length > 0 && (
        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem' }} className="no-print">
          <button className="btn btn-primary" onClick={saveInvoice} disabled={saving}>
            {saving ? 'Saving…' : 'Save Invoice'}
          </button>
          <button className="btn btn-secondary" onClick={() => window.print()}>Print / Save as PDF</button>
        </div>
      )}

      {viewingInvoice && (
        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem' }} className="no-print">
          <button className="btn btn-secondary" onClick={() => window.print()}>Print / Save as PDF</button>
          <button className="btn btn-secondary" onClick={() => setViewingInvoice(null)}>Close</button>
        </div>
      )}
    </div>
  )
}
