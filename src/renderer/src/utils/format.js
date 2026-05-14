export const formatPHP = (amount) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(amount || 0)

export const formatNumber = (n) =>
  new Intl.NumberFormat('en-PH').format(n || 0)

export const formatDate = (dateStr) => {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
}

export const formatDateShort = (dateStr) => {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

export const formatDateTime = (dateStr) => {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

// For SQLite created_at strings like "2026-05-07 14:34:12"
export const formatRecordedAt = (sqliteStr) => {
  if (!sqliteStr) return '—'
  // SQLite stores as "YYYY-MM-DD HH:MM:SS" — replace space with T so JS Date parses as local
  const d = new Date(String(sqliteStr).replace(' ', 'T'))
  if (isNaN(d)) return sqliteStr
  return d.toLocaleString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  })
}

export const formatTimeOnly = (sqliteStr) => {
  if (!sqliteStr) return '—'
  const d = new Date(String(sqliteStr).replace(' ', 'T'))
  if (isNaN(d)) return '—'
  return d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true })
}

export const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]

export const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export const toDateInput = (d = new Date()) =>
  d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10)
