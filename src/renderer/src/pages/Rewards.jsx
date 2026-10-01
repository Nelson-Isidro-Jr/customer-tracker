import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Gift, Star, Plus, Edit, Trash2, Package, Trophy, History, Coins, SlidersHorizontal,
  Search, X, Undo2, Check, Sparkles, Settings2, ArrowRight, Users
} from 'lucide-react'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import Pagination from '../components/Pagination'
import Avatar from '../components/Avatar'
import AnimatedNumber from '../components/AnimatedNumber'
import CustomerPicker from '../components/CustomerPicker'
import { PrizeModal, AdjustPointsModal } from '../components/RewardForms'
import { SkeletonRows } from './Transactions'
import { useToast } from '../context/ToastContext'
import { useSettings } from '../context/SettingsContext'
import usePaged from '../hooks/usePaged'
import { formatPHP, formatNumber, formatRecordedAt } from '../utils/format'

const EASE = [0.16, 1, 0.3, 1]
const fmtInt = v => formatNumber(Math.round(v))

const TABS = [
  { key: 'redeem', label: 'Redeem', icon: Gift },
  { key: 'prizes', label: 'Prizes', icon: Package },
  { key: 'points', label: 'Points', icon: Trophy },
  { key: 'claims', label: 'Claims history', icon: History }
]

// ─── Rate editor ──────────────────────────────────────────────────────────────

function RateModal({ rate, onClose }) {
  const { updateSettings } = useSettings()
  const { showToast } = useToast()
  const [value, setValue] = useState(String(rate))
  const [saving, setSaving] = useState(false)
  const n = Number(value)
  const valid = Number.isFinite(n) && n >= 1

  async function save(e) {
    e.preventDefault()
    if (!valid) return
    setSaving(true)
    try {
      await updateSettings({ pesosPerPoint: Math.round(n * 100) / 100 })
      showToast('Points rate updated — every balance was recalculated', 'success')
      onClose()
    } catch (err) { showToast(err?.message || 'Failed to save rate', 'error') }
    finally { setSaving(false) }
  }

  return (
    <Modal title="Points Rate" onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <p className="text-sm text-slate-500 leading-relaxed">
          Customers earn 1 point for every amount below, counted from their total purchases.
          Changing it recalculates everyone’s points right away, including past purchases.
        </p>
        <div>
          <label className="field-label">Pesos per 1 point *</label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold">₱</span>
            <input type="number" min="1" step="0.01" className="input-field pl-8 text-lg font-semibold" value={value} onChange={e => setValue(e.target.value)} autoFocus required />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[1000, 5000, 10000].map(p => (
            <button key={p} type="button" onClick={() => setValue(String(p))}
              className={`py-2 rounded-xl text-xs font-semibold border transition-colors ${Number(value) === p ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              ₱{formatNumber(p)}
            </button>
          ))}
        </div>
        {valid && (
          <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-xs text-amber-800 space-y-1">
            <div className="font-semibold">Examples at ₱{formatNumber(n)} per point</div>
            {[25000, 100000].map(spent => (
              <div key={spent} className="flex justify-between"><span>Spent {formatPHP(spent)}</span><span className="font-bold">{fmtInt(Math.floor(spent / n))} points</span></div>
            ))}
          </div>
        )}
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button type="submit" disabled={!valid || saving} className="btn-primary flex-1 justify-center">{saving ? 'Saving…' : 'Save Rate'}</button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Claim celebration ────────────────────────────────────────────────────────

function ClaimSuccess({ claim, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 2400); return () => clearTimeout(t) }, [onClose])
  return (
    <Modal title="Prize claimed" onClose={onClose} size="sm">
      <div className="relative flex flex-col items-center text-center py-2">
        {Array.from({ length: 10 }, (_, i) => (
          <motion.span
            key={i}
            className="absolute top-8 text-amber-400"
            initial={{ opacity: 0, x: 0, y: 0, scale: 0.4 }}
            animate={{ opacity: [0, 1, 0], x: Math.cos((i / 10) * Math.PI * 2) * 90, y: Math.sin((i / 10) * Math.PI * 2) * 60, scale: 1 }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.15 }}
          >
            <Star size={14} className="fill-current" />
          </motion.span>
        ))}
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 14 }}
          className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/30"
        >
          <Gift size={28} />
        </motion.div>
        <div className="mt-4 text-base font-bold text-slate-900">{claim.prize} is on its way!</div>
        <div className="text-sm text-slate-500 mt-1">{claim.customer} spent {fmtInt(claim.cost)} points · {fmtInt(claim.balance)} left</div>
      </div>
    </Modal>
  )
}

// ─── Prize card ───────────────────────────────────────────────────────────────

function PrizeCard({ prize, balance, canClaim, onClaim, onEdit, onDelete, manage, index }) {
  const out = prize.quantity <= 0
  const affordable = balance != null && balance >= prize.points_cost
  const pct = balance == null ? 0 : Math.min(100, (balance / prize.points_cost) * 100)
  const stockTotal = prize.quantity + (prize.claimed || 0)
  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.35, ease: EASE, delay: Math.min(index, 10) * 0.03 }}
      whileHover={{ y: -3 }}
      className={`card p-5 flex flex-col gap-3 transition-shadow hover:shadow-md ${out ? 'opacity-70' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 text-orange-600 flex items-center justify-center flex-shrink-0">
          <Gift size={20} />
        </div>
        <span className={`badge ${out ? 'bg-red-50 text-red-600' : prize.quantity <= 3 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
          {out ? 'Out of stock' : `${fmtInt(prize.quantity)} left`}
        </span>
      </div>
      <div className="min-w-0">
        <div className="text-sm font-bold text-slate-900 truncate" title={prize.name}>{prize.name}</div>
        <div className="text-xs text-slate-400 mt-0.5 line-clamp-2 min-h-[32px]">{prize.description || 'No description'}</div>
      </div>
      <div className="flex items-center gap-1.5 text-amber-600 font-extrabold text-lg tabular-nums">
        <Star size={16} className="fill-amber-400 text-amber-400" /> {fmtInt(prize.points_cost)} <span className="text-xs font-semibold text-slate-400">points</span>
      </div>

      {manage ? (
        <>
          <div>
            <div className="flex justify-between text-[11px] text-slate-400 mb-1"><span>Stock</span><span>{fmtInt(prize.claimed || 0)} claimed</span></div>
            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <motion.div className="h-full rounded-full bg-blue-500" initial={{ width: 0 }} animate={{ width: `${stockTotal ? (prize.quantity / stockTotal) * 100 : 0}%` }} transition={{ duration: 0.8, ease: EASE }} />
            </div>
          </div>
          <div className="flex gap-2 mt-auto">
            <button onClick={onEdit} className="btn-secondary flex-1 justify-center !py-2 text-xs"><Edit size={13} /> Edit</button>
            <button onClick={onDelete} className="btn-ghost !px-2.5 hover:!text-red-500" title="Delete prize"><Trash2 size={14} /></button>
          </div>
        </>
      ) : (
        <>
          {balance != null && (
            <div>
              <div className="h-1.5 rounded-full bg-amber-100 overflow-hidden">
                <motion.div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: EASE }} />
              </div>
              <div className="text-[11px] mt-1 text-slate-400">
                {affordable ? 'Enough points to claim' : `Needs ${fmtInt(prize.points_cost - balance)} more points`}
              </div>
            </div>
          )}
          <button
            onClick={onClaim}
            disabled={!canClaim || out || !affordable}
            className="btn-primary justify-center mt-auto !py-2 text-xs"
          >
            {out ? 'Out of stock' : !canClaim ? 'Pick a customer first' : affordable ? <><Check size={14} /> Claim prize</> : 'Not enough points'}
          </button>
        </>
      )}
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Rewards() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { settings } = useSettings()
  const [searchParams, setSearchParams] = useSearchParams()

  const [tab, setTab]                 = useState('redeem')
  const [summary, setSummary]         = useState(null)
  const [prizes, setPrizes]           = useState([])
  const [prizesLoaded, setPrizesLoaded] = useState(false)
  const [customer, setCustomer]       = useState(null)
  const [points, setPoints]           = useState(null)
  const [prizeModal, setPrizeModal]   = useState(null)   // 'new' | prize
  const [deletePrize, setDeletePrize] = useState(null)
  const [claimTarget, setClaimTarget] = useState(null)
  const [claimed, setClaimed]         = useState(null)
  const [adjustFor, setAdjustFor]     = useState(null)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [rateOpen, setRateOpen]       = useState(false)
  const [pointsQuery, setPointsQuery] = useState('')
  const [claimsQuery, setClaimsQuery] = useState('')

  const rate = settings.pesosPerPoint || 10000

  const loadSummary = useCallback(() => window.electron.invoke('rewards:summary').then(setSummary).catch(() => {}), [])
  const loadPrizes = useCallback(() => window.electron.invoke('rewards:prizes').then(p => { setPrizes(p); setPrizesLoaded(true) }), [])
  const loadPoints = useCallback(id => {
    if (!id) { setPoints(null); return }
    window.electron.invoke('rewards:customerPoints', id).then(setPoints).catch(err => showToast(err?.message, 'error'))
  }, [showToast])

  useEffect(() => { loadSummary(); loadPrizes() }, [loadSummary, loadPrizes, rate])
  useEffect(() => { loadPoints(customer?.id) }, [customer?.id, loadPoints, rate])

  // Arriving from a customer profile: /rewards?customer=12
  useEffect(() => {
    const id = Number(searchParams.get('customer'))
    if (!id) return
    window.electron.invoke('customers:getById', id).then(c => { if (c) { setCustomer(c); setTab('redeem') } })
    setSearchParams({}, { replace: true })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const pointsParams = useMemo(() => ({ search: pointsQuery.trim(), rate }), [pointsQuery, rate])
  const claimsParams = useMemo(() => ({ search: claimsQuery.trim() }), [claimsQuery])
  const pointsPaged = usePaged('rewards:pointsPage', pointsParams, { sizeKey: 'ct-size-points', defaultSize: 25, debounce: pointsQuery ? 220 : 0 })
  const claimsPaged = usePaged('rewards:redemptionsPage', claimsParams, { sizeKey: 'ct-size-claims', defaultSize: 25, debounce: claimsQuery ? 220 : 0 })

  function refreshAll() {
    loadSummary()
    loadPrizes()
    loadPoints(customer?.id)
    pointsPaged.reload()
    claimsPaged.reload()
  }

  async function confirmClaim() {
    const prize = claimTarget
    try {
      const res = await window.electron.invoke('rewards:redeem', { customerId: customer.id, prizeId: prize.id, quantity: 1 })
      setClaimTarget(null)
      setPoints(res.points)
      setClaimed({ prize: prize.name, customer: customer.full_name, cost: prize.points_cost, balance: res.points.balance })
      refreshAll()
    } catch (err) {
      setClaimTarget(null)
      showToast(err?.message || 'Could not claim prize', 'error')
    }
  }

  async function confirmDeletePrize() {
    try {
      await window.electron.invoke('rewards:deletePrize', deletePrize.id)
      showToast('Prize deleted', 'info')
      setDeletePrize(null)
      refreshAll()
    } catch (err) { showToast(err?.message || 'Failed to delete prize', 'error') }
  }

  async function confirmCancel() {
    try {
      await window.electron.invoke('rewards:cancel', cancelTarget.id)
      showToast(`Claim cancelled — ${cancelTarget.points_spent} points returned`, 'success')
      setCancelTarget(null)
      refreshAll()
    } catch (err) { showToast(err?.message || 'Failed to cancel claim', 'error') }
  }

  function startRedeemFor(c) {
    setCustomer(c)
    setTab('redeem')
  }

  const kpis = [
    { label: 'Points outstanding', value: summary?.outstandingPoints || 0, icon: Star, tone: 'bg-amber-500' },
    { label: 'Points redeemed', value: summary?.redeemedPoints || 0, icon: Coins, tone: 'bg-orange-500' },
    { label: 'Items in stock', value: summary?.itemsInStock || 0, icon: Package, tone: 'bg-blue-600', sub: `${fmtInt(summary?.prizeCount || 0)} prizes` },
    { label: 'Claims made', value: summary?.redemptions || 0, icon: Gift, tone: 'bg-violet-500' }
  ]

  return (
    <div className="page-container">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="inline-flex bg-slate-100 rounded-xl p-1 gap-1">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`relative px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === key ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {tab === key && <motion.span layoutId="rewards-tab" className="absolute inset-0 bg-white rounded-lg shadow-sm" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
                <span className="relative flex items-center gap-2"><Icon size={15} /> {label}</span>
              </button>
            ))}
          </div>
          <button onClick={() => setRateOpen(true)} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold hover:bg-amber-100 transition-colors" title="Change the points rate">
            <Star size={13} className="fill-amber-400 text-amber-400" /> ₱{formatNumber(rate)} = 1 point <Settings2 size={13} className="opacity-70" />
          </button>
        </div>
        <motion.button whileTap={{ scale: 0.97 }} onClick={() => setPrizeModal('new')} className="btn-primary">
          <Plus size={16} /> Add Prize
        </motion.button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map(({ label, value, icon: Icon, tone, sub }, i) => (
          <motion.div key={label} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, ease: EASE }} whileHover={{ y: -2 }} className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
              <div className={`w-9 h-9 ${tone} rounded-xl flex items-center justify-center`}><Icon size={17} className="text-white" /></div>
            </div>
            <div className="text-2xl font-bold text-slate-900 tabular-nums"><AnimatedNumber value={value} format={fmtInt} /></div>
            {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
          </motion.div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22, ease: EASE }}
        >
          {tab === 'redeem' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
              <div className="space-y-4">
                <div className="card p-5 space-y-3">
                  <h3 className="text-sm font-semibold text-slate-900">Choose a customer</h3>
                  <CustomerPicker value={customer} onChange={setCustomer} showPoints placeholder="Search by name, email, or phone…" />
                </div>
                <AnimatePresence mode="wait">
                  {customer && points ? (
                    <motion.div
                      key={customer.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="relative overflow-hidden rounded-2xl p-5 text-white bg-gradient-to-br from-blue-600 to-indigo-700 shadow-lg shadow-blue-600/20"
                    >
                      <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-glass/10 blur-2xl" />
                      <div className="relative flex items-center gap-3">
                        <Avatar name={customer.full_name} size={44} className="ring-2 ring-glass/40" />
                        <div className="min-w-0">
                          <div className="font-bold truncate">{customer.full_name}</div>
                          <div className="text-xs text-white/70">{formatPHP(points.total_purchases)} lifetime spend</div>
                        </div>
                      </div>
                      <div className="relative mt-5 text-xs font-semibold uppercase tracking-wider text-white/70">Available points</div>
                      <div className="relative text-5xl font-extrabold tabular-nums leading-tight"><AnimatedNumber value={points.balance} format={fmtInt} /></div>
                      <div className="relative text-[11px] text-white/70 mt-1">
                        {fmtInt(points.earned)} earned{points.adjusted ? ` · ${points.adjusted > 0 ? '+' : ''}${fmtInt(points.adjusted)} adjusted` : ''} · {fmtInt(points.redeemed)} redeemed
                      </div>
                      <div className="relative mt-4 h-1.5 rounded-full bg-glass/20 overflow-hidden">
                        <motion.div className="h-full bg-glass rounded-full" initial={{ width: 0 }} animate={{ width: `${((points.rate - points.toNextPoint) / points.rate) * 100}%` }} transition={{ duration: 0.9, ease: EASE }} />
                      </div>
                      <div className="relative text-[11px] text-white/70 mt-1.5">{formatPHP(points.toNextPoint)} more spending earns the next point</div>
                      <div className="relative flex gap-2 mt-4">
                        <button onClick={() => setAdjustFor({ customer, balance: points.balance })} className="flex-1 inline-flex items-center justify-center gap-1.5 bg-glass/15 hover:bg-glass/25 text-white text-xs font-bold rounded-lg py-2 transition-colors">
                          <SlidersHorizontal size={13} /> Add / deduct points
                        </button>
                        <button onClick={() => navigate(`/customers/${customer.id}`)} className="inline-flex items-center justify-center gap-1 bg-glass/15 hover:bg-glass/25 text-white text-xs font-bold rounded-lg px-3 transition-colors" title="Open profile">
                          <ArrowRight size={13} />
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div key="none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card p-8 text-center">
                      <Users size={28} className="mx-auto text-slate-300" />
                      <div className="text-sm font-medium text-slate-600 mt-3">Pick a customer to see their points</div>
                      <div className="text-xs text-slate-400 mt-1">Prizes they can afford will light up.</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="xl:col-span-2">
                {!prizesLoaded ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">{[0, 1, 2].map(i => <div key={i} className="card h-[230px] skeleton" />)}</div>
                ) : prizes.length === 0 ? (
                  <EmptyPrizes onAdd={() => setPrizeModal('new')} />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
                    <AnimatePresence>
                      {prizes.map((p, i) => (
                        <PrizeCard
                          key={p.id}
                          index={i}
                          prize={p}
                          balance={points?.balance ?? null}
                          canClaim={!!customer}
                          onClaim={() => setClaimTarget(p)}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'prizes' && (
            !prizesLoaded ? null : prizes.length === 0 ? (
              <EmptyPrizes onAdd={() => setPrizeModal('new')} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                <AnimatePresence>
                  {prizes.map((p, i) => (
                    <PrizeCard key={p.id} index={i} prize={p} manage onEdit={() => setPrizeModal(p)} onDelete={() => setDeletePrize(p)} />
                  ))}
                </AnimatePresence>
              </div>
            )
          )}

          {tab === 'points' && (
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Customer points</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Ranked by available points · ₱{formatNumber(rate)} spent = 1 point</p>
                </div>
                <SearchBox value={pointsQuery} onChange={setPointsQuery} placeholder="Search customers…" />
              </div>
              <div className="overflow-auto max-h-[calc(100vh-420px)] min-h-[220px]">
                <table className="w-full">
                  <thead className="sticky top-0 z-10">
                    <tr>
                      <th className="table-header w-14">#</th>
                      <th className="table-header">Customer</th>
                      <th className="table-header text-right">Total spent</th>
                      <th className="table-header text-right">Earned</th>
                      <th className="table-header text-right">Adjusted</th>
                      <th className="table-header text-right">Redeemed</th>
                      <th className="table-header text-right">Available</th>
                      <th className="table-header text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y divide-slate-50 transition-opacity ${pointsPaged.loading && pointsPaged.loaded ? 'opacity-50' : ''}`}>
                    {!pointsPaged.loaded ? <SkeletonRows cols={8} rows={6} /> : pointsPaged.rows.length === 0 ? (
                      <tr><td colSpan={8} className="px-5 py-12 text-center text-sm text-slate-400">No customers found.</td></tr>
                    ) : pointsPaged.rows.map((c, i) => (
                      <tr key={`${pointsPaged.page}-${c.id}`} className="hover:bg-slate-50/60 transition-colors animate-row-in" style={{ animationDelay: `${Math.min(i, 14) * 18}ms` }}>
                        <td className="table-cell text-slate-400 tabular-nums">{(pointsPaged.page - 1) * pointsPaged.pageSize + i + 1}</td>
                        <td className="table-cell">
                          <button onClick={() => navigate(`/customers/${c.id}`)} className="flex items-center gap-2.5 group text-left">
                            <Avatar name={c.full_name} size={30} />
                            <span className="font-medium text-slate-800 group-hover:text-blue-600 transition-colors whitespace-nowrap">{c.full_name}</span>
                          </button>
                        </td>
                        <td className="table-cell text-right tabular-nums">{formatPHP(c.total_purchases)}</td>
                        <td className="table-cell text-right tabular-nums text-slate-500">{fmtInt(c.points_earned)}</td>
                        <td className={`table-cell text-right tabular-nums ${c.points_adjusted > 0 ? 'text-emerald-600' : c.points_adjusted < 0 ? 'text-red-600' : 'text-slate-300'}`}>
                          {c.points_adjusted ? `${c.points_adjusted > 0 ? '+' : ''}${fmtInt(c.points_adjusted)}` : '—'}
                        </td>
                        <td className="table-cell text-right tabular-nums text-slate-500">{c.points_redeemed ? fmtInt(c.points_redeemed) : '—'}</td>
                        <td className="table-cell text-right">
                          <span className="badge bg-amber-50 text-amber-700 tabular-nums gap-1"><Star size={11} className="fill-current" />{fmtInt(c.points_balance)}</span>
                        </td>
                        <td className="table-cell">
                          <div className="flex justify-end gap-1">
                            <button onClick={() => setAdjustFor({ customer: c, balance: c.points_balance })} className="btn-ghost !px-2 !py-1 text-xs" title="Add or deduct points"><SlidersHorizontal size={14} /></button>
                            <button onClick={() => startRedeemFor(c)} className="btn-ghost !px-2 !py-1 text-xs hover:!text-blue-600" title="Redeem a prize"><Gift size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {pointsPaged.loaded && pointsPaged.total > 0 && (
                <Pagination page={pointsPaged.page} pageSize={pointsPaged.pageSize} total={pointsPaged.total}
                  onPageChange={pointsPaged.setPage} onPageSizeChange={pointsPaged.setPageSize} loading={pointsPaged.loading} label="customers" layoutId="points-page" />
              )}
            </div>
          )}

          {tab === 'claims' && (
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Claims history</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Cancelling a claim gives the points back and returns the item to stock</p>
                </div>
                <SearchBox value={claimsQuery} onChange={setClaimsQuery} placeholder="Search customer or prize…" />
              </div>
              <div className="overflow-auto max-h-[calc(100vh-420px)] min-h-[220px]">
                <table className="w-full">
                  <thead className="sticky top-0 z-10">
                    <tr>
                      <th className="table-header">When</th>
                      <th className="table-header">Customer</th>
                      <th className="table-header">Prize</th>
                      <th className="table-header text-center">Qty</th>
                      <th className="table-header text-right">Points</th>
                      <th className="table-header text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y divide-slate-50 transition-opacity ${claimsPaged.loading && claimsPaged.loaded ? 'opacity-50' : ''}`}>
                    {!claimsPaged.loaded ? <SkeletonRows cols={6} rows={5} /> : claimsPaged.rows.length === 0 ? (
                      <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-400">{claimsQuery ? 'No claims match your search.' : 'No prizes have been claimed yet.'}</td></tr>
                    ) : claimsPaged.rows.map((r, i) => (
                      <tr key={r.id} className="hover:bg-slate-50/60 transition-colors animate-row-in" style={{ animationDelay: `${Math.min(i, 14) * 18}ms` }}>
                        <td className="table-cell text-xs text-slate-400 whitespace-nowrap">{formatRecordedAt(r.created_at)}</td>
                        <td className="table-cell">
                          <button onClick={() => navigate(`/customers/${r.customer_id}`)} className="flex items-center gap-2.5 group text-left">
                            <Avatar name={r.customer_name} size={28} />
                            <span className="font-medium text-slate-800 group-hover:text-blue-600 transition-colors whitespace-nowrap">{r.customer_name}</span>
                          </button>
                        </td>
                        <td className="table-cell"><span className="flex items-center gap-2"><Gift size={13} className="text-orange-500" />{r.prize_name}</span></td>
                        <td className="table-cell text-center tabular-nums">{r.quantity}</td>
                        <td className="table-cell text-right font-bold text-amber-600 tabular-nums">−{fmtInt(r.points_spent)}</td>
                        <td className="table-cell text-right">
                          <button onClick={() => setCancelTarget(r)} className="btn-ghost !px-2 !py-1 text-xs hover:!text-red-500"><Undo2 size={13} /> Cancel</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {claimsPaged.loaded && claimsPaged.total > 0 && (
                <Pagination page={claimsPaged.page} pageSize={claimsPaged.pageSize} total={claimsPaged.total}
                  onPageChange={claimsPaged.setPage} onPageSizeChange={claimsPaged.setPageSize} loading={claimsPaged.loading} label="claims" layoutId="claims-page" />
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {prizeModal && <PrizeModal prize={prizeModal === 'new' ? null : prizeModal} onClose={() => setPrizeModal(null)} onSuccess={refreshAll} />}
      {rateOpen && <RateModal rate={rate} onClose={() => setRateOpen(false)} />}
      {adjustFor && (
        <AdjustPointsModal customer={adjustFor.customer} balance={adjustFor.balance} onClose={() => setAdjustFor(null)} onSuccess={refreshAll} />
      )}
      {claimTarget && customer && points && (
        <ConfirmDialog
          danger={false}
          title="Claim Prize"
          message={`Give ${claimTarget.name} to ${customer.full_name} for ${fmtInt(claimTarget.points_cost)} points? Their balance goes from ${fmtInt(points.balance)} to ${fmtInt(points.balance - claimTarget.points_cost)}, and ${fmtInt(claimTarget.quantity - 1)} will be left in stock.`}
          onConfirm={confirmClaim}
          onCancel={() => setClaimTarget(null)}
        />
      )}
      {deletePrize && (
        <ConfirmDialog
          title="Delete Prize"
          message={`Delete "${deletePrize.name}"? Past claims stay in the history.`}
          onConfirm={confirmDeletePrize}
          onCancel={() => setDeletePrize(null)}
        />
      )}
      {cancelTarget && (
        <ConfirmDialog
          danger={false}
          title="Cancel Claim"
          message={`Cancel ${cancelTarget.customer_name}'s claim of ${cancelTarget.prize_name}? ${fmtInt(cancelTarget.points_spent)} points go back to them and the item returns to stock.`}
          onConfirm={confirmCancel}
          onCancel={() => setCancelTarget(null)}
        />
      )}
      {claimed && <ClaimSuccess claim={claimed} onClose={() => setClaimed(null)} />}
    </div>
  )
}

function SearchBox({ value, onChange, placeholder }) {
  return (
    <div className="relative w-64">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input className="input-field !py-2 pl-8 pr-8 text-xs" placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} />
      {value && (
        <button onClick={() => onChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-700"><X size={12} /></button>
      )}
    </div>
  )
}

function EmptyPrizes({ onAdd }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card p-12 text-center">
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 text-orange-500 flex items-center justify-center"
      >
        <Sparkles size={28} />
      </motion.div>
      <div className="text-base font-bold text-slate-900 mt-4">No prizes yet</div>
      <div className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">Add rewards like free products or discounts. Customers claim them with the points they earn from purchases.</div>
      <button onClick={onAdd} className="btn-primary mt-5"><Plus size={15} /> Add your first prize</button>
    </motion.div>
  )
}
