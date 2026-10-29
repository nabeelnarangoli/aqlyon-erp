import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { configured } from './lib/supabase'
import { AuthProvider, useAuth } from './lib/auth'
import { ToastProvider, Loading } from './components/ui'
import Layout from './components/Layout'
import { REPORT_PERMS } from './lib/permissions'
import Login from './pages/Login'
import SetupNeeded from './pages/SetupNeeded'

const Approvals = lazy(() => import('./pages/Approvals'))
const Help = lazy(() => import('./pages/Help'))
const Jobs = lazy(() => import('./pages/Jobs'))
const WorkReport = lazy(() => import('./pages/reports/WorkReport'))
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
const WalkIn = lazy(() => import('./pages/finance/WalkIn'))
const Invoices = lazy(() => import('./pages/finance/Invoices'))
const InvoiceView = lazy(() => import('./pages/finance/InvoiceView'))
const Quotations = lazy(() => import('./pages/finance/Quotations'))
const Payments = lazy(() => import('./pages/finance/Payments'))
const Expenses = lazy(() => import('./pages/finance/Expenses'))
const Suppliers = lazy(() => import('./pages/finance/Suppliers'))
const WorkOrders = lazy(() => import('./pages/finance/Suppliers').then((m) => ({ default: m.WorkOrders })))
const SocialReports = lazy(() => import('./pages/reports/SocialReports'))
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

function Guard({ perm, children }) {
  const { has } = useAuth()
  return has(...perm) ? children : <Navigate to="/" replace />
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
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="approvals" element={<Approvals />} />
          <Route path="leads" element={<Guard perm={['leads.view', 'leads.manage']}><Leads /></Guard>} />
          <Route path="clients" element={<Guard perm={['clients.view', 'clients.manage']}><Clients /></Guard>} />
          <Route path="clients/:id" element={<Guard perm={['clients.view', 'clients.manage']}><ClientDetail /></Guard>} />
          <Route path="clients/:id/report" element={<Guard perm={['clients.view', 'clients.manage', 'tasks.view', 'tasks.work', 'calendar.view']}><WorkReport /></Guard>} />
          <Route path="followups" element={<Guard perm={['leads.manage', 'clients.manage']}><FollowUps /></Guard>} />
          <Route path="projects" element={<Guard perm={['projects.view', 'projects.manage']}><Projects /></Guard>} />
          <Route path="tasks" element={<Guard perm={['tasks.view', 'tasks.work', 'tasks.manage', 'tasks.review']}><Tasks /></Guard>} />
          <Route path="tasks/:id" element={<Guard perm={['tasks.view', 'tasks.work', 'tasks.manage', 'tasks.review']}><TaskDetail /></Guard>} />
          <Route path="calendar" element={<Guard perm={['calendar.view', 'calendar.manage']}><Calendar /></Guard>} />
          <Route path="timesheet" element={<Guard perm={['tasks.work', 'tasks.manage', 'timesheet.all']}><Timesheet /></Guard>} />
          <Route path="queries" element={<Queries />} />
          <Route path="queries/:id" element={<Queries />} />
          <Route path="finance/invoices" element={<Guard perm={['invoices.view', 'invoices.manage']}><Invoices /></Guard>} />
          {/* any team member may open an invoice they billed or collected for (walk-in); the database decides what they can see */}
          <Route path="finance/invoices/:id" element={<InvoiceView kind="invoice" />} />
          <Route path="walkin" element={<WalkIn />} />
          <Route path="jobs" element={<Jobs />} />
          <Route path="finance/quotations" element={<Guard perm={['quotations.view', 'quotations.manage']}><Quotations /></Guard>} />
          <Route path="finance/quotations/:id" element={<Guard perm={['quotations.view', 'quotations.manage']}><InvoiceView kind="quote" /></Guard>} />
          <Route path="finance/payments" element={<Guard perm={['payments.manage']}><Payments /></Guard>} />
          <Route path="finance/expenses" element={<Guard perm={['expenses.manage']}><Expenses /></Guard>} />
          <Route path="finance/suppliers" element={<Guard perm={['suppliers.view', 'suppliers.manage', 'suppliers.pay', 'expenses.manage', 'payments.manage']}><Suppliers /></Guard>} />
          <Route path="finance/suppliers/:id" element={<Guard perm={['suppliers.view', 'suppliers.manage', 'suppliers.pay', 'expenses.manage', 'payments.manage']}><Suppliers /></Guard>} />
          <Route path="finance/work-orders" element={<Guard perm={['suppliers.view', 'suppliers.manage', 'suppliers.pay']}><WorkOrders /></Guard>} />
          <Route path="social" element={<Guard perm={['calendar.view', 'calendar.manage', 'clients.view', 'clients.manage', 'reports.content']}><SocialReports /></Guard>} />
          <Route path="social/:id" element={<Guard perm={['calendar.view', 'calendar.manage', 'clients.view', 'clients.manage', 'reports.content']}><SocialReports /></Guard>} />
          <Route path="reports" element={<Guard perm={REPORT_PERMS}><Reports /></Guard>} />
          <Route path="team" element={<Guard perm={['team.manage']}><Team /></Guard>} />
          <Route path="settings" element={<Guard perm={['settings.manage']}><SettingsPage /></Guard>} />
          <Route path="help" element={<Help />} />
          <Route path="help/:id" element={<Help />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
