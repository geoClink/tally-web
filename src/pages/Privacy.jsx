import { Link } from 'react-router-dom'

export default function Privacy() {
  return (
    <div className="privacy-page">
      <div className="privacy-content">
        <Link to="/" className="privacy-back">← Back</Link>
        <h1>Privacy Policy</h1>
        <p className="privacy-date">Last updated: July 2026</p>

        <h2>What we collect</h2>
        <p>We collect your email address (for authentication) and the time tracking data you enter — client names, session dates, hours logged, and optional notes. Nothing else.</p>

        <h2>How we use it</h2>
        <p>Solely to provide the Tally service. Your data syncs your sessions across iOS, Apple Watch, Mac, and the web dashboard. We do not sell, share, or use your data for advertising.</p>

        <h2>Third-party services</h2>
        <ul>
          <li><strong>Supabase</strong> — database and authentication</li>
          <li><strong>Stripe</strong> — payment processing for Pro and Business plans</li>
          <li><strong>Vercel</strong> — web app hosting</li>
          <li><strong>Apple App Store</strong> — iOS app distribution and in-app purchases via StoreKit</li>
        </ul>

        <h2>Data deletion</h2>
        <p>You can delete your account and all associated data at any time from the <strong>Settings</strong> page inside the app. Deletion removes your sessions, client rates, configuration, and workspace data immediately.</p>

        <h2>Security</h2>
        <p>All data is stored in Supabase with row-level security enabled — each user can only access their own records. Connections are encrypted in transit via HTTPS.</p>

        <h2>Contact</h2>
        <p>Questions about this policy? Reach out via the <a href="https://apps.apple.com/us/app/tally-time-tracker/id6775275483" target="_blank" rel="noopener noreferrer">App Store support page</a>.</p>
      </div>
    </div>
  )
}
