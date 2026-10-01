import { useState } from 'react'
import Modal from './Modal'
import CustomerPicker from './CustomerPicker'
import { useToast } from '../context/ToastContext'
import { toDateInput } from '../utils/format'

function AmountInput({ value, onChange, autoFocus }) {
  return (
    <div className="relative">
      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold">₱</span>
      <input
        type="number" min="0.01" step="0.01" className="input-field pl-8"
        value={value} onChange={onChange} placeholder="0.00" required autoFocus={autoFocus}
      />
    </div>
  )
}

// Add a transaction. Pass `customer` to lock it to one customer (Customer Detail).
export function AddTransactionModal({ customer = null, onClose, onSuccess }) {
  const { showToast } = useToast()
  const [picked, setPicked] = useState(customer)
  const [form, setForm] = useState({ amount: '', description: '', date: toDateInput() })
  const [saving, setSaving] = useState(false)
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    if (!picked) { showToast('Please select a customer', 'error'); return }
    if (!form.amount || parseFloat(form.amount) <= 0) { showToast('Enter a valid amount', 'error'); return }
    setSaving(true)
    try {
      await window.electron.invoke('transactions:add', {
        customer_id: picked.id,
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
    <Modal title={customer ? `Add Transaction — ${customer.full_name}` : 'Add Transaction'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {!customer && (
          <div>
            <label className="field-label">Customer *</label>
            <CustomerPicker value={picked} onChange={setPicked} />
          </div>
        )}
        <div>
          <label className="field-label">Amount (PHP) *</label>
          <AmountInput value={form.amount} onChange={set('amount')} autoFocus={!!customer} />
        </div>
        <div>
          <label className="field-label">Date *</label>
          <input type="date" className="input-field" value={form.date} onChange={set('date')} required />
        </div>
        <div>
          <label className="field-label">Description</label>
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

export function EditTransactionModal({ txn, onClose, onSuccess }) {
  const { showToast } = useToast()
  const [form, setForm] = useState({
    amount: String(txn.amount),
    description: txn.description || '',
    date: toDateInput(txn.date)
  })
  const [saving, setSaving] = useState(false)
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    if (!form.amount || parseFloat(form.amount) <= 0) { showToast('Enter a valid amount', 'error'); return }
    setSaving(true)
    try {
      await window.electron.invoke('transactions:update', {
        id: txn.id,
        data: { amount: parseFloat(form.amount), description: form.description || null, date: form.date }
      })
      showToast('Transaction updated!', 'success')
      onSuccess()
      onClose()
    } catch (err) { showToast(err?.message || 'Failed to update transaction', 'error') }
    finally { setSaving(false) }
  }

  return (
    <Modal title={txn.customer_name ? `Edit Transaction — ${txn.customer_name}` : 'Edit Transaction'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="field-label">Amount (PHP) *</label>
          <AmountInput value={form.amount} onChange={set('amount')} autoFocus />
        </div>
        <div>
          <label className="field-label">Date *</label>
          <input type="date" className="input-field" value={form.date} onChange={set('date')} required />
        </div>
        <div>
          <label className="field-label">Description</label>
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
