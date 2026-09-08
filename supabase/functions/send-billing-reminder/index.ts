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

async function sendApns(token: string, environment: string, jwt: string, title: string, body: string): Promise<number> {
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

async function buildFcmAccessToken(serviceAccountJson: string): Promise<{ token: string; projectId: string }> {
  const sa = JSON.parse(serviceAccountJson)
  const now = Math.floor(Date.now() / 1000)
  const toB64url = (obj: object) => btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const header = toB64url({ alg: 'RS256', typ: 'JWT' })
  const jwtPayload = toB64url({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })
  const signingInput = `${header}.${jwtPayload}`
  const keyData = sa.private_key.replace(/-----BEGIN PRIVATE KEY-----/g, '').replace(/-----END PRIVATE KEY-----/g, '').replace(/\s/g, '')
  const keyBuffer = Uint8Array.from(atob(keyData), c => c.charCodeAt(0))
  const key = await crypto.subtle.importKey('pkcs8', keyBuffer.buffer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput))
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${signingInput}.${sigB64}`,
  })
  const tokenData = await tokenRes.json()
  return { token: tokenData.access_token, projectId: sa.project_id }
}

async function sendFcm(deviceToken: string, accessToken: string, projectId: string, title: string, body: string): Promise<number> {
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: { token: deviceToken, notification: { title, body }, android: { priority: 'high' } } }),
  })
  return res.status
}

// Runs daily via cron. Finds users whose billing cycle starts today and sends
// a push reminding them to send an invoice.
Deno.serve(async (req) => {
  const secret = Deno.env.get('DIGEST_SECRET')
  if (secret && req.headers.get('x-digest-secret') !== secret) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const now = new Date()
  const todayDayOfMonth = now.getUTCDate()  // 1–31
  const todayWeekday = now.getUTCDay()      // 0=Sun … 6=Sat

  // Find client rates where today matches the billing cycle start
  const { data: rates } = await supabase
    .from('client_rates')
    .select('user_id, client, billing_cycle, billing_start_day, billing_weekday')

  if (!rates?.length) {
    return new Response(JSON.stringify({ sent: 0, message: 'No client rates found' }))
  }

  // Group clients whose cycle starts today by user_id
  const userClientMap: Record<string, string[]> = {}
  for (const rate of rates) {
    const isMonthly = rate.billing_cycle === 'monthly' && rate.billing_start_day === todayDayOfMonth
    const isWeekly = rate.billing_cycle === 'weekly' && rate.billing_weekday === todayWeekday
    if (isMonthly || isWeekly) {
      if (!userClientMap[rate.user_id]) userClientMap[rate.user_id] = []
      userClientMap[rate.user_id].push(rate.client)
    }
  }

  const userIds = Object.keys(userClientMap)
  if (!userIds.length) {
    return new Response(JSON.stringify({ sent: 0, message: 'No billing cycles start today' }))
  }

  // Load device tokens for those users
  const { data: deviceTokens } = await supabase
    .from('device_tokens')
    .select('user_id, token, environment, platform')
    .in('user_id', userIds)

  const tokenMap: Record<string, { token: string; environment: string; platform: string }[]> = {}
  for (const dt of deviceTokens ?? []) {
    if (!tokenMap[dt.user_id]) tokenMap[dt.user_id] = []
    tokenMap[dt.user_id].push({ token: dt.token, environment: dt.environment, platform: dt.platform ?? 'ios' })
  }

  // Build push credentials
  const apnsKey = Deno.env.get('APNS_PRIVATE_KEY')
  const apnsKeyId = Deno.env.get('APNS_KEY_ID')
  const apnsTeamId = Deno.env.get('APNS_TEAM_ID')
  const apnsJwt = (apnsKey && apnsKeyId && apnsTeamId)
    ? await buildApnsJwt(apnsTeamId, apnsKeyId, apnsKey)
    : null

  const fcmServiceAccount = Deno.env.get('FCM_SERVICE_ACCOUNT_JSON')
  const fcmAuth = fcmServiceAccount ? await buildFcmAccessToken(fcmServiceAccount) : null

  let sent = 0
  for (const userId of userIds) {
    const clients = userClientMap[userId]
    const clientLabel = clients.length === 1
      ? clients[0]
      : `${clients.slice(0, -1).join(', ')} and ${clients[clients.length - 1]}`

    const title = 'New billing period started'
    const body = `Time to invoice ${clientLabel}.`

    for (const { token, environment, platform } of tokenMap[userId] ?? []) {
      let status = 0
      if (platform === 'android' && fcmAuth) {
        status = await sendFcm(token, fcmAuth.token, fcmAuth.projectId, title, body)
      } else if (apnsJwt) {
        status = await sendApns(token, environment, apnsJwt, title, body)
      }
      if (status === 200) sent++
    }
  }

  return new Response(JSON.stringify({ sent, usersNotified: userIds.length }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
