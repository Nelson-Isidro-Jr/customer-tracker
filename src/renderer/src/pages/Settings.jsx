import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User, Save, CheckCircle, Trash2, AlertTriangle, FolderOpen, ShieldCheck, FolderX, Camera,
  Palette, Check, Sun, Moon, Star, Sparkles, Play, ImageOff, Info
} from 'lucide-react'
import { useSettings, useTheme } from '../context/SettingsContext'
import { useToast } from '../context/ToastContext'
import ConfirmDialog from '../components/ConfirmDialog'
import Avatar from '../components/Avatar'
import { PRESETS, DEFAULT_CUSTOM, previewOf, isHex } from '../theme'
import { cropToSquare } from '../utils/photo'
import { formatPHP, formatNumber } from '../utils/format'

const EASE = [0.16, 1, 0.3, 1]

function Section({ icon: Icon, tone, title, subtitle, children, delay = 0, danger = false }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: EASE }}
      className={`card overflow-hidden ${danger ? 'border-red-100' : ''}`}
    >
      <div className={`px-6 py-4 border-b flex items-center gap-3 ${danger ? 'border-red-100 bg-red-50/40' : 'border-slate-100'}`}>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tone}`}><Icon size={16} /></div>
        <div>
          <h2 className={`text-sm font-bold ${danger ? 'text-red-900' : 'text-slate-900'}`}>{title}</h2>
          <p className={`text-xs ${danger ? 'text-red-600/80' : 'text-slate-500'}`}>{subtitle}</p>
        </div>
      </div>
      {children}
    </motion.section>
  )
}

function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-blue-600' : 'bg-slate-300'}`}
    >
      <motion.span
        className="absolute top-0.5 w-5 h-5 rounded-full bg-glass shadow"
        animate={{ left: checked ? 22 : 2 }}
        transition={{ type: 'spring', stiffness: 600, damping: 34 }}
      />
    </button>
  )
}

// Miniature of the app in a theme's colors
function ThemeThumb({ setting }) {
  const p = previewOf(setting)
  return (
    <div className="h-20 rounded-xl overflow-hidden flex border border-slate-200/60" style={{ background: p.page }}>
      <div className="w-6 flex flex-col items-center gap-1 pt-2" style={{ background: p.sidebar }}>
        <span className="w-3 h-3 rounded" style={{ background: p.brand }} />
        <span className="w-3 h-1 rounded-full bg-glass/30" />
        <span className="w-3 h-1 rounded-full bg-glass/20" />
      </div>
      <div className="flex-1 p-2 space-y-1.5">
        <div className="h-2 w-2/3 rounded-full" style={{ background: p.mode === 'dark' ? '#334155' : '#cbd5e1' }} />
        <div className="rounded-md p-1.5 flex items-center gap-1.5" style={{ background: p.surface }}>
          <span className="w-4 h-4 rounded" style={{ background: p.tint }} />
          <span className="flex-1 h-1.5 rounded-full" style={{ background: p.mode === 'dark' ? '#334155' : '#e2e8f0' }} />
        </div>
        <div className="flex gap-1">
          <span className="h-3 w-8 rounded" style={{ background: p.brand }} />
          <span className="h-3 w-5 rounded" style={{ background: p.brand2 }} />
        </div>
      </div>
    </div>
  )
}

const SWATCHES = ['#2563eb', '#7c3aed', '#db2777', '#e11d48', '#ea580c', '#d97706', '#16a34a', '#0d9488', '#0891b2', '#475569']

function ColorField({ label, value, onChange }) {
  const [text, setText] = useState(value)
  useEffect(() => { setText(value) }, [value])
  return (
    <div>
      <label className="field-label">{label}</label>
      <div className="flex items-center gap-2">
        <label className="relative w-11 h-11 rounded-xl border border-slate-200 overflow-hidden cursor-pointer flex-shrink-0 shadow-inner" style={{ background: value }}>
          <input type="color" value={value} onChange={e => onChange(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
        </label>
        <input
          className="input-field font-mono uppercase"
          value={text}
          maxLength={7}
          onChange={e => {
            const v = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`
            setText(v)
            if (isHex(v) && v.length === 7) onChange(v.toLowerCase())
          }}
        />
      </div>
    </div>
  )
}

export default function Settings() {
  const { settings, updateSettings } = useSettings()
  const { setPreview } = useTheme()
  const { showToast } = useToast()
  const [name, setName]               = useState(settings.userName)
  const [saving, setSaving]           = useState(false)
  const [clearing, setClearing]       = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [rate, setRate]               = useState(String(settings.pesosPerPoint || 10000))
  const [version, setVersion]         = useState('')
  const [custom, setCustom]           = useState({ ...DEFAULT_CUSTOM, ...(settings.theme?.custom || {}) })
  const [customDirty, setCustomDirty] = useState(false)

  const current = settings.theme?.preset || 'light'

  useEffect(() => { window.electron.invoke('app:info').then(i => setVersion(i.version)).catch(() => {}) }, [])
  // Leaving the page drops any unsaved custom-theme preview
  useEffect(() => () => setPreview(null), [setPreview])

  async function saveName(e) {
    e.preventDefault()
    if (!name.trim()) { showToast('Name cannot be empty', 'error'); return }
    setSaving(true)
    try {
      await updateSettings({ userName: name.trim() })
      showToast('Profile saved!', 'success')
    } catch { showToast('Failed to save settings', 'error') }
    finally { setSaving(false) }
  }

  async function pickPhoto() {
    try {
      const raw = await window.electron.invoke('profile:pickPhoto')
      if (!raw) return
      const photo = await cropToSquare(raw, 320)
      await updateSettings({ profilePhoto: photo })
      showToast('Profile photo updated!', 'success')
    } catch (err) { showToast(err?.message || 'Could not use that photo', 'error') }
  }

  async function removePhoto() {
    await updateSettings({ profilePhoto: null })
    showToast('Profile photo removed', 'info')
  }

  async function choosePreset(key) {
    setPreview(null)
    setCustomDirty(false)
    const theme = { preset: key, custom: settings.theme?.custom }
    await updateSettings({ theme, windowBackground: previewOf(theme).page })
    showToast(`${PRESETS[key].label} theme applied`, 'success')
  }

  function editCustom(patch) {
    const next = { ...custom, ...patch }
    setCustom(next)
    setCustomDirty(true)
    setPreview({ preset: 'custom', custom: next })
  }

  async function saveCustom() {
    const theme = { preset: 'custom', custom }
    await updateSettings({ theme, windowBackground: previewOf(theme).page })
    setPreview(null)
    setCustomDirty(false)
    showToast('Custom theme saved', 'success')
  }

  function discardCustom() {
    setPreview(null)
    setCustom({ ...DEFAULT_CUSTOM, ...(settings.theme?.custom || {}) })
    setCustomDirty(false)
  }

  async function saveRate() {
    const n = Number(rate)
    if (!Number.isFinite(n) || n < 1) { showToast('Enter an amount of at least ₱1', 'error'); return }
    await updateSettings({ pesosPerPoint: Math.round(n * 100) / 100 })
    showToast('Points rate saved — all balances recalculated', 'success')
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

  const nameChanged = name.trim() !== settings.userName
  const rateNum = Number(rate)
  const rateChanged = Number.isFinite(rateNum) && rateNum !== settings.pesosPerPoint

  return (
    <div className="page-container">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Profile */}
        <Section icon={User} tone="bg-blue-50 text-blue-600" title="Profile" subtitle="Your name and photo appear in the sidebar, greeting, reports, and Activity Log">
          <div className="px-6 py-6 grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 items-start">
            <div className="flex flex-col items-center gap-3">
              <motion.div whileHover={{ scale: 1.03 }} className="relative group">
                <Avatar name={settings.userName} photo={settings.profilePhoto} size={112} className="shadow-lg" />
                <button onClick={pickPhoto} className="absolute inset-0 rounded-full bg-slate-900/50 text-white opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 text-[11px] font-semibold">
                  <Camera size={20} /> Change
                </button>
              </motion.div>
              <div className="flex gap-2">
                <button onClick={pickPhoto} className="btn-secondary !py-1.5 !px-3 text-xs"><Camera size={13} /> Upload photo</button>
                {settings.profilePhoto && (
                  <button onClick={removePhoto} className="btn-ghost !py-1.5 !px-2 text-xs hover:!text-red-500" title="Remove photo"><ImageOff size={14} /></button>
                )}
              </div>
              <p className="text-[11px] text-slate-400 text-center max-w-[180px]">PNG, JPG, WebP or GIF. Cropped to a circle automatically.</p>
            </div>
            <form onSubmit={saveName} className="space-y-4">
              <div>
                <label className="field-label">Display name</label>
                <input className="input-field" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" maxLength={60} />
              </div>
              <div className="flex items-center gap-3">
                <button type="submit" disabled={saving || !nameChanged} className="btn-primary">
                  {saving ? 'Saving…' : <><Save size={15} /> Save name</>}
                </button>
                {!nameChanged && <span className="flex items-center gap-1.5 text-xs text-emerald-600"><CheckCircle size={13} /> Up to date</span>}
              </div>
            </form>
          </div>
        </Section>

        {/* Appearance */}
        <Section icon={Palette} tone="bg-violet-50 text-violet-600" title="Appearance" subtitle="Pick a theme — every page, button, chart, and scrollbar updates instantly" delay={0.04}>
          <div className="px-6 py-6 space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
              {Object.entries(PRESETS).map(([key, p]) => (
                <motion.button
                  key={key}
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => choosePreset(key)}
                  className={`relative text-left rounded-2xl p-2 border-2 transition-colors ${current === key && !customDirty ? 'border-blue-500 bg-blue-50/50' : 'border-transparent hover:border-slate-200'}`}
                >
                  <ThemeThumb setting={{ preset: key }} />
                  <div className="flex items-center justify-between mt-2 px-1">
                    <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                      {p.mode === 'dark' ? <Moon size={12} /> : <Sun size={12} />} {p.label}
                    </span>
                    {current === key && !customDirty && <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center"><Check size={10} /></span>}
                  </div>
                </motion.button>
              ))}
              <motion.button
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => editCustom({})}
                className={`relative text-left rounded-2xl p-2 border-2 transition-colors ${current === 'custom' || customDirty ? 'border-blue-500 bg-blue-50/50' : 'border-transparent hover:border-slate-200'}`}
              >
                <ThemeThumb setting={{ preset: 'custom', custom }} />
                <div className="flex items-center justify-between mt-2 px-1">
                  <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5"><Sparkles size={12} /> Custom</span>
                  {current === 'custom' && !customDirty && <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center"><Check size={10} /></span>}
                </div>
              </motion.button>
            </div>

            <AnimatePresence initial={false}>
              {(current === 'custom' || customDirty) && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className="overflow-hidden"
                >
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5 space-y-5">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <div className="text-sm font-bold text-slate-900">Custom theme</div>
                        <div className="text-xs text-slate-500">Changes preview live. Save to keep them.</div>
                      </div>
                      <div className="relative grid grid-cols-2 bg-slate-100 rounded-xl p-1 w-56">
                        {[['light', 'Light', Sun], ['dark', 'Dark', Moon]].map(([key, label, Icon]) => (
                          <button key={key} onClick={() => editCustom({ mode: key, page: key === 'dark' ? '#0b1120' : '#f1f5f9' })}
                            className={`relative flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${custom.mode === key ? 'text-slate-900' : 'text-slate-500'}`}>
                            {custom.mode === key && <motion.span layoutId="custom-mode" className="absolute inset-0 bg-white rounded-lg shadow-sm" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
                            <span className="relative flex items-center gap-1.5"><Icon size={13} /> {label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="field-label">Quick colors</label>
                      <div className="flex flex-wrap gap-2">
                        {SWATCHES.map(c => (
                          <motion.button key={c} whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.92 }} onClick={() => editCustom({ brand: c })}
                            className={`w-8 h-8 rounded-full shadow-sm ring-offset-2 ${custom.brand === c ? 'ring-2 ring-slate-900' : ''}`} style={{ background: c }} title={c} />
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <ColorField label="Buttons & highlights" value={custom.brand} onChange={v => editCustom({ brand: v })} />
                      <ColorField label="Sidebar" value={custom.sidebar} onChange={v => editCustom({ sidebar: v })} />
                      <ColorField label="Background" value={custom.page} onChange={v => editCustom({ page: v })} />
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={saveCustom} disabled={!customDirty && current === 'custom'} className="btn-primary"><Save size={15} /> Save custom theme</button>
                      {customDirty && <button onClick={discardCustom} className="btn-ghost">Discard</button>}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Section>

        {/* Rewards */}
        <Section icon={Star} tone="bg-amber-50 text-amber-600" title="Reward Points" subtitle="How much a customer spends to earn 1 point" delay={0.08}>
          <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-5 items-end">
            <div>
              <label className="field-label">Pesos per 1 point</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold">₱</span>
                <input type="number" min="1" step="0.01" className="input-field pl-8" value={rate} onChange={e => setRate(e.target.value)} />
              </div>
              <p className="text-xs text-slate-400 mt-1.5">Points are counted from each customer’s total purchases, so a change recalculates existing customers too.</p>
            </div>
            <div className="space-y-3">
              {Number.isFinite(rateNum) && rateNum >= 1 && (
                <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-2.5 text-xs text-amber-800">
                  A customer who spent {formatPHP(50000)} gets <b>{formatNumber(Math.floor(50000 / rateNum))} points</b>.
                </div>
              )}
              <button onClick={saveRate} disabled={!rateChanged} className="btn-primary"><Save size={15} /> Save rate</button>
            </div>
          </div>
        </Section>

        {/* Greeting */}
        <Section icon={Sparkles} tone="bg-orange-50 text-orange-600" title="Startup Greeting" subtitle="A friendly hello with your photo and a motivating message each time the app opens" delay={0.1}>
          <div className="px-6 py-5 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <Toggle checked={settings.showGreeting !== false} onChange={v => updateSettings({ showGreeting: v })} label="Show greeting on startup" />
              <span className="text-sm text-slate-700">{settings.showGreeting !== false ? 'Show greeting when the app opens' : 'Greeting is turned off'}</span>
            </div>
            <button onClick={() => window.dispatchEvent(new Event('ct:show-greeting'))} className="btn-secondary"><Play size={14} /> Preview greeting</button>
          </div>
        </Section>

        {/* Auto-backup */}
        <Section icon={ShieldCheck} tone="bg-emerald-50 text-emerald-600" title="Automatic Backup" subtitle="Saves a JSON snapshot to a folder of your choice, once per day on app launch" delay={0.12}>
          <div className="px-6 py-5 space-y-4">
            {settings.autoBackupFolder ? (
              <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 uppercase tracking-wide"><CheckCircle size={13} /> Enabled</div>
                <div className="text-sm font-mono text-slate-700 break-all">{settings.autoBackupFolder}</div>
                {settings.autoBackupLastRun && <div className="text-xs text-slate-500">Last backup: {new Date(settings.autoBackupLastRun).toLocaleString()}</div>}
              </div>
            ) : (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-500">
                No backup folder configured. Pick a folder (OneDrive, Documents, USB drive…) and a snapshot will be saved automatically each day you open the app.
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={pickBackupFolder} className="btn-primary"><FolderOpen size={15} /> {settings.autoBackupFolder ? 'Change Folder' : 'Choose Folder'}</button>
              {settings.autoBackupFolder && (
                <>
                  <button onClick={runBackupNow} className="btn-secondary"><Save size={15} /> Back Up Now</button>
                  <button onClick={disableAutoBackup} className="btn-ghost hover:!text-red-500"><FolderX size={15} /> Disable</button>
                </>
              )}
            </div>
          </div>
        </Section>

        {/* Danger zone */}
        <Section icon={AlertTriangle} tone="bg-red-100 text-red-600" title="Danger Zone" subtitle="These actions cannot be undone" delay={0.14} danger>
          <div className="px-6 py-5 flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-slate-900">Clear All Data</div>
              <div className="text-xs text-slate-500 mt-0.5">Permanently delete every customer, transaction, prize, and claim. The Activity Log is kept.</div>
            </div>
            <button onClick={() => setConfirmClear(true)} disabled={clearing} className="btn-danger flex-shrink-0">
              <Trash2 size={15} /> {clearing ? 'Clearing…' : 'Clear All Data'}
            </button>
          </div>
        </Section>

        {/* About */}
        <Section icon={Info} tone="bg-slate-100 text-slate-600" title="About" subtitle="Customer Tracker" delay={0.16}>
          <div className="px-6 py-5 grid grid-cols-2 gap-y-2 text-sm">
            <span className="text-slate-500">Version</span><span className="font-medium text-slate-900 text-right">{version || '—'}</span>
            <span className="text-slate-500">Author</span><span className="font-medium text-slate-900 text-right">Nelson Isidro</span>
            <span className="text-slate-500">Currency</span><span className="font-medium text-slate-900 text-right">Philippine Peso (₱ PHP)</span>
          </div>
        </Section>
      </div>

      {confirmClear && (
        <ConfirmDialog
          title="Clear All Data"
          message="This will permanently delete ALL customers, transactions, prizes, and claims. This action cannot be undone."
          requireType="DELETE"
          onConfirm={handleClearAll}
          onCancel={() => setConfirmClear(false)}
        />
      )}
    </div>
  )
}
