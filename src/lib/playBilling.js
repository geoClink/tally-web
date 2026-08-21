import { Capacitor } from '@capacitor/core'
import { supabase } from './supabase'

export const isAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'

const PRODUCT_IDS = {
  pro: 'pro_lifetime',
  business: 'business_monthly',
}

let initialized = false
let onPurchaseSuccess = null

export function setOnPurchaseSuccess(cb) {
  onPurchaseSuccess = cb
}

export async function initPlayBilling() {
  if (!isAndroid || initialized) return

  const { store, ProductType, Platform } = window.CdvPurchase ?? {}
  if (!store) return

  store.register([
    { type: ProductType.NON_CONSUMABLE, id: PRODUCT_IDS.pro, platform: Platform.GOOGLE_PLAY },
    { type: ProductType.PAID_SUBSCRIPTION, id: PRODUCT_IDS.business, platform: Platform.GOOGLE_PLAY },
  ])

  store.when()
    .approved(transaction => transaction.verify())
    .verified(async receipt => {
      await receipt.finish()
      await syncToSupabase(receipt)
      onPurchaseSuccess?.()
    })

  await store.initialize([Platform.GOOGLE_PLAY])
  initialized = true
}

async function syncToSupabase(receipt) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  let tier = 'free'
  let expiresAt = null

  for (const tx of receipt.transactions ?? []) {
    for (const p of tx.products ?? []) {
      if (p.id === PRODUCT_IDS.business) {
        tier = 'business'
        expiresAt = tx.expirationDate ?? null
      } else if (p.id === PRODUCT_IDS.pro && tier !== 'business') {
        tier = 'pro'
      }
    }
  }

  if (tier === 'free') return

  const { data: existing } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('user_id', user.id)
    .eq('source', 'android')
    .maybeSingle()

  if (existing) {
    await supabase.from('subscriptions').update({ tier, expires_at: expiresAt }).eq('id', existing.id)
  } else {
    await supabase.from('subscriptions').insert({ user_id: user.id, tier, source: 'android', expires_at: expiresAt })
  }
}

export async function purchaseProduct(productId) {
  const { store, Platform } = window.CdvPurchase ?? {}
  if (!store) throw new Error('Play Billing not available')
  const product = store.get(productId, Platform.GOOGLE_PLAY)
  const offer = product?.getOffer()
  if (!offer) throw new Error('Product not available. Make sure it is active in Play Console.')
  const error = await offer.order()
  if (error) throw new Error(error.message)
}

export async function restorePurchases() {
  const { store } = window.CdvPurchase ?? {}
  if (!store) throw new Error('Play Billing not available')
  await store.restorePurchases()
}

export function getProduct(productId) {
  const { store, Platform } = window.CdvPurchase ?? {}
  if (!store) return null
  return store.get(productId, Platform.GOOGLE_PLAY)
}
