// Nightly demo reset — deletes all demo sessions and re-seeds with current-week data.
// Run manually: node supabase/reset-demo.mjs
// Runs automatically via GitHub Actions (.github/workflows/reset-demo.yml)

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
  console.error('Missing required env vars')
  process.exit(1)
}

const supabase = createClient(url, anon)

const { data: { user }, error: authError } = await supabase.auth.signInWithPassword({ email, password: pass })
if (authError || !user) { console.error('Auth failed:', authError?.message); process.exit(1) }

// Delete all existing sessions for demo account
await supabase.from('sessions').delete().eq('user_id', user.id)

// Build session rows relative to the current week (Mon–today)
function weekMonday() {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const mon = new Date(now)
  mon.setDate(now.getDate() + diff)
  mon.setHours(0, 0, 0, 0)
  return mon
}

function makeSession(client, dayOffset, startHour, endHour, task_note) {
  const base = new Date(weekMonday())
  base.setDate(base.getDate() + dayOffset)
  const start = new Date(base); start.setUTCHours(startHour, 0, 0, 0)
  const end   = new Date(base); end.setUTCHours(endHour,   0, 0, 0)
  const hours = parseFloat(((end - start) / 3600000).toFixed(4))
  const date  = base.toISOString().split('T')[0]
  return { client, start_time: start.toISOString(), end_time: end.toISOString(), hours, date, task_note, is_manual: false }
}

const today = new Date().getDay() // 0=Sun 1=Mon … 6=Sat
const maxDay = today === 0 ? 6 : today - 1 // days since Monday (0=Mon, 4=Fri)

const blueprint = [
  // Mon
  { day: 0, client: 'Acme Corp',         start: 9,  end: 12.5, note: 'Sprint planning and feature work' },
  { day: 0, client: 'River North Group', start: 13.5, end: 17.5, note: 'Q3 reporting dashboard' },
  // Tue
  { day: 1, client: 'Acme Corp',         start: 8.5, end: 12,  note: 'API integration work' },
  { day: 1, client: 'Blue Sky Studio',   start: 13,  end: 16.5, note: 'Brand refresh review' },
  // Wed
  { day: 2, client: 'River North Group', start: 9,   end: 12,  note: 'Stakeholder presentation prep' },
  { day: 2, client: 'Acme Corp',         start: 13,  end: 16,  note: 'Code review and QA' },
  // Thu
  { day: 3, client: 'Blue Sky Studio',   start: 9,   end: 11.5, note: 'Asset exports and print specs' },
  { day: 3, client: 'Acme Corp',         start: 12.5, end: 15, note: 'Bug fixes from QA pass' },
  // Fri
  { day: 4, client: 'Acme Corp',         start: 9,   end: 12.5, note: 'Performance improvements' },
  { day: 4, client: 'River North Group', start: 13.5, end: 15.5, note: 'End-of-week sync' },
  // Sat
  { day: 5, client: 'Blue Sky Studio',   start: 10,  end: 12,  note: 'Final deliverables review' },
]

const rows = blueprint
  .filter(b => b.day <= maxDay)
  .map(b => ({ ...makeSession(b.client, b.day, b.start, b.end, b.note), user_id: user.id }))

const { error } = await supabase.from('sessions').insert(rows)
if (error) { console.error('Insert failed:', error.message); process.exit(1) }
console.log(`Demo reset complete — inserted ${rows.length} sessions.`)
