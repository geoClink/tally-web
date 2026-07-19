import "@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

function formatHours(h: number) {
  const total = Math.round(h * 60)
  const hrs = Math.floor(total / 60)
  const mins = total % 60
  if (mins === 0) return `${hrs}h`
  return `${hrs}h ${mins}m`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const {
      invoiceNumber,
      yourName,
      clientName,
      clientEmail,
      startDate,
      endDate,
      lineItems,
      hourlyRate,
      totalHours,
      totalAmount,
    } = await req.json()

    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) throw new Error('RESEND_API_KEY not set')

    const rows = (lineItems ?? []).map((item: { date: string; hours: number; task_note?: string; amount: number }) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${item.date}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${formatHours(item.hours)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;">${item.task_note || '—'}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatCurrency(item.amount)}</td>
      </tr>
    `).join('')

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

    <div style="background:#1e3a5f;padding:32px 40px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <div style="color:#fff;font-size:1.25rem;font-weight:700;">${yourName || 'Invoice'}</div>
          <div style="color:#93c5fd;font-size:0.85rem;margin-top:4px;">${startDate} — ${endDate}</div>
        </div>
        <div style="text-align:right;">
          <div style="color:#fff;font-weight:700;letter-spacing:0.05em;">INVOICE</div>
          <div style="color:#93c5fd;font-size:0.85rem;">${invoiceNumber}</div>
          <div style="color:#93c5fd;font-size:0.85rem;">${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
        </div>
      </div>
    </div>

    <div style="padding:32px 40px;">
      <div style="margin-bottom:24px;">
        <div style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;margin-bottom:4px;">Bill To</div>
        <div style="font-weight:600;font-size:1rem;">${clientName}</div>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="padding:8px 12px;text-align:left;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;">Date</th>
            <th style="padding:8px 12px;text-align:left;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;">Hours</th>
            <th style="padding:8px 12px;text-align:left;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;">Description</th>
            <th style="padding:8px 12px;text-align:right;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;">Amount</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div style="text-align:right;border-top:2px solid #e5e7eb;padding-top:16px;">
        <div style="color:#6b7280;font-size:0.85rem;margin-bottom:4px;">${formatHours(totalHours)} @ ${formatCurrency(hourlyRate)}/hr</div>
        <div style="font-size:1.5rem;font-weight:700;color:#1e3a5f;">${formatCurrency(totalAmount)}</div>
      </div>

      <div style="margin-top:32px;padding:16px;background:#f3f4f6;border-radius:8px;font-size:0.85rem;color:#6b7280;">
        Sent via <strong>Tally</strong> — Time Tracker
      </div>
    </div>
  </div>
</body>
</html>
    `

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Tally <invoices@georgeclinkscalesdev.com>',
        to: clientEmail,
        subject: `Invoice ${invoiceNumber} from ${yourName || 'your contractor'}`,
        html,
      }),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(JSON.stringify(data))

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
