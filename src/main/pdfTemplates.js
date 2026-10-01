// HTML templates for the A4 PDF reports. Pure functions of the report data so
// they can be rendered by the hidden print window with JavaScript disabled.
// Every user-supplied string goes through esc() before it reaches the markup.

import { monthlyColumnChart, growthChart, cumulativeChart, SERIES } from './pdfCharts'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ESCAPES[c])

const php = n => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(n || 0)
const num = n => new Intl.NumberFormat('en-PH').format(n || 0)
const dateLong = s => (s ? new Date(`${s}T00:00:00`).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : '—')
const dateShort = s => (s ? new Date(`${s}T00:00:00`).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—')
const stamp = d => d.toLocaleString('en-PH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
const pct = (v, digits = 1) => (v == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(digits)}%`)
const pad = (n, len = 2) => String(n).padStart(len, '0')
const refStamp = d => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`

// ─── Shared pieces ────────────────────────────────────────────────────────────

const ICON_TREND = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>'
const ARROW_UP = '<svg width="7" height="7" viewBox="0 0 10 10"><path d="M5 1 9 8H1Z" fill="currentColor"/></svg>'
const ARROW_DOWN = '<svg width="7" height="7" viewBox="0 0 10 10"><path d="M5 9 1 2h8Z" fill="currentColor"/></svg>'

function delta(value, versus) {
  if (value == null) return `<div class="delta neutral">No ${esc(versus)} baseline</div>`
  if (Math.abs(value) < 0.05) return `<div class="delta neutral">No change vs ${esc(versus)}</div>`
  const up = value >= 0
  return `<div class="delta ${up ? 'up' : 'down'}">${up ? ARROW_UP : ARROW_DOWN}<span>${pct(value)} vs ${esc(versus)}</span></div>`
}

function masthead({ brand, kind, title, subtitle, meta }) {
  const brandMeta = [brand.companyAddress, brand.companyContact].filter(Boolean).map(esc).join(' · ')
  return `
  <header class="masthead">
    <div class="glow"></div>
    <div class="brand-row">
      <div class="brand">
        <div class="brand-mark">${ICON_TREND}</div>
        <div>
          <div class="brand-name">${esc(brand.companyName)}</div>
          ${brandMeta ? `<div class="brand-meta">${brandMeta}</div>` : ''}
        </div>
      </div>
      <div class="doc-kind">${esc(kind)}</div>
    </div>
    <h1 class="doc-title">${title}</h1>
    <div class="doc-sub">${subtitle}</div>
    <div class="meta-strip">
      ${meta.map(([k, v]) => `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}
    </div>
  </header>`
}

function kpi({ label, value, sub = '', primary = false }) {
  return `
    <div class="kpi${primary ? ' primary' : ''}">
      <div class="kpi-label">${esc(label)}</div>
      <div class="kpi-value">${value}</div>
      ${sub}
    </div>`
}

function sectionHead(index, title, note = '') {
  return `
    <div class="section-head">
      <div><span class="section-index">${pad(index)}</span><span class="section-title">${esc(title)}</span></div>
      ${note ? `<div class="section-note">${note}</div>` : ''}
    </div>`
}

function legend(year) {
  return `
    <div class="legend">
      <span><i class="swatch" style="background:${SERIES.previous}"></i>${year - 1}</span>
      <span><i class="swatch" style="background:${SERIES.current}"></i>${year}</span>
    </div>`
}

function growthLegend() {
  return `
    <div class="legend">
      <span><i class="swatch" style="background:${SERIES.current}"></i>Growth</span>
      <span><i class="swatch" style="background:${SERIES.decline}"></i>Decline</span>
    </div>`
}

function lineLegend(year) {
  return `
    <div class="legend">
      <span><i class="line-key" style="background:${SERIES.previous}"></i>${year - 1}</span>
      <span><i class="line-key" style="background:${SERIES.current}"></i>${year}</span>
    </div>`
}

function chartPanel({ legendHtml, svg, caption }) {
  return `
    <div class="panel chart-panel">
      <div class="panel-top">${legendHtml}</div>
      ${svg}
      ${caption ? `<div class="caption">${caption}</div>` : ''}
    </div>`
}

function growthCell(v) {
  if (v == null) return '<span class="muted">—</span>'
  return `<span class="${v >= 0 ? 'pos' : 'neg'}">${pct(v)}</span>`
}

function monthlyTable(monthly, year, { amountLabel }) {
  const total = monthly.reduce((s, m) => s + m.total, 0)
  const count = monthly.reduce((s, m) => s + m.count, 0)
  const prevTotal = monthly.reduce((s, m) => s + m.prevYearTotal, 0)
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Month</th>
            <th class="num">Transactions</th>
            <th class="num">${esc(amountLabel)} ${year}</th>
            <th class="num">${year - 1}</th>
            <th class="num">MoM growth</th>
            <th class="num">Share</th>
            <th class="num">Cumulative</th>
          </tr>
        </thead>
        <tbody>
          ${monthly.map(m => `
            <tr class="${m.isFuture ? 'future' : ''}">
              <td class="strong">${MONTH_NAMES[m.month - 1]}${m.inProgress ? ' <span class="sub">month to date</span>' : ''}</td>
              <td class="num">${m.isFuture ? '—' : num(m.count)}</td>
              <td class="num strong">${m.isFuture ? '<span class="muted">Upcoming</span>' : php(m.total)}</td>
              <td class="num muted-ink">${php(m.prevYearTotal)}</td>
              <td class="num">${m.inProgress ? '<span class="muted">In progress</span>' : growthCell(m.growth)}</td>
              <td class="num">${!m.isFuture && total ? `${((m.total / total) * 100).toFixed(1)}%` : '—'}</td>
              <td class="num">${m.cumulative == null ? '—' : php(m.cumulative)}</td>
            </tr>`).join('')}
        </tbody>
        <tfoot>
          <tr class="grand">
            <td>Full year</td>
            <td class="num">${num(count)}</td>
            <td class="num">${php(total)}</td>
            <td class="num">${php(prevTotal)}</td>
            <td class="num"></td>
            <td class="num">${total ? '100%' : '—'}</td>
            <td class="num">${php(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>`
}

function rankBadge(rank) {
  const tier = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : ''
  return `<span class="rank ${tier}">${rank}</span>`
}

function growthFootnote(year) {
  return `Month-over-month growth compares each month with the month before it; January compares with December ${year - 1}.
    Months with no sales in the prior month, the month still in progress, and months that have not happened yet show no growth bar.
    Bars above +300% are clipped and labelled with their actual value.`
}

function comparisonNote(comparison) {
  return comparison.isYtd
    ? `Year-over-year changes compare January 1 to today with the same dates in ${comparison.label.split(' ')[0]}.`
    : ''
}

function documentShell(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<style>${CSS}</style>
</head>
<body>${body}</body>
</html>`
}

// ─── Annual sales report ──────────────────────────────────────────────────────

export function buildYearlyReportHtml(report, { brand, preparedBy, generatedAt = new Date() }) {
  const { year, totals, comparison, monthly, bestMonth, topBuyers, topTransactions } = report
  const frequentBuyers = report.frequentBuyers || []
  const frequent = frequentBuyers[0]
  const hasSales = totals.count > 0
  const topBuyer = topBuyers[0]
  const largest = topTransactions[0]

  const head = masthead({
    brand,
    kind: 'Annual Sales Report',
    title: `Sales Performance ${year}`,
    subtitle: `Reporting period January 1 – December 31, ${year}`,
    meta: [
      ['Prepared by', preparedBy],
      ['Generated', stamp(generatedAt)],
      ['Reference', `AR-${year}-${refStamp(generatedAt)}`]
    ]
  })

  const kpis = `
    <div class="kpis">
      ${kpi({ label: 'Total revenue', value: php(totals.total), sub: delta(totals.revenueGrowth, comparison.label), primary: true })}
      ${kpi({ label: 'Transactions', value: num(totals.count), sub: delta(totals.countGrowth, comparison.label) })}
      ${kpi({ label: 'Active buyers', value: num(totals.buyers), sub: delta(totals.buyersGrowth, comparison.label) })}
      ${kpi({ label: 'Average sale', value: php(totals.average), sub: '<div class="delta neutral">Per transaction</div>' })}
    </div>`

  const highlights = `
    <div class="highlights">
      <div class="highlight">
        <div class="hl-label">Best month</div>
        <div class="hl-value">${bestMonth ? MONTH_NAMES[bestMonth.month - 1] : '—'}</div>
        <div class="hl-sub">${bestMonth ? `${php(bestMonth.total)} · ${num(bestMonth.count)} transactions` : 'No sales yet'}</div>
      </div>
      <div class="highlight">
        <div class="hl-label">Top buyer</div>
        <div class="hl-value">${topBuyer ? esc(topBuyer.full_name) : '—'}</div>
        <div class="hl-sub">${topBuyer ? `${php(topBuyer.total_amount)} · ${topBuyer.share.toFixed(1)}% of revenue` : 'No buyers yet'}</div>
      </div>
      <div class="highlight">
        <div class="hl-label">Most frequent buyer</div>
        <div class="hl-value">${frequent ? esc(frequent.full_name) : '—'}</div>
        <div class="hl-sub">${frequent ? `${num(frequent.transaction_count)} transactions · ${php(frequent.total_amount)}` : 'No buyers yet'}</div>
      </div>
      <div class="highlight">
        <div class="hl-label">Largest sale</div>
        <div class="hl-value">${largest ? php(largest.amount) : '—'}</div>
        <div class="hl-sub">${largest ? `${esc(largest.customer_name)} · ${dateShort(largest.date)}` : 'No sales yet'}</div>
      </div>
    </div>`

  const charts = hasSales || monthly.some(m => m.prevYearTotal > 0) ? `
    <section class="keep">
      ${sectionHead(1, 'Monthly revenue', `${year} compared with ${year - 1}`)}
      ${chartPanel({ legendHtml: legend(year), svg: monthlyColumnChart(monthly) })}
    </section>
    <section class="keep">
      ${sectionHead(2, 'Month-over-month growth', 'Change in revenue versus the previous month')}
      ${chartPanel({ legendHtml: growthLegend(), svg: growthChart(monthly), caption: growthFootnote(year) })}
    </section>
    <section class="keep">
      ${sectionHead(3, 'Cumulative revenue', 'Year-to-date running total')}
      ${chartPanel({ legendHtml: lineLegend(year), svg: cumulativeChart(monthly) })}
    </section>` : `
    <section>
      <div class="panel empty-panel">No sales were recorded in ${year} or ${year - 1}.</div>
    </section>`

  const breakdown = `
    <section>
      ${sectionHead(4, 'Monthly breakdown', 'Every value plotted above, in table form')}
      ${monthlyTable(monthly, year, { amountLabel: 'Revenue' })}
    </section>`

  const buyers = `
    <section>
      ${sectionHead(5, topBuyers.length ? `Top ${topBuyers.length} buyers` : 'Top buyers', `Ranked by total purchases in ${year}`)}
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th style="width:34px">Rank</th>
              <th>Customer</th>
              <th class="num">Transactions</th>
              <th class="num">Largest</th>
              <th class="num">Last purchase</th>
              <th class="num">Total</th>
              <th style="width:120px">Share of revenue</th>
            </tr>
          </thead>
          <tbody>
            ${topBuyers.length ? topBuyers.map((b, i) => `
              <tr>
                <td>${rankBadge(i + 1)}</td>
                <td><div class="strong">${esc(b.full_name)}</div>${b.email || b.phone ? `<div class="sub">${esc(b.email || b.phone)}</div>` : ''}</td>
                <td class="num">${num(b.transaction_count)}</td>
                <td class="num">${php(b.largest_amount)}</td>
                <td class="num">${dateShort(b.last_purchase)}</td>
                <td class="num strong">${php(b.total_amount)}</td>
                <td>
                  <div class="share">
                    <div class="share-track"><div class="share-fill" style="width:${Math.max(1.5, b.share).toFixed(2)}%"></div></div>
                    <span>${b.share.toFixed(1)}%</span>
                  </div>
                </td>
              </tr>`).join('') : '<tr><td colspan="7" class="empty-row">No buyers recorded this year.</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>`

  const maxVisits = Math.max(1, ...frequentBuyers.map(b => b.transaction_count))
  const frequentSection = `
    <section>
      ${sectionHead(6, 'Most frequent buyers', `Ranked by number of transactions in ${year}`)}
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th style="width:34px">Rank</th>
              <th>Customer</th>
              <th class="num">Transactions</th>
              <th class="num">Active months</th>
              <th class="num">Avg per visit</th>
              <th class="num">Total</th>
              <th style="width:120px">Share of transactions</th>
            </tr>
          </thead>
          <tbody>
            ${frequentBuyers.length ? frequentBuyers.map((b, i) => `
              <tr>
                <td>${rankBadge(i + 1)}</td>
                <td><div class="strong">${esc(b.full_name)}</div>${b.email || b.phone ? `<div class="sub">${esc(b.email || b.phone)}</div>` : ''}</td>
                <td class="num strong">${num(b.transaction_count)}</td>
                <td class="num">${num(b.active_months)} of 12</td>
                <td class="num">${php(b.average)}</td>
                <td class="num">${php(b.total_amount)}</td>
                <td>
                  <div class="share">
                    <div class="share-track violet"><div class="share-fill violet" style="width:${Math.max(1.5, (b.transaction_count / maxVisits) * 100).toFixed(2)}%"></div></div>
                    <span>${b.share.toFixed(1)}%</span>
                  </div>
                </td>
              </tr>`).join('') : '<tr><td colspan="7" class="empty-row">No buyers recorded this year.</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>`

  const txns = `
    <section>
      ${sectionHead(7, 'Top transactions', `Largest single sales in ${year}`)}
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th style="width:34px">Rank</th>
              <th>Date</th>
              <th>Customer</th>
              <th>Description</th>
              <th class="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${topTransactions.length ? topTransactions.map((t, i) => `
              <tr>
                <td>${rankBadge(i + 1)}</td>
                <td class="nowrap">${dateShort(t.date)}</td>
                <td class="strong">${esc(t.customer_name)}</td>
                <td class="muted-ink">${t.description ? esc(t.description) : '—'}</td>
                <td class="num strong">${php(t.amount)}</td>
              </tr>`).join('') : '<tr><td colspan="5" class="empty-row">No transactions recorded this year.</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>`

  const closing = `
    <div class="closing">
      <div>${esc(brand.footerNote)}</div>
      <div>Figures are in Philippine pesos and come from the transactions recorded in ${esc(brand.companyName)} as of ${stamp(generatedAt)}.
        ${comparisonNote(comparison)}</div>
    </div>`

  return documentShell(`Annual Sales Report ${year}`, head + kpis + highlights + charts + breakdown + buyers + frequentSection + txns + closing)
}

// ─── Customer statement & yearly audit ────────────────────────────────────────

export function buildBuyerStatementHtml(statement, { brand, preparedBy, generatedAt = new Date() }) {
  const { year, customer, transactions, monthly, comparison, audit } = statement
  const contact = [customer.email, customer.phone].filter(Boolean).map(esc).join(' · ')

  const head = masthead({
    brand,
    kind: 'Customer Statement & Yearly Audit',
    title: esc(customer.full_name),
    subtitle: `${contact ? `${contact} · ` : ''}Customer since ${dateLong(String(customer.created_at || '').slice(0, 10))}`,
    meta: [
      ['Statement period', `Jan 1 – Dec 31, ${year}`],
      ['Customer ID', `C-${pad(customer.id, 5)}`],
      ['Prepared by', preparedBy],
      ['Generated', stamp(generatedAt)]
    ]
  })

  const kpis = `
    <div class="kpis kpis-5">
      ${kpi({ label: `Total spent ${year}`, value: php(audit.total), sub: delta(audit.growth, comparison.label), primary: true })}
      ${kpi({ label: 'Transactions', value: num(audit.count), sub: `<div class="delta neutral">${num(audit.prevCount)} in ${esc(comparison.label)}</div>` })}
      ${kpi({ label: 'Average purchase', value: php(audit.average), sub: '<div class="delta neutral">Per transaction</div>' })}
      ${kpi({ label: 'Buyer rank', value: audit.rank ? `#${audit.rank}` : '—', sub: `<div class="delta neutral">of ${num(audit.buyerCount)} buyers</div>` })}
      ${kpi({ label: 'Revenue share', value: `${audit.share.toFixed(1)}%`, sub: `<div class="delta neutral">of ${php(audit.yearRevenue)}</div>` })}
    </div>`

  const auditItems = [
    ['First purchase', dateLong(audit.firstPurchase)],
    ['Last purchase', dateLong(audit.lastPurchase)],
    ['Largest purchase', audit.largest ? `${php(audit.largest.amount)} <span class="sub">· ${dateShort(audit.largest.date)}</span>` : '—'],
    ['Smallest purchase', audit.smallest ? `${php(audit.smallest.amount)} <span class="sub">· ${dateShort(audit.smallest.date)}</span>` : '—'],
    ['Active months', `${audit.activeMonths} of 12`],
    ['Best month', audit.bestMonth ? `${MONTH_NAMES[audit.bestMonth.month - 1]} <span class="sub">· ${php(audit.bestMonth.total)}</span>` : '—'],
    ['Average days between purchases', audit.avgDaysBetween == null ? '—' : `${audit.avgDaysBetween.toFixed(1)} days`],
    [comparison.isYtd ? `Spent in ${comparison.label}` : `Total spent ${year - 1}`, php(audit.prevTotal)],
    ['Year-over-year change', audit.growth == null ? '<span class="muted">No prior-year purchases</span>' : growthCell(audit.growth)],
    ['Lifetime total (all years)', `${php(customer.total_purchases)} <span class="sub">· ${num(customer.transaction_count)} transactions</span>`]
  ]

  const auditGrid = `
    <section class="keep">
      ${sectionHead(1, 'Yearly audit summary', `Activity for ${year}`)}
      <div class="audit-grid">
        ${auditItems.map(([k, v]) => `<div class="audit-item"><div class="k">${esc(k)}</div><div class="v">${v}</div></div>`).join('')}
      </div>
    </section>`

  const hasHistory = audit.count > 0 || audit.prevTotal > 0
  const charts = hasHistory ? `
    <section class="keep">
      ${sectionHead(2, 'Monthly spending', `${year} compared with ${year - 1}`)}
      ${chartPanel({ legendHtml: legend(year), svg: monthlyColumnChart(monthly, { height: 172 }) })}
    </section>
    <section class="keep">
      ${sectionHead(3, 'Spending growth', 'Month-over-month change and year-to-date total')}
      <div class="split">
        ${chartPanel({ legendHtml: growthLegend(), svg: growthChart(monthly, { width: 320, height: 176 }) })}
        ${chartPanel({ legendHtml: lineLegend(year), svg: cumulativeChart(monthly, { width: 320, height: 176 }) })}
      </div>
      <div class="caption standalone">${growthFootnote(year)}</div>
    </section>` : ''

  const summary = `
    <section class="keep">
      ${sectionHead(4, 'Monthly summary')}
      ${monthlyTable(monthly, year, { amountLabel: 'Spent' })}
    </section>`

  const byMonth = new Map()
  transactions.forEach(t => {
    const m = parseInt(t.date.slice(5, 7), 10)
    if (!byMonth.has(m)) byMonth.set(m, [])
    byMonth.get(m).push(t)
  })

  let seq = 0
  const ledgerRows = [...byMonth.entries()].map(([m, rows]) => {
    const subtotal = rows.reduce((s, t) => s + t.amount, 0)
    return `
      <tr class="group"><td colspan="5">${MONTH_NAMES[m - 1]} ${year}<span>${rows.length} transaction${rows.length === 1 ? '' : 's'}</span></td></tr>
      ${rows.map(t => `
        <tr>
          <td class="muted-ink">${++seq}</td>
          <td class="nowrap">${dateShort(t.date)}</td>
          <td>${t.description ? esc(t.description) : '<span class="muted">—</span>'}</td>
          <td class="num strong">${php(t.amount)}</td>
          <td class="num muted-ink">${php(t.running_total)}</td>
        </tr>`).join('')}
      <tr class="subtotal"><td colspan="3">${MONTH_NAMES[m - 1]} subtotal</td><td class="num">${php(subtotal)}</td><td></td></tr>`
  }).join('')

  const ledger = `
    <section>
      ${sectionHead(5, 'Transaction ledger', `All ${num(audit.count)} transactions in ${year}, oldest first`)}
      <div class="table-wrap">
        <table class="ledger">
          <thead>
            <tr>
              <th style="width:34px">#</th>
              <th style="width:96px">Date</th>
              <th>Description</th>
              <th class="num">Amount</th>
              <th class="num">Running total</th>
            </tr>
          </thead>
          <tbody>
            ${ledgerRows || `<tr><td colspan="5" class="empty-row">No transactions recorded for ${esc(customer.full_name)} in ${year}.</td></tr>`}
          </tbody>
          <tfoot>
            <tr class="grand">
              <td colspan="3">Total for ${year} · ${num(audit.count)} transaction${audit.count === 1 ? '' : 's'}</td>
              <td class="num">${php(audit.total)}</td>
              <td class="num">${php(audit.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>`

  const signoff = `
    <section class="keep">
      ${sectionHead(6, 'Control totals & sign-off')}
      <div class="panel controls">
        <div><span>Transactions</span><b>${num(audit.count)}</b></div>
        <div><span>Total amount</span><b>${php(audit.total)}</b></div>
        <div><span>Period covered</span><b>${audit.count ? `${dateShort(audit.firstPurchase)} – ${dateShort(audit.lastPurchase)}` : '—'}</b></div>
      </div>
      <div class="signatures">
        <div class="sig"><div class="sig-line"></div><div class="sig-label">Prepared by</div><div class="sig-name">${esc(preparedBy)}</div></div>
        <div class="sig"><div class="sig-line"></div><div class="sig-label">Reviewed by</div><div class="sig-name">&nbsp;</div></div>
        <div class="sig"><div class="sig-line"></div><div class="sig-label">Customer acknowledgment</div><div class="sig-name">${esc(customer.full_name)}</div></div>
      </div>
      <div class="closing">
        <div>${esc(brand.footerNote)}</div>
        <div>Amounts are in Philippine pesos and reflect the transactions recorded for this customer as of ${stamp(generatedAt)}.
          ${comparisonNote(comparison)}</div>
      </div>
    </section>`

  return documentShell(
    `Customer Statement ${customer.full_name} ${year}`,
    head + kpis + auditGrid + charts + summary + ledger + signoff
  )
}

// ─── Print footer (rendered by Chromium in the bottom page margin) ───────────

export function footerTemplate(label) {
  return `
    <div style="width:100%;padding:0 12mm;font-size:7.5px;font-family:'Segoe UI',Roboto,'Helvetica Neue',Arial,system-ui,sans-serif;color:#94A3B8;display:flex;justify-content:space-between;align-items:center;">
      <span>${esc(label)}</span>
      <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
    </div>`
}

// ─── Stylesheet ───────────────────────────────────────────────────────────────

const CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body {
  font-family: 'Inter', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, system-ui, sans-serif;
  font-size: 10.5px; line-height: 1.45; color: #0F172A; background: #FFFFFF;
}

.masthead {
  position: relative; overflow: hidden;
  background: #0B1120; color: #FFFFFF;
  border-radius: 14px; padding: 20px 24px 16px;
}
.masthead .glow {
  position: absolute; right: -90px; top: -120px; width: 340px; height: 340px; border-radius: 50%;
  background: radial-gradient(circle, rgba(37,99,235,0.55) 0%, rgba(37,99,235,0) 70%);
}
.brand-row { position: relative; display: flex; justify-content: space-between; align-items: flex-start; }
.brand { display: flex; align-items: center; gap: 10px; }
.brand-mark { width: 30px; height: 30px; border-radius: 9px; background: #2563EB; display: flex; align-items: center; justify-content: center; }
.brand-name { font-size: 12.5px; font-weight: 700; letter-spacing: 0.01em; }
.brand-meta { font-size: 9px; color: #94A3B8; margin-top: 1px; }
.doc-kind { font-size: 8.5px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: #93C5FD; text-align: right; padding-top: 4px; }
.doc-title { position: relative; font-size: 25px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.15; margin-top: 18px; }
.doc-sub { position: relative; font-size: 10.5px; color: #CBD5E1; margin-top: 3px; }
.meta-strip { position: relative; display: flex; gap: 22px; margin-top: 14px; padding-top: 11px; border-top: 1px solid rgba(255,255,255,0.12); }
.meta-strip div { display: flex; flex-direction: column; gap: 1px; }
.meta-strip span { font-size: 7.5px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #64748B; }
.meta-strip b { font-size: 9.5px; font-weight: 600; color: #E2E8F0; }

.kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 9px; margin-top: 12px; break-inside: avoid; }
.kpis-5 { grid-template-columns: 1.35fr repeat(4, 1fr); }
.kpi { border: 1px solid #E2E8F0; border-radius: 12px; padding: 11px 13px; background: #FFFFFF; min-width: 0; }
.kpi.primary { background: linear-gradient(135deg, #2563EB 0%, #1E40AF 100%); border-color: transparent; color: #FFFFFF; }
.kpi-label { font-size: 7.5px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #64748B; }
.kpi.primary .kpi-label { color: #BFDBFE; }
.kpi-value { font-size: 16px; font-weight: 700; letter-spacing: -0.01em; margin-top: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kpi.primary .kpi-value { font-size: 17px; }
.delta { display: inline-flex; align-items: center; gap: 4px; margin-top: 5px; font-size: 8.5px; font-weight: 600; }
.delta.up { color: #15803D; }
.delta.down { color: #B91C1C; }
.delta.neutral { color: #94A3B8; font-weight: 500; }
.kpi.primary .delta { color: #FFFFFF; background: rgba(255,255,255,0.16); padding: 2px 7px; border-radius: 999px; }
.kpi.primary .delta.neutral { color: #DBEAFE; }

.highlights { display: grid; grid-template-columns: repeat(4, 1fr); gap: 9px; margin-top: 9px; break-inside: avoid; }
.highlight { border-radius: 12px; padding: 10px 13px; background: #F8FAFC; border: 1px solid #EEF2F6; min-width: 0; }
.hl-label { font-size: 7.5px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #64748B; }
.hl-value { font-size: 12.5px; font-weight: 700; margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hl-sub { font-size: 9px; color: #64748B; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

section { margin-top: 16px; }
section.keep { break-inside: avoid; }
.section-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 7px; break-after: avoid; }
.section-index { font-size: 8.5px; font-weight: 800; color: #2563EB; letter-spacing: 0.08em; margin-right: 8px; }
.section-title { font-size: 12.5px; font-weight: 700; color: #0F172A; letter-spacing: -0.005em; }
.section-note { font-size: 8.5px; color: #64748B; }

.panel { border: 1px solid #E2E8F0; border-radius: 12px; padding: 12px 14px 8px; background: #FFFFFF; break-inside: avoid; }
.panel-top { display: flex; justify-content: flex-end; margin-bottom: 2px; }
.legend { display: flex; gap: 14px; font-size: 8.5px; color: #475569; }
.legend span { display: inline-flex; align-items: center; gap: 5px; }
.swatch { display: inline-block; width: 9px; height: 9px; border-radius: 3px; }
.line-key { display: inline-block; width: 14px; height: 2px; border-radius: 2px; }
.caption { font-size: 8px; color: #94A3B8; margin-top: 4px; line-height: 1.5; }
.caption.standalone { margin-top: 6px; }
.split { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
.empty-panel { text-align: center; color: #64748B; padding: 28px; }

.chart { display: block; overflow: visible; }
.chart text { font-family: inherit; }
.chart .tick { font-size: 8.5px; fill: #94A3B8; font-variant-numeric: tabular-nums; }
.chart .tick.future { fill: #CBD5E1; }
.chart .value { font-size: 8.5px; font-weight: 700; fill: #334155; }
.chart .empty { font-size: 10px; fill: #94A3B8; }

.table-wrap { border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden; }
table { width: 100%; border-collapse: collapse; font-size: 9.5px; }
thead { display: table-header-group; }
tfoot { display: table-row-group; }
tr { break-inside: avoid; }
th {
  text-align: left; font-size: 7.5px; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase;
  color: #64748B; background: #F8FAFC; padding: 7px 10px; border-bottom: 1px solid #E2E8F0; white-space: nowrap;
}
td { padding: 6px 10px; border-bottom: 1px solid #F1F5F9; vertical-align: middle; }
tbody tr:last-child td { border-bottom: none; }
.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.nowrap { white-space: nowrap; }
.strong { font-weight: 600; color: #0F172A; }
.sub { font-size: 8.5px; color: #94A3B8; font-weight: 400; }
.muted { color: #94A3B8; }
.muted-ink { color: #64748B; }
.pos { color: #15803D; font-weight: 600; }
.neg { color: #B91C1C; font-weight: 600; }
tr.future td { color: #94A3B8; }
tr.grand td { background: #0B1120; color: #FFFFFF; font-weight: 700; border-bottom: none; padding: 8px 10px; }
tr.group td { background: #EFF6FF; color: #1E3A8A; font-weight: 700; font-size: 9px; padding: 6px 10px; border-bottom: 1px solid #DBEAFE; }
tr.group td span { font-weight: 500; color: #3B82F6; margin-left: 8px; }
tr.subtotal td { background: #F8FAFC; font-weight: 600; color: #334155; font-size: 9px; border-bottom: 1px solid #E2E8F0; }
.empty-row { text-align: center; color: #94A3B8; padding: 18px; }

.rank {
  display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px;
  border-radius: 50%; font-size: 8.5px; font-weight: 700; background: #EFF6FF; color: #2563EB;
}
.rank.gold { background: #FEF3C7; color: #B45309; }
.rank.silver { background: #F1F5F9; color: #475569; }
.rank.bronze { background: #FFEDD5; color: #C2410C; }
.share { display: flex; align-items: center; gap: 7px; }
.share-track { flex: 1; height: 5px; border-radius: 999px; background: #DBEAFE; overflow: hidden; }
.share-fill { height: 100%; border-radius: 999px; background: #2563EB; }
.share-track.violet { background: #EDE9FE; }
.share-fill.violet { background: #7C3AED; }
.share span { font-size: 8.5px; font-weight: 600; color: #475569; width: 34px; text-align: right; font-variant-numeric: tabular-nums; }

.audit-grid { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden; }
.audit-item { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding: 7px 13px; border-bottom: 1px solid #F1F5F9; }
.audit-item:nth-child(odd) { border-right: 1px solid #F1F5F9; }
.audit-item:nth-last-child(-n+2) { border-bottom: none; }
.audit-item .k { font-size: 9px; color: #64748B; }
.audit-item .v { font-size: 10px; font-weight: 600; text-align: right; }

.controls { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; padding: 11px 14px; background: #F8FAFC; }
.controls div { display: flex; flex-direction: column; gap: 2px; }
.controls span { font-size: 7.5px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #64748B; }
.controls b { font-size: 11px; font-weight: 700; font-variant-numeric: tabular-nums; }
.signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; margin-top: 34px; }
.sig-line { border-top: 1px solid #94A3B8; }
.sig-label { font-size: 7.5px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #64748B; margin-top: 5px; }
.sig-name { font-size: 9.5px; font-weight: 600; margin-top: 1px; }

.closing { margin-top: 18px; padding-top: 10px; border-top: 1px solid #E2E8F0; font-size: 8px; color: #94A3B8; line-height: 1.6; break-inside: avoid; }
`
