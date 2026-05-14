import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Plus, UserCheck, Crown, ChevronRight, Edit, Trash2, Mail, Phone } from 'lucide-react'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import { useToast } from '../context/ToastContext'
import { formatPHP, formatDateShort } from '../utils/format'

function CustomerForm({ initial, onSubmit, onClose, loading }) {
  const [form, setForm] = useState(initial || { full_name: '', email: '', phone: '', notes: '' })
  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form) }} className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Full Name *</label>
        <input className="input-field" value={form.full_name} onChange={set('full_name')} placeholder="e.g. Juan dela Cruz" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Email</label>
          <input className="input-field" type="email" value={form.email} onChange={set('email')} placeholder="Optional" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Phone</label>
          <input className="input-field" value={form.phone} onChange={set('phone')} placeholder="Optional" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Notes</label>
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

export default function Customers() {
  const navigate   = useNavigate()
  const { showToast } = useToast()

  const [customers, setCustomers] = useState([])
  const [loading, setLoading]     = useState(true)
  const [query, setQuery]         = useState('')
  const [addOpen, setAddOpen]     = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [saving, setSaving]       = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = query.trim()
        ? await window.electron.invoke('customers:search', query.trim())
        : await window.electron.invoke('customers:getAll')
      setCustomers(data)
    } finally { setLoading(false) }
  }, [query])

  useEffect(() => { load() }, [load])

  async function handleAdd(form) {
    setSaving(true)
    try {
      await window.electron.invoke('customers:add', form)
      showToast('Customer added!', 'success')
      setAddOpen(false)
      load()
    } catch (err) { showToast(err?.message || 'Failed to add customer', 'error') }
    finally { setSaving(false) }
  }

  async function handleEdit(form) {
    setSaving(true)
    try {
      await window.electron.invoke('customers:update', { id: editTarget.id, data: form })
      showToast('Customer updated!', 'success')
      setEditTarget(null)
      load()
    } catch (err) { showToast(err?.message || 'Failed to update customer', 'error') }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    try {
      await window.electron.invoke('customers:delete', deleteTarget.id)
      showToast('Customer deleted', 'info')
      setDeleteTarget(null)
      load()
    } catch (err) { showToast(err?.message || 'Failed to delete customer', 'error') }
  }

  const topBuyer = customers[0]

  return (
    <div className="page-container">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input-field pl-9"
            placeholder="Search by name, email or phone…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <button onClick={() => setAddOpen(true)} className="btn-primary flex-shrink-0">
          <Plus size={16} /> Add Customer
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
            <UserCheck size={20} className="text-blue-600" />
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900">{customers.length}</div>
            <div className="text-xs text-slate-500">Total Customers</div>
          </div>
        </div>
        {topBuyer && (
          <div className="card p-4 flex items-center gap-4 border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
              <Crown size={20} className="text-amber-600" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-slate-900 truncate">{topBuyer.full_name}</div>
              <div className="text-xs text-amber-600 font-semibold">{formatPHP(topBuyer.total_purchases)} — Top Buyer</div>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <motion.div className="card overflow-hidden" layout>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">#</th>
                <th className="table-header">Customer</th>
                <th className="table-header">Contact</th>
                <th className="table-header text-right">Total Purchases</th>
                <th className="table-header text-center">Txns</th>
                <th className="table-header">Last Purchase</th>
                <th className="table-header text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-slate-400 text-sm">Loading…</td></tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center">
                    <div className="text-slate-400 text-sm">{query ? 'No customers match your search.' : 'No customers yet. Add your first customer!'}</div>
                  </td>
                </tr>
              ) : (
                <AnimatePresence>
                  {customers.map((c, i) => (
                    <motion.tr
                      key={c.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                      className="hover:bg-slate-50/70 transition-colors group"
                    >
                      <td className="table-cell text-slate-400 font-medium w-10">{i + 1}</td>
                      <td className="table-cell">
                        <div
                          className="flex items-center gap-3 cursor-pointer"
                          onClick={() => navigate(`/customers/${c.id}`)}
                        >
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                            i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {c.full_name[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors flex items-center gap-1.5">
                              {c.full_name}
                              {i === 0 && <Crown size={12} className="text-amber-500" />}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="table-cell text-slate-500">
                        <div className="space-y-0.5">
                          {c.email && <div className="flex items-center gap-1.5 text-xs"><Mail size={11} />{c.email}</div>}
                          {c.phone && <div className="flex items-center gap-1.5 text-xs"><Phone size={11} />{c.phone}</div>}
                          {!c.email && !c.phone && <span className="text-slate-300">—</span>}
                        </div>
                      </td>
                      <td className="table-cell text-right font-bold text-slate-900">{formatPHP(c.total_purchases)}</td>
                      <td className="table-cell text-center">
                        <span className="badge bg-blue-50 text-blue-700">{c.transaction_count}</span>
                      </td>
                      <td className="table-cell text-slate-500">{formatDateShort(c.last_purchase)}</td>
                      <td className="table-cell">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => navigate(`/customers/${c.id}`)} className="btn-ghost !px-2 !py-1.5" title="View">
                            <ChevronRight size={15} />
                          </button>
                          <button onClick={() => setEditTarget(c)} className="btn-ghost !px-2 !py-1.5 hover:text-blue-600" title="Edit">
                            <Edit size={15} />
                          </button>
                          <button onClick={() => setDeleteTarget(c)} className="btn-ghost !px-2 !py-1.5 hover:text-red-500" title="Delete">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Modals */}
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
          message={`Delete "${deleteTarget.full_name}"? This will also remove all their transaction records. This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
