import { useState } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import BugReportModal from '../components/BugReportModal'
import './Landing.css'

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)

const APP_STORE_URL = 'https://apps.apple.com/us/app/tally-time-tracker/id6775275483'

const productSlides = [
  { src: '/images/tallyios/iphone-frame-1.webp', alt: 'Start tracking in one tap — simple timer running in the background so you never lose a billable minute' },
  { src: '/images/tallyios/iphone-frame-25.webp', alt: 'See where your time goes — weekly and all-time breakdowns by client at a glance' },
  { src: '/images/tallyios/iphone-frame-26.webp', alt: 'Never lose a day — every day you log time gets a dot, watch your consistency grow month by month' },
  { src: '/images/tallyios/iphone-frame-27.webp', alt: 'Track your whole team — see everyone\'s hours, weekly goals, and team totals all in one place' },
  { src: '/images/tallyios/iphone-frame-28.webp', alt: 'Know what you\'ve earned — hours and earnings per client tracked automatically as you work' },
  { src: '/images/tallyios/iphone-frame-29.webp', alt: 'Send invoices from your phone — generate a PDF invoice and collect payment in seconds' },
  { src: '/images/tallyios/iphone-frame-30.webp', alt: 'Always on your home screen — check your hours and weekly goal without ever opening the app' },
  { src: '/images/tallyios/iphone-frame-31.webp', alt: 'Track from your lock screen — Live Activity shows your timer running, no need to open the app' },
  { src: '/images/tallyios/iphone-frame-32.webp', alt: 'Customize your experience — set time rounding, notifications, currency, and more' },
]


const features = [
  { title: 'Live Activity & Dynamic Island', body: 'Your running timer stays on the lock screen and Dynamic Island the entire time — no need to open the app.' },
  { title: 'Widgets & Siri', body: 'Small and medium home screen widgets show your active session. Start and stop timers by voice via App Intents and Siri Shortcuts.' },
  { title: 'Apple Watch', body: 'Full watchOS companion app synced via WatchConnectivity. Log sessions and check your weekly progress from your wrist.' },
  { title: 'Focus Mode', body: 'A custom App Intent filter lets Tally activate automatically when your Work focus turns on.' },
  { title: 'Reports & export', body: 'Swift Charts visualize hours by client across weekly and all-time views. Pro includes CSV export for invoicing.' },
  { title: 'Team workspaces', body: 'Invite members, assign clients, and roll up hours across your whole team. Business tier adds Stripe invoicing.' },
]

const versions = [
  {
    version: '1.4.4',
    label: 'Latest',
    items: [
      'Live Activity & Dynamic Island — running timer stays on the lock screen the entire session',
      'Lock screen widgets — instant access to today\'s hours without opening the app',
      'Widgets refresh instantly when you stop a timer',
      'Google Sign-In via the native iOS account picker',
      'Forgot password link on the sign-in screen',
      'Invite team members by email — automatically added to your workspace when they sign in',
      'Report a Problem — contact support directly from the app',
      'Workspaces stay visible and readable when a Business subscription lapses',
    ],
  },
  {
    version: '1.4.3',
    items: [
      'Apple Watch companion app',
      'Siri shortcuts — start and stop timers with your voice',
      'PDF invoice generation',
    ],
  },
  {
    version: '1.4',
    items: [
      'Team workspaces — invite collaborators, track shared client hours, see everyone\'s progress in one place',
      'Business subscription with 7-day free trial',
    ],
  },
  {
    version: '1.3',
    items: [
      'Weekly goal tracking per workspace',
      'Edit and delete logged sessions',
      'Budget hours per client',
    ],
  },
  {
    version: '1.0',
    items: [
      'One-tap timer with client selection',
      'Weekly hours summary',
      'CSV export',
      'Home screen widget',
      'Free tier with unlimited basic tracking',
    ],
  },
]

const faqs = [
  { q: 'How do I sign in?', a: 'Email/password, Sign in with Apple, or Sign in with Google — all three work on both iOS and web.' },
  { q: 'How do I report a bug or get help?', a: 'Use the "Report a bug" link in the footer or inside Settings on the web dashboard. On iOS, use the feedback option in the app. We read every report.' },
  { q: 'Is Pro really a one-time payment?', a: 'Yes. $9.99 once, yours forever. No recurring fees for solo users — ever.' },
  { q: 'What happens when I hit the 5-client limit on Free?', a: "You'll be prompted to upgrade. All your existing data stays intact — upgrading just unlocks more clients and full session history." },
  { q: 'Does the web dashboard work without the iOS app?', a: 'Fully standalone. Create an account on the web and use it on its own. The iOS app syncs to the same account when you add it.' },
  { q: 'What does Business add over Pro?', a: 'Team workspaces let you invite members, assign clients, and roll up hours across your team, plus client invoicing via email. Business is $4.99/user/month — each team member needs their own subscription. 7-day free trial on iOS.' },
]

const tiers = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    features: ['Up to 5 clients', 'Last 7 days of history', 'iOS & Web'],
    cta: 'Sign up free',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '$9.99',
    period: 'one-time',
    badge: 'Most popular',
    features: ['Unlimited clients', 'Full session history', 'CSV export', 'Apple Watch & widgets', 'All Free features'],
    cta: 'Get Pro',
    note: 'Secure checkout via Stripe · Cards & Apple Pay accepted',
    highlight: true,
  },
  {
    name: 'Business',
    price: '$4.99',
    period: 'per user / month',
    features: ['Team workspaces', 'Client invoicing via email', '7-day free trial (iOS)', 'All Pro features'],
    cta: 'Start free trial on iOS',
    note: 'Secure checkout via Stripe · Cards & Apple Pay accepted',
    ctaHref: APP_STORE_URL,
    highlight: false,
  },
]

export default function Landing() {
  const { user, loading, recoveryMode } = useAuth()
  const [bugModalOpen, setBugModalOpen] = useState(false)
  const [emailInput, setEmailInput] = useState('')
  const [emailStatus, setEmailStatus] = useState('idle')

  async function handleEmailSubmit(e) {
    e.preventDefault()
    setEmailStatus('loading')
    const { error, data } = await supabase.functions.invoke('subscribe', { body: { email: emailInput } })
    if (error || data?.error) {
      const msg = data?.error ?? error?.message
      setEmailStatus(msg === 'already' ? 'already' : 'error')
    } else {
      setEmailStatus('success')
      setEmailInput('')
    }
  }

  if (!loading && user && !recoveryMode) return <Navigate to="/dashboard" replace />

  return (
    <div className="landing">
      <nav className="landing-nav">
        <span className="landing-logo">Tally</span>
        <div className="landing-nav-actions">
          <Link to="/login" className="landing-nav-signin">Sign in</Link>
          <Link to="/login?mode=signup" className="landing-nav-cta">Sign up free →</Link>
        </div>
      </nav>
      <header className="landing-banner">
      <section className="landing-hero">
        <h1 className="landing-headline">Track every hour.<br />Get paid for all of it.</h1>
        <p className="landing-subhead">
          Stop losing billable hours. Track time and send invoices from your iPhone, iPad, or browser.
        </p>
        <div className="landing-hero-ctas">
          <Link to="/login?mode=signup" className="landing-btn-primary">Sign up free →</Link>
          <a href={APP_STORE_URL} className="landing-appstore-badge" target="_blank" rel="noopener noreferrer" aria-label="Download on the App Store">
            <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22" aria-hidden="true">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
            <span className="landing-appstore-text">
              <span className="landing-appstore-sub">Download on the</span>
              <span className="landing-appstore-main">App Store</span>
            </span>
          </a>
        </div>
        <p className="landing-hero-note">Free to start · No credit card required · Live on App Store</p>
      </section>
      </header>

<section className="landing-demo">
        <h2 className="landing-section-title">Try it live</h2>
        <p className="landing-demo-sub">No sign-up needed — the full dashboard, right here.</p>
        <a href="/demo" target="_blank" rel="noopener noreferrer" className="landing-browser-mockup landing-browser-mockup--link">
          <div className="landing-browser-bar">
            <div className="landing-browser-dots">
              <span /><span /><span />
            </div>
            <div className="landing-browser-url">tallytimetracker.com/demo</div>
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
        <a href="/demo" target="_blank" rel="noopener noreferrer" className="landing-demo-mobile-btn">
          Try the live demo →
        </a>
      </section>

      <section className="landing-screenshots">
        <div className="landing-screenshots-header">
          <span className="landing-platform-badge">iPhone · iPad · Apple Watch · Web</span>
          <h2 className="landing-section-title">Native on every Apple device</h2>
          <p className="landing-screenshots-sub">iPhone, iPad, Apple Watch, and a full web dashboard — one Supabase backend, everything in sync.</p>
        </div>
        <div className="landing-scroll-track">
          {productSlides.map(item => (
            <div key={item.src} className="landing-scroll-item">
              <img src={item.src} alt={item.alt} loading="lazy" style={{ width: '100%', borderRadius: '12px', display: 'block' }} />
            </div>
          ))}
        </div>
      </section>

      <section className="landing-features-section">
        <div className="landing-features-header">
          <h2 className="landing-section-title">Built for how freelancers actually work</h2>
          <p className="landing-features-sub">Not just a timer — a complete billing workflow for iPhone, Mac, and web.</p>
        </div>
        <div className="landing-features">
          {features.map((f) => (
            <div key={f.title} className="landing-feature-card">
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-pricing">
        <h2 className="landing-section-title">Pricing</h2>
        <p className="landing-pricing-sub">No subscriptions for solo users. Pay once, own it forever.</p>
        <div className="landing-pricing-grid">
          {tiers.map((t) => (
            <div key={t.name} className={`landing-tier${t.highlight ? ' landing-tier--highlight' : ''}`}>
              {t.badge && <div className="landing-tier-badge">{t.badge}</div>}
              <div className="landing-tier-name">{t.name}</div>
              <div className="landing-tier-price">
                {t.price} <span className="landing-tier-period">{t.period}</span>
              </div>
              <ul className="landing-tier-features">
                {t.features.map((f) => <li key={f}>{f}</li>)}
              </ul>
              <div className="landing-tier-cta-group">
                {t.name === 'Business' ? (
                  <a
                    href={isIOS ? APP_STORE_URL : import.meta.env.VITE_STRIPE_BUSINESS_LINK}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="landing-btn-outline"
                  >
                    {isIOS ? 'Start free trial on iOS' : 'Start free trial →'}
                  </a>
                ) : t.ctaHref ? (
                  <a href={t.ctaHref} target="_blank" rel="noopener noreferrer" className={t.highlight ? 'landing-btn-primary' : 'landing-btn-outline'}>
                    {t.cta}
                  </a>
                ) : (
                  <Link to={`/login?mode=signup`} className={t.highlight ? 'landing-btn-primary' : 'landing-btn-outline'}>
                    {t.cta}
                  </Link>
                )}
                {t.note
                  ? <p className="landing-tier-note">{t.note}</p>
                  : <p className="landing-tier-note landing-tier-note--spacer" aria-hidden="true" />
                }
              </div>
            </div>
          ))}
        </div>
        <p className="landing-pricing-sub" style={{ marginTop: '1.25rem', fontSize: '0.85rem' }}>
          Free plan never expires · No credit card required · Your data is never sold or shared
        </p>
      </section>

      <section className="landing-changelog">
        <div className="landing-changelog-header">
          <h2 className="landing-section-title">What's New</h2>
          <p className="landing-features-sub">Updated regularly across iOS and web.</p>
        </div>
        <div className="landing-changelog-list">
          {versions.map((v) => (
            <div key={v.version} className="landing-changelog-item">
              <div className="landing-changelog-version">
                <span className="landing-changelog-num">v{v.version}</span>
                {v.label && <span className="landing-changelog-label">{v.label}</span>}
              </div>
              <ul className="landing-changelog-bullets">
                {v.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-faq">
        <h2 className="landing-section-title">Common questions</h2>
        <div className="landing-faq-list">
          {faqs.map((item) => (
            <div key={item.q} className="landing-faq-item">
              <p className="landing-faq-q">{item.q}</p>
              <p className="landing-faq-a">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-closing-cta">
        <h2 className="landing-closing-headline">Start tracking in under a minute.</h2>
        <p className="landing-closing-sub">Free to start. No credit card required.</p>
        <div className="landing-hero-ctas">
          <Link to="/login?mode=signup" className="landing-btn-primary">Sign up free →</Link>
          <a href={APP_STORE_URL} className="landing-appstore-badge" target="_blank" rel="noopener noreferrer" aria-label="Download on the App Store">
            <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22" aria-hidden="true">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
            <span className="landing-appstore-text">
              <span className="landing-appstore-sub">Download on the</span>
              <span className="landing-appstore-main">App Store</span>
            </span>
          </a>
        </div>
      </section>

      <section className="landing-email-capture">
        <h2 className="landing-section-title">Stay in the loop</h2>
        <p className="landing-email-sub">Get notified when new features ship. No spam — just updates.</p>
        {emailStatus === 'success' ? (
          <p className="landing-email-success">You're in. We'll let you know when something ships.</p>
        ) : (
          <form className="landing-email-form" onSubmit={handleEmailSubmit}>
            <input
              type="email"
              className="landing-email-input"
              placeholder="your@email.com"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              required
            />
            <button type="submit" className="landing-btn-primary" disabled={emailStatus === 'loading'}>
              {emailStatus === 'loading' ? 'Saving…' : 'Notify me'}
            </button>
          </form>
        )}
        {emailStatus === 'already' && <p className="landing-email-error">That email is already subscribed.</p>}
        {emailStatus === 'error' && <p className="landing-email-error">Something went wrong — try again.</p>}
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer">Download on App Store</a>
          <Link to="/login">Sign in</Link>
          <Link to="/privacy">Privacy</Link>
          <button onClick={() => setBugModalOpen(true)}>Report a bug</button>
          <a href="https://squishybutter.app" target="_blank" rel="noopener noreferrer">Squishybutter — exclusive gacha-style digital squishy toy game by George</a>
        </div>
      </footer>
      {bugModalOpen && <BugReportModal onClose={() => setBugModalOpen(false)} />}
    </div>
  )
}
