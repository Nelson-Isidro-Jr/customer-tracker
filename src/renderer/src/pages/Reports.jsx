import { useState } from 'react'
import Select from '../components/Select'
import Pagination from '../components/Pagination'
import { useTheme } from '../context/SettingsContext'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calendar, BarChart3, Download, Trophy, Receipt, DollarSign, RefreshCw
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { useToast } from '../context/ToastContext'
import { formatPHP, formatDate, formatDateShort, formatCompactPHP, MONTH_NAMES, toDateInput } from '../utils/format'

const ROWS_PER_PAGE = 50

const now = new Date()

export default function Reports() {
  const { showToast } = useToast()
  const { colors } = useTheme()
  const [tab, setTab] = useState('daily')
  const [mPage, setMPage] = useState(1)

  // Daily state
  const [dailyDate, setDailyDate]     = useState(toDateInput())
  const [dailyReport, setDailyReport] = useState(null)
  const [dailyLoading, setDailyLoading] = useState(false)

  // Monthly state
  const [mYear, setMYear]   = useState(now.getFullYear())
  const [mMonth, setMMonth] = useState(now.getMonth() + 1)
  const [mReport, setMReport] = useState(null)
  const [mLoading, setMLoading] = useState(false)

  async function loadDaily() {
    setDailyLoading(true)
    try {
      const r = await window.electron.invoke('reports:daily', dailyDate)
      setDailyReport(r)
    } catch { showToast('Failed to load report', 'error') }
    finally { setDailyLoading(false) }
  }

  async function loadMonthly() {
    setMLoading(true)
    try {
      const r = await window.electron.invoke('reports:monthly', { year: mYear, month: mMonth })
      setMReport(r)
      setMPage(1)
    } catch { showToast('Failed to load report', 'error') }
    finally { setMLoading(false) }
  }

  async function exportDaily() {
    if (!dailyReport) return
    const res = await window.electron.invoke('data:exportExcel', {
      type: 'daily', filters: { date: dailyDate }
    })
    if (res.success) showToast('Exported to Excel!', 'success')
    else showToast('Export cancelled', 'info')
  }

  async function exportMonthly() {
    if (!mReport) return
    const res = await window.electron.invoke('data:exportExcel', {
      type: 'monthly', filters: { year: mYear, month: mMonth }
    })
    if (res.success) showToast('Exported to Excel!', 'success')
    else showToast('Export cancelled', 'info')
  }

  const years = Array.from({ length: 10 }, (_, i) => now.getFullYear() - i)

  return (
    <div className="page-container">
      {/* Tabs */}
      <div className="inline-flex bg-slate-100 rounded-xl p-1 gap-1">
        {[
          { key: 'daily',   label: 'Daily Report',   icon: Calendar },
          { key: 'monthly', label: 'Monthly Report', icon: BarChart3 }
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`relative px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              tab === key ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab === key && <motion.span layoutId="reports-tab" className="absolute inset-0 bg-white rounded-lg shadow-sm" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
            <span className="relative flex items-center gap-2"><Icon size={15} /> {label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === 'daily' ? (
          <motion.div
            key="daily"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-5"
          >
            {/* Daily controls */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Select Date</h3>
              <div className="flex items-end gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Date</label>
                  <input
                    type="date" className="input-field"
                    value={dailyDate}
                    onChange={e => setDailyDate(e.target.value)}
                  />
                </div>
                <button onClick={loadDaily} disabled={dailyLoading} className="btn-primary">
                  {dailyLoading ? <RefreshCw size={15} className="animate-spin" /> : <Receipt size={15} />}
                  {dailyLoading ? 'Loading…' : 'Generate Report'}
                </button>
              </div>
            </div>

            {dailyReport && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                {/* Daily summary */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[
                    { label: 'Total Sales', value: formatPHP(dailyReport.total), icon: DollarSign, color: 'bg-blue-600' },
                    { label: 'Transactions', value: dailyReport.count, icon: Receipt, color: 'bg-emerald-500' },
                    { label: 'Avg per Transaction', value: dailyReport.count ? formatPHP(dailyReport.total / dailyReport.count) : '—', icon: BarChart3, color: 'bg-amber-500' }
                  ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="card p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
                        <div className={`w-8 h-8 ${color} rounded-lg flex items-center justify-center`}>
                          <Icon size={15} className="text-white" />
                        </div>
                      </div>
                      <div className="text-xl font-bold text-slate-900">{value}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{formatDate(dailyDate)}</div>
                    </div>
                  ))}
                </div>

                {/* Daily transactions table */}
                <div className="card overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Sales — {formatDate(dailyDate)}
                    </h3>
                    <button onClick={exportDaily} className="btn-secondary !py-2 text-xs">
                      <Download size={13} /> Export Excel
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr>
                          <th className="table-header">#</th>
                          <th className="table-header">Customer</th>
                          <th className="table-header">Description</th>
                          <th className="table-header text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {dailyReport.transactions.length === 0 ? (
                          <tr><td colSpan={4} className="px-5 py-10 text-center text-slate-400 text-sm">No sales on this date.</td></tr>
                        ) : dailyReport.transactions.map((t, i) => (
                          <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="table-cell text-slate-400">{i + 1}</td>
                            <td className="table-cell font-medium text-slate-800">{t.customer_name}</td>
                            <td className="table-cell text-slate-500">{t.description || '—'}</td>
                            <td className="table-cell text-right font-bold text-slate-900">{formatPHP(t.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                      {dailyReport.transactions.length > 0 && (
                        <tfoot>
                          <tr className="bg-slate-50 border-t border-slate-200">
                            <td colSpan={3} className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Total</td>
                            <td className="px-5 py-3 text-right font-bold text-blue-700 text-base">{formatPHP(dailyReport.total)}</td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="monthly"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-5"
          >
            {/* Monthly controls */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Select Month</h3>
              <div className="flex items-end gap-3 flex-wrap">
                <div className="flex-1 min-w-[140px]">
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Month</label>
                  <Select value={mMonth} onChange={setMMonth} options={MONTH_NAMES.map((m, i) => ({ value: i + 1, label: m }))} ariaLabel="Month" />
                </div>
                <div className="flex-1 min-w-[120px]">
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Year</label>
                  <Select value={mYear} onChange={setMYear} options={years.map(y => ({ value: y, label: String(y) }))} ariaLabel="Year" />
                </div>
                <button onClick={loadMonthly} disabled={mLoading} className="btn-primary">
                  {mLoading ? <RefreshCw size={15} className="animate-spin" /> : <BarChart3 size={15} />}
                  {mLoading ? 'Loading…' : 'Generate Report'}
                </button>
              </div>
            </div>

            {mReport && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                {/* Monthly summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Total Sales', value: formatPHP(mReport.total), icon: DollarSign, color: 'bg-blue-600' },
                    { label: 'Transactions', value: mReport.count, icon: Receipt, color: 'bg-emerald-500' },
                    { label: 'Avg per Transaction', value: mReport.count ? formatPHP(mReport.total / mReport.count) : '—', icon: BarChart3, color: 'bg-amber-500' },
                    { label: 'Best Buyer', value: mReport.bestBuyer?.full_name || 'N/A', icon: Trophy, color: 'bg-violet-500' }
                  ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="card p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
                        <div className={`w-8 h-8 ${color} rounded-lg flex items-center justify-center`}>
                          <Icon size={15} className="text-white" />
                        </div>
                      </div>
                      <div className="text-base font-bold text-slate-900 truncate">{value}</div>
                      {label === 'Best Buyer' && mReport.bestBuyer && (
                        <div className="text-xs text-violet-600 mt-0.5">{formatPHP(mReport.bestBuyer.total_amount)}</div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Daily breakdown chart */}
                {mReport.dailyBreakdown.length > 0 && (
                  <div className="card p-5">
                    <h3 className="text-sm font-semibold text-slate-900 mb-5">
                      Daily Breakdown — {MONTH_NAMES[mMonth - 1]} {mYear}
                    </h3>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={mReport.dailyBreakdown} barSize={20} margin={{ left: -10 }}>
                        <CartesianGrid stroke={colors.grid} vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: colors.tick }} axisLine={false} tickLine={false}
                          tickFormatter={d => d.slice(8)} />
                        <YAxis tick={{ fontSize: 10, fill: colors.tick }} axisLine={false} tickLine={false} width={68}
                          tickFormatter={formatCompactPHP} />
                        <Tooltip
                          formatter={(v) => [formatPHP(v), 'Revenue']}
                          labelFormatter={d => formatDate(d)}
                          contentStyle={{ borderRadius: '12px', border: '1px solid rgb(var(--c-gray-200))', background: 'rgb(var(--c-surface))', color: 'rgb(var(--t-gray-800))', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', fontSize: 12 }}
                          cursor={{ fill: colors.cursor, radius: 4 }}
                        />
                        <Bar dataKey="total" fill={colors.current} radius={[4, 4, 0, 0]} maxBarSize={20} animationDuration={800} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Monthly transactions table */}
                <div className="card overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Transactions — {MONTH_NAMES[mMonth - 1]} {mYear}
                    </h3>
                    <button onClick={exportMonthly} className="btn-secondary !py-2 text-xs">
                      <Download size={13} /> Export Excel
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr>
                          <th className="table-header">#</th>
                          <th className="table-header">Date</th>
                          <th className="table-header">Customer</th>
                          <th className="table-header">Description</th>
                          <th className="table-header text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {mReport.transactions.length === 0 ? (
                          <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-400 text-sm">No transactions this month.</td></tr>
                        ) : mReport.transactions.slice((mPage - 1) * ROWS_PER_PAGE, mPage * ROWS_PER_PAGE).map((t, i) => (
                          <tr key={t.id} className="hover:bg-slate-50/60 transition-colors animate-row-in" style={{ animationDelay: `${Math.min(i, 14) * 18}ms` }}>
                            <td className="table-cell text-slate-400 tabular-nums">{(mPage - 1) * ROWS_PER_PAGE + i + 1}</td>
                            <td className="table-cell font-medium text-slate-700 whitespace-nowrap">{formatDateShort(t.date)}</td>
                            <td className="table-cell font-medium text-slate-800">{t.customer_name}</td>
                            <td className="table-cell text-slate-500">{t.description || '—'}</td>
                            <td className="table-cell text-right font-bold text-slate-900">{formatPHP(t.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                      {mReport.transactions.length > 0 && (
                        <tfoot>
                          <tr className="bg-slate-50 border-t border-slate-200">
                            <td colSpan={4} className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Total</td>
                            <td className="px-5 py-3 text-right font-bold text-blue-700 text-base">{formatPHP(mReport.total)}</td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                  {mReport.transactions.length > ROWS_PER_PAGE && (
                    <Pagination
                      page={mPage}
                      pageSize={ROWS_PER_PAGE}
                      total={mReport.transactions.length}
                      onPageChange={setMPage}
                      label="transactions"
                      layoutId="monthly-page"
                    />
                  )}
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
