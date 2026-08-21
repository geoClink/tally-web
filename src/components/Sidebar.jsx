import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSubscription } from '../context/SubscriptionContext'
import { usePendingInvite } from '../context/PendingInviteContext'
import AndroidModal from './AndroidModal'

const APP_STORE_URL = 'https://apps.apple.com/us/app/tally-time-tracker/id6775275483'

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/track', label: 'Track Time' },
  { to: '/reports', label: 'Reports' },
  { to: '/sessions', label: 'Sessions' },
  { to: '/calendar', label: 'Activity' },
  { to: '/clients', label: 'Client Rates' },
  { to: '/team', label: 'Team', tier: 'business' },
  { to: '/team-dashboard', label: 'Team Dashboard', tier: 'business' },
  { to: '/invoices', label: 'Invoices', tier: 'business' },
  { to: '/billing', label: 'Billing' },
  { to: '/settings', label: 'Settings' },
  { to: '/help', label: 'Help' },
]

export default function Sidebar({ onClose }) {
  const { user, signOut } = useAuth()
  const { tier, isBusiness } = useSubscription()
  const { pendingInvite } = usePendingInvite()
  const navigate = useNavigate()
  const [androidModalOpen, setAndroidModalOpen] = useState(false)

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <>
      <div className="sidebar-brand">Tally</div>
      <div className="sidebar-email">{user?.email}</div>
      <ul className="sidebar-nav">
        {navItems.map(item => {
          const needsBusiness = item.tier === 'business' && !isBusiness
          return (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
                onClick={onClose}
              >
                {item.label}
                {needsBusiness && <span className="tier-badge">Business</span>}
                {item.to === '/team' && pendingInvite && (
                  <span style={{
                    display: 'inline-block', width: '8px', height: '8px',
                    borderRadius: '50%', background: 'var(--accent)',
                    marginLeft: '6px', flexShrink: 0,
                  }} />
                )}
              </NavLink>
            </li>
          )
        })}
      </ul>
      <div className="sidebar-footer">
        <div className={`current-tier tier-${tier}`}>{tier}</div>
        <div className="sidebar-download-row">
          <a
            href={APP_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="sidebar-download-btn"
            aria-label="Download on the App Store"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14" aria-hidden="true">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
            iOS
          </a>
          <button
            onClick={() => setAndroidModalOpen(true)}
            className="sidebar-download-btn"
            aria-label="Android beta"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14" aria-hidden="true">
              <path d="M17.523 15.341a5.172 5.172 0 0 1-5.172-5.172 5.172 5.172 0 0 1 5.172-5.172 5.172 5.172 0 0 1 5.172 5.172 5.172 5.172 0 0 1-5.172 5.172m-11.046 0a5.172 5.172 0 0 1-5.172-5.172 5.172 5.172 0 0 1 5.172-5.172 5.172 5.172 0 0 1 5.172 5.172 5.172 5.172 0 0 1-5.172 5.172M17.584.809l1.937-3.355a.403.403 0 0 0-.148-.551.403.403 0 0 0-.551.148L16.87.465a12.245 12.245 0 0 0-4.87-1.006c-1.748 0-3.402.37-4.87 1.006L5.178-2.949a.403.403 0 0 0-.551-.148.403.403 0 0 0-.148.551L6.416.809C2.9 2.688.477 6.365.477 10.613h23.046c0-4.248-2.423-7.925-5.939-9.804"/>
            </svg>
            Android
          </button>
        </div>
        <button onClick={handleSignOut} className="sidebar-signout">Sign Out</button>
      </div>
      {androidModalOpen && <AndroidModal onClose={() => setAndroidModalOpen(false)} />}
    </>
  )
}
