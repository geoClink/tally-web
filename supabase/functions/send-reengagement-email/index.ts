import { createClient } from 'jsr:@supabase/supabase-js@2'

// Call weekly via cron. Emails users who haven't logged a session in 7–30 days.
// Requires x-digest-secret header matching DIGEST_SECRET env var.
Deno.serve(async (req) => {
  const secret = Deno.env.get('DIGEST_SECRET')
  if (secret && req.headers.get('x-digest-secret') !== secret) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
  const resendKey = Deno.env.get('RESEND_API_KEY')!

  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  // Find users who had at least one session but nothing in the last 7 days
  const { data: activeSessions } = await supabase
    .from('sessions')
    .select('user_id')
    .gte('date', sevenDaysAgo)

  const activeIds = new Set((activeSessions ?? []).map(s => s.user_id))

  const { data: oldSessions } = await supabase
    .from('sessions')
    .select('user_id')
    .gte('date', thirtyDaysAgo)
    .lt('date', sevenDaysAgo)

  if (!oldSessions?.length) {
    return new Response(JSON.stringify({ sent: 0, message: 'No inactive users found' }))
  }

  const inactiveIds = [...new Set(oldSessions.map(s => s.user_id))].filter(id => !activeIds.has(id))

  const { data: users } = await supabase.auth.admin.listUsers()
  const emailMap: Record<string, string> = {}
  for (const u of users?.users ?? []) {
    if (u.email && !u.email.includes('privaterelay.appleid.com')) {
      emailMap[u.id] = u.email
    }
  }

  let sent = 0
  for (const userId of inactiveIds) {
    const email = emailMap[userId]
    if (!email) continue

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Tally <noreply@tallytimetracker.com>',
        to: email,
        subject: 'Still tracking time?',
        html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Still tracking time?</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f3f4f6;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="540" cellpadding="0" cellspacing="0" role="presentation" style="max-width:540px;width:100%;">

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

          <tr>
            <td style="background:#ffffff;padding:40px 40px 32px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
              <h1 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#111827;line-height:1.3;">
                It's been a while
              </h1>
              <p style="margin:0 0 20px;font-size:15px;color:#6b7280;line-height:1.6;">
                You haven't logged any time in Tally recently. We get it — things get busy.
              </p>
              <p style="margin:0 0 28px;font-size:15px;color:#6b7280;line-height:1.6;">
                Your data is still here whenever you're ready. Tap below to pick up where you left off.
              </p>
              <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 28px;">
                <tr>
                  <td style="background:#1d4ed8;border-radius:8px;">
                    <a href="https://tallytimetracker.com/track" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">
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

          <tr>
            <td style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:0 0 10px 10px;padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
                You're receiving this from Tally because you have an account.<br>
                <a href="https://tallytimetracker.com/settings" style="color:#9ca3af;">Unsubscribe</a>
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

    if (res.ok) sent++
  }

  return new Response(JSON.stringify({ sent, inactive: inactiveIds.length }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
