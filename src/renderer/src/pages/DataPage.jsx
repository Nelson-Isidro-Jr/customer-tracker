import { useState } from 'react'
import { motion } from 'framer-motion'
import { Upload, Download, FileSpreadsheet, Database, AlertTriangle, CheckCircle } from 'lucide-react'
import { useToast } from '../context/ToastContext'
import ConfirmDialog from '../components/ConfirmDialog'

function ActionCard({ icon: Icon, iconBg, title, description, buttonLabel, buttonClass, onClick, loading }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-6 flex flex-col gap-4"
    >
      <div className={`w-12 h-12 ${iconBg} rounded-2xl flex items-center justify-center`}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <h3 className="text-sm font-bold text-slate-900 mb-1">{title}</h3>
        <p className="text-xs text-slate-500 leading-relaxed">{description}</p>
      </div>
      <button onClick={onClick} disabled={loading} className={`${buttonClass} justify-center mt-auto`}>
        {loading ? 'Working…' : buttonLabel}
      </button>
    </motion.div>
  )
}

export default function DataPage() {
  const { showToast } = useToast()
  const [loading, setLoading]         = useState('')
  const [confirmImport, setConfirmImport] = useState(false)

  async function handleExportBackup() {
    setLoading('backup-export')
    try {
      const res = await window.electron.invoke('data:export')
      if (res.success) showToast('Backup exported successfully!', 'success')
      else showToast('Export cancelled', 'info')
    } catch { showToast('Export failed', 'error') }
    finally { setLoading('') }
  }

  async function handleImportBackup() {
    setLoading('backup-import')
    try {
      const res = await window.electron.invoke('data:import')
      if (res.success) showToast('Data imported! Refresh pages to see changes.', 'success')
      else showToast('Import cancelled', 'info')
    } catch { showToast('Import failed — invalid file?', 'error') }
    finally { setLoading(''); setConfirmImport(false) }
  }

  async function handleExportExcel() {
    setLoading('excel')
    try {
      const res = await window.electron.invoke('data:exportExcel', { type: 'all', filters: {} })
      if (res.success) showToast('Excel file exported!', 'success')
      else showToast('Export cancelled', 'info')
    } catch { showToast('Export failed', 'error') }
    finally { setLoading('') }
  }

  return (
    <div className="page-container">
      {/* Info banner */}
      <div className="card p-4 flex items-start gap-3 border-blue-200 bg-blue-50/60">
        <Database size={18} className="text-blue-500 flex-shrink-0 mt-0.5" />
        <div>
          <div className="text-sm font-semibold text-blue-900 mb-0.5">Database Management</div>
          <div className="text-xs text-blue-700 leading-relaxed">
            Export a backup to save all your data as a JSON file. Import a backup to restore from a previous save.
            Export to Excel for clean spreadsheet reports. <strong>Importing replaces all current data.</strong>
          </div>
        </div>
      </div>

      {/* Action cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ActionCard
          icon={Download}
          iconBg="bg-emerald-600"
          title="Export Backup"
          description="Save all customers and transactions to a JSON backup file. Use this to back up your data or transfer it to another device."
          buttonLabel="Export Backup (.json)"
          buttonClass="btn-secondary"
          onClick={handleExportBackup}
          loading={loading === 'backup-export'}
        />
        <ActionCard
          icon={Upload}
          iconBg="bg-amber-500"
          title="Import Backup"
          description="Restore data from a previously exported JSON backup file. Warning: this will replace ALL current data with the backup."
          buttonLabel="Import Backup (.json)"
          buttonClass="btn-secondary"
          onClick={() => setConfirmImport(true)}
          loading={loading === 'backup-import'}
        />
        <ActionCard
          icon={FileSpreadsheet}
          iconBg="bg-blue-600"
          title="Export to Excel"
          description="Export all customers and transactions to a clean Excel file with separate sheets. Perfect for analysis and sharing."
          buttonLabel="Export All to Excel (.xlsx)"
          buttonClass="btn-primary"
          onClick={handleExportExcel}
          loading={loading === 'excel'}
        />
      </div>

      {/* Tips */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <CheckCircle size={15} className="text-emerald-500" /> Tips
        </h3>
        <ul className="space-y-2 text-xs text-slate-500">
          <li className="flex items-start gap-2"><span className="text-slate-300 mt-0.5">•</span> Export a backup regularly to protect your data.</li>
          <li className="flex items-start gap-2"><span className="text-slate-300 mt-0.5">•</span> The database file is stored in your Windows user profile (AppData). Uninstalling the app does not delete it.</li>
          <li className="flex items-start gap-2"><span className="text-slate-300 mt-0.5">•</span> Use the Excel export for sharing reports with others or opening in Microsoft Excel / Google Sheets.</li>
          <li className="flex items-start gap-2"><span className="text-slate-300 mt-0.5">•</span> Only import backups created by this application (Customer Tracker JSON format).</li>
        </ul>
      </div>

      {confirmImport && (
        <ConfirmDialog
          title="Import Backup"
          message="Importing will permanently replace ALL your current customers and transactions with the data from the backup file. Are you sure you want to continue?"
          onConfirm={handleImportBackup}
          onCancel={() => setConfirmImport(false)}
        />
      )}
    </div>
  )
}
