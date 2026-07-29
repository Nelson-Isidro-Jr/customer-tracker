import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Award, Gift, Search, Plus, Edit, Trash2, ImagePlus, X,
  Coins, Settings2, PackageOpen, Undo2, Crown
} from 'lucide-react'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import Pagination from '../components/Pagination'
import { useToast } from '../context/ToastContext'
import { formatPHP, formatDateShort, formatRecordedAt } from '../utils/format'
import { fileToResizedDataURL } from '../utils/image'
import { Page, Pop, PopGrid } from '../components/Cascade'

const TABS = [
  { id: 'balances',    label: 'Point Balances', icon: Coins },
  { id: 'catalog',     label: 'Rewards',        icon: Gift },
  { id: 'redemptions', label: 'Redemptions',    icon: Award }
]

const formatPoints = (n) => (n || 0).toLocaleString('en-PH')

function rateLabel(config) {
  if (!config) return ''
  const rate = `${formatPHP(config.peso_per_point)} = 1 point`
  return config.start_date
    ? `${rate} · earning from ${formatDateShort(config.start_date)}`
    : `${rate} · counting all transactions`
}

// ─── Reward image picker ──────────────────────────────────────────────────────

function ImageField({ value, onChange }) {
  const { showToast } = useToast()
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)

  async function pick(e) {
    const file = e.target.files?.[0]
    e.target.value = ''            // let the same file be re-picked after a remove
    if (!file) return
    setBusy(true)
    try {
      onChange(await fileToResizedDataURL(file))
    } catch (err) {
      showToast(err?.message || 'Could not load that image', 'error')
    } finally { setBusy(false) }
  }

  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Photo</label>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={pick} />
      <div className="flex items-center gap-3">
        <div className="w-20 h-20 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center flex-shrink-0">
          {value
            ? <img src={value} alt="" className="w-full h-full object-cover" />
            : <Gift size={22} className="text-slate-300" />}
        </div>
        <div className="flex flex-col gap-2">
          <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className="btn-secondary !py-2">
            <ImagePlus size={15} /> {busy ? 'Processing…' : value ? 'Change Photo' : 'Add Photo'}
          </button>
          {value && (
            <button type="button" onClick={() => onChange(null)} className="btn-ghost !py-1 hover:text-red-500 text-xs">
              <X size={13} /> Remove
            </button>
          )}
        </div>
      </div>
      <p className="text-xs text-slate-400 mt-1.5">Resized to 512px and saved with your backups.</p>
    </div>
  )
}

// ─── Add / edit reward ────────────────────────────────────────────────────────

function RewardModal({ reward, onClose, onSaved }) {
  const { showToast } = useToast()
  const editing = !!reward
  const [form, setForm] = useState({
    name:        reward?.name || '',
    description: reward?.description || '',
    points_cost: reward ? String(reward.points_cost) : '',
    quantity:    reward ? String(reward.quantity) : '',
    image:       reward?.image || null
  })
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      points_cost: parseInt(form.points_cost, 10),
      quantity: parseInt(form.quantity || '0', 10),
      image: form.image
    }
    if (!payload.name) { showToast('Reward name is required', 'error'); return }
    if (!(payload.points_cost > 0)) { showToast('Points cost must be greater than zero', 'error'); return }
    if (!(payload.quantity >= 0)) { showToast('Quantity cannot be negative', 'error'); return }

    setSaving(true)
    try {
      if (editing) await window.electron.invoke('rewards:update', { id: reward.id, data: payload })
      else         await window.electron.invoke('rewards:add', payload)
      showToast(editing ? 'Reward updated!' : 'Reward added!', 'success')
      onSaved()
      onClose()
    } catch (err) { showToast(err?.message || 'Failed to save reward', 'error') }
    finally { setSaving(false) }
  }

  return (
    <Modal title={editing ? `Edit — ${reward.name}` : 'Add Reward'} onClose={onClose} size="lg">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Reward Name *</label>
          <input className="input-field" value={form.name} onChange={set('name')} placeholder="e.g. Teddy Bear" required autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Points Cost *</label>
            <div className="relative">
              <Coins size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="number" min="1" step="1" className="input-field pl-9"
                value={form.points_cost} onChange={set('points_cost')} placeholder="25" required />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Quantity in Stock *</label>
            <input type="number" min="0" step="1" className="input-field"
              value={form.quantity} onChange={set('quantity')} placeholder="0" required />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Description</label>
          <textarea className="input-field resize-none" rows={2} value={form.description}
            onChange={set('description')} placeholder="Optional" />
        </div>
        <ImageField value={form.image} onChange={(image) => setForm(p => ({ ...p, image }))} />
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Reward'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Redeem ───────────────────────────────────────────────────────────────────

function RedeemModal({ rewards, presetReward, presetCustomer, onClose, onDone }) {
  const { showToast } = useToast()
  const [customers, setCustomers]   = useState([])
  const [customerId, setCustomerId] = useState(presetCustomer?.id ? String(presetCustomer.id) : '')
  const [rewardId, setRewardId]     = useState(presetReward?.id ? String(presetReward.id) : '')
  const [quantity, setQuantity]     = useState('1')
  const [note, setNote]             = useState('')
  const [points, setPoints]         = useState(presetCustomer || null)
  const [saving, setSaving]         = useState(false)

  useEffect(() => {
    window.electron.invoke('customers:getAllLite').then(setCustomers).catch(() => {})
  }, [])

  // Pull the live balance whenever the chosen customer changes.
  useEffect(() => {
    if (!customerId) { setPoints(null); return }
    let cancelled = false
    window.electron.invoke('points:customer', parseInt(customerId, 10))
      .then(p => { if (!cancelled) setPoints(p) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [customerId])

  const reward = rewards.find(r => String(r.id) === rewardId)
  const qty    = Math.max(1, parseInt(quantity || '1', 10) || 1)
  const cost   = reward ? reward.points_cost * qty : 0
  const balance = points?.points_balance ?? 0
  const after   = balance - cost

  let problem = null
  if (!customerId) problem = 'Choose a customer'
  else if (!reward) problem = 'Choose a reward'
  else if (reward.quantity < qty) problem = reward.quantity === 0
    ? `${reward.name} is out of stock`
    : `Only ${reward.quantity} left in stock`
  else if (after < 0) problem = `Not enough points — ${formatPoints(cost - balance)} short`

  async function submit(e) {
    e.preventDefault()
    if (problem) { showToast(problem, 'error'); return }
    setSaving(true)
    try {
      await window.electron.invoke('redemptions:redeem', {
        customer_id: parseInt(customerId, 10),
        reward_id: reward.id,
        quantity: qty,
        note: note.trim() || null
      })
      showToast(`${reward.name} claimed for ${formatPoints(cost)} points!`, 'success')
      onDone()
      onClose()
    } catch (err) { showToast(err?.message || 'Failed to redeem', 'error') }
    finally { setSaving(false) }
  }

  return (
    <Modal title="Redeem Reward" onClose={onClose} size="lg">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Customer *</label>
          <select className="input-field" value={customerId} onChange={e => setCustomerId(e.target.value)} required>
            <option value="">Select a customer…</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Reward *</label>
            <select className="input-field" value={rewardId} onChange={e => setRewardId(e.target.value)} required>
              <option value="">Select a reward…</option>
              {rewards.map(r => (
                <option key={r.id} value={r.id} disabled={r.quantity === 0}>
                  {r.name} — {formatPoints(r.points_cost)} pts{r.quantity === 0 ? ' (out of stock)' : ` (${r.quantity} left)`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Qty *</label>
            <input type="number" min="1" step="1" className="input-field"
              value={quantity} onChange={e => setQuantity(e.target.value)} required />
          </div>
        </div>

        {/* Live balance preview */}
        {customerId && (
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Current balance</span>
              <span className="font-bold text-slate-900">{formatPoints(balance)} pts</span>
            </div>
            {reward && (
              <>
                <div className="flex items-center justify-between text-sm mt-2">
                  <span className="text-slate-500">
                    {qty}× {reward.name}
                  </span>
                  <span className="font-semibold text-red-600">−{formatPoints(cost)} pts</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-2 pt-2 border-t border-slate-200">
                  <span className="text-slate-500">Balance after</span>
                  <span className={`font-bold ${after < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {formatPoints(after)} pts
                  </span>
                </div>
              </>
            )}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Note</label>
          <input className="input-field" value={note} onChange={e => setNote(e.target.value)} placeholder="Optional" />
        </div>

        {problem && customerId && rewardId && (
          <div className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {problem}
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button type="submit" disabled={saving || !!problem}
            className={`btn-primary flex-1 justify-center ${(saving || problem) ? 'opacity-50 cursor-not-allowed' : ''}`}>
            {saving ? 'Claiming…' : 'Confirm Redemption'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Tab: balances ────────────────────────────────────────────────────────────

function BalancesTab({ onRedeem, refreshKey }) {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [rows, setRows]         = useState([])
  const [total, setTotal]       = useState(0)
  const [config, setConfig]     = useState(null)
  const [loading, setLoading]   = useState(true)
  const [query, setQuery]       = useState('')
  const [search, setSearch]     = useState('')
  const [page, setPage]         = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const reqIdRef = useRef(0)

  useEffect(() => {
    const t = setTimeout(() => setSearch(query.trim()), 250)
    return () => clearTimeout(t)
  }, [query])

  const load = useCallback(async () => {
    const myReqId = ++reqIdRef.current
    setLoading(true)
    try {
      const res = await window.electron.invoke('points:balances', { page, pageSize, search })
      if (myReqId !== reqIdRef.current) return
      setRows(res.rows)
      setTotal(res.total)
      setConfig(res.config)
    } catch (err) {
      if (myReqId === reqIdRef.current) showToast(err?.message || 'Failed to load balances', 'error')
    } finally {
      if (myReqId === reqIdRef.current) setLoading(false)
    }
  }, [page, pageSize, search, showToast, refreshKey])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative flex-1 max-w-md min-w-[220px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input-field pl-9"
            placeholder="Search customers…"
            value={query}
            onChange={e => { setQuery(e.target.value); setPage(1) }}
          />
        </div>
        {config && (
          <Link to="/settings" className="flex items-center gap-2 text-xs text-slate-500 hover:text-blue-600 transition-colors">
            <Settings2 size={13} /> {rateLabel(config)}
          </Link>
        )}
      </div>

      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }}
        className="card overflow-hidden"
      >
        <div className="overflow-x-auto max-h-[calc(100vh-380px)] overflow-y-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-white z-10">
              <tr>
                <th className="table-header">#</th>
                <th className="table-header">Customer</th>
                <th className="table-header text-right">Qualifying Spend</th>
                <th className="table-header text-center">Earned</th>
                <th className="table-header text-center">Redeemed</th>
                <th className="table-header text-center">Balance</th>
                <th className="table-header text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-slate-400 text-sm">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400 text-sm">
                    {search ? 'No customers match your search.' : 'No customers yet.'}
                  </td>
                </tr>
              ) : rows.map((r, i) => {
                const rank = (page - 1) * pageSize + i + 1
                return (
                  <tr key={r.id} className="hover:bg-slate-50/60 transition-colors group">
                    <td className="table-cell text-slate-400 font-medium w-10">{rank}</td>
                    <td className="table-cell">
                      <button onClick={() => navigate(`/customers/${r.id}`)} className="flex items-center gap-2.5">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${
                          rank === 1 && !search ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {r.full_name?.[0]?.toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-slate-800 group-hover:text-blue-600 transition-colors flex items-center gap-1.5">
                          {r.full_name}
                          {rank === 1 && !search && r.points_balance > 0 && <Crown size={12} className="text-amber-500" />}
                        </span>
                      </button>
                    </td>
                    <td className="table-cell text-right text-slate-600 whitespace-nowrap">{formatPHP(r.qualifying_spend)}</td>
                    <td className="table-cell text-center text-slate-500">{formatPoints(r.points_earned)}</td>
                    <td className="table-cell text-center text-slate-500">
                      {r.points_redeemed ? formatPoints(r.points_redeemed) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="table-cell text-center">
                      <span className={`badge ${r.points_balance > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'}`}>
                        {formatPoints(r.points_balance)} pts
                      </span>
                    </td>
                    <td className="table-cell text-right">
                      <button
                        onClick={() => onRedeem(r)}
                        disabled={r.points_balance <= 0}
                        className="btn-ghost !px-2.5 !py-1.5 hover:text-amber-600 disabled:opacity-30 disabled:cursor-not-allowed"
                        title={r.points_balance > 0 ? 'Redeem a reward' : 'No points to redeem'}
                      >
                        <Gift size={15} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <Pagination
          page={page} pageSize={pageSize} total={total} loading={loading}
          onPageChange={setPage}
          onPageSizeChange={(n) => { setPageSize(n); setPage(1) }}
        />
      </motion.div>
    </div>
  )
}

// ─── Tab: catalog ─────────────────────────────────────────────────────────────

function CatalogTab({ rewards, loading, onRefresh, onRedeem }) {
  const { showToast } = useToast()
  const [addOpen, setAddOpen]           = useState(false)
  const [editTarget, setEditTarget]     = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  async function handleDelete() {
    try {
      await window.electron.invoke('rewards:delete', deleteTarget.id)
      showToast('Reward deleted', 'info')
      setDeleteTarget(null)
      onRefresh()
    } catch (err) { showToast(err?.message || 'Failed to delete reward', 'error') }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-slate-500">
          {loading ? 'Loading…' : `${rewards.length} ${rewards.length === 1 ? 'reward' : 'rewards'} in the catalog`}
        </div>
        <button onClick={() => setAddOpen(true)} className="btn-primary">
          <Plus size={16} /> Add Reward
        </button>
      </div>

      {!loading && rewards.length === 0 ? (
        <div className="card px-6 py-16 text-center">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-3">
            <Gift size={22} className="text-amber-500" />
          </div>
          <div className="text-sm font-semibold text-slate-700">No rewards yet</div>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Add something customers can claim with their points — a teddy bear, a gift card, a free item.
          </p>
          <button onClick={() => setAddOpen(true)} className="btn-primary mt-4">
            <Plus size={16} /> Add Your First Reward
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {rewards.map(r => (
            <div key={r.id} className="card overflow-hidden flex flex-col group">
              <div className="relative aspect-[4/3] bg-slate-50 overflow-hidden">
                {r.image
                  ? <img src={r.image} alt={r.name} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center"><Gift size={30} className="text-slate-200" /></div>}
                <span className="absolute top-2 left-2 badge bg-amber-500 text-white shadow-sm">
                  {formatPoints(r.points_cost)} pts
                </span>
                {r.quantity === 0 && (
                  <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center">
                    <span className="badge bg-white text-slate-700">Out of stock</span>
                  </div>
                )}
              </div>

              <div className="px-4 py-3 flex-1 flex flex-col">
                <div className="text-sm font-bold text-slate-900 truncate">{r.name}</div>
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 flex-1">
                  {r.description || <span className="text-slate-300">No description</span>}
                </p>
                <div className="flex items-center gap-1.5 mt-2 text-xs">
                  <PackageOpen size={12} className={r.quantity === 0 ? 'text-slate-400' : r.quantity <= 3 ? 'text-amber-500' : 'text-emerald-500'} />
                  <span className={`font-semibold ${r.quantity === 0 ? 'text-slate-400' : r.quantity <= 3 ? 'text-amber-600' : 'text-slate-600'}`}>
                    {r.quantity} in stock
                  </span>
                </div>
              </div>

              <div className="px-3 py-2.5 border-t border-slate-100 bg-slate-50/50 flex items-center gap-1">
                <button
                  onClick={() => onRedeem(null, r)}
                  disabled={r.quantity === 0}
                  className="btn-primary !py-1.5 !px-3 !text-xs flex-1 justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Award size={13} /> Redeem
                </button>
                <button onClick={() => setEditTarget(r)} className="btn-ghost !px-2 !py-1.5 hover:text-blue-600" title="Edit">
                  <Edit size={14} />
                </button>
                <button onClick={() => setDeleteTarget(r)} className="btn-ghost !px-2 !py-1.5 hover:text-red-500" title="Delete">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {addOpen && <RewardModal onClose={() => setAddOpen(false)} onSaved={onRefresh} />}
      {editTarget && <RewardModal reward={editTarget} onClose={() => setEditTarget(null)} onSaved={onRefresh} />}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete Reward"
          message={`Delete "${deleteTarget.name}" from the catalog? Past redemptions of it stay on record.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}

// ─── Tab: redemptions ─────────────────────────────────────────────────────────

function RedemptionsTab({ onChanged, refreshKey }) {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [rows, setRows]     = useState([])
  const [total, setTotal]   = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage]     = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [voidTarget, setVoidTarget] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await window.electron.invoke('redemptions:getPage', { page, pageSize })
      setRows(res.rows)
      setTotal(res.total)
    } catch (err) {
      showToast(err?.message || 'Failed to load redemptions', 'error')
    } finally { setLoading(false) }
  }, [page, pageSize, showToast, refreshKey])

  useEffect(() => { load() }, [load])

  async function handleVoid() {
    try {
      await window.electron.invoke('redemptions:delete', voidTarget.id)
      showToast('Redemption voided — points returned', 'info')
      setVoidTarget(null)
      if (rows.length === 1 && page > 1) setPage(p => p - 1)
      else load()
      onChanged()
    } catch (err) { showToast(err?.message || 'Failed to void redemption', 'error') }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }}
      className="card overflow-hidden"
    >
      <div className="overflow-x-auto max-h-[calc(100vh-330px)] overflow-y-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-white z-10">
            <tr>
              <th className="table-header">When</th>
              <th className="table-header">Customer</th>
              <th className="table-header">Reward</th>
              <th className="table-header text-center">Qty</th>
              <th className="table-header text-right">Points</th>
              <th className="table-header">Note</th>
              <th className="table-header text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr><td colSpan={7} className="px-5 py-12 text-center text-slate-400 text-sm">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-slate-400 text-sm">
                  No rewards have been claimed yet.
                </td>
              </tr>
            ) : rows.map(r => (
              <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                <td className="table-cell text-slate-400 whitespace-nowrap text-xs">{formatRecordedAt(r.created_at)}</td>
                <td className="table-cell">
                  <button
                    onClick={() => r.customer_id && navigate(`/customers/${r.customer_id}`)}
                    className="text-sm font-medium text-slate-800 hover:text-blue-600 transition-colors"
                  >
                    {r.customer_name}
                  </button>
                </td>
                <td className="table-cell">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <Gift size={12} className="text-amber-600" />
                    </div>
                    <span className="text-sm font-medium text-slate-700">{r.reward_name}</span>
                  </div>
                </td>
                <td className="table-cell text-center text-slate-500">{r.quantity}</td>
                <td className="table-cell text-right font-bold text-amber-700 whitespace-nowrap">
                  {formatPoints(r.points_spent)} pts
                </td>
                <td className="table-cell text-slate-500">{r.note || <span className="text-slate-300">—</span>}</td>
                <td className="table-cell text-right">
                  <button onClick={() => setVoidTarget(r)} className="btn-ghost !px-2 !py-1 hover:text-red-500" title="Void — returns the points">
                    <Undo2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination
        page={page} pageSize={pageSize} total={total} loading={loading}
        onPageChange={setPage}
        onPageSizeChange={(n) => { setPageSize(n); setPage(1) }}
      />

      {voidTarget && (
        <ConfirmDialog
          title="Void Redemption"
          message={`Return ${formatPoints(voidTarget.points_spent)} points to ${voidTarget.customer_name} and put ${voidTarget.quantity}× ${voidTarget.reward_name} back in stock?`}
          onConfirm={handleVoid}
          onCancel={() => setVoidTarget(null)}
        />
      )}
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Rewards() {
  const { showToast } = useToast()
  const [tab, setTab] = useState('balances')
  const [rewards, setRewards] = useState([])
  const [rewardsLoading, setRewardsLoading] = useState(true)
  const [summary, setSummary] = useState(null)
  const [redeemTarget, setRedeemTarget] = useState(null)
  // Bumped after anything that moves points, so every tab refetches.
  const [refreshKey, setRefreshKey] = useState(0)

  const loadRewards = useCallback(async () => {
    setRewardsLoading(true)
    try {
      setRewards(await window.electron.invoke('rewards:getAll'))
    } catch (err) {
      showToast(err?.message || 'Failed to load rewards', 'error')
    } finally { setRewardsLoading(false) }
  }, [showToast])

  const loadSummary = useCallback(async () => {
    try {
      setSummary(await window.electron.invoke('points:summary'))
    } catch (_) {}
  }, [])

  useEffect(() => { loadRewards(); loadSummary() }, [loadRewards, loadSummary])

  const refreshAll = useCallback(() => {
    loadRewards()
    loadSummary()
    setRefreshKey(k => k + 1)
  }, [loadRewards, loadSummary])

  const openRedeem = (customer = null, reward = null) =>
    setRedeemTarget({ customer, reward })

  return (
    <Page>
      {/* Stat strip */}
      <Pop className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <Coins size={19} className="text-amber-600" />
          </div>
          <div className="min-w-0">
            <div className="text-xl font-bold text-slate-900">{formatPoints(summary?.points_available)}</div>
            <div className="text-xs text-slate-500">Points Available</div>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <Award size={19} className="text-blue-600" />
          </div>
          <div className="min-w-0">
            <div className="text-xl font-bold text-slate-900">{formatPoints(summary?.points_earned)}</div>
            <div className="text-xs text-slate-500">Points Earned</div>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <Gift size={19} className="text-emerald-600" />
          </div>
          <div className="min-w-0">
            <div className="text-xl font-bold text-slate-900">{formatPoints(summary?.points_redeemed)}</div>
            <div className="text-xs text-slate-500">Points Redeemed</div>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <PackageOpen size={19} className="text-slate-600" />
          </div>
          <div className="min-w-0">
            <div className="text-xl font-bold text-slate-900">{formatPoints(summary?.customers_with_points)}</div>
            <div className="text-xs text-slate-500">Customers With Points</div>
          </div>
        </div>
      </Pop>

      {/* Tabs */}
      <Pop className="flex items-center gap-1 border-b border-slate-200">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </Pop>

      {tab === 'balances' && (
        <BalancesTab refreshKey={refreshKey} onRedeem={(customer) => openRedeem(customer, null)} />
      )}
      {tab === 'catalog' && (
        <CatalogTab
          rewards={rewards}
          loading={rewardsLoading}
          onRefresh={refreshAll}
          onRedeem={openRedeem}
        />
      )}
      {tab === 'redemptions' && (
        <RedemptionsTab refreshKey={refreshKey} onChanged={refreshAll} />
      )}

      {redeemTarget && (
        <RedeemModal
          rewards={rewards}
          presetReward={redeemTarget.reward}
          presetCustomer={redeemTarget.customer}
          onClose={() => setRedeemTarget(null)}
          onDone={refreshAll}
        />
      )}
    </Page>
  )
}
