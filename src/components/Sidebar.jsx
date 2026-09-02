import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSubscription } from '../context/SubscriptionContext'
import { usePendingInvite } from '../context/PendingInviteContext'
import { useAvatar } from '../context/AvatarContext'
import AndroidModal from './AndroidModal'

const APP_STORE_URL = 'https://apps.apple.com/us/app/tally-time-tracker/id6775275483'

// SVG icons — each returns a 16×16 icon element
function Icon({ d, viewBox = '0 0 24 24' }) {
  return (
    <svg width="16" height="16" viewBox={viewBox} fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0 }}>
      {Array.isArray(d)
        ? d.map((p, i) => <path key={i} d={p} />)
        : <path d={d} />}
    </svg>
  )
}

const ICONS = {
  dashboard: <Icon d={['M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z', 'M9 22V12h6v10']} />,
  track:     <Icon d={['M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z', 'M12 6v6l4 2']} />,
  sessions:  <Icon d={['M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2', 'M9 5a2 2 0 002 2h2a2 2 0 002-2', 'M9 5a2 2 0 012-2h2a2 2 0 012 2', 'M9 12h6M9 16h4']} />,
  activity:  <Icon d="M3 3v18h18M7 16l4-4 4 4 4-4" />,
  reports:   <Icon d={['M18 20V10', 'M12 20V4', 'M6 20v-6']} />,
  clients:   <Icon d={['M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2', 'M9 11a4 4 0 100-8 4 4 0 000 8z', 'M23 21v-2a4 4 0 00-3-3.87', 'M16 3.13a4 4 0 010 7.75']} />,
  invoices:  <Icon d={['M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z', 'M14 2v6h6', 'M16 13H8M16 17H8M10 9H8']} />,
  team:      <Icon d={['M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2', 'M9 11a4 4 0 100-8 4 4 0 000 8z', 'M23 21v-2a4 4 0 00-3-3.87', 'M16 3.13a4 4 0 010 7.75']} />,
  teamdash:  <Icon d={['M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z', 'M9 22V12h6v10']} />,
  billing:   <Icon d={['M21 4H3a2 2 0 00-2 2v12a2 2 0 002 2h18a2 2 0 002-2V6a2 2 0 00-2-2z', 'M1 10h22']} />,
  settings:  <Icon d={['M12 15a3 3 0 100-6 3 3 0 000 6z', 'M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z']} />,
  help:      <Icon d={['M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z', 'M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3', 'M12 17h.01']} />,
}

const NAV_GROUPS = [
  {
    label: null,
    items: [
      { to: '/dashboard',  label: 'Dashboard',  icon: ICONS.dashboard },
      { to: '/track',      label: 'Track Time', icon: ICONS.track },
    ],
  },
  {
    label: 'History',
    items: [
      { to: '/sessions', label: 'Sessions', icon: ICONS.sessions },
      { to: '/calendar', label: 'Activity',  icon: ICONS.activity },
      { to: '/reports',  label: 'Reports',   icon: ICONS.reports },
    ],
  },
  {
    label: 'Money',
    items: [
      { to: '/clients',  label: 'Client Rates', icon: ICONS.clients },
      { to: '/invoices', label: 'Invoices',      icon: ICONS.invoices, tier: 'business' },
    ],
  },
  {
    label: 'Team',
    tier: 'business',
    items: [
      { to: '/team',           label: 'Team',           icon: ICONS.team },
      { to: '/team-dashboard', label: 'Team Dashboard', icon: ICONS.teamdash },
    ],
  },
  {
    label: 'Account',
    items: [
      { to: '/billing',  label: 'Billing',  icon: ICONS.billing },
      { to: '/settings', label: 'Settings', icon: ICONS.settings },
      { to: '/help',     label: 'Help',     icon: ICONS.help },
    ],
  },
]

export default function Sidebar({ onClose }) {
  const { user, signOut } = useAuth()
  const { tier, isBusiness } = useSubscription()
  const { pendingInvite } = usePendingInvite()
  const { dataUri, color } = useAvatar()
  const navigate = useNavigate()
  const [androidModalOpen, setAndroidModalOpen] = useState(false)

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <>
      <div className="sidebar-brand">Tally</div>

      <NavLink to="/settings" className="sidebar-profile" onClick={onClose} title="Edit profile">
        <div style={{
          width: '40px', height: '40px', borderRadius: '50%',
          background: color, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
        }}>
          <img src={dataUri} width="32" height="32" alt="avatar" style={{ display: 'block' }} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.email}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '1px' }}>Edit profile</div>
        </div>
      </NavLink>

      <ul className="sidebar-nav">
        {NAV_GROUPS.map((group, gi) => {
          // Hide entire Business group for non-business users
          if (group.tier === 'business' && !isBusiness) return null

          return (
            <li key={gi} className="sidebar-group">
              {group.label && (
                <div className="sidebar-group-label">{group.label}</div>
              )}
              <ul className="sidebar-group-items">
                {group.items.map(item => {
                  // Hide business-only items for non-business users
                  if (item.tier === 'business' && !isBusiness) return null

                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
                        onClick={onClose}
                      >
                        <span className="sidebar-link-inner">
                          <span className="sidebar-icon">{item.icon}</span>
                          {item.label}
                        </span>
                        {item.to === '/team' && pendingInvite && (
                          <span style={{
                            width: '7px', height: '7px', borderRadius: '50%',
                            background: 'var(--accent)', flexShrink: 0,
                            display: 'inline-block',
                          }} />
                        )}
                      </NavLink>
                    </li>
                  )
                })}
              </ul>
            </li>
          )
        })}
      </ul>

      <div className="sidebar-footer">
        <div className={`current-tier tier-${tier}`}>{tier}</div>
        <div className="sidebar-download-row">
          <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer"
            className="sidebar-download-btn" aria-label="Download on the App Store">
            <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
            iOS
          </a>
          <button onClick={() => setAndroidModalOpen(true)}
            className="sidebar-download-btn" aria-label="Android beta">
            <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
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
