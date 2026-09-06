import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "@supabase/supabase-js"

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
    // Verify the caller is an admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !user || !ADMIN_EMAILS.includes(user.email ?? '')) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders })
    }

    // Parse request body
    const { title, body } = await req.json()
    if (!title || !body) {
      return new Response(
        JSON.stringify({ error: 'title and body are required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Get APNs credentials from secrets
    const apnsKey = Deno.env.get('APNS_PRIVATE_KEY')
    const apnsKeyId = Deno.env.get('APNS_KEY_ID')
    const apnsTeamId = Deno.env.get('APNS_TEAM_ID')
    if (!apnsKey || !apnsKeyId || !apnsTeamId) {
      throw new Error('APNs secrets not configured. Set APNS_PRIVATE_KEY, APNS_KEY_ID, APNS_TEAM_ID in Supabase secrets.')
    }

    const jwt = await buildApnsJwt(apnsTeamId, apnsKeyId, apnsKey)

    // Fetch all device tokens using service role (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const { data: tokens, error: tokensError } = await supabaseAdmin
      .from('device_tokens')
      .select('token')
    if (tokensError) throw tokensError

    const apnsPayload = JSON.stringify({
      aps: { alert: { title, body }, sound: 'default' },
    })

    let sent = 0
    let failed = 0
    const staleTokens: string[] = []

    for (const { token } of tokens ?? []) {
      const res = await fetch(`${APNS_HOST}/3/device/${token}`, {
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
        // 410 = device token is no longer active — remove it
        if (res.status === 410) {
          staleTokens.push(token)
        }
      }
    }

    // Clean up stale tokens
    if (staleTokens.length > 0) {
      await supabaseAdmin
        .from('device_tokens')
        .delete()
        .in('token', staleTokens)
    }

    return new Response(
      JSON.stringify({ sent, failed, total: tokens?.length ?? 0, removedStale: staleTokens.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
