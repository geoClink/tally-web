import { createClient } from 'jsr:@supabase/supabase-js@2'

const BUNDLE_ID = 'name.GeorgeClinkscales.Tally'

async function buildApnsJwt(teamId: string, keyId: string, privateKeyPem: string): Promise<string> {
  const keyData = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '')
  const keyBuffer = Uint8Array.from(atob(keyData), c => c.charCodeAt(0))
  const key = await crypto.subtle.importKey('pkcs8', keyBuffer.buffer, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const toB64url = (obj: object) => btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const header = toB64url({ alg: 'ES256', kid: keyId })
  const payload = toB64url({ iss: teamId, iat: Math.floor(Date.now() / 1000) })
  const signingInput = `${header}.${payload}`
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(signingInput))
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `${signingInput}.${sigB64}`
}

async function sendPush(token: string, environment: string, jwt: string, title: string, body: string) {
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

// Called by a weekly cron. Requires the DIGEST_SECRET header to match DIGEST_SECRET env var
// so random callers can't trigger mass emails.
Deno.serve(async (req) => {
  const secret = Deno.env.get('DIGEST_SECRET')
  if (secret && req.headers.get('x-digest-secret') !== secret) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const resendKey = Deno.env.get('RESEND_API_KEY')!

  const supabase = createClient(supabaseUrl, serviceKey)

  // Date range: last 7 full days
  const now = new Date()
  const weekAgo = new Date(now)
  weekAgo.setDate(weekAgo.getDate() - 7)
  const weekAgoStr = weekAgo.toISOString().split('T')[0]

  // Get all sessions from the last 7 days, grouped by user
  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('user_id, client, hours, date')
    .gte('date', weekAgoStr)
    .gt('hours', 0)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  if (!sessions || sessions.length === 0) {
    return new Response(JSON.stringify({ sent: 0, message: 'No sessions this week' }))
  }

  // Group sessions by user_id
  const byUser: Record<string, { totalHours: number; clients: Record<string, number> }> = {}
  for (const s of sessions) {
    if (!byUser[s.user_id]) byUser[s.user_id] = { totalHours: 0, clients: {} }
    byUser[s.user_id].totalHours += s.hours
    byUser[s.user_id].clients[s.client] = (byUser[s.user_id].clients[s.client] ?? 0) + s.hours
  }

  // Look up emails for each user from auth.users
  const userIds = Object.keys(byUser)
  const { data: users, error: usersError } = await supabase.auth.admin.listUsers()
  if (usersError) {
    return new Response(JSON.stringify({ error: usersError.message }), { status: 500 })
  }

  const emailMap: Record<string, string> = {}
  for (const u of users.users) {
    if (userIds.includes(u.id) && u.email) emailMap[u.id] = u.email
  }

  // Load device tokens for active users so we can send push alongside email
  const { data: deviceTokens } = await supabase
    .from('device_tokens')
    .select('user_id, token, environment')
    .in('user_id', userIds)

  const tokenMap: Record<string, { token: string; environment: string }[]> = {}
  for (const dt of deviceTokens ?? []) {
    if (!tokenMap[dt.user_id]) tokenMap[dt.user_id] = []
    tokenMap[dt.user_id].push({ token: dt.token, environment: dt.environment })
  }

  // Build APNs JWT once if credentials are available
  const apnsKey = Deno.env.get('APNS_PRIVATE_KEY')
  const apnsKeyId = Deno.env.get('APNS_KEY_ID')
  const apnsTeamId = Deno.env.get('APNS_TEAM_ID')
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
            <td style="padding:8px 0;font-size:14px;color:#111827;text-align:right;border-bottom:1px solid #f3f4f6;font-variant-numeric:tabular-nums;">${hours.toFixed(1)}h</td>
          </tr>`)
        .join('')

      const res = await fetch('https://api.resend.com/emails', {
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

          <!-- Header -->
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

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:40px 40px 32px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
              <p style="margin:0 0 4px;font-size:13px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#9ca3af;">Weekly summary</p>
              <h1 style="margin:0 0 24px;font-size:32px;font-weight:700;color:#111827;letter-spacing:-0.5px;line-height:1.1;">
                ${total.toFixed(1)}<span style="font-size:18px;font-weight:500;color:#6b7280;"> hours this week</span>
              </h1>

              <!-- Client breakdown -->
              <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#374151;">Hours by client</p>
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 28px;">
                ${clientRows}
              </table>

              <!-- CTA -->
              <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 28px;">
                <tr>
                  <td style="background:#1d4ed8;border-radius:8px;">
                    <a href="https://tallytimetracker.com/reports" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.1px;">
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

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:0 0 10px 10px;padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
                You're receiving this weekly summary from Tally.<br>
                <a href="https://tallytimetracker.com/settings" style="color:#9ca3af;">Unsubscribe</a>
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

      if (res.ok) sent++
    }

    // Send push to any device tokens this user has registered
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

  return new Response(JSON.stringify({ sent, pushSent }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
