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
        from: 'Tally <noreply@georgeclinkscalesdev.com>',
        to: invitedEmail,
        subject: `You've been invited to ${workspaceName} on Tally`,
        html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You've been invited to ${workspaceName} on Tally</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f3f4f6;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="540" cellpadding="0" cellspacing="0" role="presentation" style="max-width:540px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#1d4ed8;border-radius:10px 10px 0 0;padding:28px 40px;text-align:center;">
              <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">Tally</span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:40px 40px 32px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
              <h1 style="margin:0 0 12px;font-size:20px;font-weight:600;color:#111827;line-height:1.3;">
                You've been invited to join ${workspaceName}
              </h1>
              <p style="margin:0 0 20px;font-size:15px;color:#6b7280;line-height:1.6;">
                <strong style="color:#111827;">${inviterEmail}</strong> has invited you to join the <strong style="color:#111827;">${workspaceName}</strong> workspace on Tally.
              </p>
              <p style="margin:0 0 20px;font-size:15px;color:#6b7280;line-height:1.6;">
                Tally is a time tracking app available on the web and on iPhone. Use whichever works best for you — your data syncs across both.
              </p>
              <p style="margin:0 0 28px;font-size:15px;color:#6b7280;line-height:1.6;">
                Click the button below to create your account at <a href="https://tallytimetracker.com" style="color:#1d4ed8;">tallytimetracker.com</a>. Make sure to sign up using the email address this was sent to so the invite links correctly.
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 32px;">
                <tr>
                  <td style="background:#1d4ed8;border-radius:8px;">
                    <a href="https://tallytimetracker.com" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.1px;">
                      Accept Invitation →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 16px;font-size:13px;color:#9ca3af;line-height:1.6;">
                Or open this link in your browser:<br>
                <a href="https://tallytimetracker.com" style="color:#6b7280;text-decoration:underline;">https://tallytimetracker.com</a>
              </p>
              <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
                Also available on iPhone:&nbsp;
                <a href="https://apps.apple.com/us/app/tally-time-tracker/id6775275483" style="color:#6b7280;text-decoration:underline;">Download on the App Store</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:0 0 10px 10px;padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
                You received this because ${inviterEmail} invited you to Tally.<br>
                If you weren't expecting this, you can safely ignore it.
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

    const data = await res.json()
    console.log('Resend response status:', res.status)
    console.log('Resend response body:', JSON.stringify(data))
    if (!res.ok) throw new Error(JSON.stringify(data))

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
