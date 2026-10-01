import { useState, useEffect, useCallback } from 'react'
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { ToastProvider } from './context/ToastContext'
import { SettingsProvider, useSettings } from './context/SettingsContext'
import Layout from './components/Layout'
import Greeting from './greeting/Greeting'
import Dashboard from './pages/Dashboard'
import Customers from './pages/Customers'
import CustomerDetail from './pages/CustomerDetail'
import Transactions from './pages/Transactions'
import Rewards from './pages/Rewards'
import ActivityLog from './pages/ActivityLog'
import Reports from './pages/Reports'
import YearlyReport from './pages/YearlyReport'
import DataPage from './pages/DataPage'
import Settings from './pages/Settings'

// Survives React StrictMode remounts, so the greeting shows once per launch
let greetedThisLaunch = false

function AppShell() {
  const { settings } = useSettings()
  const [greeting, setGreeting] = useState(() => settings.showGreeting !== false && !greetedThisLaunch)

  const finish = useCallback(() => {
    greetedThisLaunch = true
    setGreeting(false)
  }, [])

  // Settings → "Preview greeting"
  useEffect(() => {
    const show = () => setGreeting(true)
    window.addEventListener('ct:show-greeting', show)
    return () => window.removeEventListener('ct:show-greeting', show)
  }, [])

  return (
    <>
      <Router>
        <Layout>
          <Routes>
            <Route path="/"                 element={<Dashboard />} />
            <Route path="/customers"        element={<Customers />} />
            <Route path="/customers/:id"    element={<CustomerDetail />} />
            <Route path="/transactions"     element={<Transactions />} />
            <Route path="/rewards"          element={<Rewards />} />
            <Route path="/activity"         element={<ActivityLog />} />
            <Route path="/history"          element={<Navigate to="/activity" replace />} />
            <Route path="/reports"          element={<Reports />} />
            <Route path="/yearly"           element={<YearlyReport />} />
            <Route path="/data"             element={<DataPage />} />
            <Route path="/settings"         element={<Settings />} />
          </Routes>
        </Layout>
      </Router>
      <AnimatePresence>{greeting && <Greeting onDone={finish} />}</AnimatePresence>
    </>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <SettingsProvider>
        <AppShell />
      </SettingsProvider>
    </ToastProvider>
  )
}
