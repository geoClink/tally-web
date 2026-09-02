import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSubscription } from '../context/SubscriptionContext'
import { supabase } from '../lib/supabase'
import { Capacitor } from '@capacitor/core'
import { isAndroid, initPlayBilling, purchaseProduct, restorePurchases, setOnPurchaseSuccess } from '../lib/playBilling'

const isNative = Capacitor.isNativePlatform()

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
  const [purchasing, setPurchasing] = useState(false)
  const [purchaseError, setPurchaseError] = useState('')
  const [stripeConnected, setStripeConnected] = useState(false)
  const [connectLoading, setConnectLoading] = useState(false)

  useEffect(() => {
    if (!user) return
    const upgradedTier = searchParams.get('upgraded')
    if (upgradedTier === 'pro' || upgradedTier === 'business') {
      refetch().then(() => setUpgraded(true))
    }
    async function loadStripeStatus() {
      if (searchParams.get('stripe_connected') === 'true') {
        // Set optimistically so the UI updates immediately on return from Stripe
        setStripeConnected(true)
        // Persist using service role (user client lacks INSERT permission)
        const { data: { session } } = await supabase.auth.getSession()
        await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-connect-account`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ action: 'mark_onboarded' }),
        })
        return
      }
      const { data } = await supabase.from('stripe_connect_accounts')
        .select('onboarded')
        .eq('user_id', user.id)
        .maybeSingle()
      setStripeConnected(!!data?.onboarded)
    }
    loadStripeStatus()
  }, [user])

  async function handleConnectStripe() {
    setConnectLoading(true)
    const returnUrl = `${window.location.origin}/billing?stripe_connected=true`
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-connect-account`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ return_url: returnUrl }),
    })
    const data = await res.json()
    setConnectLoading(false)
    if (data.url) {
      window.location.href = data.url
    } else {
      alert(data.error ?? 'Failed to connect Stripe account')
    }
  }

  useEffect(() => {
    if (!isAndroid) return
    setOnPurchaseSuccess(() => {
      refetch().then(() => setUpgraded(true))
    })
    initPlayBilling()
  }, [])

  async function handleAndroidPurchase(productId) {
    setPurchaseError('')
    setPurchasing(true)
    try {
      await purchaseProduct(productId)
    } catch (err) {
      setPurchaseError(err.message)
    } finally {
      setPurchasing(false)
    }
  }

  async function handleRestore() {
    setPurchaseError('')
    setPurchasing(true)
    try {
      await restorePurchases()
      await refetch()
    } catch (err) {
      setPurchaseError(err.message)
    } finally {
      setPurchasing(false)
    }
  }

  function handleUpgrade(plan) {
    if (user?.email === import.meta.env.VITE_DEMO_EMAIL) {
      alert('This is a demo account. Sign up for a real account to upgrade.')
      return
    }
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
        {subscription?.source === 'android' && (
          <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '0.75rem' }}>
            Your subscription was purchased through the Android app. Manage it via Google Play.
          </p>
        )}
      </div>

      {purchaseError && <div className="auth-error" style={{ marginBottom: '1rem' }}>{purchaseError}</div>}

      {isAndroid ? (
        <>
          {tier === 'free' && (
            <>
              <div style={{ marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Upgrade your plan</h2>
                <p className="text-muted" style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>
                  Purchased here? It unlocks on iOS and web too.
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
                      disabled={purchasing}
                      onClick={() => handleAndroidPurchase(plan.id === 'pro' ? 'pro_lifetime' : 'business_monthly')}
                    >
                      {purchasing ? 'Opening…' : `Upgrade to ${plan.name}`}
                    </button>
                  </div>
                ))}
              </div>
              <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                <button className="btn btn-secondary" onClick={handleRestore} disabled={purchasing}>
                  Restore purchases
                </button>
              </div>
            </>
          )}
          {tier !== 'free' && (
            <div className="card">
              <div className="card-title">Manage subscription</div>
              <p className="text-muted" style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                Manage or cancel your subscription in Google Play → Account → Payments & subscriptions.
              </p>
            </div>
          )}
        </>
      ) : (
        <>
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
        </>
      )}

      {tier === 'business' && !isAndroid && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-title">Payment collection</div>
          <p className="text-muted" style={{ fontSize: '0.875rem', marginTop: '0.5rem', marginBottom: '1rem' }}>
            Connect your Stripe account to let clients pay your invoices directly online.
          </p>
          {stripeConnected ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success)', fontWeight: 500 }}>
              <span>✓</span> Stripe account connected
            </div>
          ) : (
            <button
              className="btn btn-primary"
              onClick={handleConnectStripe}
              disabled={connectLoading}
            >
              {connectLoading ? 'Redirecting to Stripe…' : 'Connect Stripe account'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
