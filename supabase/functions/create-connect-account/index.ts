import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing authorization header')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) throw new Error('Unauthorized')

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')!
    const body = await req.json()

    // Separate action: just mark the account as onboarded (called after Stripe redirect)
    if (body.action === 'mark_onboarded') {
      await supabaseAdmin
        .from('stripe_connect_accounts')
        .update({ onboarded: true })
        .eq('user_id', user.id)
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { return_url } = body

    // Check if user already has a connect account
    const { data: existing } = await supabaseAdmin
      .from('stripe_connect_accounts')
      .select('stripe_account_id')
      .eq('user_id', user.id)
      .maybeSingle()

    let accountId = existing?.stripe_account_id

    // Create a new Stripe Express account if needed
    if (!accountId) {
      const accountRes = await fetch('https://api.stripe.com/v1/accounts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          type: 'express',
          email: user.email!,
          'capabilities[transfers][requested]': 'true',
          'capabilities[card_payments][requested]': 'true',
        }),
      })

      const account = await accountRes.json()
      if (!accountRes.ok) throw new Error(account.error?.message ?? 'Failed to create Stripe account')

      accountId = account.id

      const { error: insertError } = await supabaseAdmin
        .from('stripe_connect_accounts')
        .insert({ user_id: user.id, stripe_account_id: accountId })

      if (insertError) throw new Error(`Failed to save connect account: ${insertError.message}`)
    }

    // Generate an onboarding link
    const linkRes = await fetch('https://api.stripe.com/v1/account_links', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        account: accountId,
        refresh_url: return_url,
        return_url: return_url,
        type: 'account_onboarding',
      }),
    })

    const link = await linkRes.json()
    if (!linkRes.ok) throw new Error(link.error?.message ?? 'Failed to create account link')

    return new Response(JSON.stringify({ url: link.url }), {
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
