import Stripe from "npm:stripe@14"
import { createClient } from "npm:@supabase/supabase-js@2"

Deno.serve(async (req) => {
  const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY")
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")
  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

  if (!stripeSecret || !webhookSecret || !supabaseUrl || !serviceRoleKey) {
    return new Response("Missing environment variables", { status: 500 })
  }

  const stripe = new Stripe(stripeSecret, { apiVersion: "2024-06-20" })
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const signature = req.headers.get("stripe-signature")
  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 })
  }

  const body = await req.text()

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
  } catch (err) {
    console.error("Webhook signature verification failed:", err)
    return new Response("Invalid signature", { status: 400 })
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session

    const userId = session.client_reference_id
    const tier = session.metadata?.tier

    if (!userId || !tier || (tier !== "pro" && tier !== "business")) {
      console.error("Missing or invalid userId/tier in session:", { userId, tier })
      return new Response("Missing userId or tier metadata", { status: 400 })
    }

    const expiresAt = tier === "business"
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      : null

    // Delete any existing subscription for this user first, then insert fresh
    await supabase.from("subscriptions").delete().eq("user_id", userId)

    const { error } = await supabase.from("subscriptions").insert({
      user_id: userId,
      tier,
      source: "stripe",
      expires_at: expiresAt,
    })

    if (error) {
      console.error("Supabase insert error:", error)
      return new Response("Database error", { status: 500 })
    }

    console.log(`Activated ${tier} for user ${userId}`)
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  })
})
