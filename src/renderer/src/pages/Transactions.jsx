import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, Edit, Filter, X, Receipt, Search } from 'lucide-react'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import Pagination from '../components/Pagination'
import { useToast } from '../context/ToastContext'
import { formatPHP, formatDate, formatDateShort, formatRecordedAt, toDateInput } from '../utils/format'
import { Page, Pop, PopGrid } from '../components/Cascade'

function AddTxnModal({ onClose, onSuccess }) {
  const { showToast } = useToast()
  const [customers, setCustomers] = useState([])
  const [form, setForm] = useState({ customer_id: '', amount: '', description: '', date: toDateInput() })
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }))

  useEffect(() => {
    window.electron.invoke('customers:getAllLite').then(setCustomers)
  }, [])

  async function submit(e) {
    e.preventDefault()
    if (!form.customer_id) { showToast('Please select a customer', 'error'); return }
    if (!form.amount || parseFloat(form.amount) <= 0) { showToast('Enter a valid amount', 'error'); return }
    setSaving(true)
    try {
      await window.electron.invoke('transactions:add', {
        customer_id: parseInt(form.customer_id),
        amount: parseFloat(form.amount),
        description: form.description || null,
        date: form.date
      })
      showToast('Transaction added!', 'success')
      onSuccess()
      onClose()
    } catch (err) { showToast(err?.message || 'Failed to add transaction', 'error') }
    finally { setSaving(false) }
  }

  return (
    <Modal title="Add Transaction" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Customer *</label>
          <select className="input-field" value={form.customer_id} onChange={set('customer_id')} required>
            <option value="">Select a customer…</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>{c.full_name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Amount (PHP) *</label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold">₱</span>
            <input type="number" min="0.01" step="0.01" className="input-field pl-8"
              value={form.amount} onChange={set('amount')} placeholder="0.00" required />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Date *</label>
          <input type="date" className="input-field" value={form.date} onChange={set('date')} required />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Description</label>
          <input className="input-field" value={form.description} onChange={set('description')} placeholder="Optional" />
        </div>
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? 'Adding…' : 'Add Transaction'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function EditTxnModal({ txn, onClose, onSuccess }) {
  const { showToast } = useToast()
  const [form, setForm] = useState({
    amount: String(txn.amount),
    description: txn.description || '',
    date: toDateInput(txn.date)
  })
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    if (!form.amount || parseFloat(form.amount) <= 0) { showToast('Enter a valid amount', 'error'); return }
    setSaving(true)
    try {
      await window.electron.invoke('transactions:update', {
        id: txn.id,
        data: {
          amount: parseFloat(form.amount),
          description: form.description || null,
          date: form.date
        }
      })
      showToast('Transaction updated!', 'success')
      onSuccess()
      onClose()
    } catch (err) { showToast(err?.message || 'Failed to update transaction', 'error') }
    finally { setSaving(false) }
  }

  return (
    <Modal title={`Edit Transaction — ${txn.customer_name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Amount (PHP) *</label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold">₱</span>
            <input type="number" min="0.01" step="0.01" className="input-field pl-8"
              value={form.amount} onChange={set('amount')} placeholder="0.00" required autoFocus />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Date *</label>
          <input type="date" className="input-field" value={form.date} onChange={set('date')} required />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Description</label>
          <input className="input-field" value={form.description} onChange={set('description')} placeholder="Optional" />
        </div>
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function Transactions() {
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [rows, setRows]                 = useState([])
  const [total, setTotal]               = useState(0)
  const [sumAmount, setSumAmount]       = useState(0)
  const [loading, setLoading]           = useState(true)
  const [addOpen, setAddOpen]           = useState(false)
  const [editTarget, setEditTarget]     = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [filters, setFilters]           = useState({ startDate: '', endDate: '' })
  const [showFilters, setShowFilters]   = useState(false)
  const [query, setQuery]               = useState('')
  const [search, setSearch]             = useState('')
  const [page, setPage]                 = useState(1)
  const [pageSize, setPageSize]         = useState(50)

  // Debounce the search box so a fast typist fires one query, not one per key.
  useEffect(() => {
    const t = setTimeout(() => setSearch(query.trim()), 250)
    return () => clearTimeout(t)
  }, [query])

  const reqIdRef = useRef(0)

  const load = useCallback(async () => {
    const myReqId = ++reqIdRef.current
    setLoading(true)
    try {
      const res = await window.electron.invoke('transactions:getPage', {
        page, pageSize, search,
        startDate: filters.startDate || null,
        endDate:   filters.endDate   || null
      })
      if (myReqId !== reqIdRef.current) return   // a newer request already won
      setRows(res.rows)
      setTotal(res.total)
      setSumAmount(res.sumAmount)
    } catch (err) {
      if (myReqId === reqIdRef.current) showToast(err?.message || 'Failed to load transactions', 'error')
    } finally {
      if (myReqId === reqIdRef.current) setLoading(false)
    }
  }, [page, pageSize, search, filters, showToast])

  useEffect(() => { load() }, [load])

  // Any change to what is being listed sends you back to page 1 — done in the
  // handlers rather than an effect so it never fires two requests.
  const setSearchQuery = (v) => { setQuery(v); setPage(1) }
  const setFilter = (k) => (e) => { setFilters(p => ({ ...p, [k]: e.target.value })); setPage(1) }
  const clearFilters = () => { setFilters({ startDate: '', endDate: '' }); setPage(1) }
  const changePageSize = (n) => { setPageSize(n); setPage(1) }

  async function handleDelete() {
    try {
      await window.electron.invoke('transactions:delete', deleteTarget.id)
      showToast('Transaction deleted', 'info')
      setDeleteTarget(null)
      // Deleting the only row on the last page would strand us past the end.
      if (rows.length === 1 && page > 1) setPage(p => p - 1)
      else load()
    } catch (err) { showToast(err?.message || 'Failed to delete transaction', 'error') }
  }

  const hasFilters = filters.startDate || filters.endDate

  return (
    <Page>
      {/* Toolbar */}
      <Pop className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative flex-1 max-w-md">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input-field pl-9"
              placeholder="Search by customer or description…"
              value={query}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`btn-secondary ${hasFilters ? '!border-blue-400 !text-blue-600' : ''}`}
          >
            <Filter size={15} /> Filters {hasFilters && <span className="badge bg-blue-100 text-blue-700 !px-1.5">Active</span>}
          </button>
          {hasFilters && (
            <button onClick={clearFilters} className="btn-ghost !px-2 !py-2 hover:text-red-500">
              <X size={15} />
            </button>
          )}
        </div>
        <button onClick={() => setAddOpen(true)} className="btn-primary">
          <Plus size={16} /> Add Transaction
        </button>
      </Pop>

      {/* Filter bar */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="card p-4 overflow-hidden"
          >
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">From Date</label>
                <input type="date" className="input-field"
                  value={filters.startDate}
                  onChange={setFilter('startDate')} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">To Date</label>
                <input type="date" className="input-field"
                  value={filters.endDate}
                  onChange={setFilter('endDate')} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary — counts and totals cover every matching record, not just this page */}
      {total > 0 && (
        <div className="flex items-center gap-4 px-1">
          <div className="flex items-center gap-2 text-sm">
            <Receipt size={14} className="text-slate-400" />
            <span className="text-slate-500">
              {total.toLocaleString('en-PH')} {total === 1 ? 'record' : 'records'}
              {(search || hasFilters) && ' matching'}
            </span>
          </div>
          <div className="text-sm font-bold text-slate-900">
            Total: <span className="text-blue-600">{formatPHP(sumAmount)}</span>
          </div>
        </div>
      )}

      {/* Table */}
      <Pop
        className="card overflow-hidden"
      >
        <div className="overflow-x-auto max-h-[calc(100vh-320px)] overflow-y-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-white z-10">
              <tr>
                <th className="table-header">#</th>
                <th className="table-header">Date</th>
                <th className="table-header">Customer</th>
                <th className="table-header">Description</th>
                <th className="table-header text-right">Amount</th>
                <th className="table-header">Time Added</th>
                <th className="table-header text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-slate-400 text-sm">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400 text-sm">
                    {search ? 'No transactions match your search.'
                      : hasFilters ? 'No transactions for the selected period.'
                      : 'No transactions yet.'}
                  </td>
                </tr>
              ) : (
                rows.map((t, i) => (
                  <tr
                    key={t.id}
                    className="hover:bg-slate-50/60 transition-colors"
                  >
                    <td className="table-cell text-slate-400 font-medium w-10">{(page - 1) * pageSize + i + 1}</td>
                    <td className="table-cell font-medium text-slate-700 whitespace-nowrap">{formatDateShort(t.date)}</td>
                    <td className="table-cell">
                      <button
                        onClick={() => navigate(`/customers/${t.customer_id}`)}
                        className="flex items-center gap-2.5 group"
                      >
                        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-[11px] font-bold text-blue-700 flex-shrink-0">
                          {t.customer_name?.[0]?.toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-slate-800 group-hover:text-blue-600 transition-colors">
                          {t.customer_name}
                        </span>
                      </button>
                    </td>
                    <td className="table-cell text-slate-500">{t.description || <span className="text-slate-300">—</span>}</td>
                    <td className="table-cell text-right font-bold text-slate-900 whitespace-nowrap">{formatPHP(t.amount)}</td>
                    <td className="table-cell text-slate-400 whitespace-nowrap text-xs">{formatRecordedAt(t.created_at)}</td>
                    <td className="table-cell text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setEditTarget(t)} className="btn-ghost !px-2 !py-1 hover:text-blue-600" title="Edit">
                          <Edit size={14} />
                        </button>
                        <button onClick={() => setDeleteTarget(t)} className="btn-ghost !px-2 !py-1 hover:text-red-500" title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {total > 0 && (
              <tfoot className="sticky bottom-0">
                <tr className="bg-slate-50 border-t border-slate-200">
                  <td colSpan={4} className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {total.toLocaleString('en-PH')} Transactions — Total
                  </td>
                  <td className="px-5 py-3 text-right text-base font-bold text-blue-700 whitespace-nowrap">
                    {formatPHP(sumAmount)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          loading={loading}
          onPageChange={setPage}
          onPageSizeChange={changePageSize}
        />
      </Pop>

      {addOpen && <AddTxnModal onClose={() => setAddOpen(false)} onSuccess={load} />}
      {editTarget && (
        <EditTxnModal txn={editTarget} onClose={() => setEditTarget(null)} onSuccess={load} />
      )}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete Transaction"
          message={`Delete the ${formatPHP(deleteTarget.amount)} transaction from ${deleteTarget.customer_name} on ${formatDate(deleteTarget.date)}?`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </Page>
  )
}
