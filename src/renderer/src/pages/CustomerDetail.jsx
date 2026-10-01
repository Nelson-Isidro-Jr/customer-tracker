import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Mail, Phone, Plus, Trash2, Edit, ShoppingBag, DollarSign, Calendar,
  TrendingUp, FileText, Star, Gift, SlidersHorizontal, Receipt, MinusCircle, PlusCircle
} from 'lucide-react'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import Pagination from '../components/Pagination'
import Avatar from '../components/Avatar'
import AnimatedNumber from '../components/AnimatedNumber'
import { AddTransactionModal, EditTransactionModal } from '../components/TransactionForms'
import { AdjustPointsModal } from '../components/RewardForms'
import { CustomerForm } from './Customers'
import { SkeletonRows } from './Transactions'
import { useToast } from '../context/ToastContext'
import usePaged from '../hooks/usePaged'
import { formatPHP, formatNumber, formatDate, formatDateShort, formatRecordedAt } from '../utils/format'

export default function CustomerDetail() {
  const { id } = useParams()
  const customerId = parseInt(id)
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [customer, setCustomer]             = useState(null)
  const [points, setPoints]                 = useState(null)
  const [pointsLog, setPointsLog]           = useState([])
  const [addTxnOpen, setAddTxnOpen]         = useState(false)
  const [editTxnTarget, setEditTxnTarget]   = useState(null)
  const [editOpen, setEditOpen]             = useState(false)
  const [adjustOpen, setAdjustOpen]         = useState(false)
  const [deleteTxn, setDeleteTxn]           = useState(null)
  const [deleteCustomer, setDeleteCustomer] = useState(false)
  const [saving, setSaving]                 = useState(false)

  const params = useMemo(() => ({ customerId }), [customerId])
  const paged = usePaged('transactions:page', params, { sizeKey: 'ct-size-customer-txns', defaultSize: 25 })

  const loadCustomer = useCallback(async () => {
    const [c, p, log] = await Promise.all([
      window.electron.invoke('customers:getById', customerId),
      window.electron.invoke('rewards:customerPoints', customerId).catch(() => null),
      window.electron.invoke('rewards:pointsHistory', customerId).catch(() => [])
    ])
    if (!c) { navigate('/customers'); return }
    setCustomer(c)
    setPoints(p)
    setPointsLog(log)
  }, [customerId, navigate])

  useEffect(() => { loadCustomer() }, [loadCustomer])

  function refresh() {
    loadCustomer()
    paged.reload()
  }

  async function handleDeleteTxn() {
    try {
      await window.electron.invoke('transactions:delete', deleteTxn.id)
      showToast('Transaction deleted', 'info')
      setDeleteTxn(null)
      refresh()
    } catch (err) { showToast(err?.message || 'Failed to delete', 'error') }
  }

  async function handleDeleteCustomer() {
    try {
      await window.electron.invoke('customers:delete', customerId)
      showToast('Customer deleted', 'info')
      navigate('/customers')
    } catch (err) { showToast(err?.message || 'Failed to delete customer', 'error') }
  }

  async function handleEdit(form) {
    setSaving(true)
    try {
      await window.electron.invoke('customers:update', { id: customerId, data: form })
      showToast('Customer updated!', 'success')
      setEditOpen(false)
      loadCustomer()
    } catch (err) { showToast(err?.message || 'Failed to update customer', 'error') }
    finally { setSaving(false) }
  }

  if (!customer) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const avgTxn = customer.transaction_count ? customer.total_purchases / customer.transaction_count : 0
  const progress = points ? Math.min(100, ((points.rate - points.toNextPoint) / points.rate) * 100) : 0

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/customers')} className="btn-ghost !px-2 !py-2" title="Back to customers">
            <ArrowLeft size={18} />
          </button>
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-4">
            <Avatar name={customer.full_name} size={56} square className="shadow-lg" />
            <div>
              <h2 className="text-xl font-bold text-slate-900">{customer.full_name}</h2>
              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                {customer.email && <span className="flex items-center gap-1.5 text-xs text-slate-500"><Mail size={11} />{customer.email}</span>}
                {customer.phone && <span className="flex items-center gap-1.5 text-xs text-slate-500"><Phone size={11} />{customer.phone}</span>}
                {!customer.email && !customer.phone && <span className="text-xs text-slate-400">No contact info</span>}
                <span className="text-xs text-slate-400">· Customer since {formatDateShort(String(customer.created_at || '').slice(0, 10))}</span>
              </div>
            </div>
          </motion.div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={() => setEditOpen(true)} className="btn-secondary"><Edit size={15} /> Edit</button>
          <button onClick={() => setDeleteCustomer(true)} className="btn-ghost hover:!text-red-500" title="Delete customer"><Trash2 size={15} /></button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Spent', value: customer.total_purchases, format: formatPHP, icon: DollarSign, color: 'text-blue-600 bg-blue-50' },
          { label: 'Transactions', value: customer.transaction_count, format: v => formatNumber(Math.round(v)), icon: ShoppingBag, color: 'text-emerald-600 bg-emerald-50' },
          { label: 'Avg per Transaction', value: avgTxn, format: formatPHP, icon: TrendingUp, color: 'text-amber-600 bg-amber-50' },
          { label: 'Last Purchase', text: formatDateShort(customer.last_purchase), icon: Calendar, color: 'text-violet-600 bg-violet-50' }
        ].map(({ label, value, format, text, icon: Icon, color }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            whileHover={{ y: -2 }}
            className="card p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${color}`}><Icon size={14} /></div>
              <span className="text-xs text-slate-500">{label}</span>
            </div>
            <div className="text-base font-bold text-slate-900">{text ?? <AnimatedNumber value={value} format={format} />}</div>
          </motion.div>
        ))}
      </div>

      {/* Rewards */}
      {points && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-4"
        >
          <div className="relative overflow-hidden rounded-2xl p-5 text-white bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-orange-500/20">
            <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-glass/10 blur-xl" />
            <div className="relative flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-white/80">Reward points</span>
              <Star size={18} className="fill-white/90 text-white/90" />
            </div>
            <div className="relative text-4xl font-extrabold mt-2 tabular-nums"><AnimatedNumber value={points.balance} format={v => formatNumber(Math.round(v))} /></div>
            <div className="relative text-xs text-white/80 mt-1">
              {formatNumber(points.earned)} earned{points.adjusted ? ` · ${points.adjusted > 0 ? '+' : ''}${formatNumber(points.adjusted)} adjusted` : ''} · {formatNumber(points.redeemed)} redeemed
            </div>
            <div className="relative mt-4">
              <div className="h-1.5 rounded-full bg-glass/25 overflow-hidden">
                <motion.div className="h-full rounded-full bg-glass" initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} />
              </div>
              <div className="text-[11px] text-white/80 mt-1.5">{formatPHP(points.toNextPoint)} more to the next point (₱{formatNumber(points.rate)} = 1 point)</div>
            </div>
            <div className="relative flex gap-2 mt-4">
              <button onClick={() => navigate(`/rewards?customer=${customer.id}`)} className="flex-1 inline-flex items-center justify-center gap-1.5 bg-glass text-[#c2410c] text-xs font-bold rounded-lg py-2 hover:bg-glass/90 transition-colors">
                <Gift size={13} /> Redeem prize
              </button>
              <button onClick={() => setAdjustOpen(true)} className="flex-1 inline-flex items-center justify-center gap-1.5 bg-glass/15 text-white text-xs font-bold rounded-lg py-2 hover:bg-glass/25 transition-colors">
                <SlidersHorizontal size={13} /> Adjust
              </button>
            </div>
          </div>

          <div className="card lg:col-span-2 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Points activity</h3>
              <span className="text-xs text-slate-400">Claims and manual adjustments</span>
            </div>
            <div className="max-h-[188px] overflow-y-auto divide-y divide-slate-50">
              {pointsLog.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-slate-400">No claims or adjustments yet. Points come from purchases automatically.</div>
              ) : pointsLog.map(h => (
                <div key={`${h.kind}-${h.id}`} className="flex items-center gap-3 px-5 py-2.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${h.points >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                    {h.kind === 'redemption' ? <Gift size={14} /> : h.points >= 0 ? <PlusCircle size={14} /> : <MinusCircle size={14} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-800 truncate">
                      {h.kind === 'redemption' ? `Claimed ${h.quantity > 1 ? `${h.quantity} × ` : ''}${h.label}` : (h.label || 'Manual adjustment')}
                    </div>
                    <div className="text-[11px] text-slate-400">{formatRecordedAt(h.created_at)}</div>
                  </div>
                  <span className={`text-sm font-bold tabular-nums ${h.points >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{h.points > 0 ? '+' : ''}{formatNumber(h.points)}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Notes */}
      {customer.notes && (
        <div className="card p-4 flex gap-3">
          <FileText size={15} className="text-slate-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-slate-600">{customer.notes}</p>
        </div>
      )}

      {/* Transactions */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Transaction History</h3>
            <p className="text-xs text-slate-400 mt-0.5">{formatNumber(customer.transaction_count)} transactions · {formatPHP(customer.total_purchases)}</p>
          </div>
          <button onClick={() => setAddTxnOpen(true)} className="btn-primary !py-2 text-xs"><Plus size={14} /> Add Transaction</button>
        </div>
        <div className="overflow-auto max-h-[520px]">
          <table className="w-full">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="table-header">Date</th>
                <th className="table-header">Description</th>
                <th className="table-header text-right">Amount</th>
                <th className="table-header">Time Added</th>
                <th className="table-header text-right">Action</th>
              </tr>
            </thead>
            <tbody className={`divide-y divide-slate-50 transition-opacity ${paged.loading && paged.loaded ? 'opacity-50' : ''}`}>
              {!paged.loaded ? (
                <SkeletonRows cols={5} rows={5} />
              ) : paged.rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center">
                    <Receipt size={26} className="mx-auto text-slate-300" />
                    <div className="text-sm text-slate-400 mt-2">No transactions yet. Add the first one!</div>
                  </td>
                </tr>
              ) : paged.rows.map((t, i) => (
                <tr key={`${paged.page}-${t.id}`} className="hover:bg-slate-50/60 transition-colors animate-row-in" style={{ animationDelay: `${Math.min(i, 14) * 18}ms` }}>
                  <td className="table-cell font-medium text-slate-700 whitespace-nowrap">{formatDate(t.date)}</td>
                  <td className="table-cell text-slate-500">{t.description || <span className="text-slate-300">—</span>}</td>
                  <td className="table-cell text-right font-bold text-slate-900 tabular-nums">{formatPHP(t.amount)}</td>
                  <td className="table-cell text-slate-400 whitespace-nowrap text-xs">{formatRecordedAt(t.created_at)}</td>
                  <td className="table-cell text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setEditTxnTarget(t)} className="btn-ghost !px-2 !py-1 hover:!text-blue-600" title="Edit"><Edit size={14} /></button>
                      <button onClick={() => setDeleteTxn(t)} className="btn-ghost !px-2 !py-1 hover:!text-red-500" title="Delete"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {paged.loaded && paged.total > 0 && (
          <Pagination
            page={paged.page}
            pageSize={paged.pageSize}
            total={paged.total}
            onPageChange={paged.setPage}
            onPageSizeChange={paged.setPageSize}
            loading={paged.loading}
            label="transactions"
            layoutId="cust-txn-page"
          />
        )}
      </motion.div>

      {addTxnOpen && <AddTransactionModal customer={customer} onClose={() => setAddTxnOpen(false)} onSuccess={refresh} />}
      {editTxnTarget && <EditTransactionModal txn={{ ...editTxnTarget, customer_name: customer.full_name }} onClose={() => setEditTxnTarget(null)} onSuccess={refresh} />}
      {editOpen && (
        <Modal title="Edit Customer" onClose={() => setEditOpen(false)}>
          <CustomerForm initial={customer} onSubmit={handleEdit} onClose={() => setEditOpen(false)} loading={saving} />
        </Modal>
      )}
      {adjustOpen && points && (
        <AdjustPointsModal customer={customer} balance={points.balance} onClose={() => setAdjustOpen(false)} onSuccess={loadCustomer} />
      )}
      {deleteTxn && (
        <ConfirmDialog
          title="Delete Transaction"
          message={`Delete the ${formatPHP(deleteTxn.amount)} transaction on ${formatDate(deleteTxn.date)}? This cannot be undone.`}
          onConfirm={handleDeleteTxn}
          onCancel={() => setDeleteTxn(null)}
        />
      )}
      {deleteCustomer && (
        <ConfirmDialog
          title="Delete Customer"
          message={`Delete "${customer.full_name}" and all their ${customer.transaction_count} transaction(s) and reward history? This cannot be undone.`}
          onConfirm={handleDeleteCustomer}
          onCancel={() => setDeleteCustomer(false)}
        />
      )}
    </div>
  )
}
