import { useState, useRef, useEffect, useCallback } from 'react'
import { Search, ChevronsUpDown, Check, Loader2, Star } from 'lucide-react'
import Avatar from './Avatar'
import { useAnchoredPanel, useOutsideClose, FloatingPanel } from './Select'
import { formatPHP } from '../utils/format'

// Searchable customer picker that queries the database as you type, so it
// stays instant with thousands of customers. value / onChange use the
// customer object ({ id, full_name, … }).
export default function CustomerPicker({ value, onChange, placeholder = 'Search for a customer…', showPoints = false, autoOpen = false }) {
  const [open, setOpen] = useState(autoOpen)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(0)
  const triggerRef = useRef(null)
  const panelRef = useRef(null)
  const listRef = useRef(null)
  const req = useRef(0)
  const pos = useAnchoredPanel(open, triggerRef, { minWidth: 320, maxHeight: 380 })
  const close = useCallback(() => setOpen(false), [])
  useOutsideClose(open, [triggerRef, panelRef], close)

  useEffect(() => {
    if (!open) return
    const id = ++req.current
    setLoading(true)
    const t = setTimeout(() => {
      window.electron.invoke('customers:searchLite', { query, limit: 40 })
        .then(rows => { if (id === req.current) { setResults(rows); setActive(0) } })
        .finally(() => { if (id === req.current) setLoading(false) })
    }, query ? 160 : 0)
    return () => clearTimeout(t)
  }, [query, open])

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  function choose(c) {
    onChange(c)
    setOpen(false)
    setQuery('')
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(results.length - 1, a + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(0, a - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (results[active]) choose(results[active]) }
    else if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-3 bg-white border rounded-xl px-3 py-2 text-left transition-all ${
          open ? 'border-blue-400 ring-2 ring-blue-500/30' : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        {value ? (
          <>
            <Avatar name={value.full_name} size={30} />
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-semibold text-slate-900 truncate">{value.full_name}</span>
              <span className="block text-[11px] text-slate-400 truncate">
                {showPoints && value.points_balance != null
                  ? `${value.points_balance.toLocaleString()} points · ${formatPHP(value.total_purchases)} spent`
                  : value.email || value.phone || 'No contact details'}
              </span>
            </span>
          </>
        ) : (
          <span className="flex-1 flex items-center gap-2 text-sm text-slate-400 py-1.5">
            <Search size={15} /> {placeholder}
          </span>
        )}
        <ChevronsUpDown size={15} className="text-slate-400 flex-shrink-0" />
      </button>

      <FloatingPanel open={open} pos={pos} panelRef={panelRef}>
        <div className="relative border-b border-slate-100">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Name, email, or phone"
            className="w-full bg-transparent pl-10 pr-10 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
          />
          {loading && <Loader2 size={15} className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-500 animate-spin" />}
        </div>
        <div ref={listRef} className="overflow-y-auto p-1.5" style={{ maxHeight: (pos?.maxHeight || 380) - 48 }}>
          {results.length === 0 && !loading ? (
            <div className="px-3 py-8 text-center text-sm text-slate-400">
              {query ? `No customers match “${query}”.` : 'No customers yet.'}
            </div>
          ) : results.map((c, i) => (
            <button
              key={c.id}
              type="button"
              data-index={i}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(c)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-colors ${i === active ? 'bg-blue-50' : ''}`}
            >
              <Avatar name={c.full_name} size={30} />
              <span className="flex-1 min-w-0">
                <span className={`block text-sm font-medium truncate ${i === active ? 'text-blue-700' : 'text-slate-800'}`}>{c.full_name}</span>
                <span className="block text-[11px] text-slate-400 truncate">
                  {[c.email || c.phone, `${formatPHP(c.total_purchases)} spent`].filter(Boolean).join(' · ')}
                </span>
              </span>
              {showPoints && (
                <span className="flex items-center gap-1 text-xs font-semibold text-amber-600 tabular-nums">
                  <Star size={12} className="fill-amber-400 text-amber-400" />{c.points_balance.toLocaleString()}
                </span>
              )}
              {value?.id === c.id && <Check size={15} className="text-blue-600" />}
            </button>
          ))}
        </div>
      </FloatingPanel>
    </>
  )
}
