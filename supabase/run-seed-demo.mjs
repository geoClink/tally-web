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

if (!url || !anon || !email || !pass) {
  console.error('Missing env vars — check VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_DEMO_EMAIL, VITE_DEMO_PASSWORD')
  process.exit(1)
}

const supabase = createClient(url, anon)

const { data: { user }, error: authError } = await supabase.auth.signInWithPassword({ email, password: pass })
if (authError || !user) {
  console.error('Auth failed:', authError?.message)
  process.exit(1)
}

console.log('Signed in as demo user')

function session(client, start, end, task_note) {
  const s = new Date(start)
  const e = new Date(end)
  const hours = parseFloat(((e - s) / 3600000).toFixed(4))
  const date = start.split('T')[0]
  return { client, start_time: start, end_time: end, hours, date, task_note, is_manual: false }
}

const sessions = [
  // Monday July 13
  session('Acme Corp',         '2026-07-13T09:00:00Z', '2026-07-13T12:30:00Z', 'Sprint planning and feature work'),
  session('River North Group', '2026-07-13T13:30:00Z', '2026-07-13T17:30:00Z', 'Q3 reporting dashboard'),
  // Tuesday July 14
  session('Acme Corp',         '2026-07-14T08:30:00Z', '2026-07-14T12:00:00Z', 'API integration work'),
  session('Blue Sky Studio',   '2026-07-14T13:00:00Z', '2026-07-14T16:30:00Z', 'Brand refresh review'),
  // Wednesday July 15
  session('River North Group', '2026-07-15T09:00:00Z', '2026-07-15T12:00:00Z', 'Stakeholder presentation prep'),
  session('Acme Corp',         '2026-07-15T13:00:00Z', '2026-07-15T16:00:00Z', 'Code review and QA'),
  // Thursday July 16
  session('Blue Sky Studio',   '2026-07-16T09:00:00Z', '2026-07-16T11:30:00Z', 'Asset exports and print specs'),
  session('Acme Corp',         '2026-07-16T12:30:00Z', '2026-07-16T15:00:00Z', 'Bug fixes from QA pass'),
  // Friday July 17
  session('Acme Corp',         '2026-07-17T09:00:00Z', '2026-07-17T12:30:00Z', 'Performance improvements'),
  session('River North Group', '2026-07-17T13:30:00Z', '2026-07-17T15:30:00Z', 'End-of-week sync'),
  // Saturday July 18 (today)
  session('Blue Sky Studio',   '2026-07-18T10:00:00Z', '2026-07-18T12:00:00Z', 'Final deliverables review'),
]

const rows = sessions.map(s => ({ ...s, user_id: user.id }))

const { error } = await supabase.from('sessions').insert(rows)
if (error) {
  console.error('Insert failed:', error.message)
  process.exit(1)
}

console.log(`Inserted ${rows.length} demo sessions — done!`)
