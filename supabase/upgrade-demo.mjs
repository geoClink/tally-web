import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '../.env') })

const url   = process.env.VITE_SUPABASE_URL
const anon  = process.env.VITE_SUPABASE_ANON_KEY
const email = process.env.VITE_DEMO_EMAIL
const pass  = process.env.VITE_DEMO_PASSWORD

const supabase = createClient(url, anon)

const { data: { user }, error: authError } = await supabase.auth.signInWithPassword({ email, password: pass })
if (authError || !user) { console.error('Auth failed:', authError?.message); process.exit(1) }

// Remove any existing subscriptions, then insert a Business one with no expiry
await supabase.from('subscriptions').delete().eq('user_id', user.id)

const { error } = await supabase.from('subscriptions').insert({
  user_id: user.id,
  tier: 'business',
  source: 'stripe',
  expires_at: null,
})

if (error) { console.error('Failed:', error.message); process.exit(1) }
console.log('Demo account upgraded to Business tier.')
