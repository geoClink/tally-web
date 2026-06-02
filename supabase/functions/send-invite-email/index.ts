import "@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { invitedEmail, workspaceName, inviterEmail } = await req.json()

    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) throw new Error('RESEND_API_KEY not set')

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Tally <onboarding@resend.dev>',
        to: invitedEmail,
        subject: `You've been invited to ${workspaceName} on Tally`,
        html: `
          <p>Hi,</p>
          <p><strong>${inviterEmail}</strong> has invited you to join the <strong>${workspaceName}</strong> workspace on Tally.</p>
          <p>To accept the invite, sign up or sign in at:</p>
          <p><a href="https://tally-web-nu.vercel.app">https://tally-web-nu.vercel.app</a></p>
          <p>Use the email address this was sent to when creating your account.</p>
          <br>
          <p>— The Tally Team</p>
        `,
      }),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.message ?? 'Failed to send email')

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
