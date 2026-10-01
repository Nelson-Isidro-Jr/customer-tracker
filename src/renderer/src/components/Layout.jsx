import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, Users, Receipt, BarChart2, Gift, ScrollText,
  Database, ChevronRight, TrendingUp, Settings, CalendarRange, Sun, Sunset, Moon
} from 'lucide-react'
import { useSettings } from '../context/SettingsContext'
import { UserAvatar } from './Avatar'
import { greetingFor } from '../greeting/messages'

const NAV = [
  {
    label: 'Menu',
    items: [
      { to: '/',             label: 'Dashboard',    icon: LayoutDashboard, end: true },
      { to: '/customers',    label: 'Customers',    icon: Users },
      { to: '/transactions', label: 'Transactions', icon: Receipt },
      { to: '/rewards',      label: 'Rewards',      icon: Gift }
    ]
  },
  {
    label: 'Reports',
    items: [
      { to: '/reports', label: 'Reports',       icon: BarChart2 },
      { to: '/yearly',  label: 'Yearly Report', icon: CalendarRange }
    ]
  },
  {
    label: 'System',
    items: [
      { to: '/activity', label: 'Activity Log',    icon: ScrollText },
      { to: '/data',     label: 'Import / Export', icon: Database }
    ]
  }
]

function NavItem({ to, label, icon: Icon, end }) {
  return (
    <NavLink to={to} end={end} className="group relative block">
      {({ isActive }) => (
        <div className={`relative flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors duration-150 ${
          isActive ? 'text-white' : 'text-sidebar-muted hover:text-sidebar-fg hover:bg-sidebar-fg/5'
        }`}>
          {isActive && (
            <motion.span
              layoutId="sidebar-active"
              className="absolute inset-0 rounded-xl bg-blue-600 shadow-lg shadow-blue-600/25"
              transition={{ type: 'spring', stiffness: 480, damping: 38 }}
            />
          )}
          <div className="relative flex items-center gap-3">
            <Icon size={17} className={isActive ? 'text-white' : 'text-sidebar-dim group-hover:text-sidebar-fg transition-colors'} />
            <span className="text-sm font-medium">{label}</span>
          </div>
          {isActive && <ChevronRight size={14} className="relative opacity-70" />}
        </div>
      )}
    </NavLink>
  )
}

function Sidebar() {
  const { settings } = useSettings()
  const navigate = useNavigate()
  const name = settings?.userName || 'Nelson Isidro'

  return (
    <aside className="w-60 flex-shrink-0 bg-sidebar flex flex-col h-full select-none">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-sidebar-fg/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/30">
            <TrendingUp size={18} className="text-white" />
          </div>
          <div>
            <div className="text-sidebar-fg font-bold text-sm leading-tight">Customer</div>
            <div className="text-sidebar-accent font-semibold text-xs tracking-wider uppercase">Tracker</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {NAV.map(group => (
          <div key={group.label}>
            <p className="text-sidebar-faint text-[10px] font-semibold uppercase tracking-widest px-3 mb-2">{group.label}</p>
            <div className="space-y-0.5">
              {group.items.map(item => <NavItem key={item.to} {...item} />)}
            </div>
          </div>
        ))}
      </nav>

      {/* Settings + user */}
      <div className="px-3 py-3 border-t border-sidebar-fg/5 space-y-1">
        <NavItem to="/settings" label="Settings" icon={Settings} />
        <button
          onClick={() => navigate('/settings')}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-sidebar-fg/5 transition-colors text-left"
          title="Edit profile"
        >
          <UserAvatar size={32} />
          <div className="min-w-0">
            <div className="text-sidebar-fg text-xs font-semibold truncate">{name}</div>
            <div className="text-sidebar-dim text-[10px]">Owner · Edit profile</div>
          </div>
        </button>
      </div>
    </aside>
  )
}

const PAGE_TITLES = {
  '/': 'Dashboard',
  '/customers': 'Customers',
  '/transactions': 'Transactions',
  '/rewards': 'Rewards',
  '/activity': 'Activity Log',
  '/reports': 'Reports',
  '/yearly': 'Yearly Report',
  '/data': 'Import / Export',
  '/settings': 'Settings'
}

const PERIOD_ICON = { morning: Sun, afternoon: Sunset, evening: Moon }

export default function Layout({ children }) {
  const location = useLocation()
  const { settings } = useSettings()
  const base = '/' + location.pathname.split('/')[1]
  const title = location.pathname.startsWith('/customers/') ? 'Customer Profile' : (PAGE_TITLES[base] || 'Customer Tracker')
  const greet = greetingFor()
  const GreetIcon = PERIOD_ICON[greet.period]
  const firstName = (settings?.userName || '').split(' ')[0]

  return (
    <div className="flex h-screen bg-page overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex-shrink-0 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-slate-400">
              <span className="text-xs font-medium">{settings?.userName || 'Nelson Isidro'}</span>
              <ChevronRight size={12} />
              <span className="text-xs font-semibold text-slate-700">{title}</span>
            </div>
            <motion.h1
              key={title}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="text-lg font-bold text-slate-900 mt-0.5"
            >
              {title}
            </motion.h1>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="hidden md:block text-right">
              <div className="flex items-center justify-end gap-1.5 text-xs font-semibold text-slate-700">
                <GreetIcon size={13} className="text-amber-500" /> {greet.text}{firstName ? `, ${firstName}` : ''}
              </div>
              <div className="text-[11px] text-slate-400">
                {new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
            <UserAvatar size={36} ring />
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-hidden">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="h-full"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  )
}
