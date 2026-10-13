import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence, MotionConfig } from 'framer-motion'
import {
  Star, Search, Smartphone, ShoppingBag, Gift, Sparkles, MinusCircle, Lock, Maximize2, Minimize2,
  Delete, ChevronRight, Check, Timer, TrendingUp, ArrowLeft, UserRoundSearch, PartyPopper, Plus, Minus, Ticket
} from 'lucide-react'
import Avatar from '../components/Avatar'
import AnimatedNumber from '../components/AnimatedNumber'
import Pagination from '../components/Pagination'
import { useSettings } from '../context/SettingsContext'
import { useToast } from '../context/ToastContext'
import { formatPHP, formatNumber, formatDate, formatRecordedAt, parseSqliteTime } from '../utils/format'
import { hashPin } from '../utils/pin'

// Customer-facing screen: shows a customer their points, the rewards they can
// claim, and their history. It never shows spending totals, has no menu, and
// returns to the start by itself so the next person never sees someone else.

const EASE = [0.16, 1, 0.3, 1]
const fmtInt = v => formatNumber(Math.round(v))
const HISTORY_PAGE = 8

// ─── Keypad (touch friendly) ──────────────────────────────────────────────────

function Keypad({ onDigit, onBack, onClear, compact = false }) {
  const key = 'h-14 rounded-2xl text-xl font-bold transition-all active:scale-95 select-none'
  return (
    <div className={`grid grid-cols-3 gap-2.5 ${compact ? 'w-64' : 'w-80'}`}>
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
        <button key={d} type="button" onClick={() => onDigit(d)} className={`${key} bg-white border border-slate-200 text-slate-800 hover:bg-slate-50 shadow-sm`}>{d}</button>
      ))}
      <button type="button" onClick={onClear} className={`${key} text-sm text-slate-500 hover:bg-slate-100`}>Clear</button>
      <button type="button" onClick={() => onDigit('0')} className={`${key} bg-white border border-slate-200 text-slate-800 hover:bg-slate-50 shadow-sm`}>0</button>
      <button type="button" onClick={onBack} className={`${key} text-slate-500 hover:bg-slate-100 flex items-center justify-center`} aria-label="Delete"><Delete size={22} /></button>
    </div>
  )
}

// ─── Lookup ───────────────────────────────────────────────────────────────────

function Lookup({ mode, onPick }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const req = useRef(0)
  const inputRef = useRef(null)
  const phoneMode = mode === 'phone'
  const digits = query.replace(/\D/g, '')

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    const ready = phoneMode ? digits.length >= 10 : query.trim().length >= 2
    if (!ready) { setResults(null); return }
    const id = ++req.current
    setLoading(true)
    const t = setTimeout(() => {
      window.electron.invoke('points:find', query)
        .then(r => { if (id === req.current) setResults(r) })
        .finally(() => { if (id === req.current) setLoading(false) })
    }, phoneMode ? 0 : 200)
    return () => clearTimeout(t)
  }, [query, digits.length, phoneMode])

  const shownPhone = phoneMode
    ? digits.replace(/^(\d{4})(\d{0,3})(\d{0,4}).*/, (_, a, b, c) => [a, b, c].filter(Boolean).join(' '))
    : query

  return (
    <motion.div
      key="lookup"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.4, ease: EASE }}
      className="h-full overflow-y-auto px-6"
    >
      {/* min-h-full + justify-center keeps it centered, yet a long result list scrolls from the top */}
      <div className="min-h-full flex flex-col items-center justify-center pt-4 pb-10">
        <motion.div
          initial={{ scale: 0.6, rotate: -20, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 15 }}
          className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shadow-xl shadow-orange-500/30"
        >
          <Star size={38} className="fill-white/90" />
        </motion.div>
        <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-slate-900 text-center">Check your reward points</h1>
        <p className="mt-2 text-base text-slate-500 text-center">
          {phoneMode ? 'Enter the mobile number registered with us' : 'Type your name or mobile number'}
        </p>

        <div className="mt-8 w-full max-w-xl">
          <div className="relative">
            {phoneMode ? <Smartphone size={22} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" /> : <Search size={22} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />}
            <input
              ref={inputRef}
              value={shownPhone}
              inputMode={phoneMode ? 'tel' : 'text'}
              onChange={e => setQuery(phoneMode ? e.target.value.replace(/\D/g, '').slice(0, 12) : e.target.value)}
              placeholder={phoneMode ? '0917 123 4567' : 'e.g. Maria Santos or 0917…'}
              className="w-full bg-white border-2 border-slate-200 rounded-2xl pl-14 pr-5 py-4 text-2xl font-semibold text-slate-900 placeholder:text-slate-300 placeholder:font-normal focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 shadow-sm transition-all tracking-wide"
            />
          </div>

          {phoneMode && (
            <div className="mt-5 flex justify-center">
              <Keypad
                onDigit={d => setQuery(q => (q.replace(/\D/g, '') + d).slice(0, 12))}
                onBack={() => setQuery(q => q.replace(/\D/g, '').slice(0, -1))}
                onClear={() => setQuery('')}
              />
            </div>
          )}

          <div className="mt-5 min-h-[120px]">
            <AnimatePresence mode="wait">
              {loading && !results ? (
                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
                  {[0, 1].map(i => <div key={i} className="skeleton h-16 !rounded-2xl" />)}
                </motion.div>
              ) : results && results.length > 0 ? (
                <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
                  {results.map((c, i) => (
                    <motion.button
                      key={c.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04, ease: EASE }}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => onPick(c.id)}
                      className="w-full flex items-center gap-4 bg-white border border-slate-200 hover:border-blue-300 rounded-2xl px-5 py-3.5 text-left shadow-sm transition-colors"
                    >
                      <Avatar name={c.full_name} size={44} />
                      <span className="flex-1 min-w-0">
                        <span className="block text-lg font-bold text-slate-900 truncate">{c.full_name}</span>
                        <span className="block text-sm text-slate-400">{c.phone_hint || 'No mobile number on file'}</span>
                      </span>
                      <span className="flex items-center gap-1 text-sm font-semibold text-blue-600">See my points <ChevronRight size={18} /></span>
                    </motion.button>
                  ))}
                </motion.div>
              ) : results ? (
                <motion.div key="none" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-center py-6">
                  <UserRoundSearch size={30} className="mx-auto text-slate-300" />
                  <div className="mt-2 text-base font-semibold text-slate-600">We couldn’t find you yet</div>
                  <div className="text-sm text-slate-400">{phoneMode ? 'Check the number, or ask our staff to look you up.' : 'Try your full name, or ask our staff for help.'}</div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Customer card ────────────────────────────────────────────────────────────

function HistoryRow({ row, showAmounts, index }) {
  const purchase = row.kind === 'purchase'
  const claim = row.kind === 'claim'
  const positive = row.points > 0
  const Icon = purchase ? ShoppingBag : claim ? Gift : positive ? Sparkles : MinusCircle
  const tone = purchase ? 'bg-blue-50 text-blue-600' : claim ? 'bg-amber-50 text-amber-600' : positive ? 'bg-violet-50 text-violet-600' : 'bg-red-50 text-red-600'
  const title = purchase
    ? (row.label || 'Purchase')
    : claim
      ? `Claimed ${row.quantity > 1 ? `${row.quantity} × ` : ''}${row.label}`
      : positive ? `Bonus points${row.label ? ` — ${row.label}` : ''}` : `Points adjustment${row.label ? ` — ${row.label}` : ''}`
  const when = purchase ? formatDate(row.date) : formatRecordedAt(row.created_at)
  return (
    <div className="flex items-center gap-3.5 px-5 py-3 animate-row-in" style={{ animationDelay: `${index * 30}ms` }}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${tone}`}><Icon size={18} /></div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-slate-800 truncate">{title}</div>
        <div className="text-xs text-slate-400">{when}</div>
      </div>
      <div className="text-right flex-shrink-0">
        {purchase && showAmounts && row.amount != null && (
          <div className="text-xs text-slate-500 tabular-nums">{formatPHP(row.amount)}</div>
        )}
        <div className="flex items-center justify-end gap-1.5 mt-0.5">
          {(!purchase || row.points !== 0) && (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold tabular-nums ${
              row.points > 0 ? 'bg-emerald-50 text-emerald-700' : row.points < 0 ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-400'
            }`}>
              <Star size={10} className="fill-current" />{row.points > 0 ? '+' : ''}{fmtInt(row.points)} {Math.abs(row.points) === 1 ? 'pt' : 'pts'}
            </span>
          )}
          {/* Points come from the running total, so most purchases add progress
              toward the next point rather than a whole point of their own */}
          {purchase && (row.to_next != null || row.points === 0) && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 tabular-nums"
              title={row.to_next != null ? `After this purchase, ${formatPHP(row.to_next)} more was needed for the next point` : 'Added to your total — counts toward your next point'}>
              <TrendingUp size={11} /> {row.to_next != null ? `${formatPHP(row.to_next)} to go` : 'Toward next point'}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function CustomerView({ customerId, showAmounts, selfClaim, claimNeedsPin, pinHash, onDone }) {
  const { showToast } = useToast()
  const [card, setCard] = useState(null)
  const [prizes, setPrizes] = useState([])
  const [page, setPage] = useState(1)
  const [history, setHistory] = useState({ rows: [], total: 0 })
  const [histLoading, setHistLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const [claimTarget, setClaimTarget] = useState(null)   // { prize, quantity }
  const [approving, setApproving] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [ticket, setTicket] = useState(null)
  const claimingRef = useRef(false)

  useEffect(() => {
    Promise.all([
      window.electron.invoke('points:card', customerId),
      window.electron.invoke('rewards:prizes')
    ]).then(([c, p]) => { setCard(c); setPrizes(p) }).catch(() => onDone())
  }, [customerId, onDone])

  useEffect(() => {
    setHistLoading(true)
    window.electron.invoke('points:timeline', { customerId, page, pageSize: HISTORY_PAGE })
      .then(setHistory)
      .finally(() => setHistLoading(false))
  }, [customerId, page, reloadKey])

  async function doClaim() {
    // One claim per confirmation, however fast the button or Enter is pressed
    if (claimingRef.current || !claimTarget) return
    claimingRef.current = true
    const { prize, quantity } = claimTarget
    setApproving(false)
    setClaiming(true)
    try {
      const res = await window.electron.invoke('points:claim', { customerId, prizeId: prize.id, quantity })
      setCard(res.card)
      setPrizes(await window.electron.invoke('rewards:prizes'))
      setPage(1)
      setReloadKey(k => k + 1)
      setClaimTarget(null)
      setTicket({ id: res.redemptionId, prize: prize.name, quantity, cost: prize.points_cost * quantity, balance: res.card.balance, at: new Date() })
    } catch (err) {
      showToast(err?.message || 'Could not claim the prize', 'error')
      setClaimTarget(null)
    } finally {
      claimingRef.current = false
      setClaiming(false)
    }
  }

  function confirmClaim() {
    if (claimNeedsPin && pinHash) setApproving(true)
    else doClaim()
  }

  const rewards = useMemo(() => {
    if (!card) return []
    return [...prizes]
      .map(p => ({ ...p, canClaim: p.quantity > 0 && card.balance >= p.points_cost }))
      .sort((a, b) => (b.canClaim - a.canClaim) || ((a.quantity > 0 ? 0 : 1) - (b.quantity > 0 ? 0 : 1)) || (a.points_cost - b.points_cost))
  }, [prizes, card])
  const claimable = rewards.filter(r => r.canClaim).length

  if (!card) return <div className="h-full flex items-center justify-center"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>

  const pct = Math.round(card.progress * 100)
  const since = parseSqliteTime(card.member_since)

  return (
    <motion.div
      key={`card-${customerId}`}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.45, ease: EASE }}
      className="h-full overflow-y-auto"
    >
      <div className="max-w-6xl mx-auto px-6 pt-2 pb-8 space-y-6">
        {/* Hello */}
        <div className="flex items-center gap-4">
          <button onClick={onDone} className="btn-ghost !px-2.5 !py-2.5" title="Back"><ArrowLeft size={20} /></button>
          <Avatar name={card.full_name} size={56} className="shadow-md" />
          <div className="min-w-0">
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight truncate">Hi, {card.first_name}! 👋</h1>
            <p className="text-sm text-slate-500">
              Member since {isNaN(since) ? '—' : since.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}
              {card.last_visit ? ` · Last visit ${formatDate(card.last_visit)}` : ''}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6 items-start">
          <div className="space-y-6">
            {/* Points hero */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: EASE, delay: 0.05 }}
              className="relative overflow-hidden rounded-3xl p-7 text-white bg-gradient-to-br from-blue-600 to-indigo-700 shadow-xl shadow-blue-600/25"
            >
              <div className="absolute -right-14 -top-14 w-52 h-52 rounded-full bg-glass/10 blur-2xl" />
              <div className="absolute -left-10 -bottom-16 w-48 h-48 rounded-full bg-glass/10 blur-2xl" />
              <div className="relative flex items-center justify-between">
                <span className="text-sm font-semibold uppercase tracking-widest text-white/80">Your points</span>
                <motion.span animate={{ rotate: [0, 15, -10, 0] }} transition={{ duration: 1.6, delay: 0.6 }}>
                  <Star size={24} className="fill-[#fcd34d] text-[#fcd34d]" />
                </motion.span>
              </div>
              <div className="relative mt-2 text-7xl font-extrabold tracking-tight tabular-nums leading-none">
                <AnimatedNumber value={card.balance} format={fmtInt} duration={1.2} />
              </div>
              <div className="relative mt-2 text-sm text-white/80">
                {fmtInt(card.earned)} earned{card.adjusted > 0 ? ` · +${fmtInt(card.adjusted)} bonus` : card.adjusted < 0 ? ` · ${fmtInt(card.adjusted)} adjusted` : ''} · {fmtInt(card.redeemed)} used
              </div>
              <div className="relative mt-6">
                <div className="flex items-center justify-between text-xs font-semibold text-white/80 mb-1.5">
                  <span className="flex items-center gap-1.5"><TrendingUp size={13} /> Next point</span>
                  <span>{pct}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-glass/20 overflow-hidden">
                  <motion.div className="h-full rounded-full bg-gradient-to-r from-[#fcd34d] to-[#ffffff]" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1.1, ease: EASE, delay: 0.3 }} />
                </div>
                <div className="mt-3 text-sm text-white">
                  Spend <b className="tabular-nums">{formatPHP(card.to_next)}</b> more to earn your next point
                </div>
                <div className="mt-0.5 text-xs text-white/70">1 point for every ₱{formatNumber(card.rate)} you spend with us.</div>
              </div>
            </motion.div>

            {/* Rewards */}
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2"><Gift size={18} className="text-orange-500" /> Rewards</h2>
                {claimable > 0 && (
                  <motion.span initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="badge bg-emerald-50 text-emerald-700 gap-1">
                    <PartyPopper size={12} /> {claimable} ready to claim
                  </motion.span>
                )}
              </div>
              <div className="max-h-[340px] overflow-y-auto divide-y divide-slate-50">
                {rewards.length === 0 ? (
                  <div className="px-5 py-8 text-center text-sm text-slate-400">Rewards are coming soon — keep collecting points!</div>
                ) : rewards.map((p, i) => {
                  const out = p.quantity <= 0
                  const need = Math.max(0, p.points_cost - card.balance)
                  const prog = Math.min(100, (card.balance / p.points_cost) * 100)
                  return (
                    <motion.div key={p.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.04, ease: EASE }}
                      className={`px-5 py-3.5 ${out ? 'opacity-50' : ''}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${p.canClaim ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md shadow-orange-500/30' : 'bg-orange-50 text-orange-500'}`}>
                          <Gift size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-slate-900 truncate">{p.name}</div>
                          <div className="text-xs text-slate-400 flex items-center gap-1"><Star size={11} className="fill-amber-400 text-amber-400" /> {fmtInt(p.points_cost)} points</div>
                        </div>
                        {out ? (
                          <span className="text-xs font-semibold text-slate-400">Out of stock</span>
                        ) : p.canClaim && selfClaim ? (
                          <motion.button
                            whileHover={{ scale: 1.04 }}
                            whileTap={{ scale: 0.96 }}
                            onClick={() => setClaimTarget({ prize: p, quantity: 1 })}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-amber-500 to-orange-500 shadow-md shadow-orange-500/30"
                          >
                            <Gift size={13} /> Claim
                          </motion.button>
                        ) : p.canClaim ? (
                          <span className="badge bg-emerald-50 text-emerald-700 gap-1"><Check size={12} /> Ask us to claim</span>
                        ) : (
                          <span className="text-right whitespace-nowrap">
                            <span className="block text-xs font-semibold text-slate-500">{fmtInt(need)} more {need === 1 ? 'point' : 'points'}</span>
                            <span className="block text-[11px] text-slate-400">Spend {formatPHP(card.to_next + (need - 1) * card.rate)} more</span>
                          </span>
                        )}
                      </div>
                      {!out && !p.canClaim && (
                        <div className="mt-2 ml-[52px] h-1.5 rounded-full bg-amber-100 overflow-hidden">
                          <motion.div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500" initial={{ width: 0 }} animate={{ width: `${prog}%` }} transition={{ duration: 0.9, ease: EASE, delay: 0.2 }} />
                        </div>
                      )}
                    </motion.div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* History */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">Your history</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Every purchase adds up — you get a point each time your spending passes another ₱{formatNumber(card.rate)}.
                {showAmounts && ' “To go” is what was left to the next point right after that purchase.'}
              </p>
            </div>
            <div className={`divide-y divide-slate-50 min-h-[300px] transition-opacity ${histLoading ? 'opacity-50' : ''}`}>
              {history.rows.length === 0 && !histLoading ? (
                <div className="px-5 py-14 text-center text-sm text-slate-400">No activity yet.</div>
              ) : history.rows.map((r, i) => <HistoryRow key={`${page}-${r.kind}-${r.id}`} row={r} index={i} showAmounts={showAmounts} />)}
            </div>
            {history.total > HISTORY_PAGE && (
              <Pagination page={page} pageSize={HISTORY_PAGE} total={history.total} onPageChange={setPage} label="entries" layoutId="pc-page" />
            )}
          </div>
        </div>

        <div className="flex justify-center pt-2">
          <motion.button whileTap={{ scale: 0.97 }} onClick={onDone} className="btn-primary !px-10 !py-3.5 !text-base !rounded-2xl">
            <Check size={18} /> Done
          </motion.button>
        </div>
      </div>

      <AnimatePresence>
        {claimTarget && !approving && (
          <ClaimSheet
            target={claimTarget}
            balance={card.balance}
            busy={claiming}
            onQuantity={q => setClaimTarget(t => ({ ...t, quantity: q }))}
            onConfirm={confirmClaim}
            onCancel={() => setClaimTarget(null)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {approving && (
          <StaffPinDialog
            pinHash={pinHash}
            title="Staff approval"
            message={`Enter the staff PIN to approve ${claimTarget?.prize.name}.`}
            confirmLabel="Approve"
            onSuccess={doClaim}
            onCancel={() => { setApproving(false); setClaimTarget(null) }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {ticket && <ClaimTicket ticket={ticket} name={card.full_name} onClose={() => setTicket(null)} />}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Claiming ─────────────────────────────────────────────────────────────────

function Overlay({ children, onBackdrop }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget && onBackdrop) onBackdrop() }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 16 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        className="bg-white rounded-3xl shadow-2xl p-7 w-full max-w-md flex flex-col items-center text-center"
      >
        {children}
      </motion.div>
    </motion.div>
  )
}

function ClaimSheet({ target, balance, busy, onQuantity, onConfirm, onCancel }) {
  const { prize, quantity } = target
  const maxQty = Math.max(1, Math.min(prize.quantity, Math.floor(balance / prize.points_cost)))
  const cost = prize.points_cost * quantity
  return (
    <Overlay onBackdrop={busy ? null : onCancel}>
      <motion.div
        initial={{ scale: 0.5, rotate: -15 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }}
        className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/30"
      >
        <Gift size={30} />
      </motion.div>
      <h2 className="mt-4 text-xl font-extrabold text-slate-900">{prize.name}</h2>
      {prize.description && <p className="text-sm text-slate-500 mt-1">{prize.description}</p>}

      {maxQty > 1 && (
        <div className="mt-5 flex items-center gap-4">
          <button onClick={() => onQuantity(Math.max(1, quantity - 1))} disabled={quantity <= 1} aria-label="One less" className="w-11 h-11 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-30"><Minus size={18} /></button>
          <div className="w-14 text-center">
            <div className="text-3xl font-extrabold text-slate-900 tabular-nums">{quantity}</div>
            <div className="text-[11px] text-slate-400">of {maxQty} max</div>
          </div>
          <button onClick={() => onQuantity(Math.min(maxQty, quantity + 1))} disabled={quantity >= maxQty} aria-label="One more" className="w-11 h-11 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-30"><Plus size={18} /></button>
        </div>
      )}

      <div className="mt-5 w-full rounded-2xl bg-slate-50 border border-slate-100 divide-y divide-slate-100 text-sm">
        <div className="flex justify-between px-4 py-3"><span className="text-slate-500">Uses</span><span className="font-bold text-amber-600 flex items-center gap-1"><Star size={13} className="fill-amber-400 text-amber-400" />{fmtInt(cost)} points</span></div>
        <div className="flex justify-between px-4 py-3"><span className="text-slate-500">Your points</span><span className="font-bold text-slate-900 tabular-nums">{fmtInt(balance)} → {fmtInt(balance - cost)}</span></div>
      </div>

      <div className="flex gap-3 w-full mt-6">
        <button onClick={onCancel} disabled={busy} className="btn-secondary flex-1 justify-center !py-3">Not now</button>
        <motion.button whileTap={{ scale: 0.97 }} onClick={onConfirm} disabled={busy} className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-amber-500 to-orange-500 shadow-md shadow-orange-500/30 disabled:opacity-60">
          {busy ? 'Claiming…' : <><Check size={16} /> Claim {quantity > 1 ? `${quantity} ` : ''}now</>}
        </motion.button>
      </div>
    </Overlay>
  )
}

function ClaimTicket({ ticket, name, onClose }) {
  return (
    <Overlay onBackdrop={onClose}>
      <div className="relative">
        {Array.from({ length: 12 }, (_, i) => (
          <motion.span
            key={i}
            className="absolute left-1/2 top-1/2 text-amber-400"
            initial={{ opacity: 0, x: 0, y: 0, scale: 0.4 }}
            animate={{ opacity: [0, 1, 0], x: Math.cos((i / 12) * Math.PI * 2) * 110, y: Math.sin((i / 12) * Math.PI * 2) * 80, scale: 1 }}
            transition={{ duration: 1.4, ease: 'easeOut', delay: 0.15 }}
          >
            <Star size={14} className="fill-current" />
          </motion.span>
        ))}
        <motion.div
          initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 240, damping: 13 }}
          className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-white flex items-center justify-center shadow-xl shadow-emerald-500/30"
        >
          <Check size={40} strokeWidth={3} />
        </motion.div>
      </div>
      <h2 className="mt-5 text-2xl font-extrabold text-slate-900">Enjoy your {ticket.quantity > 1 ? `${ticket.quantity} × ` : ''}{ticket.prize}!</h2>
      <p className="text-sm text-slate-500 mt-1">Show this screen to our staff to receive your prize.</p>

      <div className="mt-5 w-full rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/60 px-5 py-4 text-left">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-700"><Ticket size={14} /> Claim ticket</span>
          <span className="text-lg font-extrabold text-slate-900 tabular-nums">#{String(ticket.id).padStart(6, '0')}</span>
        </div>
        <div className="mt-2 text-sm font-semibold text-slate-800">{name}</div>
        <div className="text-xs text-slate-500">{ticket.at.toLocaleString('en-PH', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>
        <div className="mt-2 flex justify-between text-xs"><span className="text-slate-500">Points used</span><span className="font-bold text-amber-700">{fmtInt(ticket.cost)}</span></div>
        <div className="flex justify-between text-xs"><span className="text-slate-500">Points left</span><span className="font-bold text-slate-900">{fmtInt(ticket.balance)}</span></div>
      </div>

      <motion.button whileTap={{ scale: 0.97 }} onClick={onClose} className="btn-primary w-full justify-center mt-6 !py-3 !rounded-2xl">
        <Check size={16} /> Got it
      </motion.button>
    </Overlay>
  )
}

// ─── Exit (optional PIN) ──────────────────────────────────────────────────────

function StaffPinDialog({ pinHash, title = 'Staff only', message, confirmLabel, onSuccess, onCancel }) {
  const [pin, setPin] = useState('')
  const [wrong, setWrong] = useState(0)
  const needsPin = !!pinHash

  // Keep typed digits out of whatever field had focus behind the dialog
  useEffect(() => { document.activeElement?.blur?.() }, [])

  const succeeded = useRef(false)
  const check = useCallback(async value => {
    if (succeeded.current) return
    const ok = !needsPin || (await hashPin(value)) === pinHash
    if (!ok) { setWrong(w => w + 1); setPin(''); return }
    if (succeeded.current) return
    succeeded.current = true
    onSuccess()
  }, [needsPin, pinHash, onSuccess])

  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape') onCancel()
      else if (needsPin && /^\d$/.test(e.key)) setPin(p => (p + e.key).slice(0, 8))
      else if (needsPin && e.key === 'Backspace') setPin(p => p.slice(0, -1))
      else if (e.key === 'Enter') check(pin)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [needsPin, pin, check, onCancel])

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 16 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        className="bg-white rounded-3xl shadow-2xl p-7 w-full max-w-sm flex flex-col items-center text-center"
      >
        <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center"><Lock size={22} /></div>
        <h2 className="mt-4 text-lg font-bold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-500 mt-1">{message}</p>
        {needsPin && (
          <>
            <motion.div key={wrong} animate={wrong ? { x: [0, -10, 10, -6, 6, 0] } : {}} transition={{ duration: 0.4 }} className="flex gap-2.5 my-5">
              {Array.from({ length: Math.max(4, pin.length) }, (_, i) => (
                <span key={i} className={`w-3.5 h-3.5 rounded-full transition-colors ${i < pin.length ? 'bg-blue-600' : 'bg-slate-200'}`} />
              ))}
            </motion.div>
            {wrong > 0 && <div className="text-xs font-semibold text-red-600 -mt-2 mb-3">Wrong PIN, try again</div>}
            <Keypad compact onDigit={d => setPin(p => (p + d).slice(0, 8))} onBack={() => setPin(p => p.slice(0, -1))} onClear={() => setPin('')} />
          </>
        )}
        <div className="flex gap-3 w-full mt-6">
          <button onClick={onCancel} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button onClick={() => check(pin)} disabled={needsPin && pin.length < 4} className="btn-primary flex-1 justify-center">{confirmLabel}</button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PointsCheck() {
  const navigate = useNavigate()
  const { settings } = useSettings()
  const [searchParams, setSearchParams] = useSearchParams()
  const [customerId, setCustomerId] = useState(() => Number(searchParams.get('customer')) || null)
  const [exiting, setExiting] = useState(false)
  const [fullScreen, setFullScreen] = useState(false)
  const [remaining, setRemaining] = useState(null)
  const lastActivity = useRef(Date.now())
  const resetAfter = Number(settings.pointsResetSeconds ?? 60)

  useEffect(() => { if (searchParams.get('customer')) setSearchParams({}, { replace: true }) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const done = useCallback(() => setCustomerId(null), [])

  // Back to the start after a quiet period, so the next person never sees the
  // previous customer's points
  useEffect(() => {
    if (!customerId || !(resetAfter > 0)) { setRemaining(null); return }
    lastActivity.current = Date.now()
    const bump = () => { lastActivity.current = Date.now() }
    const events = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart']
    events.forEach(e => window.addEventListener(e, bump, { passive: true }))
    const timer = setInterval(() => {
      const left = Math.ceil(resetAfter - (Date.now() - lastActivity.current) / 1000)
      if (left <= 0) setCustomerId(null)
      setRemaining(left <= 10 ? Math.max(0, left) : null)
    }, 500)
    return () => {
      events.forEach(e => window.removeEventListener(e, bump))
      clearInterval(timer)
    }
  }, [customerId, resetAfter])

  // Leave full screen whenever this screen closes
  useEffect(() => () => { window.electron.invoke('window:setFullScreen', false).catch(() => {}) }, [])

  async function toggleFullScreen() {
    setFullScreen(await window.electron.invoke('window:setFullScreen', !fullScreen))
  }

  async function exitView() {
    await window.electron.invoke('window:setFullScreen', false).catch(() => {})
    navigate('/')
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative h-screen flex flex-col overflow-hidden bg-page">
        {/* Soft brand glow */}
        <div className="pointer-events-none absolute -top-40 -left-32 w-[520px] h-[520px] rounded-full bg-blue-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-48 -right-32 w-[560px] h-[560px] rounded-full bg-indigo-500/10 blur-3xl" />

        {/* Top bar */}
        <header className="relative z-10 flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/30">
              <TrendingUp size={19} className="text-white" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 leading-tight">Customer Tracker</div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-blue-600">Points Check</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleFullScreen} className="btn-ghost !px-2.5" title={fullScreen ? 'Exit full screen' : 'Full screen'}>
              {fullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <button onClick={() => setExiting(true)} className="btn-ghost !px-2.5" title="Staff: leave the customer screen">
              <Lock size={18} />
            </button>
          </div>
        </header>

        <main className="relative z-0 flex-1 min-h-0">
          <AnimatePresence mode="wait">
            {customerId
              ? (
                <CustomerView
                  key={customerId}
                  customerId={customerId}
                  showAmounts={settings.pointsShowAmounts !== false}
                  selfClaim={settings.pointsSelfClaim !== false}
                  claimNeedsPin={!!settings.pointsClaimNeedsPin}
                  pinHash={settings.customerViewPinHash}
                  onDone={done}
                />
              )
              : <Lookup key="lookup" mode={settings.pointsLookupMode} onPick={setCustomerId} />}
          </AnimatePresence>
        </main>

        <AnimatePresence>
          {remaining != null && customerId && (
            <motion.div
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-[#0f172a] text-white rounded-2xl shadow-2xl px-5 py-3 text-sm"
            >
              <Timer size={16} className="text-amber-300" />
              Returning to the start in <b className="tabular-nums">{remaining}s</b> — tap anywhere to stay
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {exiting && (
            <StaffPinDialog
              pinHash={settings.customerViewPinHash}
              message={settings.customerViewPinHash ? 'Enter the PIN to leave the customer screen.' : 'Leave the customer screen and go back to the app?'}
              confirmLabel={settings.customerViewPinHash ? 'Unlock' : 'Leave'}
              onSuccess={exitView}
              onCancel={() => setExiting(false)}
            />
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  )
}
