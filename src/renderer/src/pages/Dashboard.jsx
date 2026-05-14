import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  Users, DollarSign, ShoppingCart, TrendingUp, Trophy, ArrowRight
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts'
import { formatPHP, formatDateShort, MONTH_SHORT } from '../utils/format'

const FADE_UP = (delay = 0) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.35 }
})

function StatCard({ title, value, sub, icon: Icon, iconBg, delay }) {
  return (
    <motion.div {...FADE_UP(delay)} className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</span>
        <div className={`w-9 h-9 ${iconBg} rounded-xl flex items-center justify-center`}>
          <Icon size={17} className="text-white" />
        </div>
      </div>
      <div className="text-2xl font-bold text-slate-900 tracking-tight">{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </motion.div>
  )
}

function BestBuyerCard({ label, buyer, gradient, delay }) {
  return (
    <motion.div {...FADE_UP(delay)} className={`rounded-2xl p-5 text-white ${gradient}`}>
      <div className="flex items-center gap-2 mb-3 opacity-80">
        <Trophy size={15} />
        <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
      </div>
      {buyer ? (
        <>
          <div className="text-xl font-bold leading-tight">{buyer.full_name}</div>
          <div className="text-white/80 text-lg font-semibold mt-1">{formatPHP(buyer.total_amount)}</div>
          <div className="text-white/50 text-xs mt-1">{buyer.transaction_count} transaction{buyer.transaction_count !== 1 ? 's' : ''}</div>
        </>
      ) : (
        <div className="text-white/50 text-sm mt-2">No data yet</div>
      )}
    </motion.div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-xs">
      <div className="font-semibold text-slate-700 mb-1">{label}</div>
      <div className="text-blue-600 font-bold">{formatPHP(payload[0]?.value)}</div>
      <div className="text-slate-400">{payload[0]?.payload?.count} transactions</div>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats]               = useState(null)
  const [chartData, setChartData]       = useState([])
  const [topBuyers, setTopBuyers]       = useState([])
  const [recentTxns, setRecentTxns]     = useState([])
  const [bestMonthly, setBestMonthly]   = useState(null)
  const [bestYearly, setBestYearly]     = useState(null)
  const [loading, setLoading]           = useState(true)

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const [s, rev, txns, bm, by, tops] = await Promise.all([
        window.electron.invoke('analytics:dashboard'),
        window.electron.invoke('analytics:monthlyRevenue', year),
        window.electron.invoke('transactions:getAll', {}),
        window.electron.invoke('analytics:bestBuyerMonthly', { year, month }),
        window.electron.invoke('analytics:bestBuyerYearly', year),
        window.electron.invoke('analytics:topBuyers', { year: null, month: null, limit: 5 })
      ])
      setStats(s)
      setChartData(MONTH_SHORT.map((m, i) => {
        const d = rev.find(r => parseInt(r.month) === i + 1)
        return { month: m, revenue: d?.total || 0, count: d?.count || 0 }
      }))
      setRecentTxns(txns.slice(0, 10))
      setBestMonthly(bm)
      setBestYearly(by)
      setTopBuyers(tops)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-slate-400">Loading dashboard…</span>
      </div>
    </div>
  )

  return (
    <div className="page-container">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Revenue"   value={formatPHP(stats?.totalRevenue)}    sub="All time"           icon={DollarSign} iconBg="bg-blue-600"    delay={0} />
        <StatCard title="Total Customers" value={stats?.totalCustomers ?? 0}        sub="Registered"         icon={Users}      iconBg="bg-emerald-500" delay={0.05} />
        <StatCard title="This Month"      value={formatPHP(stats?.monthlyRevenue)}  sub={`${MONTH_SHORT[month-1]} ${year}`} icon={TrendingUp} iconBg="bg-amber-500" delay={0.1} />
        <StatCard title="Transactions"    value={stats?.totalTransactions ?? 0}     sub="Total records"      icon={ShoppingCart} iconBg="bg-violet-500" delay={0.15} />
      </div>

      {/* Best buyers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <BestBuyerCard
          label={`Best Buyer — ${MONTH_SHORT[month-1]} ${year}`}
          buyer={bestMonthly}
          gradient="bg-gradient-to-br from-amber-500 to-orange-600"
          delay={0.2}
        />
        <BestBuyerCard
          label={`Best Buyer — Year ${year}`}
          buyer={bestYearly}
          gradient="bg-gradient-to-br from-blue-600 to-indigo-700"
          delay={0.25}
        />
      </div>

      {/* Chart + Top buyers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div {...FADE_UP(0.3)} className="card lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-slate-900">Monthly Revenue — {year}</h3>
          </div>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={chartData} barSize={28} margin={{ left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false}
                tickFormatter={v => v >= 1000 ? `₱${(v/1000).toFixed(0)}k` : `₱${v}`} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#EFF6FF', radius: 6 }} />
              <Bar dataKey="revenue" fill="#3B82F6" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div {...FADE_UP(0.35)} className="card p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">All-Time Top Buyers</h3>
          {topBuyers.length === 0 ? (
            <div className="text-slate-400 text-sm text-center py-10">No data yet</div>
          ) : (
            <div className="space-y-3">
              {topBuyers.map((c, i) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35 + i * 0.05 }}
                  className="flex items-center gap-3 group cursor-pointer"
                  onClick={() => navigate(`/customers/${c.id}`)}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${
                    i === 0 ? 'bg-amber-100 text-amber-700' :
                    i === 1 ? 'bg-slate-100 text-slate-600' :
                    i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-blue-50 text-blue-600'
                  }`}>
                    {i === 0 ? '👑' : i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-800 truncate group-hover:text-blue-600 transition-colors">
                      {c.full_name}
                    </div>
                    <div className="text-[11px] text-slate-400">{c.transaction_count} txns</div>
                  </div>
                  <div className="text-sm font-bold text-slate-800 flex-shrink-0">{formatPHP(c.total_amount)}</div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Recent transactions */}
      <motion.div {...FADE_UP(0.4)} className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">Recent Transactions</h3>
          <button onClick={() => navigate('/transactions')} className="btn-ghost !py-1 text-xs">
            View all <ArrowRight size={13} />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">Customer</th>
                <th className="table-header">Description</th>
                <th className="table-header">Date</th>
                <th className="table-header text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {recentTxns.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-slate-400 text-sm">
                    No transactions yet. Add your first one!
                  </td>
                </tr>
              ) : recentTxns.map(t => (
                <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="table-cell">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-[11px] font-bold text-blue-600 flex-shrink-0">
                        {t.customer_name?.[0]?.toUpperCase()}
                      </div>
                      <span className="font-medium text-slate-800">{t.customer_name}</span>
                    </div>
                  </td>
                  <td className="table-cell text-slate-500">{t.description || '—'}</td>
                  <td className="table-cell text-slate-500">{formatDateShort(t.date)}</td>
                  <td className="table-cell text-right font-semibold text-slate-900">{formatPHP(t.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  )
}
