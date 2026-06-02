import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSubscription } from '../context/SubscriptionContext'

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/track', label: 'Track Time' },
  { to: '/reports', label: 'Reports' },
  { to: '/sessions', label: 'Sessions' },
  { to: '/clients', label: 'Client Rates' },
  { to: '/team', label: 'Team', tier: 'business' },
  { to: '/invoices', label: 'Invoices', tier: 'business' },
  { to: '/billing', label: 'Billing' },
]

export default function Sidebar({ onClose }) {
  const { user, signOut } = useAuth()
  const { tier, isBusiness } = useSubscription()
  const navigate = useNavigate()

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
              </NavLink>
            </li>
          )
        })}
      </ul>
      <div className="sidebar-footer">
        <div className={`current-tier tier-${tier}`}>{tier}</div>
        <button onClick={handleSignOut} className="sidebar-signout">Sign Out</button>
      </div>
    </>
  )
}
