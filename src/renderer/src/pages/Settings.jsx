import { useState, useEffect, useCallback, useRef } from 'react'
import {
  User, Save, CheckCircle, Trash2, AlertTriangle, FolderOpen,
  ShieldCheck, FolderX, Award, Coins, CalendarX, ImagePlus, X
} from 'lucide-react'
import { useSettings } from '../context/SettingsContext'
import { useToast } from '../context/ToastContext'
import ConfirmDialog from '../components/ConfirmDialog'
import { Page, Pop } from '../components/Cascade'
import { formatPHP, formatDateShort } from '../utils/format'
import { fileToResizedDataURL } from '../utils/image'

export default function Settings() {
  const { settings, updateSettings } = useSettings()
  const { showToast } = useToast()
  const [form, setForm] = useState({ userName: settings.userName })
  const [saving, setSaving] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [version, setVersion] = useState('')

  // ── Points config ──────────────────────────────────────────────────────────
  const [points, setPoints] = useState({ peso_per_point: '', start_date: '' })
  const [pointsSaved, setPointsSaved] = useState(null)
  const [summary, setSummary] = useState(null)
  const [savingPoints, setSavingPoints] = useState(false)
  const [confirmPoints, setConfirmPoints] = useState(false)

  // ── Profile picture ────────────────────────────────────────────────────────
  const avatarInputRef = useRef(null)
  const [avatarBusy, setAvatarBusy] = useState(false)

  async function pickAvatar(e) {
    const file = e.target.files?.[0]
    e.target.value = ''          // allow re-picking the same file after removal
    if (!file) return
    setAvatarBusy(true)
    try {
      const avatar = await fileToResizedDataURL(file, 256)
      await updateSettings({ avatar })
      showToast('Profile picture updated!', 'success')
    } catch (err) {
      showToast(err?.message || 'Could not load that image', 'error')
    } finally { setAvatarBusy(false) }
  }

  async function removeAvatar() {
    try {
      await updateSettings({ avatar: null })
      showToast('Profile picture removed', 'info')
    } catch { showToast('Failed to update setting', 'error') }
  }

  const loadPoints = useCallback(async () => {
    try {
      const [cfg, sum] = await Promise.all([
        window.electron.invoke('points:getConfig'),
        window.electron.invoke('points:summary')
      ])
      const shaped = { peso_per_point: String(cfg.peso_per_point), start_date: cfg.start_date || '' }
      setPoints(shaped)
      setPointsSaved(shaped)
      setSummary(sum)
    } catch (err) { showToast(err?.message || 'Failed to load points settings', 'error') }
  }, [showToast])

  useEffect(() => {
    loadPoints()
    window.electron.invoke('app:getVersion').then(setVersion).catch(() => {})
  }, [loadPoints])

  const pointsChanged = pointsSaved && (
    points.peso_per_point !== pointsSaved.peso_per_point ||
    points.start_date     !== pointsSaved.start_date
  )
  const rateValue = parseFloat(points.peso_per_point)
  const rateValid = Number.isFinite(rateValue) && rateValue > 0

  async function savePoints() {
    setSavingPoints(true)
    try {
      await window.electron.invoke('points:setConfig', {
        peso_per_point: rateValue,
        start_date: points.start_date || null
      })
      showToast('Points settings saved — balances recalculated', 'success')
      await loadPoints()
    } catch (err) {
      showToast(err?.message || 'Failed to save points settings', 'error')
    } finally {
      setSavingPoints(false)
      setConfirmPoints(false)
    }
  }

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

  async function pickBackupFolder() {
    const folder = await window.electron.invoke('dialog:pickFolder')
    if (!folder) return
    try {
      await updateSettings({ autoBackupFolder: folder })
      showToast('Auto-backup folder set', 'success')
    } catch { showToast('Failed to update setting', 'error') }
  }

  async function disableAutoBackup() {
    try {
      await updateSettings({ autoBackupFolder: null })
      showToast('Auto-backup disabled', 'info')
    } catch { showToast('Failed to update setting', 'error') }
  }

  async function runBackupNow() {
    try {
      const last = await window.electron.invoke('data:autoBackupNow')
      if (last) {
        await updateSettings({ autoBackupLastRun: last })
        showToast('Backup written', 'success')
      } else {
        showToast('Set a backup folder first', 'info')
      }
    } catch { showToast('Backup failed', 'error') }
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
    <Page className="max-w-2xl">
      {/* Profile card */}
      <Pop
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
            <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={pickAvatar} />
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={avatarBusy}
              className="group relative w-16 h-16 rounded-full overflow-hidden flex-shrink-0 bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center ring-2 ring-white shadow-sm"
              title="Change profile picture"
            >
              {settings.avatar
                ? <img src={settings.avatar} alt="" className="w-full h-full object-cover" />
                : <span className="text-white font-bold text-xl">{settings.userName?.[0]?.toUpperCase() || 'N'}</span>}
              <span className="absolute inset-0 bg-slate-900/55 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <ImagePlus size={18} className="text-white" />
              </span>
            </button>

            <div className="min-w-0">
              <div className="text-base font-bold text-slate-900 truncate">{settings.userName}</div>
              <div className="text-xs text-slate-500 mb-1.5">Shown on the welcome screen and sidebar</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={avatarBusy}
                  className="btn-secondary !py-1.5 !px-3 !text-xs"
                >
                  <ImagePlus size={13} /> {avatarBusy ? 'Processing…' : settings.avatar ? 'Change Photo' : 'Add Photo'}
                </button>
                {settings.avatar && (
                  <button type="button" onClick={removeAvatar} className="btn-ghost !py-1.5 !px-2 !text-xs hover:text-red-500">
                    <X size={13} /> Remove
                  </button>
                )}
              </div>
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
      </Pop>

      {/* Auto-backup card */}
      <Pop
        className="card overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
            <ShieldCheck size={16} className="text-emerald-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Automatic Backup</h2>
            <p className="text-xs text-slate-500">Saves a JSON snapshot to a folder of your choice, once per day on app launch</p>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          {settings.autoBackupFolder ? (
            <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 uppercase tracking-wide">
                <CheckCircle size={13} /> Enabled
              </div>
              <div className="text-sm font-mono text-slate-700 break-all">{settings.autoBackupFolder}</div>
              {settings.autoBackupLastRun && (
                <div className="text-xs text-slate-500">
                  Last backup: {new Date(settings.autoBackupLastRun).toLocaleString()}
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-500">
              No backup folder configured. Pick a folder (OneDrive, Documents, USB drive…) and a snapshot will be saved automatically each day you open the app.
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={pickBackupFolder} className="btn-primary">
              <FolderOpen size={15} /> {settings.autoBackupFolder ? 'Change Folder' : 'Choose Folder'}
            </button>
            {settings.autoBackupFolder && (
              <>
                <button onClick={runBackupNow} className="btn-secondary">
                  <Save size={15} /> Back Up Now
                </button>
                <button onClick={disableAutoBackup} className="btn-ghost hover:text-red-500">
                  <FolderX size={15} /> Disable
                </button>
              </>
            )}
          </div>
        </div>
      </Pop>

      {/* Points & rewards card */}
      <Pop
        className="card overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
            <Award size={16} className="text-amber-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Points &amp; Rewards</h2>
            <p className="text-xs text-slate-500">How spending converts into points customers can redeem</p>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                Pesos Per Point
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold">₱</span>
                <input
                  type="number" min="1" step="any" className="input-field pl-8"
                  value={points.peso_per_point}
                  onChange={e => setPoints(p => ({ ...p, peso_per_point: e.target.value }))}
                  placeholder="10000"
                />
              </div>
              <p className="text-xs text-slate-400 mt-1.5">
                {rateValid
                  ? `${formatPHP(rateValue)} spent = 1 point`
                  : 'Must be greater than zero'}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                Earning Starts
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="date" className="input-field"
                  value={points.start_date}
                  onChange={e => setPoints(p => ({ ...p, start_date: e.target.value }))}
                />
                {points.start_date && (
                  <button
                    onClick={() => setPoints(p => ({ ...p, start_date: '' }))}
                    className="btn-ghost !px-2 !py-2 hover:text-red-500 flex-shrink-0"
                    title="Count all transactions"
                  >
                    <CalendarX size={15} />
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1.5">
                {points.start_date
                  ? `Only transactions from ${formatDateShort(points.start_date)} onward earn points`
                  : 'Blank — every transaction ever recorded earns points'}
              </p>
            </div>
          </div>

          {/* Live preview of what the current saved settings produce */}
          {summary && (
            <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">
                <Coins size={13} /> Currently In Effect
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-lg font-bold text-slate-900">{formatPHP(summary.qualifying_spend)}</div>
                  <div className="text-xs text-slate-500">Qualifying spend</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-slate-900">{(summary.points_earned || 0).toLocaleString('en-PH')}</div>
                  <div className="text-xs text-slate-500">Points issued</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-slate-900">{(summary.customers_with_points || 0).toLocaleString('en-PH')}</div>
                  <div className="text-xs text-slate-500">Customers with points</div>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={() => setConfirmPoints(true)}
              disabled={!pointsChanged || !rateValid || savingPoints}
              className={`btn-primary ${(!pointsChanged || !rateValid || savingPoints) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {savingPoints ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</>
              ) : (
                <><Save size={15} /> Save &amp; Recalculate</>
              )}
            </button>
            {!pointsChanged && pointsSaved && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-600">
                <CheckCircle size={13} /> Up to date
              </span>
            )}
          </div>
        </div>
      </Pop>

      {/* Danger zone */}
      <Pop
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
              Permanently delete every customer, transaction and redemption record. Your rewards
              catalog and points settings are kept.
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
      </Pop>

      {/* About card */}
      <Pop
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
            <span className="font-medium text-slate-900">{version || '—'}</span>
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
      </Pop>

      {confirmClear && (
        <ConfirmDialog
          title="Clear All Data"
          message="This will permanently delete ALL customers, ALL transactions and ALL redemptions. This action cannot be undone."
          requireType="DELETE"
          onConfirm={handleClearAll}
          onCancel={() => setConfirmClear(false)}
        />
      )}

      {confirmPoints && (
        <ConfirmDialog
          title="Recalculate Points"
          danger={false}
          message={
            `Every customer's points will be recalculated at ${formatPHP(rateValue)} = 1 point, ` +
            (points.start_date
              ? `counting transactions from ${formatDateShort(points.start_date)} onward. `
              : 'counting every transaction on record. ') +
            'Rewards already claimed stay claimed and stay deducted.'
          }
          onConfirm={savePoints}
          onCancel={() => setConfirmPoints(false)}
        />
      )}
    </Page>
  )
}
