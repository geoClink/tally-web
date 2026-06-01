import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useSubscription } from '../context/SubscriptionContext'

const PLANS = [
  {
    id: 'pro',
    name: 'Pro',
    price: '$9.99',
    period: 'one-time',
    envKey: 'VITE_STRIPE_PRO_LINK',
    features: ['Unlimited clients', 'Full session history', 'CSV export', 'All future Pro features'],
  },
  {
    id: 'business',
    name: 'Business',
    price: '$4.99',
    period: '/month',
    envKey: 'VITE_STRIPE_BUSINESS_LINK',
    features: ['Everything in Pro', 'Team workspaces', 'Invoice generation', 'Member management'],
    featured: true,
  },
]

export default function Billing() {
  const { user } = useAuth()
  const { tier, subscription, refetch } = useSubscription()
  const [searchParams] = useSearchParams()
  const [upgraded, setUpgraded] = useState(false)

  // Stripe redirects back here with ?upgraded=pro or ?upgraded=business after payment
  useEffect(() => {
    const upgradedTier = searchParams.get('upgraded')
    if (upgradedTier && (upgradedTier === 'pro' || upgradedTier === 'business')) {
      handleStripeSuccess(upgradedTier)
    }
  }, [])

  async function handleStripeSuccess(upgradedTier) {
    // Write the subscription record. In production this should be done via
    // a Stripe webhook → Supabase Edge Function for security.
    const expiresAt = upgradedTier === 'business'
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      : null

    await supabase.from('subscriptions').insert({
      user_id: user.id,
      tier: upgradedTier,
      source: 'stripe',
      expires_at: expiresAt,
    })

    await refetch()
    setUpgraded(true)
  }

  function handleUpgrade(plan) {
    const link = import.meta.env[plan.envKey]
    if (!link) {
      alert(`Set ${plan.envKey} in your .env file to enable Stripe payments.`)
      return
    }
    // Append user info so Stripe can associate the payment
    const url = new URL(link)
    url.searchParams.set('client_reference_id', user.id)
    url.searchParams.set('prefilled_email', user.email)
    // After payment, Stripe returns here — we read the ?upgraded= param above
    url.searchParams.set('success_url', `${window.location.origin}/billing?upgraded=${plan.id}`)
    window.location.href = url.toString()
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Billing</h1>
        <p className="page-subtitle">Manage your subscription</p>
      </div>

      {upgraded && (
        <div className="alert alert-success">
          You're all set! Your subscription has been activated.
        </div>
      )}

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-title">Current Plan</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
          <span className={`current-tier tier-${tier}`}>{tier}</span>
          {subscription?.source && (
            <span className="text-muted" style={{ fontSize: '0.85rem' }}>
              via {subscription.source === 'ios' ? 'iOS App' : 'Stripe'}
            </span>
          )}
          {subscription?.expires_at && (
            <span className="text-muted" style={{ fontSize: '0.85rem' }}>
              · renews {new Date(subscription.expires_at).toLocaleDateString()}
            </span>
          )}
        </div>
        {subscription?.source === 'ios' && (
          <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '0.75rem' }}>
            Your subscription was purchased through the iOS app. Manage it via the App Store.
          </p>
        )}
      </div>

      {tier === 'free' && (
        <>
          <div style={{ marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Upgrade your plan</h2>
            <p className="text-muted" style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>
              Subscriptions work across iOS and web — buy once, use everywhere.
            </p>
          </div>
          <div className="plan-grid">
            {PLANS.map(plan => (
              <div key={plan.id} className={`plan-card${plan.featured ? ' featured' : ''}`}>
                <div className="plan-name">{plan.name}</div>
                <div className="plan-price">{plan.price}</div>
                <div className="plan-period">{plan.period}</div>
                <ul className="plan-features">
                  {plan.features.map(f => <li key={f}>{f}</li>)}
                </ul>
                <button
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  onClick={() => handleUpgrade(plan)}
                >
                  Upgrade to {plan.name}
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {tier === 'pro' && (
        <div className="plan-card featured" style={{ maxWidth: '320px' }}>
          <div className="plan-name">Business</div>
          <div className="plan-price">$4.99</div>
          <div className="plan-period">/month</div>
          <ul className="plan-features">
            {PLANS[1].features.map(f => <li key={f}>{f}</li>)}
          </ul>
          <button
            className="btn btn-primary"
            style={{ width: '100%' }}
            onClick={() => handleUpgrade(PLANS[1])}
          >
            Upgrade to Business
          </button>
        </div>
      )}

      <div className="alert alert-info" style={{ marginTop: '1.5rem', fontSize: '0.85rem' }}>
        <strong>Note:</strong> For a production app, configure a Stripe webhook to automatically
        activate subscriptions. See <code>supabase/schema.sql</code> for notes.
      </div>
    </div>
  )
}
