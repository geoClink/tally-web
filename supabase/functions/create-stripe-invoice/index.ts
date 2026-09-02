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

    // Get user's connected Stripe account
    const { data: connectAccount } = await supabaseAdmin
      .from('stripe_connect_accounts')
      .select('stripe_account_id, onboarded')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!connectAccount?.stripe_account_id || !connectAccount?.onboarded) {
      throw new Error('Stripe account not connected. Please connect your Stripe account first.')
    }

    const stripeAccountId = connectAccount.stripe_account_id
    const { clientEmail, clientName, lineItems } = await req.json()

    if (!clientEmail || !clientName || !lineItems?.length) {
      throw new Error('clientEmail, clientName, and lineItems are required')
    }

    // Find or create a Stripe customer on the connected account
    const searchRes = await fetch(
      `https://api.stripe.com/v1/customers/search?query=email:"${encodeURIComponent(clientEmail)}"`,
      {
        headers: {
          'Authorization': `Bearer ${stripeKey}`,
          'Stripe-Account': stripeAccountId,
        },
      }
    )
    const searchData = await searchRes.json()
    let customerId = searchData.data?.[0]?.id

    if (!customerId) {
      const customerRes = await fetch('https://api.stripe.com/v1/customers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeKey}`,
          'Stripe-Account': stripeAccountId,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ email: clientEmail, name: clientName }),
      })
      const customer = await customerRes.json()
      if (!customerRes.ok) throw new Error(customer.error?.message ?? 'Failed to create customer')
      customerId = customer.id
    }

    // Calculate total in cents to determine the platform fee (0.5%)
    const totalCents = lineItems.reduce((sum: number, item: { hours: number; rate: number }) =>
      sum + Math.round(item.hours * item.rate * 100), 0)
    const applicationFeeCents = Math.max(50, Math.round(totalCents * 0.005)) // 0.5%, minimum $0.50

    // Create the invoice
    const invoiceRes = await fetch('https://api.stripe.com/v1/invoices', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Stripe-Account': stripeAccountId,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        customer: customerId,
        collection_method: 'send_invoice',
        days_until_due: '14',
        'application_fee_amount': String(applicationFeeCents),
      }),
    })
    const invoice = await invoiceRes.json()
    if (!invoiceRes.ok) throw new Error(invoice.error?.message ?? 'Failed to create invoice')

    // Add line items
    for (const item of lineItems) {
      const amountCents = Math.round(item.hours * item.rate * 100)
      await fetch('https://api.stripe.com/v1/invoiceitems', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeKey}`,
          'Stripe-Account': stripeAccountId,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          customer: customerId,
          invoice: invoice.id,
          description: item.description,
          amount: String(amountCents),
          currency: 'usd',
        }),
      })
    }

    // Finalize and send the invoice
    const finalizeRes = await fetch(`https://api.stripe.com/v1/invoices/${invoice.id}/finalize`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Stripe-Account': stripeAccountId,
      },
    })
    const finalized = await finalizeRes.json()
    if (!finalizeRes.ok) throw new Error(finalized.error?.message ?? 'Failed to finalize invoice')

    await fetch(`https://api.stripe.com/v1/invoices/${invoice.id}/send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Stripe-Account': stripeAccountId,
      },
    })

    return new Response(JSON.stringify({
      invoiceId: finalized.id,
      invoiceUrl: finalized.hosted_invoice_url,
      amountDue: finalized.amount_due,
    }), {
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
