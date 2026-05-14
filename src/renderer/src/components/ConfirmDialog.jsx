import { useState } from 'react'
import Modal from './Modal'
import { AlertTriangle } from 'lucide-react'

export default function ConfirmDialog({ title, message, onConfirm, onCancel, danger = true, requireType }) {
  const [typed, setTyped] = useState('')
  const gated = !!requireType
  const canConfirm = !gated || typed === requireType

  return (
    <Modal title={title} onClose={onCancel} size="sm">
      <div className="flex flex-col items-center text-center gap-4">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${danger ? 'bg-red-50' : 'bg-amber-50'}`}>
          <AlertTriangle size={24} className={danger ? 'text-red-500' : 'text-amber-500'} />
        </div>
        <p className="text-sm text-slate-600 leading-relaxed">{message}</p>
        {gated && (
          <div className="w-full text-left">
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
              Type <span className="font-mono text-red-600">{requireType}</span> to confirm
            </label>
            <input
              autoFocus
              className="input-field font-mono"
              value={typed}
              onChange={e => setTyped(e.target.value)}
              placeholder={requireType}
            />
          </div>
        )}
        <div className="flex gap-3 w-full pt-1">
          <button onClick={onCancel} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button
            onClick={onConfirm}
            disabled={!canConfirm}
            className={`flex-1 justify-center ${danger ? 'btn-danger' : 'btn-primary'} ${!canConfirm ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Confirm
          </button>
        </div>
      </div>
    </Modal>
  )
}
