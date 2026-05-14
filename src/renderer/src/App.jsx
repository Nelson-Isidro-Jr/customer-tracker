import { HashRouter as Router, Routes, Route } from 'react-router-dom'
import { ToastProvider } from './context/ToastContext'
import { SettingsProvider } from './context/SettingsContext'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Customers from './pages/Customers'
import CustomerDetail from './pages/CustomerDetail'
import Transactions from './pages/Transactions'
import Reports from './pages/Reports'
import DataPage from './pages/DataPage'
import Settings from './pages/Settings'

export default function App() {
  return (
    <ToastProvider>
      <SettingsProvider>
        <Router>
          <Layout>
            <Routes>
              <Route path="/"                 element={<Dashboard />} />
              <Route path="/customers"        element={<Customers />} />
              <Route path="/customers/:id"    element={<CustomerDetail />} />
              <Route path="/transactions"     element={<Transactions />} />
              <Route path="/reports"          element={<Reports />} />
              <Route path="/data"             element={<DataPage />} />
              <Route path="/settings"         element={<Settings />} />
            </Routes>
          </Layout>
        </Router>
      </SettingsProvider>
    </ToastProvider>
  )
}
