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

// SQLite CURRENT_TIMESTAMP values ("2026-05-07 14:34:12") are UTC; mark them
// as such so they display in the computer's local time
export const parseSqliteTime = (sqliteStr) => {
  const s = String(sqliteStr || '').trim()
  if (!s) return new Date(NaN)
  const iso = s.includes('T') ? s : s.replace(' ', 'T')
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`)
}

export const formatRecordedAt = (sqliteStr) => {
  if (!sqliteStr) return '—'
  const d = parseSqliteTime(sqliteStr)
  if (isNaN(d)) return sqliteStr
  return d.toLocaleString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  })
}

export const formatTimeOnly = (sqliteStr) => {
  if (!sqliteStr) return '—'
  const d = parseSqliteTime(sqliteStr)
  if (isNaN(d)) return '—'
  return d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true })
}

// Axis-friendly peso amounts: ₱950, ₱12.5k, ₱1.2M
export const formatCompactPHP = (v) => {
  const a = Math.abs(v || 0)
  const sign = v < 0 ? '-' : ''
  const r = n => Math.round(n * 10) / 10
  if (a >= 1e6) return `${sign}₱${r(a / 1e6)}M`
  if (a >= 1e3) return `${sign}₱${r(a / 1e3)}k`
  return `${sign}₱${r(a)}`
}

// Signed percentage with a true minus sign: +12.4%, −3.0%
export const formatPct = (v, digits = 1) => {
  if (v == null) return '—'
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(digits)}%`
}

export const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]

export const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// yyyy-MM-dd in local time (toISOString alone would give the UTC date, which
// is still "yesterday" in the Philippines until 8 AM)
export const toDateInput = (d = new Date()) => {
  if (!(d instanceof Date)) return String(d).slice(0, 10)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}
