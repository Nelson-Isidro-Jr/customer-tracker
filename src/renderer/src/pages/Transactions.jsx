import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, Filter, X, Receipt } from 'lucide-react'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import { useToast } from '../context/ToastContext'
import { formatPHP, formatDate, formatDateShort, formatRecordedAt, toDateInput } from '../utils/format'

function AddTxnModal({ onClose, onSuccess }) {
  const { showToast } = useToast()
  const [customers, setCustomers] = useState([])
  const [form, setForm] = useState({ customer_id: '', amount: '', description: '', date: toDateInput() })
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }))

  useEffect(() => {
    window.electron.invoke('customers:getAll').then(setCustomers)
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

export default function Transactions() {
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [transactions, setTransactions] = useState([])
  const [loading, setLoading]           = useState(true)
  const [addOpen, setAddOpen]           = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [filters, setFilters]           = useState({ startDate: '', endDate: '' })
  const [showFilters, setShowFilters]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const f = {}
      if (filters.startDate) f.startDate = filters.startDate
      if (filters.endDate)   f.endDate   = filters.endDate
      const data = await window.electron.invoke('transactions:getAll', f)
      setTransactions(data)
    } finally { setLoading(false) }
  }, [filters])

  useEffect(() => { load() }, [load])

  async function handleDelete() {
    try {
      await window.electron.invoke('transactions:delete', deleteTarget.id)
      showToast('Transaction deleted', 'info')
      setDeleteTarget(null)
      load()
    } catch (err) { showToast(err?.message || 'Failed to delete transaction', 'error') }
  }

  const clearFilters = () => setFilters({ startDate: '', endDate: '' })
  const hasFilters = filters.startDate || filters.endDate
  const total = transactions.reduce((s, t) => s + t.amount, 0)

  return (
    <div className="page-container">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
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
      </div>

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
                  onChange={e => setFilters(p => ({ ...p, startDate: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">To Date</label>
                <input type="date" className="input-field"
                  value={filters.endDate}
                  onChange={e => setFilters(p => ({ ...p, endDate: e.target.value }))} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary */}
      {transactions.length > 0 && (
        <div className="flex items-center gap-4 px-1">
          <div className="flex items-center gap-2 text-sm">
            <Receipt size={14} className="text-slate-400" />
            <span className="text-slate-500">{transactions.length} records</span>
          </div>
          <div className="text-sm font-bold text-slate-900">
            Total: <span className="text-blue-600">{formatPHP(total)}</span>
          </div>
        </div>
      )}

      {/* Table */}
      <motion.div className="card overflow-hidden" layout>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
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
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400 text-sm">
                    {hasFilters ? 'No transactions for the selected period.' : 'No transactions yet.'}
                  </td>
                </tr>
              ) : (
                transactions.map((t, i) => (
                  <motion.tr
                    key={t.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.015 }}
                    className="hover:bg-slate-50/60 transition-colors"
                  >
                    <td className="table-cell text-slate-400 font-medium w-10">{i + 1}</td>
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
                      <button onClick={() => setDeleteTarget(t)} className="btn-ghost !px-2 !py-1 hover:text-red-500">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
            {transactions.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 border-t border-slate-200">
                  <td colSpan={5} className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {transactions.length} Transactions — Total
                  </td>
                  <td className="px-5 py-3 text-right text-base font-bold text-blue-700">{formatPHP(total)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </motion.div>

      {addOpen && <AddTxnModal onClose={() => setAddOpen(false)} onSuccess={load} />}
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
