import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { configured } from './lib/supabase'
import { AuthProvider, useAuth } from './lib/auth'
import { ToastProvider, Loading } from './components/ui'
import Layout from './components/Layout'
import Login from './pages/Login'
import SetupNeeded from './pages/SetupNeeded'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Leads = lazy(() => import('./pages/crm/Leads'))
const Clients = lazy(() => import('./pages/crm/Clients'))
const ClientDetail = lazy(() => import('./pages/crm/ClientDetail'))
const FollowUps = lazy(() => import('./pages/crm/FollowUps'))
const Projects = lazy(() => import('./pages/crm/Projects'))
const Tasks = lazy(() => import('./pages/tasks/Tasks'))
const TaskDetail = lazy(() => import('./pages/tasks/TaskDetail'))
const Calendar = lazy(() => import('./pages/tasks/Calendar'))
const Timesheet = lazy(() => import('./pages/tasks/Timesheet'))
const Queries = lazy(() => import('./pages/tasks/Queries'))
const Invoices = lazy(() => import('./pages/finance/Invoices'))
const InvoiceView = lazy(() => import('./pages/finance/InvoiceView'))
const Quotations = lazy(() => import('./pages/finance/Quotations'))
const Payments = lazy(() => import('./pages/finance/Payments'))
const Expenses = lazy(() => import('./pages/finance/Expenses'))
const Reports = lazy(() => import('./pages/reports/Reports'))
const Team = lazy(() => import('./pages/admin/Team'))
const SettingsPage = lazy(() => import('./pages/admin/Settings'))
const Portal = lazy(() => import('./pages/Portal'))

export default function App() {
  const loc = useLocation()
  if (loc.pathname.startsWith('/p/')) {
    return <Suspense fallback={<Loading />}><Routes><Route path="/p/:token" element={<Portal />} /></Routes></Suspense>
  }
  if (!configured) return <SetupNeeded />
  return (
    <ToastProvider>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </ToastProvider>
  )
}

function Guard({ roles, children }) {
  const { can } = useAuth()
  return can(...roles) ? children : <Navigate to="/" replace />
}

function Gate() {
  const { session, profile, loading, signOut } = useAuth()
  if (loading) return <Loading label="Starting Aqlyon ERP…" />
  if (!session) return <Login />
  if (!profile) return <Loading label="Loading your profile…" />
  if (!profile.active) {
    return (
      <div className="auth-form" style={{ minHeight: '100vh' }}>
        <div className="auth-card center">
          <img src="/logo-full.png" alt="Aqlyon Brand Management" style={{ margin: '0 auto' }} />
          <h2>Account disabled</h2>
          <p className="muted">Your access has been turned off. Please contact the admin.</p>
          <button className="btn btn-outline" onClick={signOut}>Sign out</button>
        </div>
      </div>
    )
  }
  const M = ['marketer'], D = ['designer'], F = ['finance']
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="leads" element={<Guard roles={M}><Leads /></Guard>} />
          <Route path="clients" element={<Guard roles={[...M, ...D, ...F]}><Clients /></Guard>} />
          <Route path="clients/:id" element={<Guard roles={[...M, ...D, ...F]}><ClientDetail /></Guard>} />
          <Route path="followups" element={<Guard roles={M}><FollowUps /></Guard>} />
          <Route path="projects" element={<Guard roles={[...M, ...D]}><Projects /></Guard>} />
          <Route path="tasks" element={<Guard roles={[...M, ...D]}><Tasks /></Guard>} />
          <Route path="tasks/:id" element={<Guard roles={[...M, ...D]}><TaskDetail /></Guard>} />
          <Route path="calendar" element={<Guard roles={[...M, ...D]}><Calendar /></Guard>} />
          <Route path="timesheet" element={<Guard roles={[...M, ...D]}><Timesheet /></Guard>} />
          <Route path="queries" element={<Queries />} />
          <Route path="queries/:id" element={<Queries />} />
          <Route path="finance/invoices" element={<Guard roles={[...F, ...M]}><Invoices /></Guard>} />
          <Route path="finance/invoices/:id" element={<Guard roles={[...F, ...M]}><InvoiceView kind="invoice" /></Guard>} />
          <Route path="finance/quotations" element={<Guard roles={[...F, ...M]}><Quotations /></Guard>} />
          <Route path="finance/quotations/:id" element={<Guard roles={[...F, ...M]}><InvoiceView kind="quote" /></Guard>} />
          <Route path="finance/payments" element={<Guard roles={F}><Payments /></Guard>} />
          <Route path="finance/expenses" element={<Guard roles={F}><Expenses /></Guard>} />
          <Route path="reports" element={<Guard roles={[...M, ...D, ...F]}><Reports /></Guard>} />
          <Route path="team" element={<Guard roles={[]}><Team /></Guard>} />
          <Route path="settings" element={<Guard roles={[]}><SettingsPage /></Guard>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
