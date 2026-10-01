import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ScrollText, Search, X, ChevronDown, CalendarRange, UserPlus, UserCog, UserX, Plus, Edit, Trash2,
  Gift, Award, Undo2, PlusCircle, MinusCircle, UserRound, Palette, Star, Settings, Upload, Download,
  AlertTriangle, FileSpreadsheet, FileText, ShieldCheck, Sparkles, ArrowRight, Filter
} from 'lucide-react'
import Pagination from '../components/Pagination'
import Select from '../components/Select'
import usePaged from '../hooks/usePaged'
import { formatPHP, formatDateShort, parseSqliteTime } from '../utils/format'

const TONES = {
  emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
  blue:    'bg-blue-50 text-blue-600 ring-blue-100',
  red:     'bg-red-50 text-red-600 ring-red-100',
  amber:   'bg-amber-50 text-amber-600 ring-amber-100',
  orange:  'bg-orange-50 text-orange-600 ring-orange-100',
  violet:  'bg-violet-50 text-violet-600 ring-violet-100',
  slate:   'bg-slate-100 text-slate-600 ring-slate-200'
}

export const ACTION_META = {
  customer_added:      { label: 'Customer added',      icon: UserPlus,        tone: 'emerald', category: 'customers' },
  customer_edited:     { label: 'Customer edited',     icon: UserCog,         tone: 'blue',    category: 'customers' },
  customer_deleted:    { label: 'Customer deleted',    icon: UserX,           tone: 'red',     category: 'customers' },
  transaction_added:   { label: 'Transaction added',   icon: Plus,            tone: 'emerald', category: 'transactions' },
  transaction_edited:  { label: 'Transaction edited',  icon: Edit,            tone: 'blue',    category: 'transactions' },
  transaction_deleted: { label: 'Transaction deleted', icon: Trash2,          tone: 'red',     category: 'transactions' },
  prize_added:         { label: 'Prize added',         icon: Gift,            tone: 'emerald', category: 'rewards' },
  prize_edited:        { label: 'Prize edited',        icon: Gift,            tone: 'blue',    category: 'rewards' },
  prize_deleted:       { label: 'Prize deleted',       icon: Gift,            tone: 'red',     category: 'rewards' },
  reward_redeemed:     { label: 'Prize claimed',       icon: Award,           tone: 'amber',   category: 'rewards' },
  reward_cancelled:    { label: 'Claim cancelled',     icon: Undo2,           tone: 'orange',  category: 'rewards' },
  points_added:        { label: 'Points added',        icon: PlusCircle,      tone: 'emerald', category: 'rewards' },
  points_deducted:     { label: 'Points deducted',     icon: MinusCircle,     tone: 'red',     category: 'rewards' },
  profile_updated:     { label: 'Profile updated',     icon: UserRound,       tone: 'violet',  category: 'settings' },
  theme_changed:       { label: 'Theme changed',       icon: Palette,         tone: 'violet',  category: 'settings' },
  points_rate_changed: { label: 'Points rate changed', icon: Star,            tone: 'amber',   category: 'settings' },
  settings_updated:    { label: 'Settings updated',    icon: Settings,        tone: 'slate',   category: 'settings' },
  data_imported:       { label: 'Backup imported',     icon: Upload,          tone: 'amber',   category: 'data' },
  data_exported:       { label: 'Backup exported',     icon: Download,        tone: 'blue',    category: 'data' },
  data_cleared:        { label: 'All data cleared',    icon: AlertTriangle,   tone: 'red',     category: 'data' },
  excel_exported:      { label: 'Excel exported',      icon: FileSpreadsheet, tone: 'emerald', category: 'data' },
  report_exported:     { label: 'PDF exported',        icon: FileText,        tone: 'blue',    category: 'data' },
  backup_created:      { label: 'Automatic backup',    icon: ShieldCheck,     tone: 'emerald', category: 'data' },
  app_updated:         { label: 'App updated',         icon: Sparkles,        tone: 'violet',  category: 'data' }
}

const CATEGORIES = [
  { key: 'all',          label: 'All' },
  { key: 'customers',    label: 'Customers' },
  { key: 'transactions', label: 'Transactions' },
  { key: 'rewards',      label: 'Rewards' },
  { key: 'settings',     label: 'Settings' },
  { key: 'data',         label: 'Data' }
]

function showValue(v, type) {
  if (v === null || v === undefined || v === '') return <span className="italic text-slate-400">empty</span>
  if (type === 'money') return formatPHP(Number(v))
  if (type === 'date') return formatDateShort(String(v).slice(0, 10))
  if (type === 'number') return Number(v).toLocaleString()
  return String(v)
}

function dayLabel(d) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const that = new Date(d); that.setHours(0, 0, 0, 0)
  const diff = Math.round((today - that) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return d.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function LogEntry({ row, index }) {
  const [open, setOpen] = useState(false)
  const meta = ACTION_META[row.action] || { label: row.action, icon: ScrollText, tone: 'slate' }
  const Icon = meta.icon
  const changes = row.details?.changes || []
  const when = parseSqliteTime(row.created_at)
  return (
    <div className="animate-row-in" style={{ animationDelay: `${Math.min(index, 14) * 18}ms` }}>
      <button
        onClick={() => changes.length && setOpen(o => !o)}
        className={`w-full flex items-start gap-3.5 px-5 py-3.5 text-left transition-colors ${changes.length ? 'hover:bg-slate-50/70 cursor-pointer' : 'cursor-default'}`}
      >
        <div className={`w-9 h-9 rounded-xl ring-4 flex items-center justify-center flex-shrink-0 ${TONES[meta.tone]}`}>
          <Icon size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-900">{meta.label}</span>
            {row.customer_name && <span className="badge bg-slate-100 text-slate-600 font-medium">{row.customer_name}</span>}
            {row.amount != null && <span className="text-sm font-bold text-slate-800 tabular-nums">{formatPHP(row.amount)}</span>}
          </div>
          {row.summary && <div className="text-xs text-slate-500 mt-0.5 truncate">{row.summary}</div>}
          <div className="text-[11px] text-slate-400 mt-1">
            {when.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}
            {row.actor ? ` · by ${row.actor}` : ''}
          </div>
        </div>
        {changes.length > 0 && (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 mt-1 flex-shrink-0">
            {changes.length} change{changes.length === 1 ? '' : 's'}
            <ChevronDown size={14} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          </span>
        )}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="ml-[68px] mr-5 mb-3.5 rounded-xl border border-slate-100 bg-slate-50/60 divide-y divide-slate-100">
              {changes.map((c, i) => (
                <div key={i} className="grid grid-cols-[140px_1fr] gap-3 px-4 py-2.5 text-xs">
                  <span className="font-semibold text-slate-500">{c.field}</span>
                  <span className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="px-2 py-0.5 rounded-md bg-red-50 text-red-700 line-through decoration-red-300 break-all">{showValue(c.from, c.type)}</span>
                    <ArrowRight size={12} className="text-slate-400 flex-shrink-0" />
                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-semibold break-all">{showValue(c.to, c.type)}</span>
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function ActivityLog() {
  const [category, setCategory] = useState('all')
  const [action, setAction]     = useState('all')
  const [query, setQuery]       = useState('')
  const [from, setFrom]         = useState('')
  const [to, setTo]             = useState('')
  const [counts, setCounts]     = useState(null)

  const params = useMemo(() => ({ category, action, search: query.trim(), from, to }), [category, action, query, from, to])
  const paged = usePaged('activity:getPage', params, { sizeKey: 'ct-size-activity', defaultSize: 50, debounce: query ? 220 : 0 })

  const loadCounts = useCallback(() => window.electron.invoke('activity:counts').then(setCounts).catch(() => {}), [])
  useEffect(() => { loadCounts() }, [loadCounts])

  const actionOptions = useMemo(() => [
    { value: 'all', label: 'All actions' },
    ...Object.entries(ACTION_META)
      .filter(([, m]) => category === 'all' || m.category === category)
      .map(([value, m]) => ({ value, label: m.label, icon: m.icon }))
  ], [category])

  function pickCategory(key) {
    setCategory(key)
    setAction('all')
  }

  // Group the page's rows under day headings
  const groups = useMemo(() => {
    const out = []
    for (const row of paged.rows) {
      const d = parseSqliteTime(row.created_at)
      const key = d.toDateString()
      if (!out.length || out[out.length - 1].key !== key) out.push({ key, label: dayLabel(d), rows: [] })
      out[out.length - 1].rows.push(row)
    }
    return out
  }, [paged.rows])

  const hasFilters = action !== 'all' || query || from || to
  let index = 0

  return (
    <div className="page-container">
      {/* Category chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {CATEGORIES.map(c => (
          <button
            key={c.key}
            onClick={() => pickCategory(c.key)}
            className={`relative px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${category === c.key ? 'text-white' : 'text-slate-600 bg-white border border-slate-200 hover:border-slate-300'}`}
          >
            {category === c.key && (
              <motion.span layoutId="log-cat" className="absolute inset-0 rounded-xl bg-blue-600 shadow-md shadow-blue-600/25" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />
            )}
            <span className="relative flex items-center gap-2">
              {c.label}
              {counts && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md tabular-nums ${category === c.key ? 'bg-glass/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  {(counts[c.key] || 0).toLocaleString()}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="card p-4 grid grid-cols-1 lg:grid-cols-[1fr_220px_auto] gap-3 items-end">
        <div className="relative">
          <label className="field-label">Search</label>
          <Search size={15} className="absolute left-3.5 bottom-3 text-slate-400" />
          <input className="input-field pl-9 pr-9" placeholder="Customer, details, or who made the change…" value={query} onChange={e => setQuery(e.target.value)} />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-2.5 bottom-2 p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"><X size={13} /></button>
          )}
        </div>
        <div>
          <label className="field-label">Action</label>
          <Select value={action} onChange={setAction} options={actionOptions} icon={Filter} menuMinWidth={240} ariaLabel="Filter by action" />
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label className="field-label">From</label>
            <input type="date" className="input-field" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="field-label">To</label>
            <input type="date" className="input-field" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          {hasFilters && (
            <button onClick={() => { setAction('all'); setQuery(''); setFrom(''); setTo('') }} className="btn-ghost !py-2.5 hover:!text-red-500" title="Clear filters">
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="card overflow-hidden">
        <div className={`overflow-y-auto max-h-[calc(100vh-410px)] min-h-[260px] transition-opacity ${paged.loading && paged.loaded ? 'opacity-50' : ''}`}>
          {!paged.loaded ? (
            <div className="p-5 space-y-4">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="flex gap-3.5 items-center">
                  <div className="skeleton w-9 h-9 !rounded-xl" />
                  <div className="flex-1 space-y-2"><div className="skeleton h-3 w-1/3" /><div className="skeleton h-2.5 w-2/3" /></div>
                </div>
              ))}
            </div>
          ) : paged.rows.length === 0 ? (
            <div className="py-20 text-center">
              <ScrollText size={30} className="mx-auto text-slate-300" />
              <div className="text-sm font-medium text-slate-500 mt-3">{hasFilters || category !== 'all' ? 'No activity matches these filters.' : 'No activity yet. Changes you make will appear here.'}</div>
            </div>
          ) : groups.map(g => (
            <div key={g.key}>
              <div className="sticky top-0 z-10 flex items-center gap-2 px-5 py-2 bg-slate-50/95 backdrop-blur border-y border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <CalendarRange size={12} /> {g.label}
                <span className="font-semibold normal-case tracking-normal text-slate-400">· {g.rows.length} event{g.rows.length === 1 ? '' : 's'}</span>
              </div>
              <div className="divide-y divide-slate-50">
                {g.rows.map(row => <LogEntry key={row.id} row={row} index={index++} />)}
              </div>
            </div>
          ))}
        </div>
        {paged.loaded && paged.total > 0 && (
          <Pagination
            page={paged.page}
            pageSize={paged.pageSize}
            total={paged.total}
            onPageChange={paged.setPage}
            onPageSizeChange={paged.setPageSize}
            loading={paged.loading}
            label="events"
            layoutId="log-page"
          />
        )}
      </div>
    </div>
  )
}
