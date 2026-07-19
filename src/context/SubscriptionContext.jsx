import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const SubscriptionContext = createContext(null)

export function SubscriptionProvider({ children }) {
  const { user } = useAuth()
  const [subscription, setSubscription] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setSubscription(null)
      setLoading(false)
      return
    }
    fetchSubscription()
  }, [user])

  async function fetchSubscription() {
    setLoading(true)

    if (user.email === import.meta.env.VITE_DEMO_EMAIL) {
      setSubscription({ tier: 'business', source: 'demo' })
      setLoading(false)
      return
    }

    const { data } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // If the subscription has an expiry date that's passed, treat as free
    if (data?.expires_at && new Date(data.expires_at) < new Date()) {
      setSubscription({ ...data, tier: 'free' })
    } else {
      setSubscription(data)
    }
    setLoading(false)
  }

  const tier = subscription?.tier ?? 'free'
  const isPro = tier === 'pro' || tier === 'business'
  const isBusiness = tier === 'business'

  return (
    <SubscriptionContext.Provider value={{ subscription, tier, isPro, isBusiness, loading, refetch: fetchSubscription }}>
      {children}
    </SubscriptionContext.Provider>
  )
}

export const useSubscription = () => useContext(SubscriptionContext)
