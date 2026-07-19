// Nightly demo reset — deletes all demo sessions and re-seeds with current-week + historical data.
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

const { error: deleteError } = await supabase.rpc('delete_own_sessions')
if (deleteError) { console.error('Delete failed:', deleteError.message); process.exit(1) }

function weekMonday() {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const mon = new Date(now)
  mon.setDate(now.getDate() + diff)
  mon.setHours(0, 0, 0, 0)
  return mon
}

// daysFromMonday: positive = this week, negative = past weeks
// Uses explicit hours + minutes to avoid setUTCHours truncation bug with decimals
function session(client, daysFromMonday, startH, startM, endH, endM, task_note) {
  const base = new Date(weekMonday())
  base.setDate(base.getDate() + daysFromMonday)
  const start = new Date(base); start.setUTCHours(startH, startM, 0, 0)
  const end   = new Date(base); end.setUTCHours(endH, endM, 0, 0)
  const hours = parseFloat(((end - start) / 3600000).toFixed(4))
  const date  = base.toISOString().split('T')[0]
  return { client, start_time: start.toISOString(), end_time: end.toISOString(), hours, date, task_note, is_manual: false }
}

const today = new Date().getDay() // 0=Sun 1=Mon … 6=Sat
const maxDay = today === 0 ? 6 : today - 1

// ── Current week (Mon through today) ────────────────────────────────────────
const thisWeek = [
  { day: 0, client: 'Acme Corp',         sH: 9,  sM: 0,  eH: 12, eM: 30, note: 'Sprint planning and feature work' },
  { day: 0, client: 'River North Group', sH: 13, sM: 30, eH: 17, eM: 30, note: 'Q3 reporting dashboard' },
  { day: 1, client: 'Acme Corp',         sH: 8,  sM: 30, eH: 12, eM: 0,  note: 'API integration work' },
  { day: 1, client: 'Blue Sky Studio',   sH: 13, sM: 0,  eH: 16, eM: 30, note: 'Brand refresh review' },
  { day: 2, client: 'River North Group', sH: 9,  sM: 0,  eH: 12, eM: 0,  note: 'Stakeholder presentation prep' },
  { day: 2, client: 'Acme Corp',         sH: 13, sM: 0,  eH: 16, eM: 0,  note: 'Code review and QA' },
  { day: 3, client: 'Blue Sky Studio',   sH: 9,  sM: 0,  eH: 11, eM: 30, note: 'Asset exports and print specs' },
  { day: 3, client: 'Acme Corp',         sH: 12, sM: 30, eH: 15, eM: 0,  note: 'Bug fixes from QA pass' },
  { day: 4, client: 'Acme Corp',         sH: 9,  sM: 0,  eH: 12, eM: 30, note: 'Performance improvements' },
  { day: 4, client: 'River North Group', sH: 13, sM: 30, eH: 15, eM: 30, note: 'End-of-week sync' },
  { day: 5, client: 'Blue Sky Studio',   sH: 10, sM: 0,  eH: 12, eM: 0,  note: 'Final deliverables review' },
]

// ── Historical sessions (always inserted — negative day = weeks back) ────────
// day offset is relative to current week's Monday, so data stays accurate over time.
// Totals: this week ~33h, this month ~65h, all time ~122h
const historical = [
  // Previous week (~24h)
  { day: -6, client: 'Acme Corp',         sH: 9,  sM: 0,  eH: 12, eM: 30, note: 'Feature development' },
  { day: -6, client: 'River North Group', sH: 13, sM: 30, eH: 17, eM: 0,  note: 'Monthly data review' },
  { day: -5, client: 'Blue Sky Studio',   sH: 9,  sM: 0,  eH: 11, eM: 30, note: 'Logo concept revisions' },
  { day: -5, client: 'Acme Corp',         sH: 13, sM: 0,  eH: 16, eM: 0,  note: 'API documentation' },
  { day: -4, client: 'Acme Corp',         sH: 9,  sM: 0,  eH: 12, eM: 0,  note: 'Bug triage and hotfix' },
  { day: -3, client: 'River North Group', sH: 9,  sM: 30, eH: 12, eM: 30, note: 'Data pipeline work' },
  { day: -3, client: 'Blue Sky Studio',   sH: 13, sM: 0,  eH: 15, eM: 0,  note: 'Print deliverables' },
  { day: -2, client: 'Acme Corp',         sH: 9,  sM: 0,  eH: 12, eM: 30, note: 'Sprint retrospective' },

  // 2 weeks ago (~13.5h)
  { day: -13, client: 'Acme Corp',         sH: 9,  sM: 0,  eH: 12, eM: 0,  note: 'Backend refactor' },
  { day: -13, client: 'Blue Sky Studio',   sH: 13, sM: 0,  eH: 15, eM: 30, note: 'Color palette exploration' },
  { day: -12, client: 'River North Group', sH: 9,  sM: 30, eH: 12, eM: 0,  note: 'Client requirements meeting' },
  { day: -11, client: 'Acme Corp',         sH: 9,  sM: 0,  eH: 12, eM: 30, note: 'Testing and QA' },
  { day: -10, client: 'Blue Sky Studio',   sH: 10, sM: 0,  eH: 12, eM: 0,  note: 'Asset handoff' },

  // 3 weeks ago (~13.5h)
  { day: -20, client: 'Acme Corp',         sH: 9,  sM: 0,  eH: 12, eM: 0,  note: 'Sprint kickoff' },
  { day: -19, client: 'River North Group', sH: 9,  sM: 0,  eH: 11, eM: 30, note: 'Analytics dashboard' },
  { day: -18, client: 'Acme Corp',         sH: 9,  sM: 0,  eH: 12, eM: 30, note: 'Feature implementation' },
  { day: -18, client: 'Blue Sky Studio',   sH: 13, sM: 30, eH: 15, eM: 30, note: 'Typography review' },
  { day: -17, client: 'Acme Corp',         sH: 9,  sM: 0,  eH: 11, eM: 30, note: 'Code cleanup' },

  // 4 weeks ago (~12h)
  { day: -27, client: 'Acme Corp',         sH: 9,  sM: 0,  eH: 13, eM: 0,  note: 'New feature scoping' },
  { day: -26, client: 'River North Group', sH: 10, sM: 0,  eH: 12, eM: 0,  note: 'Reporting automation' },
  { day: -25, client: 'Blue Sky Studio',   sH: 9,  sM: 0,  eH: 12, eM: 0,  note: 'Brand guidelines draft' },
  { day: -24, client: 'Acme Corp',         sH: 9,  sM: 0,  eH: 12, eM: 0,  note: 'Database optimization' },

  // 5 weeks ago (~8.5h)
  { day: -34, client: 'Acme Corp',         sH: 9,  sM: 0,  eH: 12, eM: 30, note: 'Security audit review' },
  { day: -33, client: 'Blue Sky Studio',   sH: 13, sM: 0,  eH: 15, eM: 30, note: 'Mockup iterations' },
  { day: -32, client: 'River North Group', sH: 9,  sM: 0,  eH: 11, eM: 30, note: 'ETL pipeline fixes' },

  // 6 weeks ago (~7h)
  { day: -41, client: 'Acme Corp',         sH: 9,  sM: 0,  eH: 12, eM: 0,  note: 'Project kickoff' },
  { day: -40, client: 'River North Group', sH: 13, sM: 0,  eH: 15, eM: 0,  note: 'Dashboard requirements' },
  { day: -39, client: 'Blue Sky Studio',   sH: 9,  sM: 0,  eH: 11, eM: 0,  note: 'Initial discovery' },

  // 7 weeks ago (~5.5h)
  { day: -47, client: 'Acme Corp',         sH: 9,  sM: 0,  eH: 12, eM: 30, note: 'Infrastructure planning' },
  { day: -46, client: 'Blue Sky Studio',   sH: 13, sM: 0,  eH: 15, eM: 0,  note: 'Competitive analysis' },

  // 8 weeks ago (~4.5h)
  { day: -55, client: 'Acme Corp',         sH: 9,  sM: 0,  eH: 11, eM: 30, note: 'Initial onboarding' },
  { day: -54, client: 'River North Group', sH: 10, sM: 0,  eH: 12, eM: 0,  note: 'Contract kickoff' },
]

const thisWeekRows = thisWeek
  .filter(b => b.day <= maxDay)
  .map(b => ({ ...session(b.client, b.day, b.sH, b.sM, b.eH, b.eM, b.note), user_id: user.id }))

const historicalRows = historical
  .map(b => ({ ...session(b.client, b.day, b.sH, b.sM, b.eH, b.eM, b.note), user_id: user.id }))

const rows = [...historicalRows, ...thisWeekRows]

const { error } = await supabase.from('sessions').insert(rows)
if (error) { console.error('Insert failed:', error.message); process.exit(1) }

console.log(`Demo reset complete — inserted ${rows.length} sessions (${thisWeekRows.length} this week + ${historicalRows.length} historical).`)
