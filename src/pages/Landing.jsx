import { Navigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './Landing.css'

const APP_STORE_URL = 'https://apps.apple.com/us/app/tally-time-tracker/id6775275483'

const screenshots = [
  { src: '/images/tallyios/tallyiostimerview.webp', alt: 'Tally iOS timer view', caption: 'Timer — one-tap tracking with client and project tagging.' },
  { src: '/images/tallyios/tallyioscalendar.webp', alt: 'Tally iOS calendar view', caption: 'Calendar — visual day and week breakdown of logged sessions.' },
  { src: '/images/tallyios/tallyiosreportview.webp', alt: 'Tally iOS report view', caption: 'Reports — earnings summary by client with CSV export.' },
  { src: '/images/tallyios/tallyiosaccountview.webp', alt: 'Tally iOS account view', caption: 'Account — subscription status and cross-platform sync.' },
  { src: '/images/tallyios/tallyiosworkspacesubscriptionpage.webp', alt: 'Tally iOS workspace page', caption: 'Workspace — Business tier team management.' },
]

const features = [
  { title: 'Live Activity & Dynamic Island', body: 'Your running timer stays on the lock screen and Dynamic Island the entire time — no need to open the app.' },
  { title: 'Widgets & Siri', body: 'Small and medium home screen widgets show your active session. Start and stop timers by voice via App Intents and Siri Shortcuts.' },
  { title: 'Apple Watch', body: 'Full watchOS companion app synced via WatchConnectivity. Log sessions and check your weekly progress from your wrist.' },
  { title: 'Focus Mode', body: 'A custom App Intent filter lets Tally activate automatically when your Work focus turns on.' },
  { title: 'Reports & export', body: 'Swift Charts visualize hours by client across weekly and all-time views. Pro includes CSV export for invoicing.' },
  { title: 'Team workspaces', body: 'Invite members, assign clients, and roll up hours across your whole team. Business tier adds Stripe invoicing.' },
]

const tiers = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    features: ['Up to 3 clients', '7-day session history', 'iOS, Watch, Mac & Web'],
    cta: 'Sign up free',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '$9.99',
    period: 'one-time',
    features: ['Unlimited clients', 'Full session history', 'CSV export', 'All Free features'],
    cta: 'Get Pro',
    highlight: true,
  },
  {
    name: 'Business',
    price: '$4.99',
    period: 'per month',
    features: ['Team workspaces', 'Stripe invoicing', '7-day free trial', 'All Pro features'],
    cta: 'Start free trial',
    highlight: false,
  },
]

export default function Landing() {
  const { user, loading } = useAuth()

  if (!loading && user) return <Navigate to="/dashboard" replace />

  return (
    <div className="landing">
      <nav className="landing-nav">
        <span className="landing-logo">Tally</span>
        <Link to="/login" className="landing-nav-signin">Sign in →</Link>
      </nav>

      <section className="landing-hero">
        <h1 className="landing-headline">Track every hour.<br />Get paid for all of it.</h1>
        <p className="landing-subhead">
          A time tracker for freelancers and small teams — native iOS, Apple Watch, Mac,
          and a web dashboard on one shared backend.
        </p>
        <div className="landing-hero-ctas">
          <Link to="/login" className="landing-btn-primary">Sign up free →</Link>
          <a href={APP_STORE_URL} className="landing-btn-secondary" target="_blank" rel="noopener noreferrer">
            Download on App Store
          </a>
        </div>
        <p className="landing-hero-note">Free to start · No credit card required · Live on App Store</p>
      </section>

      <section className="landing-demo">
        <h2 className="landing-section-title">See it in action</h2>
        <p className="landing-demo-sub">No sign-up required — try the full web dashboard.</p>
        <a href="/demo" target="_blank" rel="noopener noreferrer" className="landing-browser-mockup landing-browser-mockup--link">
          <div className="landing-browser-bar">
            <div className="landing-browser-dots">
              <span /><span /><span />
            </div>
            <div className="landing-browser-url">tally-web-nu.vercel.app/demo</div>
          </div>
          <div className="landing-demo-preview">
            <img
              src="/images/demo-screenshot.png"
              alt="Tally web dashboard"
              className="landing-demo-screenshot"
              loading="lazy"
            />
            <div className="landing-demo-overlay">
              <span className="landing-demo-cta">Try live demo →</span>
            </div>
          </div>
        </a>
      </section>

      <section className="landing-screenshots">
        <div className="landing-screenshots-header">
          <span className="landing-platform-badge">iOS · watchOS · macOS · Web</span>
          <h2 className="landing-section-title">Native on every Apple device</h2>
          <p className="landing-screenshots-sub">iPhone, Apple Watch, iPad, and Mac Catalyst — plus a full web dashboard. One Supabase backend, everything in sync.</p>
        </div>
        <div className="landing-scroll-track">
          {screenshots.map((s) => (
            <div key={s.src} className="landing-scroll-item">
              <div className="landing-phone-mockup">
                <div className="landing-phone-btns-left" />
                <div className="landing-phone-screen-static">
                  <img src={s.src} alt={s.alt} loading="lazy" />
                </div>
              </div>
              <p>{s.caption}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-features">
        {features.map((f) => (
          <div key={f.title} className="landing-feature-card">
            <h3>{f.title}</h3>
            <p>{f.body}</p>
          </div>
        ))}
      </section>

      <section className="landing-pricing">
        <h2 className="landing-section-title">Pricing</h2>
        <p className="landing-pricing-sub">No subscriptions for solo users. Pay once, own it forever.</p>
        <div className="landing-pricing-grid">
          {tiers.map((t) => (
            <div key={t.name} className={`landing-tier${t.highlight ? ' landing-tier--highlight' : ''}`}>
              <div className="landing-tier-name">{t.name}</div>
              <div className="landing-tier-price">
                {t.price} <span className="landing-tier-period">{t.period}</span>
              </div>
              <ul className="landing-tier-features">
                {t.features.map((f) => <li key={f}>{f}</li>)}
              </ul>
              <Link to="/login" className={t.highlight ? 'landing-btn-primary' : 'landing-btn-outline'}>
                {t.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer">Download on App Store</a>
          <Link to="/login">Sign in</Link>
        </div>
      </footer>
    </div>
  )
}
