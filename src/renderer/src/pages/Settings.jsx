import { useState } from 'react'
import { motion } from 'framer-motion'
import { User, Save, CheckCircle, Trash2, AlertTriangle } from 'lucide-react'
import { useSettings } from '../context/SettingsContext'
import { useToast } from '../context/ToastContext'
import ConfirmDialog from '../components/ConfirmDialog'

export default function Settings() {
  const { settings, updateSettings } = useSettings()
  const { showToast } = useToast()
  const [form, setForm] = useState({ userName: settings.userName })
  const [saving, setSaving] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  async function handleSave(e) {
    e.preventDefault()
    if (!form.userName.trim()) { showToast('Name cannot be empty', 'error'); return }
    setSaving(true)
    try {
      await updateSettings({ userName: form.userName.trim() })
      showToast('Settings saved!', 'success')
    } catch { showToast('Failed to save settings', 'error') }
    finally { setSaving(false) }
  }

  async function handleClearAll() {
    setClearing(true)
    try {
      await window.electron.invoke('data:clearAll')
      showToast('All data cleared successfully.', 'success')
    } catch (err) {
      showToast(err?.message || 'Failed to clear data', 'error')
    } finally {
      setClearing(false)
      setConfirmClear(false)
    }
  }

  const changed = form.userName.trim() !== settings.userName

  return (
    <div className="page-container max-w-2xl">
      {/* Profile card */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="card overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
            <User size={16} className="text-blue-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">User Profile</h2>
            <p className="text-xs text-slate-500">Your name appears in the sidebar and on reports</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="px-6 py-6 space-y-5">
          <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
            <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
              {settings.userName?.[0]?.toUpperCase() || 'N'}
            </div>
            <div>
              <div className="text-base font-bold text-slate-900">{settings.userName}</div>
              <div className="text-xs text-slate-500">Current display name</div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
              Display Name
            </label>
            <input
              className="input-field"
              value={form.userName}
              onChange={e => setForm(p => ({ ...p, userName: e.target.value }))}
              placeholder="Your name"
              maxLength={60}
            />
            <p className="text-xs text-slate-400 mt-1.5">This name is shown in the sidebar and on reports.</p>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={saving || !changed}
              className={`btn-primary ${(!changed || saving) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {saving ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</>
              ) : (
                <><Save size={15} /> Save Changes</>
              )}
            </button>
            {!changed && settings.userName && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-600">
                <CheckCircle size={13} /> Up to date
              </span>
            )}
          </div>
        </form>
      </motion.div>

      {/* Danger zone */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="card overflow-hidden border-red-100"
      >
        <div className="px-6 py-4 border-b border-red-100 bg-red-50/40 flex items-center gap-3">
          <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
            <AlertTriangle size={15} className="text-red-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-red-900">Danger Zone</h2>
            <p className="text-xs text-red-600/80">These actions cannot be undone</p>
          </div>
        </div>

        <div className="px-6 py-5 flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-slate-900">Clear All Data</div>
            <div className="text-xs text-slate-500 mt-0.5">
              Permanently delete every customer and transaction record from the database.
            </div>
          </div>
          <button
            onClick={() => setConfirmClear(true)}
            disabled={clearing}
            className="btn-danger flex-shrink-0"
          >
            <Trash2 size={15} />
            {clearing ? 'Clearing…' : 'Clear All Data'}
          </button>
        </div>
      </motion.div>

      {/* About card */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="card p-6"
      >
        <h3 className="text-sm font-bold text-slate-900 mb-4">About</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Application</span>
            <span className="font-medium text-slate-900">Customer Tracker</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Version</span>
            <span className="font-medium text-slate-900">1.0.0</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Author</span>
            <span className="font-medium text-slate-900">Nelson Isidro</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Currency</span>
            <span className="font-medium text-slate-900">Philippine Peso (₱ PHP)</span>
          </div>
        </div>
      </motion.div>

      {confirmClear && (
        <ConfirmDialog
          title="Clear All Data"
          message="This will permanently delete ALL customers and ALL transactions. This action cannot be undone."
          requireType="DELETE"
          onConfirm={handleClearAll}
          onCancel={() => setConfirmClear(false)}
        />
      )}
    </div>
  )
}
