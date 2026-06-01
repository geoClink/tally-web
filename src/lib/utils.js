// Converts a decimal hours value to a human-readable string: 1.5 → "1h 30m"
export function formatHours(h) {
  if (!h || h <= 0) return '0m'
  const hours = Math.floor(h)
  const mins = Math.round((h - hours) * 60)
  if (!hours) return `${mins}m`
  if (!mins) return `${hours}h`
  return `${hours}h ${mins}m`
}

// Returns today's date as YYYY-MM-DD (matching the iOS app's date format)
export function todayString() {
  return new Date().toISOString().split('T')[0]
}

// Returns the Monday of the current week as YYYY-MM-DD
export function weekStartString() {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.setDate(diff)).toISOString().split('T')[0]
}

// Returns the first day of the current month as YYYY-MM-DD
export function monthStartString() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]
}

// Formats a number as USD currency
export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}
