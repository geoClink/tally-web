import { Link } from 'react-router-dom'

export default function Help() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Help</h1>
        <p className="page-subtitle">How Tally works and answers to common questions</p>
      </div>

      <div style={{ maxWidth: '720px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        <div className="card">
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Logging time</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
            Go to <strong>Track Time</strong> to log your hours. There are two ways:
          </p>
          <ul style={{ fontSize: '0.875rem', paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <li><strong>Timer</strong> — pick a client, hit Start, then Stop when you're done. The session is saved automatically.</li>
            <li><strong>Manual entry</strong> — enter a start time, end time, and client name to log past work.</li>
          </ul>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
            Free accounts are limited to 5 clients and can only view the last 7 days of history.
          </p>
        </div>

        <div className="card">
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Plans</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem' }}>
            <div>
              <span className="current-tier tier-free" style={{ marginBottom: '0.35rem', display: 'inline-flex' }}>Free</span>
              <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.2rem', marginTop: '0.3rem' }}>
                <li>Up to 5 clients</li>
                <li>Last 7 days of session history</li>
                <li>Dashboard, reports, and activity calendar</li>
              </ul>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
                <span className="current-tier tier-pro" style={{ display: 'inline-flex' }}>Pro — $9.99 one-time</span>
                <Link to="/billing" className="btn btn-primary btn-sm">Upgrade to Pro →</Link>
              </div>
              <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.2rem', marginTop: '0.3rem' }}>
                <li>Unlimited clients</li>
                <li>Full session history</li>
                <li>CSV export from Reports and Sessions</li>
                <li>Per-client hourly rates</li>
              </ul>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
                <span className="current-tier tier-business" style={{ display: 'inline-flex' }}>Business — $4.99/month</span>
                <Link to="/billing" className="btn btn-primary btn-sm">Upgrade to Business →</Link>
              </div>
              <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.2rem', marginTop: '0.3rem' }}>
                <li>Everything in Pro</li>
                <li>Team workspaces — invite members and track their hours</li>
                <li>Invoice generation with tax and memo fields</li>
                <li>Online payment collection via Stripe (connect your account in Billing)</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Invoices</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
            Business accounts can generate invoices from the <strong>Invoices</strong> page. Pick a date range and client — Tally pulls your tracked sessions and builds a line-item invoice automatically.
          </p>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
            You can add a <strong>Tax Rate %</strong> and a <strong>Memo / Notes</strong> field (e.g. payment terms). The preview updates live as you type.
          </p>
          <ul style={{ fontSize: '0.875rem', paddingLeft: '1.25rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.6rem' }}>
            <li><strong>Save Draft</strong> — saves the invoice without sending it.</li>
            <li><strong>Save &amp; Send</strong> — saves and immediately sends to the client's email.</li>
          </ul>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Past invoices appear in the Invoice History section at the bottom of the page.
          </p>
        </div>

        <div className="card">
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Collecting payments online</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
            Business accounts can connect a Stripe account to collect payments directly from clients. Go to <strong>Billing → Payment collection</strong> and click <strong>Connect Stripe account</strong>.
          </p>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
            Once connected, clicking <strong>Save &amp; Send</strong> on an invoice sends a Stripe-powered email to your client with a <strong>Pay Now</strong> button. They pay by card — the money goes directly to your connected bank account. Stripe automatically sends reminders for unpaid invoices.
          </p>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            A small platform fee (1%, minimum $0.50) is deducted per invoice to cover Stripe Connect costs. Standard Stripe card processing fees also apply.
          </p>
        </div>

        <div className="card">
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Client rates</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
            Pro and Business accounts can set a default hourly rate per client on the <strong>Client Rates</strong> page. When you generate an invoice, Tally pre-fills the rate for each client automatically.
          </p>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            You can override the rate for any individual invoice on the invoice form.
          </p>
        </div>

        <div className="card">
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Team workspaces</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
            Business accounts can create workspaces on the <strong>Team</strong> page. Invite members by email — they'll get a notification to accept.
          </p>
          <div className="alert alert-warning" style={{ marginBottom: '0.75rem' }}>
            <strong>Important:</strong> When creating a workspace, the <strong>Client Name</strong> field must exactly match the client name that your team members log time under. The Team Dashboard filters sessions by this name, so a mismatch means hours won't appear.
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            The Track Time page shows workspace client names at the top of the client dropdown as a reminder.
          </p>
        </div>

        <div className="card">
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Goals and dashboard</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
            Set a weekly hour goal in <strong>Settings</strong> to see a progress bar on your dashboard. You can also set per-client goals to track how many hours per week you want to work for each client.
          </p>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            The dashboard resets progress at the start of each week (Monday).
          </p>
        </div>

        <div className="card">
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Daily reminders</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
            Enable daily reminders in <strong>Settings</strong> to get a notification at a time you choose. Useful if you forget to log time at the end of the day.
          </p>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            On iOS and Android, reminders are delivered as push notifications. On the web, they require notification permission in your browser.
          </p>
        </div>

        <div className="card">
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Exporting data</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Pro and Business accounts can export sessions as a CSV file from both the <strong>Reports</strong> and <strong>Sessions</strong> pages. The export includes all sessions matching your current filters — date range, client, etc.
          </p>
        </div>

        <div className="card">
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Upgrading your plan</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
            On the web or iOS: go to <strong>Billing</strong> and select your plan — you'll be taken to a Stripe checkout page and your plan activates automatically after payment.
          </p>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
            On Android: purchase through Google Play from the <strong>Billing</strong> page in the app.
          </p>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            If your plan doesn't update right away, try refreshing the page.
          </p>
        </div>

        <div className="card">
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Common questions</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.875rem' }}>
            <div>
              <p style={{ fontWeight: 500, marginBottom: '0.2rem' }}>How does payment collection work?</p>
              <p style={{ color: 'var(--text-muted)' }}>Connect your Stripe account in Billing. Then create an invoice and click Save &amp; Send — your client gets an email with a Pay Now link and pays by card. The money goes straight to your bank account minus Stripe's card fee and a 1% platform fee.</p>
            </div>
            <div>
              <p style={{ fontWeight: 500, marginBottom: '0.2rem' }}>My team hours aren't showing up on the Team Dashboard.</p>
              <p style={{ color: 'var(--text-muted)' }}>Check that the workspace's Client Name exactly matches what your members log time under — including capitalization and spacing. This is the most common cause.</p>
            </div>
            <div>
              <p style={{ fontWeight: 500, marginBottom: '0.2rem' }}>I upgraded but still see the Free tier.</p>
              <p style={{ color: 'var(--text-muted)' }}>Refresh the page. If it still shows Free, try signing out and back in. If the issue persists, report a bug from the Settings page.</p>
            </div>
            <div>
              <p style={{ fontWeight: 500, marginBottom: '0.2rem' }}>Can I use Tally on my phone?</p>
              <p style={{ color: 'var(--text-muted)' }}>Yes — native apps are available for iOS and Android. The web app is also mobile-responsive and works in any browser.</p>
            </div>
            <div>
              <p style={{ fontWeight: 500, marginBottom: '0.2rem' }}>How do I delete a session?</p>
              <p style={{ color: 'var(--text-muted)' }}>Go to <strong>Sessions</strong> — each session has a delete button on the right.</p>
            </div>
            <div>
              <p style={{ fontWeight: 500, marginBottom: '0.2rem' }}>How do I delete my account?</p>
              <p style={{ color: 'var(--text-muted)' }}>Go to <strong>Settings → Delete Account</strong>. This permanently removes all your data. If you have an active Business subscription, cancel it first through Stripe or the App Store to avoid future charges.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
