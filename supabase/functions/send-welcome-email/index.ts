const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify webhook secret when called from a Supabase database webhook
    const webhookSecret = Deno.env.get('WEBHOOK_SECRET')
    if (webhookSecret) {
      const authHeader = req.headers.get('authorization') ?? ''
      if (authHeader !== `Bearer ${webhookSecret}`) {
        return new Response('Unauthorized', { status: 401 })
      }
    }

    const body = await req.json()

    // Database webhook format: { type: 'INSERT', record: { email, ... } }
    // Direct call format: { email }
    const email = body.record?.email ?? body.email
    if (!email) throw new Error('email is required')

    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) throw new Error('RESEND_API_KEY not set')

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Tally <noreply@tallytimetracker.com>',
        to: email,
        subject: 'Welcome to Tally',
        html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Tally</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f3f4f6;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="540" cellpadding="0" cellspacing="0" role="presentation" style="max-width:540px;width:100%;">

          <!-- Header -->
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

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:40px 40px 32px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
              <h1 style="margin:0 0 12px;font-size:20px;font-weight:600;color:#111827;line-height:1.3;">
                You're all set.
              </h1>
              <p style="margin:0 0 20px;font-size:15px;color:#6b7280;line-height:1.6;">
                Thanks for signing up for Tally. You can start tracking time right now — just head to the Track page, pick a client, and start the timer.
              </p>
              <p style="margin:0 0 28px;font-size:15px;color:#6b7280;line-height:1.6;">
                A few things to know on day one:
              </p>

              <!-- Tips list -->
              <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 28px;width:100%;">
                <tr>
                  <td style="padding:0 0 14px;">
                    <table cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td style="vertical-align:top;padding-right:12px;font-size:16px;">⏱</td>
                        <td>
                          <p style="margin:0;font-size:14px;color:#111827;font-weight:600;line-height:1.4;">Track time, get paid accurately</p>
                          <p style="margin:4px 0 0;font-size:13px;color:#6b7280;line-height:1.5;">Use the timer on the Track page during a session, or log time manually after the fact.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 0 14px;">
                    <table cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td style="vertical-align:top;padding-right:12px;font-size:16px;">📊</td>
                        <td>
                          <p style="margin:0;font-size:14px;color:#111827;font-weight:600;line-height:1.4;">See your hours at a glance</p>
                          <p style="margin:4px 0 0;font-size:13px;color:#6b7280;line-height:1.5;">The Dashboard shows today, this week, and per-client progress toward your goals.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td>
                    <table cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td style="vertical-align:top;padding-right:12px;font-size:16px;">📱</td>
                        <td>
                          <p style="margin:0;font-size:14px;color:#111827;font-weight:600;line-height:1.4;">Also on iPhone</p>
                          <p style="margin:4px 0 0;font-size:13px;color:#6b7280;line-height:1.5;">The iOS app syncs with this account automatically. Same data, wherever you are.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 32px;">
                <tr>
                  <td style="background:#1d4ed8;border-radius:8px;">
                    <a href="https://tallytimetracker.com/track" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.1px;">
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

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:0 0 10px 10px;padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
                You're receiving this because you just created a Tally account.<br>
                Questions? Reply to this email.
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
