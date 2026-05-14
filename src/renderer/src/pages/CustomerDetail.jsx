import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Mail, Phone, Plus, Trash2, Edit,
  ShoppingBag, DollarSign, Calendar, TrendingUp, FileText
} from 'lucide-react'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import { useToast } from '../context/ToastContext'
import { formatPHP, formatDate, formatDateShort, formatRecordedAt, toDateInput } from '../utils/format'

function AddTxnModal({ customerId, onClose, onSuccess }) {
  const { showToast } = useToast()
  const [form, setForm] = useState({ amount: '', description: '', date: toDateInput() })
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    if (!form.amount || parseFloat(form.amount) <= 0) { showToast('Enter a valid amount', 'error'); return }
    setSaving(true)
    try {
      await window.electron.invoke('transactions:add', {
        customer_id: customerId,
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
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Amount (PHP) *</label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold">₱</span>
            <input
              type="number" min="0.01" step="0.01"
              className="input-field pl-8" value={form.amount} onChange={set('amount')}
              placeholder="0.00" required autoFocus
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Date *</label>
          <input type="date" className="input-field" value={form.date} onChange={set('date')} required />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Description</label>
          <input className="input-field" value={form.description} onChange={set('description')} placeholder="Optional description" />
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

function EditCustomerModal({ customer, onClose, onSuccess }) {
  const { showToast } = useToast()
  const [form, setForm] = useState({
    full_name: customer.full_name || '',
    email: customer.email || '',
    phone: customer.phone || '',
    notes: customer.notes || ''
  })
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await window.electron.invoke('customers:update', { id: customer.id, data: form })
      showToast('Customer updated!', 'success')
      onSuccess()
      onClose()
    } catch (err) { showToast(err?.message || 'Failed to update customer', 'error') }
    finally { setSaving(false) }
  }

  return (
    <Modal title="Edit Customer" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Full Name *</label>
          <input className="input-field" value={form.full_name} onChange={set('full_name')} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Email</label>
            <input className="input-field" type="email" value={form.email} onChange={set('email')} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Phone</label>
            <input className="input-field" value={form.phone} onChange={set('phone')} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Notes</label>
          <textarea className="input-field resize-none" rows={2} value={form.notes} onChange={set('notes')} />
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

export default function CustomerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [customer, setCustomer]       = useState(null)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading]         = useState(true)
  const [addTxnOpen, setAddTxnOpen]   = useState(false)
  const [editOpen, setEditOpen]       = useState(false)
  const [deleteTxn, setDeleteTxn]     = useState(null)
  const [deleteCustomer, setDeleteCustomer] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const [c, txns] = await Promise.all([
        window.electron.invoke('customers:getById', parseInt(id)),
        window.electron.invoke('transactions:getByCustomer', parseInt(id))
      ])
      if (!c) { navigate('/customers'); return }
      setCustomer(c)
      setTransactions(txns)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [id])

  async function handleDeleteTxn() {
    try {
      await window.electron.invoke('transactions:delete', deleteTxn.id)
      showToast('Transaction deleted', 'info')
      setDeleteTxn(null)
      load()
    } catch (err) { showToast(err?.message || 'Failed to delete', 'error') }
  }

  async function handleDeleteCustomer() {
    try {
      await window.electron.invoke('customers:delete', parseInt(id))
      showToast('Customer deleted', 'info')
      navigate('/customers')
    } catch (err) { showToast(err?.message || 'Failed to delete customer', 'error') }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!customer) return null

  const avgTxn = transactions.length ? customer.total_purchases / transactions.length : 0

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/customers')} className="btn-ghost !px-2 !py-2">
            <ArrowLeft size={18} />
          </button>
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-4"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white text-xl font-bold shadow-lg">
              {customer.full_name[0].toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">{customer.full_name}</h2>
              <div className="flex items-center gap-3 mt-0.5">
                {customer.email && (
                  <span className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Mail size={11} />{customer.email}
                  </span>
                )}
                {customer.phone && (
                  <span className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Phone size={11} />{customer.phone}
                  </span>
                )}
                {!customer.email && !customer.phone && (
                  <span className="text-xs text-slate-400">No contact info</span>
                )}
              </div>
            </div>
          </motion.div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={() => setEditOpen(true)} className="btn-secondary">
            <Edit size={15} /> Edit
          </button>
          <button onClick={() => setDeleteCustomer(true)} className="btn-ghost hover:text-red-500">
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* Stat mini cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Spent', value: formatPHP(customer.total_purchases), icon: DollarSign, color: 'text-blue-600 bg-blue-50' },
          { label: 'Transactions', value: customer.transaction_count, icon: ShoppingBag, color: 'text-emerald-600 bg-emerald-50' },
          { label: 'Avg per Transaction', value: formatPHP(avgTxn), icon: TrendingUp, color: 'text-amber-600 bg-amber-50' },
          { label: 'Last Purchase', value: formatDateShort(customer.last_purchase), icon: Calendar, color: 'text-violet-600 bg-violet-50' }
        ].map(({ label, value, icon: Icon, color }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="card p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${color}`}>
                <Icon size={14} />
              </div>
              <span className="text-xs text-slate-500">{label}</span>
            </div>
            <div className="text-base font-bold text-slate-900">{value}</div>
          </motion.div>
        ))}
      </div>

      {/* Notes */}
      {customer.notes && (
        <div className="card p-4 flex gap-3">
          <FileText size={15} className="text-slate-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-slate-600">{customer.notes}</p>
        </div>
      )}

      {/* Transactions */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="card overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">Transaction History</h3>
          <button onClick={() => setAddTxnOpen(true)} className="btn-primary !py-2 text-xs">
            <Plus size={14} /> Add Transaction
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">Date</th>
                <th className="table-header">Description</th>
                <th className="table-header text-right">Amount</th>
                <th className="table-header">Time Added</th>
                <th className="table-header text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-slate-400 text-sm">
                    No transactions yet. Add the first one!
                  </td>
                </tr>
              ) : transactions.map((t, i) => (
                <motion.tr
                  key={t.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className="hover:bg-slate-50/60 transition-colors"
                >
                  <td className="table-cell font-medium text-slate-700">{formatDate(t.date)}</td>
                  <td className="table-cell text-slate-500">{t.description || <span className="text-slate-300">—</span>}</td>
                  <td className="table-cell text-right font-bold text-slate-900">{formatPHP(t.amount)}</td>
                  <td className="table-cell text-slate-400 whitespace-nowrap text-xs">{formatRecordedAt(t.created_at)}</td>
                  <td className="table-cell text-right">
                    <button onClick={() => setDeleteTxn(t)} className="btn-ghost !px-2 !py-1 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
            {transactions.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 border-t border-slate-200">
                  <td colSpan={2} className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Total
                  </td>
                  <td className="px-5 py-3 text-right text-base font-bold text-blue-700">
                    {formatPHP(customer.total_purchases)}
                  </td>
                  <td /><td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </motion.div>

      {addTxnOpen && (
        <AddTxnModal customerId={parseInt(id)} onClose={() => setAddTxnOpen(false)} onSuccess={load} />
      )}
      {editOpen && (
        <EditCustomerModal customer={customer} onClose={() => setEditOpen(false)} onSuccess={load} />
      )}
      {deleteTxn && (
        <ConfirmDialog
          title="Delete Transaction"
          message={`Delete the ${formatPHP(deleteTxn.amount)} transaction on ${formatDate(deleteTxn.date)}? This cannot be undone.`}
          onConfirm={handleDeleteTxn}
          onCancel={() => setDeleteTxn(null)}
        />
      )}
      {deleteCustomer && (
        <ConfirmDialog
          title="Delete Customer"
          message={`Delete "${customer.full_name}" and all their ${transactions.length} transaction(s)? This cannot be undone.`}
          onConfirm={handleDeleteCustomer}
          onCancel={() => setDeleteCustomer(false)}
        />
      )}
    </div>
  )
}
