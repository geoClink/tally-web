import { createClient } from '@supabase/supabase-js'

// Vercel cron job handler — runs every Monday at 8am UTC.
// Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` for cron invocations.
export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) return res.status(500).json({ error: 'RESEND_API_KEY not set' })

  // Last 7 full days
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const weekAgoStr = weekAgo.toISOString().split('T')[0]

  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('user_id, client, hours, date')
    .gte('date', weekAgoStr)
    .gt('hours', 0)

  if (error) return res.status(500).json({ error: error.message })
  if (!sessions?.length) return res.json({ sent: 0, message: 'No sessions this week' })

  // Group by user
  const byUser = {}
  for (const s of sessions) {
    if (!byUser[s.user_id]) byUser[s.user_id] = { totalHours: 0, clients: {} }
    byUser[s.user_id].totalHours += s.hours
    byUser[s.user_id].clients[s.client] = (byUser[s.user_id].clients[s.client] ?? 0) + s.hours
  }

  // Get emails from auth.users
  const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers()
  if (usersError) return res.status(500).json({ error: usersError.message })

  const emailMap = {}
  for (const u of users) {
    if (byUser[u.id] && u.email) emailMap[u.id] = u.email
  }

  let sent = 0
  for (const [userId, data] of Object.entries(byUser)) {
    const email = emailMap[userId]
    if (!email) continue

    const total = data.totalHours
    const clientRows = Object.entries(data.clients)
      .sort((a, b) => b[1] - a[1])
      .map(([client, hours]) => `
        <tr>
          <td style="padding:8px 0;font-size:14px;color:#111827;border-bottom:1px solid #f3f4f6;">${client}</td>
          <td style="padding:8px 0;font-size:14px;color:#111827;text-align:right;border-bottom:1px solid #f3f4f6;">${hours.toFixed(1)}h</td>
        </tr>`)
      .join('')

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Tally <noreply@georgeclinkscalesdev.com>',
        to: email,
        subject: `Your week in Tally — ${total.toFixed(1)} hours tracked`,
        html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your week in Tally</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f3f4f6;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="540" cellpadding="0" cellspacing="0" role="presentation" style="max-width:540px;width:100%;">
          <tr>
            <td style="background:#1d4ed8;border-radius:10px 10px 0 0;padding:28px 40px;text-align:center;">
              <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">Tally</span>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;padding:40px 40px 32px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
              <p style="margin:0 0 4px;font-size:13px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#9ca3af;">Weekly summary</p>
              <h1 style="margin:0 0 24px;font-size:32px;font-weight:700;color:#111827;letter-spacing:-0.5px;line-height:1.1;">
                ${total.toFixed(1)}<span style="font-size:18px;font-weight:500;color:#6b7280;"> hours this week</span>
              </h1>
              <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#374151;">Hours by client</p>
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 28px;">
                ${clientRows}
              </table>
              <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 28px;">
                <tr>
                  <td style="background:#1d4ed8;border-radius:8px;">
                    <a href="https://tallytimetracker.com/reports" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">
                      View full report →
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
                Also on iPhone:&nbsp;
                <a href="https://apps.apple.com/us/app/tally-time-tracker/id6775275483" style="color:#6b7280;text-decoration:underline;">Download on the App Store</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:0 0 10px 10px;padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
                You're receiving this weekly summary from Tally.<br>
                <a href="https://tallytimetracker.com/settings" style="color:#9ca3af;">Manage email settings</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
      }),
    })

    if (emailRes.ok) sent++
  }

  return res.json({ sent })
}
