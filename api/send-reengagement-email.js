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

// Vercel cron — runs every Monday at 9am UTC.
// Emails users who tracked time 7–30 days ago but nothing in the last 7 days.
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

  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const { data: activeSessions } = await supabase
    .from('sessions')
    .select('user_id')
    .gte('date', sevenDaysAgo)

  const activeIds = new Set((activeSessions ?? []).map(s => s.user_id))

  const { data: oldSessions } = await supabase
    .from('sessions')
    .select('user_id')
    .gte('date', thirtyDaysAgo)
    .lt('date', sevenDaysAgo)

  if (!oldSessions?.length) return res.json({ sent: 0, message: 'No inactive users' })

  const inactiveIds = [...new Set(oldSessions.map(s => s.user_id))].filter(id => !activeIds.has(id))

  const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers()
  if (usersError) return res.status(500).json({ error: usersError.message })

  const emailMap = {}
  for (const u of users) {
    if (u.email && !u.email.includes('privaterelay.appleid.com')) emailMap[u.id] = u.email
  }

  // Get device tokens for inactive users
  const { data: deviceTokens } = await supabase
    .from('device_tokens')
    .select('user_id, token, environment')
    .in('user_id', inactiveIds)

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
  for (const userId of inactiveIds) {
    const email = emailMap[userId]

    if (email) {
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Tally <noreply@tallytimetracker.com>',
          to: email,
          subject: 'Still tracking time?',
          html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Still tracking time?</title>
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
              <h1 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#111827;line-height:1.3;">It's been a while</h1>
              <p style="margin:0 0 20px;font-size:15px;color:#6b7280;line-height:1.6;">
                You haven't logged any time in Tally recently. We get it — things get busy.
              </p>
              <p style="margin:0 0 28px;font-size:15px;color:#6b7280;line-height:1.6;">
                Your data is still here whenever you're ready.
              </p>
              <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 28px;">
                <tr>
                  <td style="background:#1d4ed8;border-radius:8px;">
                    <a href="https://tallytimetracker.com/track" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">
                      Start tracking →
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
                You're receiving this from Tally because you have an account.<br>
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

      if (emailRes.ok) sent++
    }

    // Push to any registered devices
    if (apnsJwt && tokenMap[userId]) {
      for (const { token, environment } of tokenMap[userId]) {
        const status = await sendPush(
          token, environment, apnsJwt,
          'Still tracking time?',
          'Your data is waiting. Tap to pick up where you left off.'
        )
        if (status === 200) pushSent++
      }
    }
  }

  return res.json({ sent, pushSent, inactive: inactiveIds.length })
}
