import { useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Minus, Star } from 'lucide-react'
import Modal from './Modal'
import { useToast } from '../context/ToastContext'

export function PrizeModal({ prize, onClose, onSuccess }) {
  const { showToast } = useToast()
  const [form, setForm] = useState({
    name: prize?.name || '',
    description: prize?.description || '',
    points_cost: prize?.points_cost ?? '',
    quantity: prize?.quantity ?? ''
  })
  const [saving, setSaving] = useState(false)
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const data = { ...form, points_cost: Number(form.points_cost), quantity: Number(form.quantity) }
      if (prize) await window.electron.invoke('rewards:updatePrize', { id: prize.id, data })
      else await window.electron.invoke('rewards:addPrize', data)
      showToast(prize ? 'Prize updated!' : 'Prize added!', 'success')
      onSuccess()
      onClose()
    } catch (err) { showToast(err?.message || 'Failed to save prize', 'error') }
    finally { setSaving(false) }
  }

  return (
    <Modal title={prize ? 'Edit Prize' : 'Add Prize'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="field-label">Prize name *</label>
          <input className="input-field" value={form.name} onChange={set('name')} placeholder="e.g. 5kg bag of rice" required autoFocus />
        </div>
        <div>
          <label className="field-label">Description</label>
          <input className="input-field" value={form.description} onChange={set('description')} placeholder="Optional details shown to the owner" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">Points needed *</label>
            <div className="relative">
              <Star size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-500 fill-amber-400" />
              <input type="number" min="1" step="1" className="input-field pl-9" value={form.points_cost} onChange={set('points_cost')} placeholder="10" required />
            </div>
          </div>
          <div>
            <label className="field-label">Quantity in stock *</label>
            <input type="number" min="0" step="1" className="input-field" value={form.quantity} onChange={set('quantity')} placeholder="5" required />
          </div>
        </div>
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? 'Saving…' : prize ? 'Save Changes' : 'Add Prize'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// Manual add / deduct, with a reason that is kept in the Activity Log
export function AdjustPointsModal({ customer, balance, onClose, onSuccess }) {
  const { showToast } = useToast()
  const [mode, setMode] = useState('add')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const n = Math.round(Number(amount) || 0)
  const preview = balance + (mode === 'add' ? n : -n)

  async function submit(e) {
    e.preventDefault()
    if (n <= 0) { showToast('Enter how many points', 'error'); return }
    setSaving(true)
    try {
      const res = await window.electron.invoke('rewards:adjust', { customerId: customer.id, points: mode === 'add' ? n : -n, reason })
      showToast(`${mode === 'add' ? 'Added' : 'Deducted'} ${n} point${n === 1 ? '' : 's'}`, 'success')
      onSuccess(res)
      onClose()
    } catch (err) { showToast(err?.message || 'Failed to adjust points', 'error') }
    finally { setSaving(false) }
  }

  return (
    <Modal title={`Adjust Points — ${customer.full_name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="relative grid grid-cols-2 bg-slate-100 rounded-xl p-1">
          {[['add', 'Add points', Plus], ['deduct', 'Deduct points', Minus]].map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              className={`relative flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-colors ${
                mode === key ? (key === 'add' ? 'text-emerald-700' : 'text-red-700') : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {mode === key && (
                <motion.span layoutId="adjust-mode" className="absolute inset-0 bg-white rounded-lg shadow-sm" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />
              )}
              <span className="relative flex items-center gap-2"><Icon size={14} /> {label}</span>
            </button>
          ))}
        </div>
        <div>
          <label className="field-label">Points *</label>
          <input type="number" min="1" step="1" className="input-field text-lg font-semibold" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" autoFocus required />
        </div>
        <div>
          <label className="field-label">Reason</label>
          <input className="input-field" value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Birthday bonus, correction, promo" maxLength={140} />
        </div>
        <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-100 px-4 py-3 text-sm">
          <span className="text-slate-500">New balance</span>
          <span className="font-bold tabular-nums">
            <span className="text-slate-400 font-medium">{balance.toLocaleString()} → </span>
            <span className={preview < 0 ? 'text-red-600' : 'text-slate-900'}>{preview.toLocaleString()} pts</span>
          </span>
        </div>
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button type="submit" disabled={saving || preview < 0} className={`flex-1 justify-center ${mode === 'add' ? 'btn-primary' : 'btn-danger'}`}>
            {saving ? 'Saving…' : mode === 'add' ? 'Add Points' : 'Deduct Points'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
