import { createClient } from '@supabase/supabase-js'

const BUNDLE_ID = 'name.GeorgeClinkscales.Tally'

async function buildApnsJwt(teamId, keyId, privateKeyPem) {
  const keyData = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '')
  const keyBuffer = Uint8Array.from(atob(keyData), c => c.charCodeAt(0))
  const key = await crypto.subtle.importKey('pkcs8', keyBuffer.buffer, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const toB64url = (obj) => btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const header = toB64url({ alg: 'ES256', kid: keyId })
  const payload = toB64url({ iss: teamId, iat: Math.floor(Date.now() / 1000) })
  const signingInput = `${header}.${payload}`
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(signingInput))
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `${signingInput}.${sigB64}`
}

async function sendPush(token, environment, jwt, title, body) {
  const host = environment === 'sandbox' ? 'https://api.sandbox.push.apple.com' : 'https://api.push.apple.com'
  const res = await fetch(`${host}/3/device/${token}`, {
    method: 'POST',
    headers: {
      authorization: `bearer ${jwt}`,
      'apns-topic': BUNDLE_ID,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ aps: { alert: { title, body }, sound: 'default' } }),
  })
  return res.status
}

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

  const userIds = Object.keys(byUser)

  // Get emails
  const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers()
  if (usersError) return res.status(500).json({ error: usersError.message })

  const emailMap = {}
  for (const u of users) {
    if (byUser[u.id] && u.email) emailMap[u.id] = u.email
  }

  // Get device tokens for active users
  const { data: deviceTokens } = await supabase
    .from('device_tokens')
    .select('user_id, token, environment')
    .in('user_id', userIds)

  const tokenMap = {}
  for (const dt of deviceTokens ?? []) {
    if (!tokenMap[dt.user_id]) tokenMap[dt.user_id] = []
    tokenMap[dt.user_id].push({ token: dt.token, environment: dt.environment })
  }

  // Build APNs JWT once if credentials are present
  const apnsKey = process.env.APNS_PRIVATE_KEY
  const apnsKeyId = process.env.APNS_KEY_ID
  const apnsTeamId = process.env.APNS_TEAM_ID
  const apnsJwt = (apnsKey && apnsKeyId && apnsTeamId)
    ? await buildApnsJwt(apnsTeamId, apnsKeyId, apnsKey)
    : null

  let sent = 0
  let pushSent = 0
  for (const [userId, data] of Object.entries(byUser)) {
    const email = emailMap[userId]
    const total = data.totalHours

    if (email) {
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
          from: 'Tally <noreply@tallytimetracker.com>',
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
            <td style="background:#1d4ed8;border-radius:10px 10px 0 0;padding:24px 40px;text-align:center;">
              <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto;">
                <tr>
                  <td style="vertical-align:middle;padding-right:10px;">
                    <img src="https://tallytimetracker.com/logo.png" alt="Tally" width="32" height="32" style="display:block;border-radius:8px;">
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">Tally</span>
                  </td>
                </tr>
              </table>
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

    // Push to any registered devices
    if (apnsJwt && tokenMap[userId]) {
      for (const { token, environment } of tokenMap[userId]) {
        const status = await sendPush(
          token, environment, apnsJwt,
          'Weekly summary',
          `You tracked ${total.toFixed(1)} hours this week.`
        )
        if (status === 200) pushSent++
      }
    }
  }

  return res.json({ sent, pushSent })
}
