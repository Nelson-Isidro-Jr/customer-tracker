import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Search, Plus, UserCheck, Crown, ChevronRight, Edit, Trash2, Mail, Phone, X,
  ArrowDownWideNarrow, Repeat, Star
} from 'lucide-react'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import Pagination from '../components/Pagination'
import Select from '../components/Select'
import Avatar from '../components/Avatar'
import AnimatedNumber from '../components/AnimatedNumber'
import { SkeletonRows } from './Transactions'
import { useToast } from '../context/ToastContext'
import usePaged from '../hooks/usePaged'
import { formatPHP, formatNumber, formatDateShort } from '../utils/format'

export function CustomerForm({ initial, onSubmit, onClose, loading }) {
  const [form, setForm] = useState(() => ({
    full_name: initial?.full_name || '',
    email: initial?.email || '',
    phone: initial?.phone || '',
    notes: initial?.notes || ''
  }))
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(form) }} className="space-y-4">
      <div>
        <label className="field-label">Full Name *</label>
        <input className="input-field" value={form.full_name} onChange={set('full_name')} placeholder="e.g. Juan dela Cruz" required autoFocus />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label">Email</label>
          <input className="input-field" type="email" value={form.email} onChange={set('email')} placeholder="Optional" />
        </div>
        <div>
          <label className="field-label">Phone</label>
          <input className="input-field" value={form.phone} onChange={set('phone')} placeholder="Optional" />
        </div>
      </div>
      <div>
        <label className="field-label">Notes</label>
        <textarea className="input-field resize-none" rows={2} value={form.notes} onChange={set('notes')} placeholder="Optional notes…" />
      </div>
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
        <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
          {loading ? 'Saving…' : initial ? 'Save Changes' : 'Add Customer'}
        </button>
      </div>
    </form>
  )
}

const SORTS = [
  { value: 'total',  label: 'Top spenders' },
  { value: 'visits', label: 'Most transactions' },
  { value: 'points', label: 'Most points' },
  { value: 'recent', label: 'Recent purchase' },
  { value: 'name',   label: 'Name (A–Z)' },
  { value: 'newest', label: 'Newest customers' }
]

export default function Customers() {
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [query, setQuery]               = useState('')
  const [sort, setSort]                 = useState(() => { try { return localStorage.getItem('ct-customers-sort') || 'total' } catch (_) { return 'total' } })
  const [summary, setSummary]           = useState(null)
  const [addOpen, setAddOpen]           = useState(false)
  const [editTarget, setEditTarget]     = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [saving, setSaving]             = useState(false)

  const params = useMemo(() => ({ search: query.trim(), sort }), [query, sort])
  const paged = usePaged('customers:page', params, { sizeKey: 'ct-size-customers', defaultSize: 25, debounce: query ? 220 : 0 })

  const loadSummary = useCallback(() => {
    window.electron.invoke('customers:summary').then(setSummary).catch(() => {})
  }, [])
  useEffect(() => { loadSummary() }, [loadSummary])

  function changeSort(v) {
    setSort(v)
    try { localStorage.setItem('ct-customers-sort', v) } catch (_) {}
  }

  function refresh() {
    paged.reload()
    loadSummary()
  }

  async function handleAdd(form) {
    setSaving(true)
    try {
      await window.electron.invoke('customers:add', form)
      showToast('Customer added!', 'success')
      setAddOpen(false)
      refresh()
    } catch (err) { showToast(err?.message || 'Failed to add customer', 'error') }
    finally { setSaving(false) }
  }

  async function handleEdit(form) {
    setSaving(true)
    try {
      await window.electron.invoke('customers:update', { id: editTarget.id, data: form })
      showToast('Customer updated!', 'success')
      setEditTarget(null)
      refresh()
    } catch (err) { showToast(err?.message || 'Failed to update customer', 'error') }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    try {
      await window.electron.invoke('customers:delete', deleteTarget.id)
      showToast('Customer deleted', 'info')
      setDeleteTarget(null)
      refresh()
    } catch (err) { showToast(err?.message || 'Failed to delete customer', 'error') }
  }

  const offset = (paged.page - 1) * paged.pageSize

  return (
    <div className="page-container">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input-field pl-9 pr-9"
            placeholder="Search by name, email or phone…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100">
              <X size={13} />
            </button>
          )}
        </div>
        <div className="w-full sm:w-56">
          <Select value={sort} onChange={changeSort} options={SORTS} icon={ArrowDownWideNarrow} ariaLabel="Sort customers" />
        </div>
        <motion.button whileTap={{ scale: 0.97 }} onClick={() => setAddOpen(true)} className="btn-primary flex-shrink-0">
          <Plus size={16} /> Add Customer
        </motion.button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center"><UserCheck size={20} className="text-blue-600" /></div>
          <div>
            <div className="text-xl font-bold text-slate-900 tabular-nums">
              <AnimatedNumber value={summary?.count || 0} format={v => formatNumber(Math.round(v))} />
            </div>
            <div className="text-xs text-slate-500">Total customers</div>
          </div>
        </motion.div>
        {summary?.topBuyer && (
          <motion.button
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            onClick={() => navigate(`/customers/${summary.topBuyer.id}`)}
            className="card p-4 flex items-center gap-4 text-left border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 hover:shadow-md transition-shadow"
          >
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center"><Crown size={20} className="text-amber-600" /></div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-slate-900 truncate">{summary.topBuyer.full_name}</div>
              <div className="text-xs text-amber-700 font-semibold">{formatPHP(summary.topBuyer.total_purchases)} · Top buyer</div>
            </div>
          </motion.button>
        )}
        {summary?.mostFrequent && (
          <motion.button
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            onClick={() => navigate(`/customers/${summary.mostFrequent.id}`)}
            className="card p-4 flex items-center gap-4 text-left border-violet-200 bg-gradient-to-r from-violet-50 to-blue-50 hover:shadow-md transition-shadow"
          >
            <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center"><Repeat size={19} className="text-violet-600" /></div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-slate-900 truncate">{summary.mostFrequent.full_name}</div>
              <div className="text-xs text-violet-700 font-semibold">{formatNumber(summary.mostFrequent.transaction_count)} transactions · Most frequent</div>
            </div>
          </motion.button>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-auto max-h-[calc(100vh-340px)] min-h-[240px]">
          <table className="w-full">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="table-header w-14">#</th>
                <th className="table-header">Customer</th>
                <th className="table-header text-right">Total Purchases</th>
                <th className="table-header text-center">Txns</th>
                <th className="table-header text-center">Points</th>
                <th className="table-header">Last Purchase</th>
                <th className="table-header text-right">Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y divide-slate-50 transition-opacity duration-200 ${paged.loading && paged.loaded ? 'opacity-50' : ''}`}>
              {!paged.loaded ? (
                <SkeletonRows cols={7} />
              ) : paged.rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center">
                    <UserCheck size={28} className="mx-auto text-slate-300" />
                    <div className="text-sm font-medium text-slate-500 mt-3">{query ? 'No customers match your search.' : 'No customers yet. Add your first customer!'}</div>
                  </td>
                </tr>
              ) : paged.rows.map((c, i) => {
                const isTop = summary?.topBuyer?.id === c.id
                return (
                  <tr
                    key={`${paged.page}-${c.id}`}
                    className="hover:bg-slate-50/70 transition-colors group animate-row-in"
                    style={{ animationDelay: `${Math.min(i, 14) * 18}ms` }}
                  >
                    <td className="table-cell text-slate-400 font-medium tabular-nums">{offset + i + 1}</td>
                    <td className="table-cell">
                      <button className="flex items-center gap-3 text-left min-w-0" onClick={() => navigate(`/customers/${c.id}`)}>
                        <Avatar name={c.full_name} size={36} />
                        <span className="min-w-0">
                          <span className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors flex items-center gap-1.5 whitespace-nowrap">
                            {c.full_name}
                            {isTop && <Crown size={12} className="text-amber-500" />}
                          </span>
                          <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-400 mt-0.5">
                            {c.email && <span className="flex items-center gap-1"><Mail size={10} />{c.email}</span>}
                            {c.phone && <span className="flex items-center gap-1"><Phone size={10} />{c.phone}</span>}
                            {!c.email && !c.phone && <span>No contact details</span>}
                          </span>
                        </span>
                      </button>
                    </td>
                    <td className="table-cell text-right font-bold text-slate-900 tabular-nums">{formatPHP(c.total_purchases)}</td>
                    <td className="table-cell text-center"><span className="badge bg-blue-50 text-blue-700 tabular-nums">{formatNumber(c.transaction_count)}</span></td>
                    <td className="table-cell text-center">
                      <span className="badge bg-amber-50 text-amber-700 tabular-nums gap-1"><Star size={11} className="fill-current" />{formatNumber(c.points_balance)}</span>
                    </td>
                    <td className="table-cell text-slate-500 whitespace-nowrap">{formatDateShort(c.last_purchase)}</td>
                    <td className="table-cell">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => navigate(`/customers/${c.id}`)} className="btn-ghost !px-2 !py-1.5" title="View"><ChevronRight size={15} /></button>
                        <button onClick={() => setEditTarget(c)} className="btn-ghost !px-2 !py-1.5 hover:!text-blue-600" title="Edit"><Edit size={15} /></button>
                        <button onClick={() => setDeleteTarget(c)} className="btn-ghost !px-2 !py-1.5 hover:!text-red-500" title="Delete"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
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
            label="customers"
            layoutId="cust-page"
          />
        )}
      </div>

      {addOpen && (
        <Modal title="Add New Customer" onClose={() => setAddOpen(false)}>
          <CustomerForm onSubmit={handleAdd} onClose={() => setAddOpen(false)} loading={saving} />
        </Modal>
      )}
      {editTarget && (
        <Modal title="Edit Customer" onClose={() => setEditTarget(null)}>
          <CustomerForm initial={editTarget} onSubmit={handleEdit} onClose={() => setEditTarget(null)} loading={saving} />
        </Modal>
      )}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete Customer"
          message={`Delete "${deleteTarget.full_name}"? This also removes their ${deleteTarget.transaction_count} transaction record(s) and reward history. This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
