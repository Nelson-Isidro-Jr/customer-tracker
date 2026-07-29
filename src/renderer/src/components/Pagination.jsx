import { ChevronLeft, ChevronRight } from 'lucide-react'

const SIZES = [25, 50, 100, 200]

/**
 * Footer for every server-paginated table. `total` is the count of ALL matching
 * rows, not just the ones on screen.
 */
export default function Pagination({
  page, pageSize, total, loading, onPageChange, onPageSizeChange, children
}) {
  if (total === 0) return null

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = (page - 1) * pageSize + 1
  const to   = Math.min(page * pageSize, total)

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap border-t border-slate-100 px-5 py-3 bg-slate-50/50">
      <div className="flex items-center gap-4">
        <div className="text-xs text-slate-500">
          Showing <span className="font-semibold text-slate-700">{from}</span>
          –<span className="font-semibold text-slate-700">{to}</span>
          {' '}of <span className="font-semibold text-slate-700">{total.toLocaleString('en-PH')}</span>
        </div>
        {onPageSizeChange && (
          <select
            className="text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg px-2 py-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={pageSize}
            onChange={e => onPageSizeChange(Number(e.target.value))}
            title="Rows per page"
          >
            {SIZES.map(s => <option key={s} value={s}>{s} / page</option>)}
          </select>
        )}
        {children}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1 || loading}
          className="btn-ghost !px-2 !py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          title="Previous page"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-xs font-semibold text-slate-700 px-2 whitespace-nowrap">
          Page {page} of {totalPages}
        </span>
        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages || loading}
          className="btn-ghost !px-2 !py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          title="Next page"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}
