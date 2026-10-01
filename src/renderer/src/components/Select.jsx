import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Check } from 'lucide-react'

// Keeps a floating panel anchored under (or above) its trigger, rendered in a
// portal so it is never clipped by modals or scroll containers.
export function useAnchoredPanel(open, triggerRef, { minWidth = 0, maxHeight = 300, gap = 6 } = {}) {
  const [pos, setPos] = useState(null)
  const update = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const below = window.innerHeight - r.bottom - gap - 8
    const above = r.top - gap - 8
    const flip = below < Math.min(maxHeight, 220) && above > below
    const width = Math.max(r.width, minWidth)
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8)
    setPos({
      left,
      width,
      top: flip ? undefined : r.bottom + gap,
      bottom: flip ? window.innerHeight - r.top + gap : undefined,
      maxHeight: Math.max(160, Math.min(maxHeight, flip ? above : below)),
      flip
    })
  }, [triggerRef, minWidth, maxHeight, gap])

  useLayoutEffect(() => { if (open) update() }, [open, update])
  useEffect(() => {
    if (!open) return
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open, update])
  return pos
}

export function useOutsideClose(open, refs, onClose) {
  useEffect(() => {
    if (!open) return
    const onDown = e => {
      if (refs.some(r => r.current?.contains(e.target))) return
      onClose()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open, refs, onClose])
}

export function FloatingPanel({ pos, open, panelRef, children, className = '' }) {
  return createPortal(
    <AnimatePresence>
      {open && pos && (
        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, y: pos.flip ? 6 : -6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: pos.flip ? 6 : -6, scale: 0.98 }}
          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          style={{ position: 'fixed', left: pos.left, top: pos.top, bottom: pos.bottom, width: pos.width, zIndex: 10000 }}
          className={`bg-white border border-slate-200 rounded-2xl shadow-2xl shadow-slate-900/10 overflow-hidden ${pos.flip ? 'origin-bottom' : 'origin-top'} ${className}`}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}

const SIZES = {
  sm: 'px-3 py-1.5 text-xs rounded-lg',
  md: 'px-4 py-2.5 text-sm rounded-xl'
}

// Themed replacement for <select>. options: [{ value, label, description?, icon? }]
export default function Select({
  value, onChange, options, placeholder = 'Select…', icon: LeadIcon,
  size = 'md', className = '', menuMinWidth = 200, disabled = false, ariaLabel
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const triggerRef = useRef(null)
  const panelRef = useRef(null)
  const listRef = useRef(null)
  const typed = useRef({ text: '', at: 0 })
  const selected = options.find(o => o.value === value)
  const pos = useAnchoredPanel(open, triggerRef, { minWidth: menuMinWidth })
  const close = useCallback(() => setOpen(false), [])
  useOutsideClose(open, [triggerRef, panelRef], close)

  useEffect(() => {
    if (open) setActive(Math.max(0, options.findIndex(o => o.value === value)))
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open) listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  function choose(o) {
    onChange(o.value)
    setOpen(false)
    triggerRef.current?.focus()
  }

  function onKeyDown(e) {
    if (disabled) return
    if (!open && ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); setOpen(true); return }
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(options.length - 1, a + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(0, a - 1)) }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0) }
    else if (e.key === 'End') { e.preventDefault(); setActive(options.length - 1) }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (options[active]) choose(options[active]) }
    else if (e.key === 'Escape' || e.key === 'Tab') setOpen(false)
    else if (e.key.length === 1) {
      const now = Date.now()
      typed.current = { text: (now - typed.current.at < 600 ? typed.current.text : '') + e.key.toLowerCase(), at: now }
      const i = options.findIndex(o => String(o.label).toLowerCase().startsWith(typed.current.text))
      if (i >= 0) setActive(i)
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen(o => !o)}
        onKeyDown={onKeyDown}
        className={`group w-full flex items-center gap-2 bg-white border text-slate-800 text-left transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/60 disabled:opacity-50 disabled:cursor-not-allowed ${
          open ? 'border-blue-400 ring-2 ring-blue-500/30' : 'border-slate-200 hover:border-slate-300'
        } ${SIZES[size]} ${className}`}
      >
        {LeadIcon && <LeadIcon size={size === 'sm' ? 13 : 15} className="text-slate-400 flex-shrink-0" />}
        {selected?.icon && <selected.icon size={size === 'sm' ? 13 : 15} className="text-slate-500 flex-shrink-0" />}
        <span className={`flex-1 truncate ${selected ? '' : 'text-slate-400'}`}>{selected ? selected.label : placeholder}</span>
        <ChevronDown
          size={size === 'sm' ? 13 : 15}
          className={`text-slate-400 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180 text-blue-500' : ''}`}
        />
      </button>

      <FloatingPanel open={open} pos={pos} panelRef={panelRef}>
        <div ref={listRef} role="listbox" className="overflow-y-auto p-1.5" style={{ maxHeight: pos?.maxHeight }}>
          {options.map((o, i) => {
            const isSel = o.value === value
            const Icon = o.icon
            return (
              <button
                key={String(o.value)}
                type="button"
                role="option"
                aria-selected={isSel}
                data-index={i}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(o)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-sm transition-colors ${
                  i === active ? 'bg-blue-50' : ''
                } ${isSel ? 'text-blue-700 font-semibold' : 'text-slate-700'}`}
              >
                {Icon && <Icon size={15} className={isSel ? 'text-blue-600' : 'text-slate-400'} />}
                <span className="flex-1 min-w-0">
                  <span className="block truncate">{o.label}</span>
                  {o.description && <span className="block text-[11px] font-normal text-slate-400 truncate">{o.description}</span>}
                </span>
                {isSel && <Check size={15} className="text-blue-600 flex-shrink-0" />}
              </button>
            )
          })}
        </div>
      </FloatingPanel>
    </>
  )
}
