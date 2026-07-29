import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  History as HistoryIcon, UserPlus, UserCog, UserX,
  Plus, Edit, Trash2, Filter, Gift, Award, Undo2, Settings2
} from 'lucide-react'
import Pagination from '../components/Pagination'
import { useToast } from '../context/ToastContext'
import { formatPHP, formatRecordedAt } from '../utils/format'
import { Page, Pop, PopGrid } from '../components/Cascade'

const ACTION_META = {
  customer_added:      { label: 'Customer Added',     icon: UserPlus,  color: 'emerald' },
  customer_edited:     { label: 'Customer Edited',    icon: UserCog,   color: 'blue'    },
  customer_deleted:    { label: 'Customer Deleted',   icon: UserX,     color: 'red'     },
  transaction_added:   { label: 'Transaction Added',  icon: Plus,      color: 'emerald' },
  transaction_edited:  { label: 'Transaction Edited', icon: Edit,      color: 'blue'    },
  transaction_deleted: { label: 'Transaction Deleted',icon: Trash2,    color: 'red'     },
  reward_added:        { label: 'Reward Added',       icon: Gift,      color: 'emerald' },
  reward_edited:       { label: 'Reward Edited',      icon: Edit,      color: 'blue'    },
  reward_deleted:      { label: 'Reward Deleted',     icon: Trash2,    color: 'red'     },
  reward_redeemed:     { label: 'Reward Redeemed',    icon: Award,     color: 'amber'   },
  redemption_voided:   { label: 'Redemption Voided',  icon: Undo2,     color: 'red'     },
  points_config_changed:{label: 'Points Settings',    icon: Settings2, color: 'amber'   }
}

const FILTER_OPTIONS = [
  { value: 'all',                 label: 'All activity' },
  { value: 'transaction_added',   label: 'Transactions added' },
  { value: 'transaction_edited',  label: 'Transactions edited' },
  { value: 'transaction_deleted', label: 'Transactions deleted' },
  { value: 'customer_added',      label: 'Customers added' },
  { value: 'customer_edited',     label: 'Customers edited' },
  { value: 'customer_deleted',    label: 'Customers deleted' },
  { value: 'reward_redeemed',     label: 'Rewards redeemed' },
  { value: 'redemption_voided',   label: 'Redemptions voided' },
  { value: 'reward_added',        label: 'Rewards added' },
  { value: 'reward_edited',       label: 'Rewards edited' },
  { value: 'reward_deleted',      label: 'Rewards deleted' },
  { value: 'points_config_changed', label: 'Points settings changes' }
]

const COLORS = {
  emerald: { badge: 'bg-emerald-50 text-emerald-700', icon: 'bg-emerald-100 text-emerald-700' },
  blue:    { badge: 'bg-blue-50 text-blue-700',       icon: 'bg-blue-100 text-blue-700' },
  red:     { badge: 'bg-red-50 text-red-700',         icon: 'bg-red-100 text-red-700' },
  amber:   { badge: 'bg-amber-50 text-amber-700',     icon: 'bg-amber-100 text-amber-700' }
}

const PAGE_SIZE = 50

export default function History() {
  const { showToast } = useToast()
  const [page, setPage]       = useState(1)
  const [action, setAction]   = useState('all')
  const [rows, setRows]       = useState([])
  const [total, setTotal]     = useState(0)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await window.electron.invoke('activity:getPage', {
        page, pageSize: PAGE_SIZE, action
      })
      setRows(res.rows)
      setTotal(res.total)
    } catch (err) {
      showToast(err?.message || 'Failed to load history', 'error')
    } finally { setLoading(false) }
  }, [page, action, showToast])

  useEffect(() => { load() }, [load])

  // Reset to page 1 alongside the filter change, so only one fetch is issued.
  const changeAction = (v) => { setAction(v); setPage(1) }

  return (
    <Page>
      {/* Toolbar */}
      <Pop className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Filter size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <select
              className="input-field pl-9 pr-8 cursor-pointer"
              value={action}
              onChange={e => changeAction(e.target.value)}
            >
              {FILTER_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <HistoryIcon size={14} className="text-slate-400" />
          <span className="text-slate-500">{total} total events</span>
        </div>
      </Pop>

      {/* Table */}
      <Pop
        className="card overflow-hidden"
      >
        <div className="overflow-x-auto max-h-[calc(100vh-260px)] overflow-y-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-white z-10">
              <tr>
                <th className="table-header">When</th>
                <th className="table-header">Action</th>
                <th className="table-header">Customer</th>
                <th className="table-header">Detail</th>
                <th className="table-header text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-400 text-sm">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-slate-400 text-sm">
                    {action === 'all'
                      ? 'No activity yet. Add a customer or transaction to start the log.'
                      : 'No events of this type.'}
                  </td>
                </tr>
              ) : rows.map((r, i) => {
                const meta = ACTION_META[r.action] || { label: r.action, icon: HistoryIcon, color: 'blue' }
                const Icon = meta.icon
                const colors = COLORS[meta.color]
                return (
                  <tr
                    key={r.id}
                    className="hover:bg-slate-50/60 transition-colors"
                  >
                    <td className="table-cell text-slate-400 whitespace-nowrap text-xs">
                      {formatRecordedAt(r.created_at)}
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center ${colors.icon}`}>
                          <Icon size={13} />
                        </div>
                        <span className={`badge ${colors.badge}`}>{meta.label}</span>
                      </div>
                    </td>
                    <td className="table-cell font-medium text-slate-800">
                      {r.customer_name || <span className="text-slate-300">—</span>}
                    </td>
                    <td className="table-cell text-slate-500">
                      {r.summary || <span className="text-slate-300">—</span>}
                    </td>
                    <td className="table-cell text-right font-bold text-slate-900 whitespace-nowrap">
                      {r.amount != null ? formatPHP(r.amount) : <span className="text-slate-300">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
          loading={loading}
          onPageChange={setPage}
        />
      </Pop>
    </Page>
  )
}
