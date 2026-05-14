import { NavLink, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, Users, Receipt, BarChart2,
  Database, ChevronRight, TrendingUp, Settings, History
} from 'lucide-react'
import { useSettings } from '../context/SettingsContext'

const NAV = [
  { to: '/',             label: 'Dashboard',    icon: LayoutDashboard, end: true },
  { to: '/customers',    label: 'Customers',    icon: Users },
  { to: '/transactions', label: 'Transactions', icon: Receipt },
  { to: '/history',      label: 'History',      icon: History },
  { to: '/reports',      label: 'Reports',      icon: BarChart2 },
  { to: '/data',         label: 'Import / Export', icon: Database },
]

function Sidebar() {
  const { settings } = useSettings()
  const name = settings?.userName || 'Nelson Isidro'
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <aside className="w-60 flex-shrink-0 bg-[#0B1120] flex flex-col h-full select-none">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
            <TrendingUp size={18} className="text-white" />
          </div>
          <div>
            <div className="text-white font-bold text-sm leading-tight">Customer</div>
            <div className="text-blue-400 font-semibold text-xs tracking-wider uppercase">Tracker</div>
          </div>
        </div>
      </div>

      {/* Main Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="text-slate-600 text-[10px] font-semibold uppercase tracking-widest px-3 mb-2">Menu</p>
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `group flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-150 ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className="flex items-center gap-3">
                  <Icon size={17} className={isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'} />
                  <span className="text-sm font-medium">{label}</span>
                </div>
                {isActive && <ChevronRight size={14} className="opacity-60" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom section: Settings + user */}
      <div className="px-3 py-3 border-t border-white/5 space-y-1">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 ${
              isActive
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Settings size={17} className={isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'} />
              <span className="text-sm font-medium">Settings</span>
            </>
          )}
        </NavLink>

        <div className="flex items-center gap-3 px-3 py-2.5">
          <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center flex-shrink-0">
            <span className="text-blue-400 text-xs font-bold">{initials}</span>
          </div>
          <div className="min-w-0">
            <div className="text-white text-xs font-semibold truncate">{name}</div>
          </div>
        </div>
      </div>
    </aside>
  )
}

const PAGE_TITLES = {
  '/': 'Dashboard',
  '/customers': 'Customers',
  '/transactions': 'Transactions',
  '/history': 'Activity History',
  '/reports': 'Reports',
  '/data': 'Import / Export',
  '/settings': 'Settings'
}

export default function Layout({ children }) {
  const location = useLocation()
  const { settings } = useSettings()
  const base = '/' + location.pathname.split('/')[1]
  const title = PAGE_TITLES[base] || PAGE_TITLES[location.pathname] || 'Customer Tracker'

  return (
    <div className="flex h-screen bg-[#F1F5F9] overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex-shrink-0">
          <div className="flex items-center gap-2 text-slate-400">
            <span className="text-xs font-medium">{settings?.userName || 'Nelson Isidro'}</span>
            <ChevronRight size={12} />
            <span className="text-xs font-semibold text-slate-700">{title}</span>
          </div>
          <h1 className="text-lg font-bold text-slate-900 mt-0.5">{title}</h1>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-hidden">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22 }}
            className="h-full"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  )
}
