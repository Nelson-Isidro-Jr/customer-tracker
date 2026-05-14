import Modal from './Modal'
import { AlertTriangle } from 'lucide-react'

export default function ConfirmDialog({ title, message, onConfirm, onCancel, danger = true }) {
  return (
    <Modal title={title} onClose={onCancel} size="sm">
      <div className="flex flex-col items-center text-center gap-4">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${danger ? 'bg-red-50' : 'bg-amber-50'}`}>
          <AlertTriangle size={24} className={danger ? 'text-red-500' : 'text-amber-500'} />
        </div>
        <p className="text-sm text-slate-600 leading-relaxed">{message}</p>
        <div className="flex gap-3 w-full pt-1">
          <button onClick={onCancel} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button onClick={onConfirm} className={`flex-1 justify-center ${danger ? 'btn-danger' : 'btn-primary'}`}>
            Confirm
          </button>
        </div>
      </div>
    </Modal>
  )
}
