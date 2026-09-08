import "@supabase/functions-js/edge-runtime.d.ts"

const ADMIN_EMAILS = ['1lclink2@att.net', 'georgeclinkscalesdev@proton.me']
const BUNDLE_ID = 'name.GeorgeClinkscales.Tally'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── APNs ──────────────────────────────────────────────────────────────────────

async function buildApnsJwt(teamId: string, keyId: string, privateKeyPem: string): Promise<string> {
  const keyData = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '')
  const keyBuffer = Uint8Array.from(atob(keyData), (c) => c.charCodeAt(0))
  const key = await crypto.subtle.importKey(
    'pkcs8', keyBuffer.buffer,
    { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']
  )
  const toB64url = (obj: object) =>
    btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
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

// ── FCM (Android) ─────────────────────────────────────────────────────────────

async function buildFcmAccessToken(serviceAccountJson: string): Promise<{ token: string; projectId: string }> {
  const sa = JSON.parse(serviceAccountJson)
  const now = Math.floor(Date.now() / 1000)

  // Build JWT for Google OAuth2
  const toB64url = (obj: object) =>
    btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const header = toB64url({ alg: 'RS256', typ: 'JWT' })
  const jwtPayload = toB64url({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })
  const signingInput = `${header}.${jwtPayload}`

  // Import RS256 private key
  const keyData = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '')
  const keyBuffer = Uint8Array.from(atob(keyData), (c) => c.charCodeAt(0))
  const key = await crypto.subtle.importKey(
    'pkcs8', keyBuffer.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput))
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const jwt = `${signingInput}.${sigB64}`

  // Exchange for access token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  })
  const tokenData = await tokenRes.json()
  return { token: tokenData.access_token, projectId: sa.project_id }
}

async function sendFcm(deviceToken: string, accessToken: string, projectId: string, title: string, body: string): Promise<number> {
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        token: deviceToken,
        notification: { title, body },
        android: { priority: 'high' },
      },
    }),
  })
  return res.status
}

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Verify caller is admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })

    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: authHeader, apikey: supabaseAnonKey },
    })
    if (!userRes.ok) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    const userData = await userRes.json()
    if (!ADMIN_EMAILS.includes(userData.email ?? '')) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders })
    }

    const { title, body, target = 'all' } = await req.json()
    if (!title || !body) {
      return new Response(JSON.stringify({ error: 'title and body are required' }), { status: 400, headers: corsHeaders })
    }

    // Fetch all targeted tokens (now includes platform column)
    const tokensRes = await fetch(`${supabaseUrl}/rest/v1/rpc/get_targeted_device_tokens`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${supabaseServiceKey}`,
        apikey: supabaseServiceKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ target }),
    })
    if (!tokensRes.ok) throw new Error(`Failed to fetch tokens: ${await tokensRes.text()}`)
    const tokens: { token: string; environment: string; platform: string }[] = await tokensRes.json()

    // Build APNs JWT (for iOS tokens)
    const apnsKey = Deno.env.get('APNS_PRIVATE_KEY')
    const apnsKeyId = Deno.env.get('APNS_KEY_ID')
    const apnsTeamId = Deno.env.get('APNS_TEAM_ID')
    const apnsJwt = (apnsKey && apnsKeyId && apnsTeamId)
      ? await buildApnsJwt(apnsTeamId, apnsKeyId, apnsKey)
      : null

    // Build FCM access token (for Android tokens)
    const fcmServiceAccount = Deno.env.get('FCM_SERVICE_ACCOUNT_JSON')
    const fcmAuth = fcmServiceAccount ? await buildFcmAccessToken(fcmServiceAccount) : null

    let sent = 0, failed = 0
    const staleTokens: string[] = []

    for (const { token, environment, platform } of tokens) {
      let status: number

      if (platform === 'android') {
        if (!fcmAuth) { failed++; continue }
        status = await sendFcm(token, fcmAuth.token, fcmAuth.projectId, title, body)
        if (status === 200) sent++
        else failed++
      } else {
        if (!apnsJwt) { failed++; continue }
        status = await sendApns(token, environment, apnsJwt, title, body)
        if (status === 200) sent++
        else {
          failed++
          if (status === 410) staleTokens.push(token)
        }
      }
    }

    // Remove stale iOS tokens
    if (staleTokens.length > 0) {
      const inList = staleTokens.map(t => `"${t}"`).join(',')
      await fetch(`${supabaseUrl}/rest/v1/device_tokens?token=in.(${inList})`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${supabaseServiceKey}`, apikey: supabaseServiceKey },
      })
    }

    return new Response(
      JSON.stringify({ sent, failed, total: tokens.length, removedStale: staleTokens.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : JSON.stringify(err)
    console.error('send-push-notification error:', message)
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
