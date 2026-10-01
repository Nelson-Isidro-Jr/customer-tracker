import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, MotionConfig } from 'framer-motion'
import {
  ChevronLeft, ChevronRight, ChevronsUpDown, LayoutDashboard, UserRound,
  FileDown, Loader2, Check, Search, ExternalLink, FileText, X,
  TrendingUp, TrendingDown, Minus, DollarSign, Receipt, Users, BarChart3,
  Trophy, Crown, CalendarDays, Hash, Percent, ArrowUpRight
} from 'lucide-react'
import {
  BarChart, Bar, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts'
import { useToast } from '../context/ToastContext'
import AnimatedNumber from '../components/AnimatedNumber'
import {
  formatPHP, formatNumber, formatDate, formatDateShort, formatCompactPHP, formatPct,
  MONTH_NAMES, MONTH_SHORT
} from '../utils/format'

// Same series colors as the PDF so the screen and the printout read alike
const C = { current: '#2563EB', previous: '#86B6EF', decline: '#E34948', grid: '#EEF2F6', tick: '#94A3B8' }
const GROWTH_CAP = 300
const EASE = [0.16, 1, 0.3, 1]

const STAGGER = { animate: { transition: { staggerChildren: 0.05 } } }
const RISE = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } }
}

const AXIS = { fontSize: 11, fill: C.tick }

// ─── Small building blocks ────────────────────────────────────────────────────

function DeltaPill({ value, versus, inverse = false }) {
  if (value == null) {
    return <span className={`text-[11px] font-medium ${inverse ? 'text-white/60' : 'text-slate-400'}`}>No {versus} baseline</span>
  }
  const flat = Math.abs(value) < 0.05
  const up = value > 0
  const Icon = flat ? Minus : up ? TrendingUp : TrendingDown
  const tone = inverse
    ? 'bg-white/15 text-white'
    : flat ? 'bg-slate-100 text-slate-500' : up ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${tone}`}>
      <Icon size={12} />
      {flat ? 'No change' : formatPct(value)} vs {versus}
    </span>
  )
}

function KpiCard({ label, value, format, icon: Icon, iconBg, footer, primary = false }) {
  if (primary) {
    return (
      <motion.div
        variants={RISE}
        whileHover={{ y: -3 }}
        className="relative overflow-hidden rounded-2xl p-5 text-white bg-gradient-to-br from-blue-600 to-indigo-700 shadow-lg shadow-blue-600/20"
      >
        <div className="absolute -right-10 -top-10 w-36 h-36 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex items-center justify-between mb-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-blue-100">{label}</span>
          <div className="w-9 h-9 bg-white/15 rounded-xl flex items-center justify-center">
            <Icon size={17} />
          </div>
        </div>
        <div className="relative text-2xl font-bold tracking-tight">
          <AnimatedNumber value={value} format={format} />
        </div>
        <div className="relative mt-2">{footer}</div>
      </motion.div>
    )
  }
  return (
    <motion.div variants={RISE} whileHover={{ y: -3 }} className="card p-5 transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
        <div className={`w-9 h-9 ${iconBg} rounded-xl flex items-center justify-center`}>
          <Icon size={17} className="text-white" />
        </div>
      </div>
      <div className="text-2xl font-bold text-slate-900 tracking-tight truncate">
        {typeof value === 'number' ? <AnimatedNumber value={value} format={format} /> : value}
      </div>
      <div className="mt-2">{footer}</div>
    </motion.div>
  )
}

function Panel({ title, subtitle, legend, children, className = '' }) {
  return (
    <motion.div variants={RISE} className={`card p-5 ${className}`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        {legend}
      </div>
      {children}
    </motion.div>
  )
}

function Legend({ items }) {
  return (
    <div className="flex items-center gap-4 flex-shrink-0">
      {items.map(({ label, color, line }) => (
        <span key={label} className="flex items-center gap-1.5 text-xs text-slate-500">
          <span
            className={line ? 'w-3.5 h-0.5 rounded-full' : 'w-2.5 h-2.5 rounded-[3px]'}
            style={{ background: color }}
          />
          {label}
        </span>
      ))}
    </div>
  )
}

function RankBadge({ rank, size = 'md' }) {
  const dims = size === 'sm' ? 'w-6 h-6 text-[10px]' : 'w-7 h-7 text-[11px]'
  const tone =
    rank === 1 ? 'bg-amber-100 text-amber-700' :
    rank === 2 ? 'bg-slate-100 text-slate-600' :
    rank === 3 ? 'bg-orange-100 text-orange-700' : 'bg-blue-50 text-blue-600'
  return (
    <div className={`${dims} rounded-full flex items-center justify-center font-bold flex-shrink-0 ${tone}`}>
      {rank === 1 ? <Crown size={size === 'sm' ? 11 : 13} /> : rank}
    </div>
  )
}

function Avatar({ name, size = 'md' }) {
  const initials = (name || '?').split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()
  const dims = size === 'lg' ? 'w-14 h-14 text-lg rounded-2xl' : 'w-9 h-9 text-xs rounded-xl'
  return (
    <div className={`${dims} bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold flex items-center justify-center flex-shrink-0`}>
      {initials}
    </div>
  )
}

function ChartTooltip({ active, payload, year, mode }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-white/95 backdrop-blur border border-slate-200 rounded-xl shadow-xl px-4 py-3 text-xs min-w-[180px]">
      <div className="font-semibold text-slate-800 mb-2">
        {MONTH_NAMES[d.month - 1]} {year}
        {d.inProgress && <span className="ml-1.5 text-[10px] font-medium text-blue-600">month to date</span>}
      </div>
      {mode === 'growth' ? (
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-500">Change vs previous month</span>
          <span className={`font-bold ${d.growth >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{formatPct(d.growth)}</span>
        </div>
      ) : (
        <div className="space-y-1">
          <TooltipRow color={C.current} label={year} value={mode === 'cumulative' ? d.cumulative : d.total} />
          <TooltipRow color={C.previous} label={year - 1} value={mode === 'cumulative' ? d.prevCumulative : d.prev} />
          {mode === 'monthly' && d.growth != null && (
            <div className="flex items-center justify-between gap-4 pt-1 mt-1 border-t border-slate-100">
              <span className="text-slate-500">MoM growth</span>
              <span className={`font-semibold ${d.growth >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{formatPct(d.growth)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function TooltipRow({ color, label, value }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-1.5 text-slate-500">
        <span className="w-2 h-2 rounded-sm" style={{ background: color }} />{label}
      </span>
      <span className="font-bold text-slate-800">{value == null ? '—' : formatPHP(value)}</span>
    </div>
  )
}

// Bar with a rounded data end that works for negative values too, and a break
// mark when a growth spike is clipped at GROWTH_CAP.
function GrowthBar({ x, y, width, height, payload }) {
  if (!height || payload.growth == null) return null
  const top = Math.min(y, y + height)
  const h = Math.abs(height)
  const neg = payload.growth < 0
  const r = Math.min(4, width / 2, h)
  const d = neg
    ? `M${x},${top}V${top + h - r}A${r},${r} 0 0 0 ${x + r},${top + h}H${x + width - r}A${r},${r} 0 0 0 ${x + width},${top + h - r}V${top}Z`
    : `M${x},${top + h}V${top + r}A${r},${r} 0 0 1 ${x + r},${top}H${x + width - r}A${r},${r} 0 0 1 ${x + width},${top + r}V${top + h}Z`
  const clipped = payload.growth > GROWTH_CAP
  return (
    <g>
      <path d={d} fill={neg ? C.decline : C.current} />
      {clipped && (
        <>
          <path d={`M${x - 1},${top + 12}L${x + width + 1},${top + 7}M${x - 1},${top + 16}L${x + width + 1},${top + 11}`} stroke="#fff" strokeWidth={2} />
          <text x={x + width / 2} y={top - 6} textAnchor="middle" fontSize={10} fontWeight={700} fill="#334155">
            {formatPct(payload.growth, 0)}
          </text>
        </>
      )}
    </g>
  )
}

function toChartData(monthly) {
  let prevRun = 0
  return monthly.map(m => {
    prevRun += m.prevYearTotal
    return {
      ...m,
      name: MONTH_SHORT[m.month - 1],
      total: m.isFuture ? null : m.total,
      prev: m.prevYearTotal,
      prevCumulative: prevRun,
      growthDisplay: m.growth == null ? null : Math.min(m.growth, GROWTH_CAP)
    }
  })
}

// ─── Charts ───────────────────────────────────────────────────────────────────

function MonthlyChart({ data, year, height = 240 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} barGap={2} barCategoryGap="26%" margin={{ left: -6, right: 4, top: 8 }}>
        <CartesianGrid stroke={C.grid} vertical={false} />
        <XAxis dataKey="name" tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={formatCompactPHP} width={56} />
        <Tooltip content={<ChartTooltip year={year} mode="monthly" />} cursor={{ fill: '#F1F5F9', radius: 8 }} />
        <Bar dataKey="prev" fill={C.previous} radius={[4, 4, 0, 0]} maxBarSize={16} animationDuration={700} />
        <Bar dataKey="total" fill={C.current} radius={[4, 4, 0, 0]} maxBarSize={16} animationDuration={900} animationBegin={150} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function GrowthChart({ data, year, height = 220 }) {
  if (!data.some(d => d.growth != null)) {
    return <EmptyChart height={height} text="Not enough monthly history to measure growth yet" />
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ left: -6, right: 4, top: 18 }}>
        <CartesianGrid stroke={C.grid} vertical={false} />
        <XAxis dataKey="name" tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} width={56} tickFormatter={v => formatPct(v, 0)} />
        <ReferenceLine y={0} stroke="#CBD5E1" />
        <Tooltip content={<ChartTooltip year={year} mode="growth" />} cursor={{ fill: '#F1F5F9', radius: 8 }} />
        <Bar dataKey="growthDisplay" shape={<GrowthBar />} maxBarSize={20} animationDuration={800} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function CumulativeChart({ data, year, height = 220 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ left: -6, right: 12, top: 8 }}>
        <CartesianGrid stroke={C.grid} vertical={false} />
        <XAxis dataKey="name" tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={formatCompactPHP} width={56} />
        <Tooltip content={<ChartTooltip year={year} mode="cumulative" />} cursor={{ stroke: '#CBD5E1', strokeWidth: 1 }} />
        <Line
          dataKey="prevCumulative" stroke={C.previous} strokeWidth={2} dot={false}
          activeDot={{ r: 4, stroke: '#fff', strokeWidth: 2 }} animationDuration={900}
        />
        <Area
          dataKey="cumulative" stroke={C.current} strokeWidth={2} fill={C.current} fillOpacity={0.1}
          dot={false} activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }} connectNulls={false} animationDuration={1100}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

function EmptyChart({ height, text }) {
  return (
    <div className="rounded-xl bg-slate-50 border border-dashed border-slate-200 flex items-center justify-center text-sm text-slate-400" style={{ height }}>
      {text}
    </div>
  )
}

// ─── Monthly table (the table view behind every chart) ────────────────────────

function MonthlyTable({ monthly, year, amountLabel }) {
  const total = monthly.reduce((s, m) => s + m.total, 0)
  const count = monthly.reduce((s, m) => s + m.count, 0)
  const prevTotal = monthly.reduce((s, m) => s + m.prevYearTotal, 0)
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr>
            <th className="table-header">Month</th>
            <th className="table-header text-right">Transactions</th>
            <th className="table-header text-right">{amountLabel} {year}</th>
            <th className="table-header text-right">{year - 1}</th>
            <th className="table-header text-right">MoM growth</th>
            <th className="table-header text-right">Cumulative</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {monthly.map(m => (
            <tr key={m.month} className={`hover:bg-slate-50/60 transition-colors ${m.isFuture ? 'text-slate-300' : ''}`}>
              <td className="table-cell font-medium text-slate-800">
                {MONTH_NAMES[m.month - 1]}
                {m.inProgress && <span className="badge bg-blue-50 text-blue-600 ml-2">In progress</span>}
              </td>
              <td className="table-cell text-right tabular-nums">{m.isFuture ? '—' : formatNumber(m.count)}</td>
              <td className="table-cell text-right font-semibold text-slate-900 tabular-nums">
                {m.isFuture ? <span className="text-slate-300 font-normal">Upcoming</span> : formatPHP(m.total)}
              </td>
              <td className="table-cell text-right text-slate-400 tabular-nums">{formatPHP(m.prevYearTotal)}</td>
              <td className="table-cell text-right tabular-nums">
                {m.growth == null
                  ? <span className="text-slate-300">—</span>
                  : <span className={`font-semibold ${m.growth >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{formatPct(m.growth)}</span>}
              </td>
              <td className="table-cell text-right text-slate-500 tabular-nums">{m.cumulative == null ? '—' : formatPHP(m.cumulative)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-50 border-t border-slate-200">
            <td className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Full year</td>
            <td className="px-5 py-3 text-right text-sm font-semibold text-slate-700 tabular-nums">{formatNumber(count)}</td>
            <td className="px-5 py-3 text-right font-bold text-blue-700 tabular-nums">{formatPHP(total)}</td>
            <td className="px-5 py-3 text-right text-sm text-slate-500 tabular-nums">{formatPHP(prevTotal)}</td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ─── Overview tab ─────────────────────────────────────────────────────────────

function Overview({ report, onPickBuyer }) {
  const navigate = useNavigate()
  const { year, totals, comparison, monthly, bestMonth, topBuyers, topTransactions } = report
  const data = useMemo(() => toChartData(monthly), [monthly])
  const maxShare = Math.max(1, ...topBuyers.map(b => b.share))

  return (
    <motion.div variants={STAGGER} initial="initial" animate="animate" className="space-y-5">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          primary label="Total revenue" value={totals.total} format={formatPHP} icon={DollarSign}
          footer={<DeltaPill value={totals.revenueGrowth} versus={comparison.label} inverse />}
        />
        <KpiCard
          label="Transactions" value={totals.count} format={v => formatNumber(Math.round(v))} icon={Receipt} iconBg="bg-emerald-500"
          footer={<DeltaPill value={totals.countGrowth} versus={comparison.label} />}
        />
        <KpiCard
          label="Active buyers" value={totals.buyers} format={v => formatNumber(Math.round(v))} icon={Users} iconBg="bg-violet-500"
          footer={<DeltaPill value={totals.buyersGrowth} versus={comparison.label} />}
        />
        <KpiCard
          label="Average sale" value={totals.average} format={formatPHP} icon={BarChart3} iconBg="bg-amber-500"
          footer={<span className="text-[11px] text-slate-400">Per transaction</span>}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            icon: CalendarDays, tone: 'text-blue-600 bg-blue-50', label: 'Best month',
            value: bestMonth ? MONTH_NAMES[bestMonth.month - 1] : '—',
            sub: bestMonth ? `${formatPHP(bestMonth.total)} · ${bestMonth.count} transactions` : 'No sales yet'
          },
          {
            icon: Trophy, tone: 'text-amber-600 bg-amber-50', label: 'Top buyer',
            value: topBuyers[0]?.full_name || '—',
            sub: topBuyers[0] ? `${formatPHP(topBuyers[0].total_amount)} · ${topBuyers[0].share.toFixed(1)}% of revenue` : 'No buyers yet',
            onClick: topBuyers[0] ? () => onPickBuyer(topBuyers[0].id) : null
          },
          {
            icon: ArrowUpRight, tone: 'text-emerald-600 bg-emerald-50', label: 'Largest sale',
            value: topTransactions[0] ? formatPHP(topTransactions[0].amount) : '—',
            sub: topTransactions[0] ? `${topTransactions[0].customer_name} · ${formatDateShort(topTransactions[0].date)}` : 'No sales yet'
          }
        ].map(({ icon: Icon, tone, label, value, sub, onClick }) => (
          <motion.div
            key={label}
            variants={RISE}
            whileHover={onClick ? { y: -2 } : undefined}
            onClick={onClick || undefined}
            className={`card p-4 flex items-center gap-3.5 ${onClick ? 'cursor-pointer hover:border-blue-200 transition-colors' : ''}`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${tone}`}>
              <Icon size={18} />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{label}</div>
              <div className="text-sm font-bold text-slate-900 truncate">{value}</div>
              <div className="text-xs text-slate-400 truncate">{sub}</div>
            </div>
          </motion.div>
        ))}
      </div>

      <Panel
        title="Monthly revenue"
        subtitle={`${year} compared with ${year - 1}`}
        legend={<Legend items={[{ label: year - 1, color: C.previous }, { label: year, color: C.current }]} />}
      >
        <MonthlyChart data={data} year={year} />
      </Panel>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Panel
          title="Month-over-month growth"
          subtitle="Change in revenue versus the previous month"
          legend={<Legend items={[{ label: 'Growth', color: C.current }, { label: 'Decline', color: C.decline }]} />}
        >
          <GrowthChart data={data} year={year} />
        </Panel>
        <Panel
          title="Cumulative revenue"
          subtitle="Year-to-date running total"
          legend={<Legend items={[{ label: year - 1, color: C.previous, line: true }, { label: year, color: C.current, line: true }]} />}
        >
          <CumulativeChart data={data} year={year} />
        </Panel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Panel title={`Top buyers of ${year}`} subtitle="Click a buyer to open their yearly audit">
          {topBuyers.length === 0 ? (
            <div className="text-slate-400 text-sm text-center py-10">No buyers this year</div>
          ) : (
            <div className="space-y-1">
              {topBuyers.map((b, i) => (
                <motion.button
                  key={b.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.4, ease: EASE }}
                  onClick={() => onPickBuyer(b.id)}
                  className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-slate-50 transition-colors text-left group"
                >
                  <RankBadge rank={i + 1} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-slate-800 truncate group-hover:text-blue-600 transition-colors">{b.full_name}</span>
                      <span className="text-sm font-bold text-slate-900 flex-shrink-0 tabular-nums">{formatPHP(b.total_amount)}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="flex-1 h-1.5 rounded-full bg-blue-100 overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-blue-600"
                          initial={{ width: 0 }}
                          animate={{ width: `${(b.share / maxShare) * 100}%` }}
                          transition={{ delay: 0.15 + i * 0.05, duration: 0.8, ease: EASE }}
                        />
                      </div>
                      <span className="text-[11px] text-slate-400 w-24 text-right flex-shrink-0">
                        {b.share.toFixed(1)}% · {b.transaction_count} txns
                      </span>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </Panel>

        <Panel title={`Top transactions of ${year}`} subtitle="Largest single sales">
          {topTransactions.length === 0 ? (
            <div className="text-slate-400 text-sm text-center py-10">No transactions this year</div>
          ) : (
            <div className="divide-y divide-slate-50">
              {topTransactions.map((t, i) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.4, ease: EASE }}
                  className="flex items-center gap-3 px-2 py-2.5"
                >
                  <RankBadge rank={i + 1} size="sm" />
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => navigate(`/customers/${t.customer_id}`)}
                      className="text-sm font-medium text-slate-800 hover:text-blue-600 transition-colors truncate block max-w-full text-left"
                    >
                      {t.customer_name}
                    </button>
                    <div className="text-[11px] text-slate-400 truncate">
                      {formatDateShort(t.date)}{t.description ? ` · ${t.description}` : ''}
                    </div>
                  </div>
                  <div className="text-sm font-bold text-slate-900 tabular-nums flex-shrink-0">{formatPHP(t.amount)}</div>
                </motion.div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <motion.div variants={RISE} className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">Monthly breakdown</h3>
          <p className="text-xs text-slate-400 mt-0.5">Every value from the charts above, in table form</p>
        </div>
        <MonthlyTable monthly={monthly} year={year} amountLabel="Revenue" />
      </motion.div>
    </motion.div>
  )
}

// ─── Buyer picker (searchable, keyboard friendly) ─────────────────────────────

function BuyerPicker({ buyers, value, onChange }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const rootRef = useRef(null)
  const listRef = useRef(null)
  const selected = buyers.find(b => b.id === value)

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return buyers
    return buyers.filter(b =>
      b.full_name.toLowerCase().includes(q) ||
      (b.email || '').toLowerCase().includes(q) ||
      (b.phone || '').includes(q)
    )
  }, [buyers, query])

  useEffect(() => {
    if (!open) return
    const onDown = e => { if (!rootRef.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  useEffect(() => { setActive(0) }, [query, open])

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  function choose(b) {
    onChange(b.id)
    setOpen(false)
    setQuery('')
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(list.length - 1, a + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(0, a - 1)) }
    else if (e.key === 'Enter' && list[active]) { e.preventDefault(); choose(list[active]) }
    else if (e.key === 'Escape') setOpen(false)
  }

  return (
    <div ref={rootRef} className="relative w-full max-w-md">
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full card px-4 py-3 flex items-center gap-3 text-left transition-all ${open ? 'ring-2 ring-blue-500 border-transparent' : 'hover:border-blue-200'}`}
      >
        {selected ? (
          <>
            <Avatar name={selected.full_name} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-900 truncate">{selected.full_name}</div>
              <div className="text-xs text-slate-400">Rank #{selected.rank} · {formatPHP(selected.total_amount)}</div>
            </div>
          </>
        ) : (
          <div className="flex-1 text-sm text-slate-400">Select a buyer…</div>
        )}
        <ChevronsUpDown size={16} className="text-slate-400 flex-shrink-0" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: EASE }}
            className="absolute z-30 mt-2 w-full bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden origin-top"
          >
            <div className="relative border-b border-slate-100">
              <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search by name, email, or phone"
                className="w-full pl-10 pr-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
              />
            </div>
            <div ref={listRef} className="max-h-80 overflow-y-auto p-1.5">
              {list.length === 0 ? (
                <div className="px-3 py-6 text-center text-sm text-slate-400">No buyers match “{query}”.</div>
              ) : list.map((b, i) => (
                <button
                  key={b.id}
                  data-index={i}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(b)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-colors ${i === active ? 'bg-blue-50' : ''}`}
                >
                  <RankBadge rank={b.rank} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium truncate ${i === active ? 'text-blue-700' : 'text-slate-800'}`}>{b.full_name}</div>
                    <div className="text-[11px] text-slate-400">{b.transaction_count} transactions</div>
                  </div>
                  <span className="text-sm font-semibold text-slate-700 tabular-nums">{formatPHP(b.total_amount)}</span>
                  {b.id === value && <Check size={15} className="text-blue-600" />}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Buyer audit tab ──────────────────────────────────────────────────────────

function BuyerAudit({ statement }) {
  const navigate = useNavigate()
  const { year, customer, transactions, monthly, comparison, audit } = statement
  const data = useMemo(() => toChartData(monthly), [monthly])

  // Ledger rows grouped by month, with each group's starting row number
  const groups = useMemo(() => {
    const map = new Map()
    transactions.forEach(t => {
      const m = parseInt(t.date.slice(5, 7), 10)
      if (!map.has(m)) map.set(m, [])
      map.get(m).push(t)
    })
    let start = 0
    return [...map.entries()].map(([month, rows]) => {
      const g = { month, rows, start }
      start += rows.length
      return g
    })
  }, [transactions])

  const auditItems = [
    ['First purchase', formatDate(audit.firstPurchase)],
    ['Last purchase', formatDate(audit.lastPurchase)],
    ['Largest purchase', audit.largest ? `${formatPHP(audit.largest.amount)} · ${formatDateShort(audit.largest.date)}` : '—'],
    ['Smallest purchase', audit.smallest ? `${formatPHP(audit.smallest.amount)} · ${formatDateShort(audit.smallest.date)}` : '—'],
    ['Active months', `${audit.activeMonths} of 12`],
    ['Best month', audit.bestMonth ? `${MONTH_NAMES[audit.bestMonth.month - 1]} · ${formatPHP(audit.bestMonth.total)}` : '—'],
    ['Avg. days between purchases', audit.avgDaysBetween == null ? '—' : `${audit.avgDaysBetween.toFixed(1)} days`],
    [comparison.isYtd ? `Spent in ${comparison.label}` : `Total spent ${year - 1}`, formatPHP(audit.prevTotal)],
    ['Lifetime total (all years)', `${formatPHP(customer.total_purchases)} · ${customer.transaction_count} txns`],
    ['Customer since', formatDate(String(customer.created_at || '').slice(0, 10))]
  ]

  return (
    <motion.div variants={STAGGER} initial="initial" animate="animate" className="space-y-5">
      <motion.div variants={RISE} className="card p-5 flex items-center gap-4 flex-wrap">
        <Avatar name={customer.full_name} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-slate-900 truncate">{customer.full_name}</h2>
            {audit.rank && (
              <span className="badge bg-amber-50 text-amber-700"><Trophy size={11} className="mr-1" />Rank #{audit.rank} of {audit.buyerCount}</span>
            )}
          </div>
          <div className="text-sm text-slate-400 mt-0.5 truncate">
            {[customer.email, customer.phone].filter(Boolean).join(' · ') || 'No contact details'}
          </div>
        </div>
        <button onClick={() => navigate(`/customers/${customer.id}`)} className="btn-secondary !py-2 text-xs">
          View customer <ArrowUpRight size={13} />
        </button>
      </motion.div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          primary label={`Total spent ${year}`} value={audit.total} format={formatPHP} icon={DollarSign}
          footer={<DeltaPill value={audit.growth} versus={comparison.label} inverse />}
        />
        <KpiCard
          label="Transactions" value={audit.count} format={v => formatNumber(Math.round(v))} icon={Hash} iconBg="bg-emerald-500"
          footer={<span className="text-[11px] text-slate-400">{audit.prevCount} in {comparison.label}</span>}
        />
        <KpiCard
          label="Average purchase" value={audit.average} format={formatPHP} icon={BarChart3} iconBg="bg-amber-500"
          footer={<span className="text-[11px] text-slate-400">Per transaction</span>}
        />
        <KpiCard
          label="Revenue share" value={audit.share} format={v => `${v.toFixed(1)}%`} icon={Percent} iconBg="bg-violet-500"
          footer={<span className="text-[11px] text-slate-400">of {formatPHP(audit.yearRevenue)}</span>}
        />
      </div>

      <Panel title="Yearly audit summary" subtitle={`Activity for ${year}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          {auditItems.map(([k, v], i) => (
            <motion.div
              key={k}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 + i * 0.03 }}
              className="flex items-baseline justify-between gap-4 py-2.5 border-b border-slate-50"
            >
              <span className="text-xs text-slate-500">{k}</span>
              <span className="text-sm font-semibold text-slate-900 text-right">{v}</span>
            </motion.div>
          ))}
        </div>
      </Panel>

      <Panel
        title="Monthly spending"
        subtitle={`${year} compared with ${year - 1}`}
        legend={<Legend items={[{ label: year - 1, color: C.previous }, { label: year, color: C.current }]} />}
      >
        <MonthlyChart data={data} year={year} height={220} />
      </Panel>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Panel
          title="Spending growth"
          subtitle="Change versus the previous month"
          legend={<Legend items={[{ label: 'Growth', color: C.current }, { label: 'Decline', color: C.decline }]} />}
        >
          <GrowthChart data={data} year={year} height={200} />
        </Panel>
        <Panel
          title="Cumulative spending"
          subtitle="Year-to-date running total"
          legend={<Legend items={[{ label: year - 1, color: C.previous, line: true }, { label: year, color: C.current, line: true }]} />}
        >
          <CumulativeChart data={data} year={year} height={200} />
        </Panel>
      </div>

      <motion.div variants={RISE} className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Transaction ledger</h3>
            <p className="text-xs text-slate-400 mt-0.5">All {audit.count} transactions in {year}, oldest first</p>
          </div>
          <span className="text-sm font-bold text-blue-700 tabular-nums">{formatPHP(audit.total)}</span>
        </div>
        <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
          <table className="w-full">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="table-header w-12">#</th>
                <th className="table-header">Date</th>
                <th className="table-header">Description</th>
                <th className="table-header text-right">Amount</th>
                <th className="table-header text-right">Running total</th>
              </tr>
            </thead>
            <tbody>
              {groups.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-400 text-sm">No transactions in {year}.</td></tr>
              ) : groups.map(g => (
                <MonthGroup key={g.month} month={g.month} year={year} rows={g.rows} startSeq={g.start} />
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      <motion.div variants={RISE} className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">Monthly summary</h3>
        </div>
        <MonthlyTable monthly={monthly} year={year} amountLabel="Spent" />
      </motion.div>
    </motion.div>
  )
}

function MonthGroup({ month, year, rows, startSeq }) {
  const subtotal = rows.reduce((s, t) => s + t.amount, 0)
  return (
    <>
      <tr className="bg-blue-50/70">
        <td colSpan={5} className="px-5 py-2 text-xs font-bold text-blue-900">
          {MONTH_NAMES[month - 1]} {year}
          <span className="ml-2 font-medium text-blue-500">{rows.length} transaction{rows.length === 1 ? '' : 's'}</span>
        </td>
      </tr>
      {rows.map((t, i) => (
        <tr key={t.id} className="hover:bg-slate-50/60 transition-colors border-b border-slate-50">
          <td className="table-cell text-slate-400 tabular-nums">{startSeq + i + 1}</td>
          <td className="table-cell whitespace-nowrap">{formatDateShort(t.date)}</td>
          <td className="table-cell text-slate-500">{t.description || '—'}</td>
          <td className="table-cell text-right font-semibold text-slate-900 tabular-nums">{formatPHP(t.amount)}</td>
          <td className="table-cell text-right text-slate-400 tabular-nums">{formatPHP(t.running_total)}</td>
        </tr>
      ))}
      <tr className="bg-slate-50 border-b border-slate-200">
        <td colSpan={3} className="px-5 py-2 text-xs font-semibold text-slate-600">{MONTH_NAMES[month - 1]} subtotal</td>
        <td className="px-5 py-2 text-right text-sm font-bold text-slate-800 tabular-nums">{formatPHP(subtotal)}</td>
        <td />
      </tr>
    </>
  )
}

// ─── Skeleton (first load only; refetches dim the previous render instead) ────

function Skeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map(i => <div key={i} className="card h-[124px] animate-pulse bg-slate-100/70" />)}
      </div>
      <div className="card h-[300px] animate-pulse bg-slate-100/70" />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="card h-[280px] animate-pulse bg-slate-100/70" />
        <div className="card h-[280px] animate-pulse bg-slate-100/70" />
      </div>
    </div>
  )
}

// ─── Export toast card ────────────────────────────────────────────────────────

function ExportReady({ file, onOpen, onClose }) {
  const name = file ? file.split(/[\\/]/).pop() : ''
  return createPortal(
    <AnimatePresence>
      {file && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          className="fixed bottom-6 right-6 z-[9998] w-[380px] bg-white border border-slate-200 rounded-2xl shadow-2xl p-4 flex items-center gap-3"
        >
          <div className="w-11 h-11 rounded-xl bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0">
            <FileText size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-slate-900">PDF ready · A4</div>
            <div className="text-xs text-slate-400 truncate" title={file}>{name}</div>
          </div>
          <button onClick={onOpen} className="btn-primary !px-3 !py-2 text-xs">
            <ExternalLink size={13} /> Open
          </button>
          <button onClick={onClose} className="btn-ghost !px-1.5 !py-1.5" title="Dismiss">
            <X size={15} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'overview', label: 'Overview',    icon: LayoutDashboard },
  { key: 'buyer',    label: 'Buyer Audit', icon: UserRound }
]

export default function YearlyReport() {
  const { showToast } = useToast()
  const thisYear = new Date().getFullYear()

  const [years, setYears]         = useState([thisYear])
  const [year, setYear]           = useState(thisYear)
  const [direction, setDirection] = useState(0)
  const [tab, setTab]             = useState('overview')

  const [report, setReport]       = useState(null)
  const [buyers, setBuyers]       = useState([])
  const [loading, setLoading]     = useState(true)

  const [buyerId, setBuyerId]     = useState(null)
  const [statement, setStatement] = useState(null)
  const [stLoading, setStLoading] = useState(false)

  const [exportState, setExportState] = useState('idle') // idle | working | done
  const [lastFile, setLastFile]       = useState(null)

  const reportReq = useRef(0)
  const stmtReq = useRef(0)

  useEffect(() => {
    window.electron.invoke('reports:years').then(list => {
      const all = [...new Set([thisYear, ...list])].sort((a, b) => b - a)
      setYears(all)
      if (list.length && !list.includes(thisYear)) setYear(list[0])
    }).catch(() => {})
  }, [thisYear])

  // Request-ID guards drop responses for a year the user has already moved past
  const loadReport = useCallback(async () => {
    const id = ++reportReq.current
    setLoading(true)
    try {
      const [r, b] = await Promise.all([
        window.electron.invoke('reports:yearly', year),
        window.electron.invoke('reports:yearlyBuyers', year)
      ])
      if (id !== reportReq.current) return
      setReport(r)
      setBuyers(b)
      setBuyerId(prev => (b.some(x => x.id === prev) ? prev : b[0]?.id ?? null))
    } catch (err) {
      if (id === reportReq.current) showToast(err?.message || 'Failed to load yearly report', 'error')
    } finally {
      if (id === reportReq.current) setLoading(false)
    }
  }, [year, showToast])

  useEffect(() => { loadReport() }, [loadReport])

  useEffect(() => {
    if (tab !== 'buyer' || !buyerId) { if (!buyerId) setStatement(null); return }
    const id = ++stmtReq.current
    setStLoading(true)
    window.electron.invoke('reports:buyerYearly', { customerId: buyerId, year })
      .then(s => { if (id === stmtReq.current) setStatement(s) })
      .catch(err => { if (id === stmtReq.current) showToast(err?.message || 'Failed to load buyer audit', 'error') })
      .finally(() => { if (id === stmtReq.current) setStLoading(false) })
  }, [tab, buyerId, year, showToast])

  const idx = years.indexOf(year)
  function stepYear(delta) {
    const next = years[idx - delta]
    if (next === undefined) return
    setDirection(delta)
    setYear(next)
  }

  function pickBuyer(id) {
    setBuyerId(id)
    setTab('buyer')
  }

  async function exportPdf() {
    if (exportState === 'working') return
    setExportState('working')
    try {
      const res = tab === 'buyer'
        ? await window.electron.invoke('reports:exportBuyerPdf', { customerId: buyerId, year })
        : await window.electron.invoke('reports:exportYearlyPdf', year)
      if (res.success) {
        setLastFile(res.path)
        setExportState('done')
        showToast('PDF exported!', 'success')
        setTimeout(() => setExportState('idle'), 1800)
      } else {
        setExportState('idle')
        showToast('Export cancelled', 'info')
      }
    } catch (err) {
      setExportState('idle')
      showToast(err?.message || 'PDF export failed', 'error')
    }
  }

  async function openLast() {
    try { await window.electron.invoke('reports:openPdf', lastFile) }
    catch (err) { showToast(err?.message || 'Could not open the PDF', 'error') }
  }

  const canExport = tab === 'overview' ? !!report : !!statement
  const exportLabel = tab === 'buyer' ? 'Export Statement PDF' : 'Export Annual PDF'

  return (
    <MotionConfig reducedMotion="user">
      <div className="page-container">
        {/* Toolbar: one control row that scopes everything below */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="card flex items-center gap-1 p-1">
              <button
                onClick={() => stepYear(-1)}
                disabled={idx >= years.length - 1}
                className="btn-ghost !px-2 !py-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
                title="Previous year"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="relative w-16 h-7 overflow-hidden flex items-center justify-center">
                <AnimatePresence initial={false} custom={direction} mode="popLayout">
                  <motion.span
                    key={year}
                    custom={direction}
                    variants={{
                      enter: d => ({ y: d >= 0 ? 18 : -18, opacity: 0 }),
                      center: { y: 0, opacity: 1 },
                      exit: d => ({ y: d >= 0 ? -18 : 18, opacity: 0 })
                    }}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.28, ease: EASE }}
                    className="absolute text-base font-bold text-slate-900 tabular-nums"
                  >
                    {year}
                  </motion.span>
                </AnimatePresence>
              </div>
              <button
                onClick={() => stepYear(1)}
                disabled={idx <= 0}
                className="btn-ghost !px-2 !py-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
                title="Next year"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="inline-flex bg-slate-100 rounded-xl p-1 gap-1">
              {TABS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`relative px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    tab === key ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {tab === key && (
                    <motion.span
                      layoutId="yearly-tab-pill"
                      className="absolute inset-0 bg-white rounded-lg shadow-sm"
                      transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                    />
                  )}
                  <span className="relative flex items-center gap-2"><Icon size={15} /> {label}</span>
                </button>
              ))}
            </div>

            {year === thisYear && (
              <span className="badge bg-blue-50 text-blue-600">
                <span className="relative flex w-1.5 h-1.5 mr-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75 animate-ping" />
                  <span className="relative inline-flex rounded-full w-1.5 h-1.5 bg-blue-500" />
                </span>
                Year to date
              </span>
            )}
          </div>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={exportPdf}
            disabled={!canExport || exportState === 'working'}
            className={`btn-primary shadow-lg shadow-blue-600/20 disabled:opacity-60 disabled:cursor-not-allowed ${exportState === 'done' ? '!bg-emerald-600' : ''}`}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={exportState}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.16 }}
                className="flex items-center gap-2"
              >
                {exportState === 'working' && <><Loader2 size={15} className="animate-spin" /> Generating PDF…</>}
                {exportState === 'done' && <><Check size={15} /> Saved</>}
                {exportState === 'idle' && <><FileDown size={15} /> {exportLabel}</>}
              </motion.span>
            </AnimatePresence>
          </motion.button>
        </div>

        <AnimatePresence mode="wait">
          {tab === 'overview' ? (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: loading && report ? 0.55 : 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
            >
              {!report ? <Skeleton /> : <Overview key={report.year} report={report} onPickBuyer={pickBuyer} />}
            </motion.div>
          ) : (
            <motion.div
              key="buyer"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="space-y-5"
            >
              <div className="flex items-center gap-3 flex-wrap">
                <BuyerPicker buyers={buyers} value={buyerId} onChange={setBuyerId} />
                <span className="text-xs text-slate-400">{buyers.length} buyer{buyers.length === 1 ? '' : 's'} with purchases in {year}</span>
              </div>
              {buyers.length === 0 && !loading ? (
                <div className="card p-12 text-center">
                  <UserRound size={28} className="mx-auto text-slate-300" />
                  <div className="text-sm font-medium text-slate-600 mt-3">No buyers in {year}</div>
                  <div className="text-xs text-slate-400 mt-1">Pick another year to audit a buyer.</div>
                </div>
              ) : !statement ? (
                <Skeleton />
              ) : (
                <motion.div animate={{ opacity: stLoading ? 0.55 : 1 }} transition={{ duration: 0.2 }}>
                  <BuyerAudit key={`${statement.customer.id}-${statement.year}`} statement={statement} />
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ExportReady file={lastFile} onOpen={openLast} onClose={() => setLastFile(null)} />
    </MotionConfig>
  )
}
