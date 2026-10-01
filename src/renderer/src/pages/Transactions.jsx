import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, Edit, Filter, X, Receipt, Search, CalendarRange, Wallet } from 'lucide-react'
import ConfirmDialog from '../components/ConfirmDialog'
import Pagination from '../components/Pagination'
import Avatar from '../components/Avatar'
import AnimatedNumber from '../components/AnimatedNumber'
import { AddTransactionModal, EditTransactionModal } from '../components/TransactionForms'
import { useToast } from '../context/ToastContext'
import usePaged from '../hooks/usePaged'
import { formatPHP, formatNumber, formatDate, formatDateShort, formatRecordedAt, toDateInput } from '../utils/format'

function rangeFor(key) {
  const now = new Date()
  const iso = toDateInput
  const today = iso(now)
  if (key === 'today') return { startDate: today, endDate: today }
  if (key === 'week') {
    const d = new Date(now); d.setDate(now.getDate() - ((now.getDay() + 6) % 7))
    return { startDate: iso(d), endDate: today }
  }
  if (key === 'month') return { startDate: `${today.slice(0, 7)}-01`, endDate: today }
  if (key === 'year') return { startDate: `${today.slice(0, 4)}-01-01`, endDate: today }
  return { startDate: '', endDate: '' }
}

const QUICK = [
  { key: 'all', label: 'All time' },
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'year', label: 'This year' }
]

export function SkeletonRows({ cols, rows = 8 }) {
  return Array.from({ length: rows }, (_, i) => (
    <tr key={i}>
      {Array.from({ length: cols }, (_, j) => (
        <td key={j} className="px-5 py-4"><div className="skeleton h-3.5" style={{ width: `${40 + ((i * 7 + j * 13) % 50)}%` }} /></td>
      ))}
    </tr>
  ))
}

export default function Transactions() {
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [query, setQuery]               = useState('')
  const [filters, setFilters]           = useState({ startDate: '', endDate: '' })
  const [quick, setQuick]               = useState('all')
  const [showFilters, setShowFilters]   = useState(false)
  const [addOpen, setAddOpen]           = useState(false)
  const [editTarget, setEditTarget]     = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const params = useMemo(() => ({ search: query.trim(), ...filters }), [query, filters])
  const paged = usePaged('transactions:page', params, { sizeKey: 'ct-size-transactions', defaultSize: 50, debounce: query ? 220 : 0 })

  function pickQuick(key) {
    setQuick(key)
    setFilters(rangeFor(key))
  }

  function setCustomRange(patch) {
    setQuick('custom')
    setFilters(p => ({ ...p, ...patch }))
  }

  async function handleDelete() {
    try {
      await window.electron.invoke('transactions:delete', deleteTarget.id)
      showToast('Transaction deleted', 'info')
      setDeleteTarget(null)
      paged.reload()
    } catch (err) { showToast(err?.message || 'Failed to delete transaction', 'error') }
  }

  const hasFilters = !!(filters.startDate || filters.endDate)
  const offset = (paged.page - 1) * paged.pageSize

  return (
    <div className="page-container">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[260px]">
          <div className="relative flex-1 max-w-md">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input-field pl-9 pr-9"
              placeholder="Search by customer or description…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                <X size={13} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`btn-secondary ${hasFilters ? '!border-blue-300 !text-blue-600' : ''}`}
          >
            <Filter size={15} /> Dates {hasFilters && <span className="badge bg-blue-100 text-blue-700 !px-1.5">On</span>}
          </button>
        </div>
        <motion.button whileTap={{ scale: 0.97 }} onClick={() => setAddOpen(true)} className="btn-primary">
          <Plus size={16} /> Add Transaction
        </motion.button>
      </div>

      {/* Date filters */}
      <AnimatePresence initial={false}>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="card p-4 space-y-4">
              <div className="flex flex-wrap gap-2">
                {QUICK.map(q => (
                  <button
                    key={q.key}
                    onClick={() => pickQuick(q.key)}
                    className={`relative px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                      quick === q.key ? 'text-white' : 'text-slate-600 bg-slate-100 hover:bg-slate-200'
                    }`}
                  >
                    {quick === q.key && (
                      <motion.span layoutId="txn-quick" className="absolute inset-0 rounded-full bg-blue-600" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />
                    )}
                    <span className="relative">{q.label}</span>
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="field-label">From</label>
                  <input type="date" className="input-field" value={filters.startDate} onChange={e => setCustomRange({ startDate: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">To</label>
                  <input type="date" className="input-field" value={filters.endDate} onChange={e => setCustomRange({ endDate: e.target.value })} />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><Receipt size={18} /></div>
          <div>
            <div className="text-xl font-bold text-slate-900 tabular-nums"><AnimatedNumber value={paged.total} format={v => formatNumber(Math.round(v))} /></div>
            <div className="text-xs text-slate-500">{query || hasFilters ? 'Matching transactions' : 'Total transactions'}</div>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><Wallet size={18} /></div>
          <div>
            <div className="text-xl font-bold text-slate-900"><AnimatedNumber value={paged.sum || 0} format={formatPHP} /></div>
            <div className="text-xs text-slate-500">Total amount</div>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center"><CalendarRange size={18} /></div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-slate-900 truncate">
              {hasFilters ? `${filters.startDate ? formatDateShort(filters.startDate) : 'Start'} – ${filters.endDate ? formatDateShort(filters.endDate) : 'Today'}` : 'All dates'}
            </div>
            <div className="text-xs text-slate-500">Period</div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-auto max-h-[calc(100vh-380px)] min-h-[240px]">
          <table className="w-full">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="table-header w-14">#</th>
                <th className="table-header">Date</th>
                <th className="table-header">Customer</th>
                <th className="table-header">Description</th>
                <th className="table-header text-right">Amount</th>
                <th className="table-header">Time Added</th>
                <th className="table-header text-right">Action</th>
              </tr>
            </thead>
            <tbody className={`divide-y divide-slate-50 transition-opacity duration-200 ${paged.loading && paged.loaded ? 'opacity-50' : ''}`}>
              {!paged.loaded ? (
                <SkeletonRows cols={7} />
              ) : paged.rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center">
                    <Receipt size={28} className="mx-auto text-slate-300" />
                    <div className="text-sm font-medium text-slate-500 mt-3">
                      {query ? 'No transactions match your search.' : hasFilters ? 'No transactions in this period.' : 'No transactions yet.'}
                    </div>
                  </td>
                </tr>
              ) : paged.rows.map((t, i) => (
                <tr
                  key={`${paged.page}-${t.id}`}
                  className="hover:bg-slate-50/70 transition-colors animate-row-in"
                  style={{ animationDelay: `${Math.min(i, 14) * 18}ms` }}
                >
                  <td className="table-cell text-slate-400 font-medium tabular-nums">{offset + i + 1}</td>
                  <td className="table-cell font-medium text-slate-700 whitespace-nowrap">{formatDateShort(t.date)}</td>
                  <td className="table-cell">
                    <button onClick={() => navigate(`/customers/${t.customer_id}`)} className="flex items-center gap-2.5 group text-left">
                      <Avatar name={t.customer_name} size={28} />
                      <span className="text-sm font-medium text-slate-800 group-hover:text-blue-600 transition-colors whitespace-nowrap">{t.customer_name}</span>
                    </button>
                  </td>
                  <td className="table-cell text-slate-500 max-w-[260px] truncate">{t.description || <span className="text-slate-300">—</span>}</td>
                  <td className="table-cell text-right font-bold text-slate-900 whitespace-nowrap tabular-nums">{formatPHP(t.amount)}</td>
                  <td className="table-cell text-slate-400 whitespace-nowrap text-xs">{formatRecordedAt(t.created_at)}</td>
                  <td className="table-cell text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setEditTarget(t)} className="btn-ghost !px-2 !py-1 hover:!text-blue-600" title="Edit"><Edit size={14} /></button>
                      <button onClick={() => setDeleteTarget(t)} className="btn-ghost !px-2 !py-1 hover:!text-red-500" title="Delete"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {paged.loaded && paged.total > 0 && (
          <Pagination
            page={paged.page}
            pageSize={paged.pageSize}
            total={paged.total}
            onPageChange={paged.setPage}
            onPageSizeChange={paged.setPageSize}
            loading={paged.loading}
            label="transactions"
            layoutId="txn-page"
          />
        )}
      </div>

      {addOpen && <AddTransactionModal onClose={() => setAddOpen(false)} onSuccess={paged.reload} />}
      {editTarget && <EditTransactionModal txn={editTarget} onClose={() => setEditTarget(null)} onSuccess={paged.reload} />}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete Transaction"
          message={`Delete the ${formatPHP(deleteTarget.amount)} transaction from ${deleteTarget.customer_name} on ${formatDate(deleteTarget.date)}?`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
