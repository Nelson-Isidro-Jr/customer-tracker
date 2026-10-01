import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import Select from './Select'

// 1 … 4 5 [6] 7 8 … 40
function pageList(page, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
  const out = [1]
  const start = Math.max(2, page - 1)
  const end = Math.min(totalPages - 1, page + 1)
  if (start > 2) out.push('…a')
  for (let i = start; i <= end; i++) out.push(i)
  if (end < totalPages - 1) out.push('…b')
  out.push(totalPages)
  return out
}

export default function Pagination({
  page, pageSize, total, onPageChange, onPageSizeChange,
  pageSizes = [25, 50, 100], loading = false, label = 'records', layoutId = 'page-pill'
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  const go = p => { if (p >= 1 && p <= totalPages && p !== page) onPageChange(p) }
  const navBtn = 'w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors disabled:opacity-30 disabled:pointer-events-none'

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap border-t border-slate-100 px-5 py-3 bg-slate-50/50">
      <div className="flex items-center gap-3 text-xs text-slate-500">
        <span>
          Showing <span className="font-semibold text-slate-700 tabular-nums">{from.toLocaleString()}</span>–
          <span className="font-semibold text-slate-700 tabular-nums">{to.toLocaleString()}</span> of{' '}
          <span className="font-semibold text-slate-700 tabular-nums">{total.toLocaleString()}</span> {label}
        </span>
        {onPageSizeChange && (
          <div className="w-[136px]">
            <Select
              size="sm"
              value={pageSize}
              onChange={onPageSizeChange}
              menuMinWidth={130}
              ariaLabel="Rows per page"
              options={pageSizes.map(n => ({ value: n, label: `${n} per page` }))}
            />
          </div>
        )}
      </div>

      <div className={`flex items-center gap-1 transition-opacity ${loading ? 'opacity-60' : ''}`}>
        <button onClick={() => go(1)} disabled={page <= 1} className={navBtn} title="First page"><ChevronsLeft size={15} /></button>
        <button onClick={() => go(page - 1)} disabled={page <= 1} className={navBtn} title="Previous page"><ChevronLeft size={15} /></button>
        {pageList(page, totalPages).map(p =>
          typeof p === 'string' ? (
            <span key={p} className="w-8 text-center text-xs text-slate-400 select-none">…</span>
          ) : (
            <button
              key={p}
              onClick={() => go(p)}
              className={`relative min-w-[32px] h-8 px-2 rounded-lg text-xs font-semibold tabular-nums transition-colors ${
                p === page ? 'text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {p === page && (
                <motion.span
                  layoutId={layoutId}
                  className="absolute inset-0 rounded-lg bg-blue-600 shadow-sm shadow-blue-600/30"
                  transition={{ type: 'spring', stiffness: 520, damping: 38 }}
                />
              )}
              <span className="relative">{p}</span>
            </button>
          )
        )}
        <button onClick={() => go(page + 1)} disabled={page >= totalPages} className={navBtn} title="Next page"><ChevronRight size={15} /></button>
        <button onClick={() => go(totalPages)} disabled={page >= totalPages} className={navBtn} title="Last page"><ChevronsRight size={15} /></button>
      </div>
    </div>
  )
}
