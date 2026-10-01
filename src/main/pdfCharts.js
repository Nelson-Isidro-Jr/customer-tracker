// SVG chart builders for the PDF reports. Plain string output, so the charts
// render as crisp vectors in the hidden print window with JavaScript disabled.

export const SERIES = {
  current:  '#2563EB',
  previous: '#86B6EF',
  decline:  '#E34948'
}

const GRID = '#EEF2F6'
const BASELINE = '#CBD5E1'
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_INITIALS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']

// One extreme month can dwarf the rest of a growth chart (a buyer going from
// ₱500 to ₱9,000 is +1700%), so bars past this are clipped and labelled.
const GROWTH_CAP = 300

const PAD = { top: 22, right: 10, bottom: 26, left: 52 }

const round1 = n => Math.round(n * 10) / 10

export function compactPHP(v) {
  const a = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (a >= 1e6) return `${sign}₱${round1(a / 1e6)}M`
  if (a >= 1e3) return `${sign}₱${round1(a / 1e3)}k`
  return `${sign}₱${round1(a)}`
}

function signedPct(v) {
  const r = Math.round(v)
  return `${r > 0 ? '+' : r < 0 ? '−' : ''}${Math.abs(r)}%`
}

function niceTicks(min, max, count = 4) {
  if (max - min <= 0) max = min + 1
  const raw = (max - min) / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const norm = raw / mag
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag
  const lo = Math.floor(min / step) * step
  const hi = Math.ceil(max / step) * step
  const ticks = []
  for (let i = 0; lo + i * step <= hi + step / 2; i++) ticks.push(Number((lo + i * step).toFixed(10)))
  return { lo, hi, ticks, step }
}

// Bar with a 4px rounded data-end and a square baseline. Grows up for positive
// values and down for negative ones.
function barPath(x, w, yBase, yEnd) {
  const h = Math.abs(yBase - yEnd)
  if (h < 0.5) return ''
  const r = Math.min(4, w / 2, h)
  if (yEnd < yBase) {
    return `M${x},${yBase}V${yEnd + r}A${r},${r} 0 0 1 ${x + r},${yEnd}H${x + w - r}A${r},${r} 0 0 1 ${x + w},${yEnd + r}V${yBase}Z`
  }
  return `M${x},${yBase}V${yEnd - r}A${r},${r} 0 0 0 ${x + r},${yEnd}H${x + w - r}A${r},${r} 0 0 0 ${x + w},${yEnd - r}V${yBase}Z`
}

function frame(width, height, inner) {
  return `<svg class="chart" viewBox="0 0 ${width} ${height}" width="100%" preserveAspectRatio="xMidYMid meet" role="img">${inner}</svg>`
}

function yAxis({ ticks, y, width, format, zero }) {
  return ticks.map(t => {
    const ty = y(t)
    const isZero = zero !== undefined && t === zero
    return `<line x1="${PAD.left}" x2="${width - PAD.right}" y1="${ty}" y2="${ty}" stroke="${isZero ? BASELINE : GRID}" stroke-width="1"/>` +
      `<text x="${PAD.left - 8}" y="${ty + 3}" text-anchor="end" class="tick">${format(t)}</text>`
  }).join('')
}

function monthLabels({ monthly, band, height }) {
  const names = band < 28 ? MONTH_INITIALS : MONTHS
  return monthly.map((m, i) => {
    const cx = PAD.left + band * i + band / 2
    return `<text x="${cx}" y="${height - 8}" text-anchor="middle" class="tick${m.isFuture ? ' future' : ''}">${names[i]}</text>`
  }).join('')
}

function emptyChart(width, height, message) {
  return frame(width, height,
    `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="10" fill="#F8FAFC" stroke="${GRID}"/>` +
    `<text x="${width / 2}" y="${height / 2 + 4}" text-anchor="middle" class="empty">${message}</text>`)
}

// Grouped columns: previous year (light step) beside the selected year (accent).
export function monthlyColumnChart(monthly, { width = 672, height = 210 } = {}) {
  const values = monthly.flatMap(m => [m.total, m.prevYearTotal])
  if (values.every(v => !v)) return emptyChart(width, height, 'No sales recorded for this period')

  const { hi, ticks } = niceTicks(0, Math.max(...values))
  const plotH = height - PAD.top - PAD.bottom
  const plotW = width - PAD.left - PAD.right
  const y = v => PAD.top + plotH - (v / hi) * plotH
  const band = plotW / 12
  const barW = Math.min(16, (band - 6) / 2 * 0.8)
  const yBase = y(0)

  let peak = -1
  monthly.forEach((m, i) => { if (!m.isFuture && m.total > 0 && (peak < 0 || m.total > monthly[peak].total)) peak = i })

  const bars = monthly.map((m, i) => {
    const gx = PAD.left + band * i + (band - (barW * 2 + 2)) / 2
    let out = ''
    if (m.prevYearTotal > 0) out += `<path d="${barPath(gx, barW, yBase, y(m.prevYearTotal))}" fill="${SERIES.previous}"/>`
    if (!m.isFuture && m.total > 0) out += `<path d="${barPath(gx + barW + 2, barW, yBase, y(m.total))}" fill="${SERIES.current}"/>`
    if (i === peak) {
      out += `<text x="${gx + barW + 2 + barW / 2}" y="${y(m.total) - 6}" text-anchor="middle" class="value">${compactPHP(m.total)}</text>`
    }
    return out
  }).join('')

  return frame(width, height,
    yAxis({ ticks, y, width, format: compactPHP, zero: 0 }) +
    bars +
    monthLabels({ monthly, band, height }))
}

// Diverging columns around zero: growth up in the accent, decline in red.
export function growthChart(monthly, { width = 672, height = 190 } = {}) {
  const vals = monthly.map(m => m.growth).filter(v => v != null)
  if (!vals.length) return emptyChart(width, height, 'Not enough monthly history to measure growth yet')

  const maxV = Math.max(...vals)
  const minV = Math.min(...vals)
  const plotH = height - PAD.top - PAD.bottom
  const plotW = width - PAD.left - PAD.right

  let { lo, hi, ticks, step } = niceTicks(Math.min(0, minV), Math.max(0, Math.min(maxV, GROWTH_CAP)))
  // Keep room under the deepest decline for its label
  if (minV < 0 && ((minV - lo) / (hi - lo)) * plotH < 14) {
    lo -= step
    ticks = [Number(lo.toFixed(10)), ...ticks]
  }
  // A decline bottoms out at -100%, so ticks past it carry no meaning
  ticks = ticks.filter(t => t >= -100)

  const y = v => PAD.top + plotH - ((v - lo) / (hi - lo)) * plotH
  const band = plotW / 12
  const barW = Math.min(20, band * 0.55)
  const yZero = y(0)
  const maxI = monthly.findIndex(m => m.growth === maxV)
  const minI = monthly.findIndex(m => m.growth === minV)

  const bars = monthly.map((m, i) => {
    if (m.growth == null) return ''
    const x = PAD.left + band * i + (band - barW) / 2
    const clipped = m.growth > hi
    const end = y(Math.min(m.growth, hi))
    const fill = m.growth >= 0 ? SERIES.current : SERIES.decline
    let out = `<path d="${barPath(x, barW, yZero, end)}" fill="${fill}"/>`
    if (clipped) {
      const b = end + 9
      out += `<path d="M${x - 1},${b + 3}L${x + barW + 1},${b - 2}M${x - 1},${b + 7}L${x + barW + 1},${b + 2}" stroke="#FFFFFF" stroke-width="2"/>`
    }
    if ((i === maxI && maxV > 0) || (i === minI && minV < 0) || clipped) {
      const ly = m.growth >= 0 ? end - 6 : end + 12
      out += `<text x="${x + barW / 2}" y="${ly}" text-anchor="middle" class="value">${signedPct(m.growth)}</text>`
    }
    return out
  }).join('')

  return frame(width, height,
    yAxis({ ticks, y, width, format: signedPct, zero: 0 }) +
    bars +
    monthLabels({ monthly, band, height }))
}

// Cumulative running total: the selected year as a line over a 10% wash, the
// previous year as a lighter reference line. The selected year stops at the
// current month so future months never read as flat growth.
export function cumulativeChart(monthly, { width = 672, height = 190 } = {}) {
  let run = 0
  const prev = monthly.map(m => (run += m.prevYearTotal))
  const cur = monthly.map(m => m.cumulative)
  const all = [...prev, ...cur.filter(v => v != null)]
  if (all.every(v => !v)) return emptyChart(width, height, 'No sales recorded for this period')

  const { hi, ticks } = niceTicks(0, Math.max(...all))
  const plotH = height - PAD.top - PAD.bottom
  const plotW = width - PAD.left - PAD.right
  const y = v => PAD.top + plotH - (v / hi) * plotH
  const band = plotW / 12
  const x = i => PAD.left + band * i + band / 2

  const line = pts => pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`).join('')

  const prevPts = prev[11] > 0 ? prev.map((v, i) => [x(i), y(v)]) : []
  const curPts = cur.map((v, i) => (v == null ? null : [x(i), y(v)])).filter(Boolean)

  let out = yAxis({ ticks, y, width, format: compactPHP, zero: 0 })
  if (prevPts.length) {
    out += `<path d="${line(prevPts)}" fill="none" stroke="${SERIES.previous}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`
  }
  if (curPts.length) {
    const last = curPts[curPts.length - 1]
    const area = `${line(curPts)}L${last[0].toFixed(1)},${y(0)}L${curPts[0][0].toFixed(1)},${y(0)}Z`
    out += `<path d="${area}" fill="${SERIES.current}" fill-opacity="0.1"/>`
    out += `<path d="${line(curPts)}" fill="none" stroke="${SERIES.current}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`
    out += `<circle cx="${last[0]}" cy="${last[1]}" r="4" fill="${SERIES.current}" stroke="#FFFFFF" stroke-width="2"/>`
    const lastVal = cur.filter(v => v != null).pop()
    const nearRight = last[0] > width - PAD.right - 70
    out += `<text x="${nearRight ? last[0] - 8 : last[0] + 8}" y="${last[1] - 8}" text-anchor="${nearRight ? 'end' : 'start'}" class="value">${compactPHP(lastVal)}</text>`
  }
  out += monthLabels({ monthly, band, height })
  return frame(width, height, out)
}
