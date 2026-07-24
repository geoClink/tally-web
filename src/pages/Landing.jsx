import { Navigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './Landing.css'

const APP_STORE_URL = 'https://apps.apple.com/us/app/tally-time-tracker/id6775275483'

const screenshots = [
  { src: '/images/tallyios/IMG_1217.PNG', alt: 'Tally iOS client earnings detail', caption: 'Client detail — total hours and earnings with one-tap invoice generation.' },
  { src: '/images/tallyios/IMG_1216_reports.PNG', alt: 'Tally iOS reports view', caption: 'Reports — hours and earnings by client with progress toward your weekly goal.' },
  { src: '/images/tallyios/IMG_1219.PNG', alt: 'Tally iOS team workspace', caption: 'Team — shared workspace with per-member hours and weekly goal progress.' },
  { src: '/images/tallyios/IMG_1218.PNG', alt: 'Tally iOS activity calendar', caption: 'Activity — visual calendar showing every day you logged time.' },
  { src: '/images/tallyios/IMG_1215.PNG', alt: 'Tally iOS timer view', caption: 'Timer — one-tap tracking with your weekly goal always in view.' },
  { src: '/images/tallyios/IMG_1220.PNG', alt: 'Tally iOS account view', caption: 'Account — subscription status and cross-platform sync.' },
  { src: '/images/tallyios/IMG_1221_paywall.PNG', alt: 'Tally iOS subscription upgrade', caption: 'Business — unlock team workspaces and client invoicing with a 7-day free trial.' },
]

const ipadScreenshots = [
  { src: '/images/tallyios/Simulator Screenshot - iPad Pro 13-inch (M5) - 2026-07-20 at 01.03.00.png', alt: 'Tally iPad reports view', caption: 'Reports — Swift Charts with per-client breakdowns and full session history.' },
  { src: '/images/tallyios/Simulator Screenshot - iPad Pro 13-inch (M5) - 2026-07-20 at 01.03.26.png', alt: 'Tally iPad team workspace', caption: 'Team — full team workspace with member hours and weekly goal progress.' },
  { src: '/images/tallyios/Simulator Screenshot - iPad Pro 13-inch (M5) - 2026-07-20 at 01.03.17.png', alt: 'Tally iPad activity calendar', caption: 'Activity — split-view calendar with day-by-day client session detail.' },
  { src: '/images/tallyios/Simulator Screenshot - iPad Pro 13-inch (M5) - 2026-07-20 at 01.02.54.png', alt: 'Tally iPad timer view', caption: 'Timer — full iPad layout with sidebar navigation and large-format controls.' },
]

const watchScreenshots = [
  { src: '/images/tallyios/watch-start.PNG', alt: 'Tally Apple Watch client select', caption: 'Select a client and start tracking from your wrist.' },
  { src: '/images/tallyios/watch-running.PNG', alt: 'Tally Apple Watch timer running', caption: 'Live timer with pause and stop — no phone needed.' },
  { src: '/images/tallyios/watch-paused.PNG', alt: 'Tally Apple Watch timer paused', caption: 'Resume or stop a session without reaching for your phone.' },
]

const features = [
  { title: 'Live Activity & Dynamic Island', body: 'Your running timer stays on the lock screen and Dynamic Island the entire time — no need to open the app.' },
  { title: 'Widgets & Siri', body: 'Small and medium home screen widgets show your active session. Start and stop timers by voice via App Intents and Siri Shortcuts.' },
  { title: 'Apple Watch', body: 'Full watchOS companion app synced via WatchConnectivity. Log sessions and check your weekly progress from your wrist.' },
  { title: 'Focus Mode', body: 'A custom App Intent filter lets Tally activate automatically when your Work focus turns on.' },
  { title: 'Reports & export', body: 'Swift Charts visualize hours by client across weekly and all-time views. Pro includes CSV export for invoicing.' },
  { title: 'Team workspaces', body: 'Invite members, assign clients, and roll up hours across your whole team. Business tier adds Stripe invoicing.' },
]

const faqs = [
  { q: 'Is Pro really a one-time payment?', a: 'Yes. $9.99 once, yours forever. No recurring fees for solo users — ever.' },
  { q: 'What happens when I hit the 3-client limit on Free?', a: "You'll be prompted to upgrade. All your existing data stays intact — upgrading just unlocks more clients and full session history." },
  { q: 'Does the web dashboard work without the iOS app?', a: 'Fully standalone. Create an account on the web and use it on its own. The iOS app syncs to the same account when you add it.' },
  { q: 'What does Business add over Pro?', a: 'Team workspaces let you invite members, assign clients, and roll up hours across your team, plus client invoicing via email. Business is $4.99/month with a 7-day free trial on iOS.' },
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
    badge: 'Most popular',
    features: ['Unlimited clients', 'Full session history', 'CSV export', 'All Free features'],
    cta: 'Buy once — yours forever',
    highlight: true,
  },
  {
    name: 'Business',
    price: '$4.99',
    period: 'per month',
    features: ['Team workspaces', 'Client invoicing via email', '7-day free trial (iOS)', 'All Pro features'],
    cta: 'Start free trial on iOS',
    ctaHref: APP_STORE_URL,
    highlight: false,
  },
]

export default function Landing() {
  const { user, loading } = useAuth()

  if (!loading && user) return <Navigate to="/dashboard" replace />

  return (
    <div className="landing">
      <header className="landing-banner">
      <nav className="landing-nav">
        <span className="landing-logo">Tally</span>
        <Link to="/login" className="landing-nav-signin">Sign in →</Link>
      </nav>

      <section className="landing-hero">
        <h1 className="landing-headline">Track every hour.<br />Get paid for all of it.</h1>
        <p className="landing-subhead">
          Stop losing billable hours to clunky tools. Track time on any Apple device, generate reports, and send invoices — all from one account.
        </p>
        <div className="landing-hero-ctas">
          <Link to="/login" className="landing-btn-primary">Sign up free →</Link>
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
        <p className="landing-social-proof">30+ downloads in the first week of launch</p>
      </section>
      </header>

      <section className="landing-founder-section">
        <div className="landing-founder-inner">
          <blockquote className="landing-founder-quote">
            "I built Tally because every time tracker I tried buried the billing workflow three screens deep. This is the one I actually wanted — fast to start, native on every Apple device, and connected to a real invoicing flow."
          </blockquote>
          <p className="landing-founder-attr">— George, Tally developer · Live on the App Store</p>
        </div>
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
          <span className="landing-platform-badge">iPhone · iPad · Apple Watch · Web</span>
          <h2 className="landing-section-title">Native on every Apple device</h2>
          <p className="landing-screenshots-sub">iPhone, iPad, Apple Watch, and a full web dashboard — one Supabase backend, everything in sync.</p>
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

        <div className="landing-ipad-row">
          <p className="landing-ipad-row-label">iPad</p>
          <div className="landing-ipad-track">
            {ipadScreenshots.map((s) => (
              <div key={s.src} className="landing-ipad-item">
                <div className="landing-ipad-mockup">
                  <div className="landing-ipad-screen">
                    <img src={s.src} alt={s.alt} loading="lazy" />
                  </div>
                </div>
                <p>{s.caption}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="landing-watch-row">
          <p className="landing-watch-row-label">Apple Watch</p>
          <div className="landing-watch-track">
            {watchScreenshots.map((s) => (
              <div key={s.src} className="landing-watch-item">
                <div className="landing-watch-mockup">
                  <div className="landing-watch-screen">
                    <img src={s.src} alt={s.alt} loading="lazy" />
                  </div>
                </div>
                <p>{s.caption}</p>
              </div>
            ))}
          </div>
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
              {t.ctaHref ? (
                <a href={t.ctaHref} target="_blank" rel="noopener noreferrer" className={t.highlight ? 'landing-btn-primary' : 'landing-btn-outline'}>
                  {t.cta}
                </a>
              ) : (
                <Link to="/login" className={t.highlight ? 'landing-btn-primary' : 'landing-btn-outline'}>
                  {t.cta}
                </Link>
              )}
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
          <Link to="/login" className="landing-btn-primary">Sign up free →</Link>
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

      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer">Download on App Store</a>
          <Link to="/login">Sign in</Link>
          <Link to="/privacy">Privacy</Link>
        </div>
      </footer>
    </div>
  )
}
