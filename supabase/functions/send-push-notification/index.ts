import "@supabase/functions-js/edge-runtime.d.ts"

const ADMIN_EMAILS = ['1lclink2@att.net', 'georgeclinkscalesdev@proton.me']
const BUNDLE_ID = 'name.GeorgeClinkscales.Tally'
const APNS_HOST = 'https://api.push.apple.com'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function buildApnsJwt(teamId: string, keyId: string, privateKeyPem: string): Promise<string> {
  const keyData = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '')

  const keyBuffer = Uint8Array.from(atob(keyData), (c) => c.charCodeAt(0))
  const key = await crypto.subtle.importKey(
    'pkcs8',
    keyBuffer.buffer,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  )

  const toB64url = (obj: object) =>
    btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

  const header = toB64url({ alg: 'ES256', kid: keyId })
  const payload = toB64url({ iss: teamId, iat: Math.floor(Date.now() / 1000) })
  const signingInput = `${header}.${payload}`

  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(signingInput)
  )

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

  return `${signingInput}.${sigB64}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Verify caller is admin via Supabase auth REST API
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: authHeader, apikey: supabaseAnonKey },
    })
    if (!userRes.ok) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }
    const userData = await userRes.json()
    if (!ADMIN_EMAILS.includes(userData.email ?? '')) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders })
    }

    // Parse request body
    const { title, body } = await req.json()
    if (!title || !body) {
      return new Response(JSON.stringify({ error: 'title and body are required' }), { status: 400, headers: corsHeaders })
    }

    // Get APNs credentials
    const apnsKey = Deno.env.get('APNS_PRIVATE_KEY')
    const apnsKeyId = Deno.env.get('APNS_KEY_ID')
    const apnsTeamId = Deno.env.get('APNS_TEAM_ID')
    if (!apnsKey || !apnsKeyId || !apnsTeamId) {
      throw new Error('APNs secrets not configured')
    }

    console.log('Building APNs JWT...')
    const jwt = await buildApnsJwt(apnsTeamId, apnsKeyId, apnsKey)
    console.log('JWT built successfully')

    // Fetch all device tokens via REST API with service role
    console.log('Fetching device tokens...')
    const tokensRes = await fetch(`${supabaseUrl}/rest/v1/device_tokens?select=token,environment`, {
      headers: {
        Authorization: `Bearer ${supabaseServiceKey}`,
        apikey: supabaseServiceKey,
      },
    })
    if (!tokensRes.ok) throw new Error(`Failed to fetch tokens: ${await tokensRes.text()}`)
    const tokens: { token: string; environment: string }[] = await tokensRes.json()

    const apnsPayload = JSON.stringify({
      aps: { alert: { title, body }, sound: 'default' },
    })

    let sent = 0
    let failed = 0
    const staleTokens: string[] = []

    for (const { token, environment } of tokens) {
      const host = environment === 'sandbox'
        ? 'https://api.sandbox.push.apple.com'
        : APNS_HOST
      const res = await fetch(`${host}/3/device/${token}`, {
        method: 'POST',
        headers: {
          authorization: `bearer ${jwt}`,
          'apns-topic': BUNDLE_ID,
          'apns-push-type': 'alert',
          'apns-priority': '10',
          'content-type': 'application/json',
        },
        body: apnsPayload,
      })

      if (res.status === 200) {
        sent++
      } else {
        failed++
        if (res.status === 410) staleTokens.push(token)
      }
    }

    // Remove stale tokens
    if (staleTokens.length > 0) {
      const inList = staleTokens.map(t => `"${t}"`).join(',')
      await fetch(`${supabaseUrl}/rest/v1/device_tokens?token=in.(${inList})`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          apikey: supabaseServiceKey,
        },
      })
    }

    return new Response(
      JSON.stringify({ sent, failed, total: tokens.length, removedStale: staleTokens.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : JSON.stringify(err)
    console.error('send-push-notification error:', message)
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
