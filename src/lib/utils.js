// Converts a decimal hours value to a human-readable string: 1.5 → "1h 30m"
export function formatHours(h) {
  if (!h || h <= 0) return '0m'
  const totalSecs = Math.round(h * 3600)
  const hours = Math.floor(totalSecs / 3600)
  const mins = Math.floor((totalSecs % 3600) / 60)
  const secs = totalSecs % 60
  if (!hours && !mins) return `${secs}s`
  if (!hours) return `${mins}m`
  if (!mins) return `${hours}h`
  return `${hours}h ${mins}m`
}

// Returns today's date as YYYY-MM-DD (matching the iOS app's date format)
export function todayString() {
  return new Date().toISOString().split('T')[0]
}

// Returns the start of the current week as YYYY-MM-DD.
// weekStart: 0 = Sunday, 1 = Monday (default, matches previous behavior)
export function weekStartString(weekStart = 1) {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - ((day - weekStart + 7) % 7)
  return new Date(d.setDate(diff)).toISOString().split('T')[0]
}

// Returns the start of the current billing period as YYYY-MM-DD.
// startDay: day of month the billing cycle begins (1–28).
// If today >= startDay, period started this month; otherwise last month.
export function billingPeriodStart(startDay) {
  const today = new Date()
  const day = today.getDate()
  const year = today.getFullYear()
  const month = today.getMonth()
  if (day >= startDay) {
    return new Date(year, month, startDay).toISOString().split('T')[0]
  }
  return new Date(year, month - 1, startDay).toISOString().split('T')[0]
}

// Returns the first day of the current month as YYYY-MM-DD
export function monthStartString() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]
}

// Returns the start and end of last month as YYYY-MM-DD strings
export function lastMonthRange() {
  const d = new Date()
  const start = new Date(d.getFullYear(), d.getMonth() - 1, 1)
  const end = new Date(d.getFullYear(), d.getMonth(), 0)
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  }
}

// Formats a number as USD currency
export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

// Returns {start, end} for last month as YYYY-MM-DD strings
export function lastMonthRange() {
  const d = new Date()
  const year = d.getFullYear()
  const month = d.getMonth()
  const start = new Date(year, month - 1, 1).toISOString().split('T')[0]
  const end = new Date(year, month, 0).toISOString().split('T')[0]
  return { start, end }
}
