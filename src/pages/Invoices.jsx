import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import TrashIcon from '../components/TrashIcon'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useSubscription } from '../context/SubscriptionContext'
import { formatHours, formatCurrency, todayString, monthStartString, lastMonthRange, billingPeriodStart } from '../lib/utils'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

function lastWeekRange(weekStart = 1) {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - ((day - weekStart + 7) % 7)
  const end = new Date(new Date().setDate(diff - 1))
  const start = new Date(end)
  start.setDate(start.getDate() - 6)
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  }
}

function lastBillingPeriodRange(startDay) {
  const currentStart = new Date(billingPeriodStart(startDay))
  const prevEnd = new Date(currentStart)
  prevEnd.setDate(prevEnd.getDate() - 1)
  const prevStart = new Date(prevEnd.getFullYear(), prevEnd.getMonth(), startDay)
  if (prevStart > prevEnd) prevStart.setMonth(prevStart.getMonth() - 1)
  return {
    start: prevStart.toISOString().split('T')[0],
    end: prevEnd.toISOString().split('T')[0],
  }
}

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
  const [clientEmail, setClientEmail] = useState('')
  const [weekStart, setWeekStart] = useState(1)
  const [taxRate, setTaxRate] = useState(0)
  const [memo, setMemo] = useState('')
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)

  // history
  const [savedInvoices, setSavedInvoices] = useState([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(null)
  const [sendingStripe, setSendingStripe] = useState(null)
  const [viewingInvoice, setViewingInvoice] = useState(null)
  const [stripeConnected, setStripeConnected] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    if (isBusiness) {
      fetchClients()
      fetchSavedInvoices()
      fetchConfig()
      supabase.from('stripe_connect_accounts').select('onboarded').eq('user_id', user.id).maybeSingle()
        .then(({ data }) => setStripeConnected(!!data?.onboarded))

    }
  }, [user, isBusiness])

  async function fetchConfig() {
    const { data } = await supabase.from('config').select('your_name, week_start').eq('user_id', user.id).maybeSingle()
    if (data?.your_name) setYourName(data.your_name)
    if (data?.week_start != null) setWeekStart(data.week_start)
  }

  async function fetchClients() {
    const [{ data: rates }, { data: sessionData }] = await Promise.all([
      supabase.from('client_rates').select('client, hourly_rate, client_email, billing_start_day').eq('user_id', user.id),
      supabase.from('sessions').select('client').eq('user_id', user.id),
    ])
    const rateMap = {}
    const emailMap = {}
    const bsdMap = {}
    rates?.forEach(r => { rateMap[r.client] = r.hourly_rate; emailMap[r.client] = r.client_email ?? ''; bsdMap[r.client] = r.billing_start_day ?? null })
    const allClients = [...new Set([
      ...(rates?.map(r => r.client) ?? []),
      ...(sessionData?.map(s => s.client) ?? []),
    ])].sort().map(c => ({ client: c, hourly_rate: rateMap[c] ?? 0, client_email: emailMap[c] ?? '', billing_start_day: bsdMap[c] ?? null }))
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
    setClientEmail(found?.client_email ?? '')
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
    const subtotal = totalHours * rate
    const taxAmount = subtotal * (taxRate / 100)
    const totalAmount = subtotal + taxAmount
    const { error } = await supabase.from('invoices').insert({
      user_id: user.id,
      invoice_number: invoiceNumber,
      your_name: yourName || null,
      client: selectedClient,
      client_email: clientEmail.trim() || null,
      start_date: startDate,
      end_date: endDate,
      total_hours: totalHours,
      hourly_rate: rate,
      total_amount: totalAmount,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      memo: memo.trim() || null,
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
    setClientEmail('')
    setMemo('')
    setTaxRate(0)
    await fetchSavedInvoices()
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 3000)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function sendInvoice(inv) {
    if (!inv.client_email) {
      alert('No client email on this invoice. Edit it to add one.')
      return
    }
    setSending(inv.id)
    const { error } = await supabase.functions.invoke('send-invoice', {
      body: {
        invoiceNumber: inv.invoice_number,
        yourName: inv.your_name,
        clientName: inv.client,
        clientEmail: inv.client_email,
        startDate: inv.start_date,
        endDate: inv.end_date,
        lineItems: inv.line_items ?? [],
        hourlyRate: inv.hourly_rate,
        totalHours: inv.total_hours,
        totalAmount: inv.total_amount,
      },
    })
    if (error) { setSending(null); alert('Failed to send: ' + error.message); return }
    await updateStatus(inv.id, 'sent')
    setSending(null)
  }

  async function saveAndSend() {
    if (!clientEmail.trim()) {
      alert('Add a client email before sending.')
      return
    }
    setSaving(true)
    const totalHours = sessions.reduce((sum, s) => sum + (s.hours ?? 0), 0)
    const subtotal = totalHours * rate
    const taxAmount = subtotal * (taxRate / 100)
    const totalAmount = subtotal + taxAmount
    const invData = {
      user_id: user.id,
      invoice_number: invoiceNumber,
      your_name: yourName || null,
      client: selectedClient,
      client_email: clientEmail.trim() || null,
      start_date: startDate,
      end_date: endDate,
      total_hours: totalHours,
      hourly_rate: rate,
      total_amount: totalAmount,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      memo: memo.trim() || null,
      status: 'draft',
      line_items: sessions.map(s => ({
        date: s.date,
        hours: s.hours,
        task_note: s.task_note,
        amount: (s.hours ?? 0) * rate,
      })),
    }
    const { data: saved, error } = await supabase.from('invoices').insert(invData).select().single()
    setSaving(false)
    if (error || !saved) { console.error(error); return }
    setGenerated(false)
    setSessions([])
    setClientEmail('')
    setMemo('')
    setTaxRate(0)
    await fetchSavedInvoices()
    // Send immediately
    if (stripeConnected) {
      await sendStripeInvoice(saved)
    } else {
      await sendInvoice(saved)
    }
  }

  async function sendStripeInvoice(inv) {
    if (!inv.client_email) {
      alert('No client email on this invoice. Edit it to add one.')
      return
    }
    setSendingStripe(inv.id)
    const { data: { session } } = await supabase.auth.getSession()
    const lineItems = (inv.line_items ?? []).map(item => ({
      description: item.task_note || item.date || 'Work',
      hours: item.hours,
      rate: inv.hourly_rate,
    }))
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-stripe-invoice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        clientEmail: inv.client_email,
        clientName: inv.client,
        lineItems,
        memo: inv.memo || null,
      }),
    })
    const data = await res.json()
    setSendingStripe(null)
    if (!res.ok || data.error) {
      alert(data.error ?? 'Failed to send Stripe invoice')
      return
    }
    await supabase.from('invoices').update({
      stripe_invoice_id: data.invoiceId,
      stripe_invoice_url: data.invoiceUrl,
      status: 'sent',
    }).eq('id', inv.id)
    setSavedInvoices(prev => prev.map(i => i.id === inv.id
      ? { ...i, stripe_invoice_id: data.invoiceId, stripe_invoice_url: data.invoiceUrl, status: 'sent' }
      : i
    ))
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

  async function downloadPDF() {
    const el = document.getElementById('invoice-print')
    if (!el) return
    setDownloading(true)
    try {
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const imgWidth = pageWidth
      const imgHeight = (canvas.height * pageWidth) / canvas.width
      let heightLeft = imgHeight
      let position = 0
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
      while (heightLeft > 0) {
        position -= pageHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }
      pdf.save(`invoice-${previewNumber || 'draft'}.pdf`)
    } finally {
      setDownloading(false)
    }
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
  const previewTaxRate   = viewingInvoice ? (viewingInvoice.tax_rate ?? 0) : taxRate
  const previewMemo      = viewingInvoice ? (viewingInvoice.memo ?? '') : memo
  const previewSubtotal  = previewTotal * previewRate
  const previewTaxAmount = previewSubtotal * (previewTaxRate / 100)
  const previewAmount    = viewingInvoice ? viewingInvoice.total_amount : previewSubtotal + previewTaxAmount

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

      {saveSuccess && (
        <div className="alert alert-success" style={{ marginBottom: '1rem' }}>
          Invoice saved! Find it in Invoice History above.
        </div>
      )}

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
            <div>
              <h2 className="section-title" style={{ margin: 0 }}>Invoice History</h2>
              {stripeConnected && (
                <div className="text-muted" style={{ fontSize: '0.78rem', marginTop: '0.2rem' }}>
                  Stripe automatically sends payment reminders for overdue invoices.
                </div>
              )}
            </div>
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
                <div key={inv.id} className="card" style={{ padding: '1rem 1.1rem' }}>
                  {/* Top row: number + client / status badge */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.35rem' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', lineHeight: 1.3 }}>
                      <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.78rem' }}>{inv.invoice_number}</span>
                      <span style={{ color: 'var(--text-muted)', margin: '0 0.3rem' }}>·</span>
                      {inv.client}
                    </div>
                    {statusBadge(inv.status)}
                  </div>

                  {/* Amount + meta */}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.9rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-0.5px' }}>
                      {formatCurrency(inv.total_amount)}
                    </span>
                    <span className="text-muted" style={{ fontSize: '0.78rem' }}>
                      {inv.start_date} — {inv.end_date} · {formatHours(inv.total_hours)}
                    </span>
                  </div>

                  {/* Action row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                    {inv.status !== 'paid' && (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => stripeConnected ? sendStripeInvoice(inv) : sendInvoice(inv)}
                        disabled={sendingStripe === inv.id || sending === inv.id}
                        title={inv.client_email ? `Send to ${inv.client_email}` : 'No client email — add one to send'}
                      >
                        {(sendingStripe === inv.id || sending === inv.id) ? 'Sending…' : 'Send Invoice'}
                      </button>
                    )}
                    {inv.stripe_invoice_url && (
                      <a href={inv.stripe_invoice_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
                        Pay Link
                      </a>
                    )}
                    {inv.status === 'draft' && (
                      <button className="btn btn-secondary btn-sm" onClick={() => updateStatus(inv.id, 'sent')}>Mark Sent</button>
                    )}
                    {inv.status === 'sent' && (
                      <button className="btn btn-secondary btn-sm" onClick={() => updateStatus(inv.id, 'paid')}>Mark Paid</button>
                    )}
                    {inv.status === 'paid' && (
                      <button className="btn btn-secondary btn-sm" onClick={() => updateStatus(inv.id, 'sent')}>Mark Unpaid</button>
                    )}
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => { setViewingInvoice(inv); setGenerated(false) }}
                    >
                      View
                    </button>

                    {/* Trash icon — pushed to far right */}
                    <button
                      onClick={() => deleteInvoice(inv.id)}
                      title="Delete invoice"
                      style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.25rem', borderRadius: '4px', display: 'flex', alignItems: 'center' }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                      <TrashIcon />
                    </button>
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
            <div className="form-group" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
              <label>Quick Period</label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {[
                  { label: 'Last Week',   action: () => { const r = lastWeekRange(weekStart); setStartDate(r.start); setEndDate(r.end) } },
                  { label: 'This Month',  action: () => { setStartDate(monthStartString()); setEndDate(todayString()) } },
                  { label: 'Last Month',  action: () => { const r = lastMonthRange(); setStartDate(r.start); setEndDate(r.end) } },
                  ...(() => {
                    const found = clients.find(c => c.client === selectedClient)
                    const bsd = found?.billing_start_day
                    if (!bsd) return []
                    return [{ label: 'Last Billing Period', action: () => { const r = lastBillingPeriodRange(bsd); setStartDate(r.start); setEndDate(r.end) } }]
                  })(),
                ].map(({ label, action }) => (
                  <button key={label} type="button" className="btn btn-secondary btn-sm" onClick={action}>{label}</button>
                ))}
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Start Date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>End Date</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Client Email (optional)</label>
              <input
                type="email"
                value={clientEmail}
                onChange={e => setClientEmail(e.target.value)}
                placeholder="client@example.com"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Tax Rate % (optional)</label>
              <input
                type="number"
                value={taxRate || ''}
                onChange={e => setTaxRate(parseFloat(e.target.value) || 0)}
                placeholder="0"
                min="0"
                max="100"
                step="0.1"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
              <label>Memo / Notes (optional)</label>
              <input
                type="text"
                value={memo}
                onChange={e => setMemo(e.target.value)}
                placeholder="Payment due within 14 days. Thank you!"
                maxLength={300}
              />
            </div>
          </div>
          <div className="invoice-form-actions" style={{ marginTop: '1rem' }}>
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
                      <th className="hide-mobile">Description</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewItems.map((s, i) => (
                      <tr key={i}>
                        <td>{s.date}</td>
                        <td>
                          {generated ? (
                            <input
                              type="number"
                              value={s.hours}
                              min="0"
                              step="0.25"
                              style={{ width: '70px', padding: '0.2rem', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--bg)', color: 'var(--text)' }}
                              onChange={e => {
                                const val = parseFloat(e.target.value) || 0
                                setSessions(prev => prev.map((row, idx) => idx === i ? { ...row, hours: val } : row))
                              }}
                            />
                          ) : formatHours(s.hours)}
                        </td>
                        <td className="hide-mobile">
                          {generated ? (
                            <input
                              type="text"
                              value={s.task_note || ''}
                              placeholder="Description"
                              style={{ width: '100%', padding: '0.2rem', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--bg)', color: 'var(--text)' }}
                              onChange={e => {
                                setSessions(prev => prev.map((row, idx) => idx === i ? { ...row, task_note: e.target.value } : row))
                              }}
                            />
                          ) : <span className="text-muted">{s.task_note || '—'}</span>}
                        </td>
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
                {previewTaxRate > 0 && (
                  <>
                    <div className="text-muted" style={{ fontSize: '0.85rem' }}>
                      Subtotal: {formatCurrency(previewSubtotal)}
                    </div>
                    <div className="text-muted" style={{ fontSize: '0.85rem' }}>
                      Tax ({previewTaxRate}%): {formatCurrency(previewTaxAmount)}
                    </div>
                  </>
                )}
                <div className="invoice-total">{formatCurrency(previewAmount)}</div>
              </div>
              {previewMemo && (
                <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {previewMemo}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {generated && sessions.length > 0 && (
        <div className="invoice-form-actions no-print" style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={saveAndSend} disabled={saving}>
            {saving ? 'Saving…' : 'Save & Send'}
          </button>
          <button className="btn btn-secondary" onClick={saveInvoice} disabled={saving}>
            {saving ? 'Saving…' : 'Save Draft'}
          </button>
          <button className="btn btn-secondary" onClick={downloadPDF} disabled={downloading}>
            {downloading ? 'Generating PDF…' : 'Download PDF'}
          </button>
        </div>
      )}

      {viewingInvoice && (
        <div className="invoice-form-actions no-print" style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={downloadPDF} disabled={downloading}>
            {downloading ? 'Generating PDF…' : 'Download PDF'}
          </button>
          <button className="btn btn-secondary" onClick={() => setViewingInvoice(null)}>Close</button>
        </div>
      )}
    </div>
  )
}
