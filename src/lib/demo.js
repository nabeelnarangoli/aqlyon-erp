import { DEFAULT_ROLES, grants } from './permissions'
import { QUOTE_TERMS, PROPOSAL_INTRO, CLIENT_RESPONSIBILITIES, PROPOSAL_EXCLUSIONS, PROPOSAL_ACCEPTANCE, PROPOSAL_SERVICES } from './proposal'
// In-browser demo backend: mimics the subset of supabase-js the app uses, plus the
// database triggers/RPCs from supabase/schema.sql, on sample data kept in localStorage.
// Only used when the app is built with VITE_DEMO=1.

const KEY = 'aqlyon-erp-demo-v14'
const SKEY = 'aqlyon-erp-demo-session'
// same "Remember me" rule as the real app: remembered → localStorage, otherwise this browser session only
const sessStore = () => { try { return localStorage.getItem('aqlyon-remember') !== '0' ? localStorage : sessionStorage } catch { return sessionStorage } }
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36))
const nowISO = () => new Date().toISOString()
const iso = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}` }
const day = (k) => { const d = new Date(); d.setDate(d.getDate() + k); return iso(d) }
const ago = (h) => new Date(Date.now() - h * 3600000).toISOString()
const mStart = (k = 0) => { const d = new Date(); return iso(new Date(d.getFullYear(), d.getMonth() + k, 1)) }
const clone = (x) => JSON.parse(JSON.stringify(x))
const files = {} // storage path -> object URL (session only)

let db = null
let currentUser = null
const authListeners = new Set()

function load() {
  try { const s = localStorage.getItem(KEY); if (s) { db = JSON.parse(s); return } } catch { /* ignore */ }
  db = seed()
  persist()
}
function persist() { try { localStorage.setItem(KEY, JSON.stringify(db)) } catch { /* ignore */ } }
export function resetDemo() { try { localStorage.removeItem(KEY) } catch { /* ignore */ } db = seed(); persist() }

const T = (name) => (db[name] ||= [])
const uid = () => currentUser?.id || null
const permsOf = (id) => { const p = T('profiles').find((x) => x.id === id); return (p?.active && T('roles').find((r) => r.id === p.role_id)?.permissions) || [] }
const hasPerm = (...want) => (!currentUser ? true : grants(permsOf(uid()), ...want))
const myRoleId = () => T('profiles').find((p) => p.id === uid())?.role_id
// table → permissions needed to read / write (mirrors the database security rules)
const READ = {
  leads: ['leads.view', 'leads.manage'], interactions: ['leads.view', 'leads.manage', 'clients.manage'],
  packages: ['packages.view', 'packages.manage', 'invoices.manage'], projects: ['projects.view', 'projects.manage', 'tasks.view', 'tasks.work', 'tasks.manage'],
  content_posts: ['calendar.view', 'calendar.manage'], social_kpis: ['calendar.view', 'calendar.manage', 'clients.view', 'clients.manage', 'reports.content'], approval_links: ['calendar.manage', 'clients.manage'],
  quotations: ['quotations.view', 'quotations.manage'], invoices: ['invoices.view', 'invoices.manage', 'payments.manage'], v_invoice_status: ['invoices.view', 'invoices.manage', 'payments.manage'],
  payments: ['payments.manage', 'invoices.view', 'invoices.manage', 'reports.finance'], expenses: ['expenses.manage', 'payments.manage', 'reports.finance', 'reports.clients'], reimbursements: ['expenses.manage', 'payments.manage', 'reports.finance'],
  suppliers: ['suppliers.view', 'suppliers.manage', 'suppliers.pay', 'expenses.manage', 'payments.manage', 'reports.finance'], supplier_bills: ['suppliers.view', 'suppliers.manage', 'suppliers.pay', 'reports.finance', 'reports.clients'],
  supplier_bill_allocations: ['suppliers.view', 'suppliers.manage', 'suppliers.pay', 'reports.clients', 'invoices.view'],
  supplier_payments: ['suppliers.view', 'suppliers.pay', 'payments.manage', 'reports.finance', 'invoices.view', 'expenses.manage'],
  clients: ['clients.view', 'clients.manage', 'tasks.view', 'tasks.work', 'invoices.view', 'quotations.view', 'calendar.view', 'suppliers.view', 'leads.manage']
}
const WRITE = {
  leads: ['leads.manage'], interactions: ['leads.manage', 'clients.manage'], clients: ['clients.manage', 'leads.manage'], packages: ['packages.manage'],
  projects: ['projects.manage'], social_kpis: ['calendar.manage', 'clients.manage'], design_tasks: ['tasks.manage', 'tasks.review', 'tasks.work'], content_posts: ['calendar.manage'], approval_links: ['calendar.manage', 'clients.manage'],
  quotations: ['quotations.manage'], invoices: ['invoices.manage', 'payments.manage'], payments: ['payments.manage'], expenses: ['expenses.manage'], reimbursements: ['expenses.manage', 'payments.manage'],
  suppliers: ['suppliers.manage', 'expenses.manage'], supplier_bills: ['suppliers.manage'], supplier_bill_allocations: ['suppliers.manage'], supplier_payments: ['suppliers.pay'],
  roles: ['team.manage'], staff_pay: ['team.manage'], settings: ['settings.manage'], services: ['settings.manage', 'quotations.manage', 'invoices.manage']
}
const canWrite = (t) => !WRITE[t] || hasPerm(...WRITE[t])
const settings = () => T('settings')[0]
const seq = (name) => { db._seq ||= {}; db._seq[name] = (db._seq[name] || 0) + 1; return db._seq[name] }

/* ---------------------------- defaults ---------------------------- */
const DEFAULTS = {
  leads: () => ({ stage: 'new', temperature: 'warm', services_interest: [], estimated_value: 0, source: 'Walk-in', created_by: uid(), updated_at: nowISO() }),
  clients: () => ({ customer_type: 'regular', status: 'active', onboarded_on: iso(new Date()), created_by: uid(), updated_at: nowISO() }),
  packages: () => ({ billing_type: 'monthly', fee: 0, start_date: iso(new Date()), billing_day: 1, posts_per_month: 0, reels_per_month: 0, stories_per_month: 0, carousels_per_month: 0, ad_budget: 0, platforms: [], status: 'active', created_by: uid() }),
  interactions: () => ({ type: 'call', direction: 'outgoing', done: false, occurred_at: nowISO(), created_by: uid() }),
  projects: () => ({ type: 'Campaign', budget: 0, ad_spend: 0, status: 'planning', reach: 0, impressions: 0, clicks: 0, leads_generated: 0, conversions: 0, owner_id: uid() }),
  design_tasks: () => ({ task_type: 'Social Post', quantity: 1, priority: 'normal', status: 'todo', created_by: uid(), estimated_hours: 0, revision_count: 0, max_revisions: settings()?.default_max_revisions ?? 3, billable: true, updated_at: nowISO() }),
  task_proofs: () => ({ status: 'pending', uploaded_by: uid() }),
  task_comments: () => ({ kind: 'comment', author_id: uid() }),
  time_logs: () => ({ user_id: uid(), log_date: iso(new Date()), billable: true }),
  queries: () => ({ category: 'General', priority: 'normal', status: 'open', from_user: uid(), updated_at: nowISO() }),
  query_replies: () => ({ author_id: uid() }),
  content_posts: () => ({ results: [], platforms: ['Instagram'], post_type: 'Post', status: 'idea', reach: 0, likes: 0, comments: 0, shares: 0, saves: 0, created_by: uid(), updated_at: nowISO() }),
  approval_links: () => ({ token: uuid().replace(/-/g, '').slice(0, 36), expires_at: new Date(Date.now() + 30 * 86400000).toISOString(), revoked: false, created_by: uid() }),
  quotations: () => ({ full_proposal: true, issue_date: iso(new Date()), valid_until: day(15), items: [], discount: 0, status: 'draft', created_by: uid() }),
  invoices: () => ({ sale_channel: 'office', issue_date: iso(new Date()), due_date: day(7), items: [], discount: 0, amount_paid: 0, status: 'draft', created_by: uid() }),
  payments: () => ({ paid_on: iso(new Date()), method: 'UPI', created_by: uid(), collected_by: uid() }),
  expenses: () => ({ spent_on: iso(new Date()), category: 'Office Supplies', method: 'UPI', rebillable: false, recurring: false, created_by: uid() }),
  reimbursements: () => ({ paid_on: iso(new Date()), method: 'Bank Transfer', created_by: uid() }),
  notifications: () => ({ read: false, kind: 'info' }),
  activity_log: () => ({ actor_id: uid() }),
  services: () => ({ category: 'Design', unit: 'per item', rate: 0, active: true }),
  profiles: () => ({ weekly_hours: 54, work_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], work_start: '09:30', work_end: '18:30', active: true }),
  roles: () => ({ color: 'blue', permissions: [], is_system: false }),
  staff_pay: () => ({ monthly_salary: 0, cost_per_hour: 0 }),
  suppliers: () => ({ category: 'Freelance Designer', active: true, created_by: uid() }),
  supplier_bills: () => ({ order_date: iso(new Date()), items: [], discount: 0, amount_paid: 0, work_status: 'ordered', status: 'unpaid', created_by: uid() }),
  supplier_bill_allocations: () => ({}),
  supplier_payments: () => ({ paid_on: iso(new Date()), kind: 'advance', method: 'UPI', created_by: uid() })
}

/* ---------------------------- triggers ---------------------------- */
function notify(user, title, body, link, kind = 'info', ref = null) {
  if (!user || user === uid()) return
  T('notifications').push({ id: uuid(), user_id: user, title, body, link, kind, actor_id: uid(), ref_id: ref, read: false, created_at: nowISO() })
}
const clearApproval = (ref) => T('notifications').forEach((n) => { if (n.ref_id === ref && n.kind === 'approval') n.read = true })
const usersWithPerm = (...want) => T('profiles').filter((p) => { const r = T('roles').find((x) => x.id === p.role_id); return p.active && r && (r.permissions.includes('*') || want.some((w) => r.permissions.includes(w))) }).map((p) => p.id)
// mirrors notify_mentions(): @FirstName or @FullNameWithoutSpaces
function mentions(body, where, link) {
  if (!body || !body.includes('@')) return
  const me = T('profiles').find((p) => p.id === uid())?.full_name || 'Someone'
  const toks = [...new Set([...body.matchAll(/@([A-Za-z][A-Za-z0-9_.]{1,40})/g)].map((m) => m[1].toLowerCase()))]
  const people = T('profiles').filter((p) => p.active)
  for (const tok of toks) {
    const t = tok.replace(/[^a-z0-9]/g, '')
    const firsts = people.filter((p) => p.full_name.split(' ')[0].toLowerCase() === tok)
    people.filter((p) => p.full_name.toLowerCase().replace(/[^a-z0-9]/g, '') === t || (firsts.length === 1 && firsts[0].id === p.id))
      .forEach((p) => notify(p.id, `${me} mentioned you · ${where}`, body.slice(0, 160), link, 'mention'))
  }
}
function postReview(r, old) {
  if (r.status === 'internal_review' && (!old || old.status !== 'internal_review')) {
    const c = T('clients').find((x) => x.id === r.client_id)
    usersWithPerm('calendar.manage').forEach((u) => notify(u, 'Approval needed: post', `${c?.name || ''} · ${r.title} · ${r.publish_date}`, '/approvals', 'approval', r.id))
  } else if (old && old.status === 'internal_review') { clearApproval(r.id); if (['copywriting', 'in_design', 'idea'].includes(r.status)) notify(r.assignee_id || r.created_by, 'Changes requested on a post', r.title, '/calendar') }
}
function totals(r) {
  const s = (r.items || []).reduce((a, i) => a + Number(i.qty ?? 1) * Number(i.rate || 0), 0)
  r.subtotal = Math.round(s * 100) / 100
  r.total = Math.max(0, Math.round((s - Number(r.discount || 0)) * 100) / 100)
}
function syncInvoice(invId) {
  const inv = T('invoices').find((i) => i.id === invId); if (!inv) return
  const paid = T('payments').filter((p) => p.invoice_id === invId).reduce((a, p) => a + Number(p.amount), 0)
  inv.amount_paid = paid
  if (inv.status !== 'cancelled') {
    if (paid >= inv.total && inv.total > 0) inv.status = 'paid'
    else if (paid > 0) inv.status = 'partial'
    else if (['paid', 'partial'].includes(inv.status)) inv.status = 'sent'
  }
}
function expensePayee(r) {
  if (r.supplier_id) { r.vendor = T('suppliers').find((x) => x.id === r.supplier_id)?.name || r.vendor; return }
  const name = String(r.vendor || '').trim(); if (!name) return
  let sup = T('suppliers').find((x) => x.name.toLowerCase() === name.toLowerCase())
  if (!sup) { sup = { id: uuid(), name, category: PAYEE_CAT[r.category] || 'Other', active: true, created_at: nowISO() }; T('suppliers').push(sup) }
  r.supplier_id = sup.id; r.vendor = sup.name
}
const PAYEE_CAT = { Rent: 'Landlord', Salary: 'Staff', 'Internet / Phone': 'Utility', 'Electricity / Water': 'Utility', 'Software / Subscriptions': 'Software / Subscription',
  'Stock Images / Assets': 'Software / Subscription', 'Ad Spend (Client)': 'Ad Platform' }
function payCalc(r) {
  const p = T('profiles').find((x) => x.id === r.user_id)
  const [h1, m1] = String(p?.work_start || '09:30').split(':').map(Number), [h2, m2] = String(p?.work_end || '18:30').split(':').map(Number)
  const monthly = (p?.work_days?.length || 6) * Math.max(1, (h2 * 60 + m2 - h1 * 60 - m1) / 60) * 52 / 12
  if (Number(r.monthly_salary) > 0) r.cost_per_hour = Math.round((Number(r.monthly_salary) / monthly) * 100) / 100
}
function syncBill(billId) {
  const b = T('supplier_bills').find((x) => x.id === billId); if (!b) return
  const paid = T('supplier_payments').filter((p) => p.bill_id === billId).reduce((a, p) => a + Number(p.amount), 0)
  b.amount_paid = paid
  if (b.status !== 'cancelled') b.status = paid >= b.total && b.total > 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid'
}
function guardDesigner(table, oldR, newR) {
  if (table === 'design_tasks' && hasPerm('tasks.manage')) return
  if (table === 'task_proofs' && hasPerm('tasks.review')) return
  if (table === 'design_tasks') {
    if (newR.status !== oldR.status && !['todo', 'in_progress', 'internal_review'].includes(newR.status) && !hasPerm('tasks.review')) throw new Error('You can only set status to To do, In progress or Ready for review')
    for (const k of ['title', 'client_id', 'due_date', 'priority', 'brief', 'max_revisions'])
      if (k in newR && JSON.stringify(newR[k]) !== JSON.stringify(oldR[k])) throw new Error('You cannot edit the brief, client, due date or priority — raise a query instead')
  }
  if (table === 'task_proofs' && (newR.status !== oldR.status || newR.review_note !== oldR.review_note || newR.client_decision !== oldR.client_decision))
    throw new Error('You do not have permission to review proofs')
}
function setTaskStatus(t, status) {
  if (!t || t.status === status) return
  const old = { ...t }
  t.status = status
  afterTaskUpdate(old, t)
}
// mirrors post_results_sync(): per-platform results roll up into the single total columns
function postResults(r) {
  if (!Array.isArray(r.results)) r.results = []
  if (!r.results.length) return
  const sum = (k) => r.results.reduce((a, x) => a + (Number(x[k]) || 0), 0)
  Object.assign(r, { published_url: r.results.find((x) => x.url)?.url || null, reach: sum('reach'), likes: sum('likes'), comments: sum('comments'), shares: sum('shares'), saves: sum('saves') })
}
// mirrors kpi_fill(): every KPI row has a From–To period and the month it starts in
function kpiFill(r) {
  const add = (iso, n) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return iso && iso.length === 10 ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : null }
  if (!r.period_start) r.period_start = add(r.month, ((r.week_no || 1) - 1) * 7)
  if (!r.period_end || r.period_end < r.period_start) r.period_end = add(r.period_start, 6)
  r.month = r.period_start.slice(0, 8) + '01'; r.extra ||= {}
}
function beforeInsert(table, r) {
  const st = settings()
  if (table === 'social_kpis') kpiFill(r)
  if (table === 'content_posts') postResults(r)
  if (table === 'invoices') { if (!r.number) r.number = `${st.invoice_prefix}-${String(r.issue_date).slice(0, 4)}-${String(seq('invoice')).padStart(4, '0')}`; totals(r) }
  if (table === 'quotations') { if (!r.number) r.number = `${st.quote_prefix}-${String(r.issue_date).slice(0, 4)}-${String(seq('quote')).padStart(4, '0')}`; totals(r) }
  if (table === 'design_tasks' && !r.code) r.code = `${st.task_prefix}-${1000 + seq('task')}`
  if (table === 'clients' && !r.code) r.code = 'CL-' + String(seq('client')).padStart(3, '0')
  if (table === 'task_proofs') r.version = Math.max(0, ...T('task_proofs').filter((p) => p.task_id === r.task_id).map((p) => p.version)) + 1
  if (table === 'payments' && !r.client_id && r.invoice_id) r.client_id = T('invoices').find((i) => i.id === r.invoice_id)?.client_id
  if (table === 'staff_pay') payCalc(r)
  if (table === 'expenses') expensePayee(r)
  if (table === 'supplier_bills') {
    if (!r.number) r.number = `${st.po_prefix || 'AQB-PO'}-${String(r.order_date).slice(0, 4)}-${String(seq('po')).padStart(4, '0')}`
    totals(r); if (r.work_status === 'received' && !r.received_on) r.received_on = iso(new Date())
  }
  if (table === 'supplier_payments') {
    if (!hasPerm('suppliers.pay')) throw new Error('You do not have permission to pay suppliers')
    if (r.bill_id) r.supplier_id = T('supplier_bills').find((b) => b.id === r.bill_id)?.supplier_id
  }
}
function afterInsert(table, r) {
  if (table === 'content_posts') postReview(r, null)
  if (table === 'task_comments' && r.kind === 'comment') { const t = T('design_tasks').find((x) => x.id === r.task_id); if (t) mentions(r.body, t.code, `/tasks/${t.id}`) }
  if (table === 'query_replies') { const qq = T('queries').find((x) => x.id === r.query_id); if (qq) mentions(r.body, `query: ${qq.subject}`, `/queries/${qq.id}`) }
  if (table === 'queries') mentions(r.body, `query: ${r.subject}`, `/queries/${r.id}`)
  if (table === 'design_tasks') notify(r.assignee_id, 'New design task assigned', `${r.code} · ${r.title}`, `/tasks/${r.id}`)
  if (table === 'task_proofs') {
    const t = T('design_tasks').find((x) => x.id === r.task_id)
    if (t && ['todo', 'in_progress', 'revision'].includes(t.status)) setTaskStatus(t, 'internal_review')
  }
  if (table === 'payments') syncInvoice(r.invoice_id)
  if (table === 'supplier_payments') syncBill(r.bill_id)
  if (table === 'queries') {
    if (r.to_user) notify(r.to_user, `New query: ${r.subject}`, (r.body || '').slice(0, 140), `/queries/${r.id}`)
    else if (r.to_role_id) T('profiles').filter((p) => p.role_id === r.to_role_id && p.active).forEach((p) => notify(p.id, `New query: ${r.subject}`, (r.body || '').slice(0, 140), `/queries/${r.id}`))
  }
  if (table === 'query_replies') {
    const q = T('queries').find((x) => x.id === r.query_id); if (!q) return
    if (r.author_id === q.from_user) notify(q.to_user, `Reply: ${q.subject}`, r.body.slice(0, 140), `/queries/${q.id}`)
    else { notify(q.from_user, `Reply: ${q.subject}`, r.body.slice(0, 140), `/queries/${q.id}`); if (q.status === 'open') q.status = 'answered' }
  }
  if (table === 'task_comments' && r.kind === 'comment') {
    const t = T('design_tasks').find((x) => x.id === r.task_id); if (!t) return
    notify(t.assignee_id, `Comment on ${t.code}`, r.body.slice(0, 140), `/tasks/${t.id}`)
    if (t.created_by !== t.assignee_id) notify(t.created_by, `Comment on ${t.code}`, r.body.slice(0, 140), `/tasks/${t.id}`)
  }
}
function afterTaskUpdate(old, t) {
  if (t.assignee_id !== old.assignee_id && t.assignee_id) notify(t.assignee_id, 'New design task assigned', `${t.code} · ${t.title}`, `/tasks/${t.id}`)
  if (t.status !== old.status) {
    if (t.status === 'revision') { t.revision_count = (old.revision_count || 0) + 1; notify(t.assignee_id, 'Revision requested', `${t.code} · ${t.title}`, `/tasks/${t.id}`) }
    else if (t.status === 'internal_review') [...new Set([t.created_by, ...usersWithPerm('tasks.review')])].forEach((u) => notify(u, 'Approval needed: design proof', `${t.code} · ${t.title}`, '/approvals', 'approval', t.id))
    if (old.status === 'internal_review' && t.status !== 'internal_review') clearApproval(t.id)
    else if (t.status === 'approved') { t.approved_at ||= nowISO(); notify(t.assignee_id, 'Design approved 🎉', `${t.code} · ${t.title}`, `/tasks/${t.id}`) }
    else if (t.status === 'delivered') t.delivered_at ||= nowISO()
    else if (t.status === 'in_progress' && !t.start_date) t.start_date = iso(new Date())
    T('task_comments').push({ id: uuid(), task_id: t.id, author_id: uid(), kind: 'system', created_at: nowISO(), body: `Status changed: ${old.status.replace(/_/g, ' ')} → ${t.status.replace(/_/g, ' ')}` })
  }
}
function afterUpdate(table, old, r) {
  if (['leads', 'clients', 'design_tasks', 'queries', 'content_posts'].includes(table)) r.updated_at = nowISO()
  if (table === 'invoices' || table === 'quotations') totals(r)
  if (table === 'content_posts' && old.results !== r.results) postResults(r)
  if (table === 'social_kpis') kpiFill(r)
  if (table === 'content_posts' && old.status !== r.status) postReview(r, old)
  if (table === 'staff_pay') payCalc(r)
  if (table === 'expenses' && (r.supplier_id !== old.supplier_id || r.vendor !== old.vendor)) expensePayee(r)
  if (table === 'roles' && old.key === 'admin') { r.permissions = ['*']; r.key = 'admin' }
  if (table === 'profiles') {
    const admins = T('profiles').filter((p) => p.active && T('roles').find((x) => x.id === p.role_id)?.key === 'admin')
    if (!admins.length) { Object.assign(r, old); throw new Error('At least one active Administrator is required') }
  }
  if (table === 'design_tasks') afterTaskUpdate(old, r)
  if (table === 'task_proofs') {
    const t = T('design_tasks').find((x) => x.id === r.task_id)
    if (r.status !== old.status) {
      if (r.status === 'approved' && t?.status === 'internal_review') setTaskStatus(t, 'client_review')
      if (r.status === 'changes_requested' && t && !['delivered', 'cancelled'].includes(t.status)) setTaskStatus(t, 'revision')
    }
    if (r.client_decision !== old.client_decision && t) {
      if (r.client_decision === 'approved' && !['delivered', 'cancelled'].includes(t.status)) setTaskStatus(t, 'approved')
      if (r.client_decision === 'changes_requested' && !['delivered', 'cancelled'].includes(t.status)) setTaskStatus(t, 'revision')
      notify(t.created_by, `Client ${r.client_decision.replace('_', ' ')}`, `${t.code} · ${t.title}`, `/tasks/${t.id}`)
    }
  }
  if (table === 'payments') { syncInvoice(r.invoice_id); if (old.invoice_id !== r.invoice_id) syncInvoice(old.invoice_id) }
  if (table === 'supplier_bills') { totals(r); syncBill(r.id); if (r.work_status === 'received' && !r.received_on) r.received_on = iso(new Date()) }
}

/* ---------------------------- relations ---------------------------- */
const FWD = { // parent table -> embedded table -> fk column on parent
  _: { clients: 'client_id', projects: 'project_id', leads: 'lead_id', invoices: 'invoice_id', packages: 'package_id', suppliers: 'supplier_id', supplier_bills: 'bill_id' },
  content_posts: { design_tasks: 'design_task_id' }, queries: { design_tasks: 'task_id' }, time_logs: { design_tasks: 'task_id' }
}
const REV = { design_tasks: { task_proofs: 'task_id', task_comments: 'task_id' }, queries: { query_replies: 'query_id' },
  supplier_bills: { supplier_bill_allocations: 'bill_id', supplier_payments: 'bill_id' } }
const TABLE_ID = { v_invoice_status: 'invoices' }

function parseSelect(sel) {
  const out = []; let depth = 0, cur = ''
  for (const ch of sel || '*') {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = '' } else cur += ch
  }
  if (cur.trim()) out.push(cur.trim())
  return out.map((p) => { const m = p.match(/^([\w]+)(?:![\w]+)?\((.*)\)$/s); return m ? { embed: m[1], cols: m[2] } : null }).filter(Boolean)
}
function embed(table, row, embeds) {
  const r = { ...row }
  for (const e of embeds) {
    const fk = FWD[table]?.[e.embed] || FWD._[e.embed]
    const rev = REV[TABLE_ID[table] || table]?.[e.embed]
    if (rev) {
      const kids = T(e.embed).filter((k) => k[rev] === row.id)
      r[e.embed] = e.cols.trim() === 'count' ? [{ count: kids.length }] : kids.map((k) => embed(e.embed, k, parseSelect(e.cols)))
    } else if (fk) {
      const target = T(e.embed).find((x) => x.id === row[fk])
      const sub = parseSelect(e.cols)
      r[e.embed] = target ? embed(e.embed, target, sub) : null
    }
  }
  return r
}
function view(name) {
  if (name === 'v_invoice_status') {
    const today = iso(new Date())
    return T('invoices').map((i) => {
      const overdue = ['sent', 'partial'].includes(i.status) && i.due_date < today
      return { ...i, client_name: T('clients').find((c) => c.id === i.client_id)?.name, balance: Number(i.total) - Number(i.amount_paid),
        overdue, days_overdue: overdue ? Math.round((new Date(today) - new Date(i.due_date)) / 86400000) : 0 }
    })
  }
  return T(name)
}
function visible(table, rows) {
  const me = uid()
  if (!currentUser) return rows
  if (READ[table] && !hasPerm(...READ[table])) {
    // walk-in billing: any team member sees walk-in customers, invoices they billed and money they collected
    if (table === 'clients') return rows.filter((r) => r.customer_type === 'walkin')
    if (table === 'invoices' || table === 'v_invoice_status') return rows.filter((r) => (r.sale_channel === 'walkin' && r.created_by === me) || T('payments').some((p) => p.invoice_id === r.id && p.collected_by === me))
    if (table === 'payments') return rows.filter((r) => r.collected_by === me)
    return []
  }
  if (table === 'staff_pay') return hasPerm('team.manage') ? rows : rows.filter((r) => r.user_id === me)
  if (table === 'notifications') return rows.filter((r) => r.user_id === me)
  if (table === 'queries') return rows.filter((r) => hasPerm('*') && permsOf(me).includes('*') || r.from_user === me || r.to_user === me || (r.to_role_id && r.to_role_id === myRoleId()))
  if (table === 'design_tasks' && !hasPerm('tasks.view', 'tasks.manage', 'tasks.review')) return hasPerm('tasks.work') ? rows.filter((r) => r.assignee_id === me || !r.assignee_id) : []
  if (table === 'time_logs') return rows.filter((r) => r.user_id === me || hasPerm('timesheet.all', 'reports.team', 'reports.clients'))
  return rows
}

/* ---------------------------- query builder ---------------------------- */
const cmp = (a, b) => (a === b ? 0 : a === null || a === undefined ? 1 : b === null || b === undefined ? -1 : a < b ? -1 : 1)
const likeRe = (p) => new RegExp('^' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.') + '$', 'i')
const getv = (r, c) => c.split('.').reduce((o, k) => (o == null ? o : o[k]), r)

class Query {
  constructor(table) { this.table = table; this.filters = []; this.orders = []; this.op = 'select'; this.sel = '*'; this.opts = {} }
  select(sel = '*', opts = {}) { if (this.op === 'select') { this.sel = sel; this.opts = opts } else this.returning = sel || '*'; return this }
  insert(v) { this.op = 'insert'; this.payload = v; return this }
  upsert(v) { this.op = 'upsert'; this.payload = v; return this }
  update(v) { this.op = 'update'; this.payload = v; return this }
  delete() { this.op = 'delete'; return this }
  f(fn) { this.filters.push(fn); return this }
  eq(c, v) { return this.f((r) => String(getv(r, c)) === String(v)) }
  neq(c, v) { return this.f((r) => String(getv(r, c)) !== String(v)) }
  in(c, list) { const s = list.map(String); return this.f((r) => s.includes(String(getv(r, c)))) }
  is(c, v) { return this.f((r) => (v === null ? getv(r, c) == null : getv(r, c) === v)) }
  gte(c, v) { return this.f((r) => getv(r, c) != null && String(getv(r, c)) >= String(v)) }
  lte(c, v) { return this.f((r) => getv(r, c) != null && String(getv(r, c)) <= String(v)) }
  ilike(c, p) { const re = likeRe(p); return this.f((r) => re.test(String(getv(r, c) ?? ''))) }
  not(c, op, v) {
    if (op === 'is') return this.f((r) => getv(r, c) != null)
    if (op === 'in') { const s = String(v).replace(/^\(|\)$/g, '').split(','); return this.f((r) => !s.includes(String(getv(r, c)))) }
    if (op === 'eq') return this.neq(c, v)
    return this
  }
  or(expr) {
    const parts = expr.split(',').map((p) => { const [c, op, ...rest] = p.split('.'); return { c, op, v: rest.join('.') } })
    return this.f((r) => parts.some(({ c, op, v }) => op === 'ilike' ? likeRe(v).test(String(r[c] ?? '')) : op === 'eq' ? String(r[c]) === v : false))
  }
  order(c, o = {}) { this.orders.push({ c, asc: o.ascending !== false, nullsFirst: o.nullsFirst }); return this }
  limit(n) { this.lim = n; return this }
  single() { this.one = 'single'; return this }
  maybeSingle() { this.one = 'maybe'; return this }
  then(res, rej) { return Promise.resolve().then(() => this.exec()).then(res, rej) }
  catch(rej) { return this.then(null, rej) }

  match(rows) { return rows.filter((r) => this.filters.every((fn) => fn(r))) }
  shape(rows, sel) {
    const embeds = parseSelect(sel)
    return rows.map((r) => embed(this.table, r, embeds))
  }
  finish(rows) {
    if (this.one) {
      if (rows.length === 0) return this.one === 'maybe' ? { data: null, error: null } : { data: null, error: { message: 'Record not found' } }
      return { data: rows[0], error: null }
    }
    return { data: rows, error: null }
  }
  exec() {
    if (!db) load()
    try {
      const t = this.table
      if (this.op === 'select') {
        let rows = this.match(visible(t, view(t)))
        if (this.opts.head) return { data: null, count: rows.length, error: null }
        for (const o of [...this.orders].reverse()) rows = [...rows].sort((a, b) => {
          const x = getv(a, o.c), y = getv(b, o.c)
          if (x == null && y == null) return 0
          if (x == null) return o.nullsFirst ? -1 : 1
          if (y == null) return o.nullsFirst ? 1 : -1
          return o.asc ? cmp(x, y) : -cmp(x, y)
        })
        if (this.lim) rows = rows.slice(0, this.lim)
        return this.finish(clone(this.shape(rows, this.sel)))
      }
      if (this.op !== 'select' && !canWrite(t)) throw new Error('You do not have permission to do that')
      if (this.op === 'insert' || this.op === 'upsert') {
        const list = Array.isArray(this.payload) ? this.payload : [this.payload]
        const out = []
        for (const v of list) {
          if (this.op === 'upsert' && v.id) { const ex = T(t).find((r) => r.id === v.id); if (ex) { Object.assign(ex, v); out.push(ex); continue } }
          if (this.op === 'upsert' && t === 'social_kpis') { const ex = T(t).find((r) => r.client_id === v.client_id && r.platform === v.platform && r.period_start === v.period_start); if (ex) { Object.assign(ex, v, { updated_at: nowISO() }); kpiFill(ex); out.push(ex); continue } }
          if (this.op === 'upsert' && t === 'staff_pay') { const ex = T(t).find((r) => r.user_id === v.user_id); if (ex) { Object.assign(ex, v); payCalc(ex); out.push(ex); continue } }
          const r = { ...(DEFAULTS[t]?.() || {}), ...Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined)) }
          r.id ||= uuid(); r.created_at ||= nowISO()
          beforeInsert(t, r); T(t).push(r); afterInsert(t, r); out.push(r)
        }
        persist()
        return this.finish(clone(this.returning ? this.shape(out, this.returning) : out))
      }
      if (this.op === 'update') {
        const rows = this.match(visible(t, T(t)))
        for (const r of rows) {
          const old = { ...r }
          guardDesigner(t, old, { ...r, ...this.payload })
          if ((t === 'expenses' || t === 'supplier_payments') && old.reimbursement_id && ((this.payload.amount !== undefined && Number(this.payload.amount) !== Number(old.amount)) || ('paid_by' in this.payload && (this.payload.paid_by || null) !== (old.paid_by || null)))) throw new Error('This expense has already been repaid. Undo the repayment first to change the amount or who paid.')
          Object.assign(r, this.payload)
          afterUpdate(t, old, r)
        }
        persist()
        return this.finish(clone(this.returning ? this.shape(rows, this.returning) : rows))
      }
      if (this.op === 'delete') {
        const kill = new Set(this.match(visible(t, T(t))).map((r) => r.id))
        if (t === 'roles') for (const id of kill) {
          if (T('roles').find((r) => r.id === id)?.key === 'admin') throw new Error('The Administrator role cannot be deleted')
          if (T('profiles').some((p) => p.role_id === id)) throw new Error('Move the users on this role to another role before deleting it')
        }
        if ((t === 'expenses' || t === 'supplier_payments') && T(t).some((r) => kill.has(r.id) && r.reimbursement_id)) throw new Error('This expense has already been repaid. Undo the repayment first.')
        db[t] = T(t).filter((r) => !kill.has(r.id))
        if (t === 'reimbursements') [...T('expenses'), ...T('supplier_payments')].forEach((e) => { if (kill.has(e.reimbursement_id)) e.reimbursement_id = null })
        if (t === 'design_tasks') { db.task_proofs = T('task_proofs').filter((p) => !kill.has(p.task_id)); db.task_comments = T('task_comments').filter((p) => !kill.has(p.task_id)) }
        if (t === 'invoices') db.payments = T('payments').filter((p) => !kill.has(p.invoice_id))
        if (t === 'payments') [...new Set(T('invoices').map((i) => i.id))].forEach(syncInvoice)
        if (t === 'supplier_bills') { db.supplier_payments = T('supplier_payments').filter((p) => !kill.has(p.bill_id)); db.supplier_bill_allocations = T('supplier_bill_allocations').filter((a) => !kill.has(a.bill_id)) }
        if (t === 'supplier_payments') T('supplier_bills').forEach((b) => syncBill(b.id))
        if (t === 'leads') db.interactions = T('interactions').filter((i) => !kill.has(i.lead_id))
        if (t === 'queries') db.query_replies = T('query_replies').filter((x) => !kill.has(x.query_id))
        persist()
        return { data: null, error: null }
      }
    } catch (e) { return { data: null, error: { message: e.message } } }
  }
}

/* ---------------------------- RPC ---------------------------- */
function rpc(name, a) {
  if (!db) load()
  try {
    if (name === 'staff_cost_rates') return { data: hasPerm('team.manage', 'reports.clients', 'reports.team') ? T('staff_pay').map((x) => ({ user_id: x.user_id, cost_per_hour: x.cost_per_hour })) : [], error: null }
    if (name === 'walkin_find') {
      const t = String(a.p_q || '').trim(), dg = t.replace(/\D/g, '')
      if (t.length < 3) return { data: [], error: null }
      const key = (x) => String(x || '').replace(/\D/g, '').slice(-10)
      const rows = T('clients').filter((c) => c.customer_type === 'walkin' && ((dg && key(c.phone).includes(dg)) || c.name.toLowerCase().includes(t.toLowerCase()))).map((c) => {
        const inv = T('invoices').filter((i) => i.client_id === c.id && i.status !== 'cancelled')
        return { id: c.id, code: c.code, name: c.name, phone: c.phone, visits: inv.length, last_visit: inv.map((i) => i.issue_date).sort().pop() || null,
          balance: inv.filter((i) => ['sent', 'partial'].includes(i.status)).reduce((x, i) => x + Number(i.total) - Number(i.amount_paid), 0) }
      }).sort((x, y) => String(y.last_visit).localeCompare(String(x.last_visit))).slice(0, 6)
      return { data: rows, error: null }
    }
    if (name === 'walkin_customer') {
      const me = uid(); if (!me) throw new Error('Not allowed')
      if (!String(a.p_name || '').trim()) throw new Error('Enter the customer name')
      const key = (x) => String(x || '').replace(/\D/g, '').slice(-10)
      const hit = key(a.p_phone).length >= 10 && T('clients').find((c) => c.customer_type === 'walkin' && key(c.phone) === key(a.p_phone))
      const more = { whatsapp: a.p_whatsapp || a.p_phone || null, email: a.p_email || null, city: a.p_city || null, address: a.p_address || null, salesman_id: a.p_salesman_id || null, salesman_name: a.p_salesman_name || null }
      if (hit) { for (const k of Object.keys(more)) if (!hit[k] && more[k]) hit[k] = more[k]; persist(); return { data: hit.id, error: null } }
      const prev = currentUser; currentUser = null
      try {
        const { data: c } = new Query('clients').insert({ name: a.p_name.trim(), contact_person: a.p_name.trim(), phone: a.p_phone || null, ...more, customer_type: 'walkin', status: 'active', account_manager_id: me, created_by: me }).exec()
        return { data: (Array.isArray(c) ? c[0] : c).id, error: null }
      } finally { currentUser = prev }
    }
    if (name === 'walkin_sale' || name === 'walkin_collect') {
      const me = uid(); if (!me) throw new Error('Not allowed')
      const key = (x) => String(x || '').replace(/\D/g, '').slice(-10)
      const prev = currentUser; currentUser = null   // runs with database rights, like the SQL function
      try {
        if (name === 'walkin_collect') {
          const inv = T('invoices').find((i) => i.id === a.p_invoice && i.sale_channel === 'walkin' && ['sent', 'partial'].includes(i.status))
          if (!inv) throw new Error('Invoice not found or already paid')
          const bal = Number(inv.total) - Number(inv.amount_paid)
          if (!(Number(a.p_amount) > 0) || Number(a.p_amount) > bal + 0.01) throw new Error(`Enter an amount up to the balance (${bal})`)
          new Query('payments').insert({ invoice_id: inv.id, client_id: inv.client_id, amount: Number(a.p_amount), method: a.p_method || 'Cash', reference: a.p_reference || null, note: 'Walk-in counter', created_by: me, collected_by: me }).exec()
          return { data: Number(inv.total) - Number(inv.amount_paid), error: null }
        }
        const items = a.p_items || []
        if (!items.length) throw new Error('Add at least one item')
        let cid = a.p_client_id
        if (!cid) {
          if (!String(a.p_name || '').trim()) throw new Error('Enter the customer name')
          const more = { whatsapp: a.p_whatsapp || a.p_phone || null, email: a.p_email || null, city: a.p_city || null, address: a.p_address || null, salesman_id: a.p_salesman_id || null, salesman_name: a.p_salesman_name || null }
          const hit = key(a.p_phone).length >= 10 && T('clients').find((c) => c.customer_type === 'walkin' && key(c.phone) === key(a.p_phone))
          if (hit) { cid = hit.id; for (const k of Object.keys(more)) if (!hit[k] && more[k]) hit[k] = more[k] }
          if (!cid) {
            const { data: c } = new Query('clients').insert({ name: a.p_name.trim(), contact_person: a.p_name.trim(), phone: a.p_phone || null, ...more, customer_type: 'walkin', status: 'active', account_manager_id: me, created_by: me }).exec()
            cid = (Array.isArray(c) ? c[0] : c).id
          }
        }
        const { data: iv } = new Query('invoices').insert({ client_id: cid, issue_date: iso(new Date()), due_date: iso(new Date()), items, discount: Number(a.p_discount) || 0, status: 'sent', sale_channel: 'walkin', notes: a.p_notes || null, terms: settings().invoice_terms, created_by: me }).exec()
        const inv = Array.isArray(iv) ? iv[0] : iv
        if (Number(a.p_paid) > 0) {
          if (Number(a.p_paid) > Number(inv.total) + 0.01) throw new Error('Amount received is more than the invoice total')
          new Query('payments').insert({ invoice_id: inv.id, client_id: cid, amount: Number(a.p_paid), method: a.p_method || 'Cash', reference: a.p_reference || null, note: 'Walk-in counter', created_by: me, collected_by: me }).exec()
        }
        const fin = T('invoices').find((i) => i.id === inv.id)
        return { data: { invoice_id: fin.id, number: fin.number, client_id: cid, total: fin.total, paid: fin.amount_paid }, error: null }
      } finally { currentUser = prev }
    }
    if (name === 'repay_expenses') {
      if (!hasPerm('expenses.manage', 'payments.manage')) throw new Error('Not allowed')
      const ids = a.p_expense_ids || [], sids = a.p_supplier_payment_ids || []
      const e1 = T('expenses').filter((e) => ids.includes(e.id) && e.paid_by === a.p_person && !e.reimbursement_id)
      const e2 = T('supplier_payments').filter((e) => sids.includes(e.id) && e.paid_by === a.p_person && !e.reimbursement_id)
      const rows = [...e1, ...e2]
      if (!rows.length || e1.length !== ids.length || e2.length !== sids.length) throw new Error('Some of the selected items are not payable to this person (already repaid or paid by someone else).')
      const { data } = new Query('reimbursements').insert({ person_id: a.p_person, paid_on: a.p_paid_on || iso(new Date()), amount: rows.reduce((x, e) => x + Number(e.amount), 0), method: a.p_method || 'Bank Transfer', reference: a.p_reference || null, note: a.p_note || null }).exec()
      const r = Array.isArray(data) ? data[0] : data
      rows.forEach((e) => { e.reimbursement_id = r.id }); persist()
      return { data: r.id, error: null }
    }
    if (name === 'convert_lead') {
      const l = T('leads').find((x) => x.id === a.p_lead); if (!l) throw new Error('Lead not found')
      if (l.converted_client_id) return { data: l.converted_client_id, error: null }
      const { data: c } = new Query('clients').insert({ name: l.company || l.name, contact_person: l.name, phone: l.phone, whatsapp: l.whatsapp, email: l.email, city: l.city, industry: l.industry, account_manager_id: l.owner_id || uid(), salesman_id: l.owner_id || uid(), status: 'onboarding', lead_id: l.id, notes: l.notes }).exec()
      const row = Array.isArray(c) ? c[0] : c
      Object.assign(l, { stage: 'won', converted_client_id: row.id })
      T('interactions').forEach((i) => { if (i.lead_id === l.id && !i.client_id) i.client_id = row.id })
      persist(); return { data: row.id, error: null }
    }
    if (name === 'generate_retainer_invoices') {
      const m = String(a.p_month).slice(0, 8) + '01'; const mEnd = iso(new Date(new Date(m).getFullYear(), new Date(m).getMonth() + 1, 0)); let n = 0
      for (const p of T('packages').filter((x) => x.status === 'active' && x.billing_type !== 'one_time' && x.start_date <= mEnd && (!x.end_date || x.end_date >= m))) {
        if (T('invoices').some((i) => i.package_id === p.id && i.period_month === m)) continue
        const months = (new Date(m).getFullYear() - new Date(p.start_date).getFullYear()) * 12 + new Date(m).getMonth() - new Date(p.start_date).getMonth()
        if (p.billing_type === 'quarterly' && months % 3) continue
        if (p.billing_type === 'yearly' && months % 12) continue
        const issue = [iso(new Date()), iso(new Date(new Date(m).getFullYear(), new Date(m).getMonth(), p.billing_day || 1))].sort()[1]
        const label = new Date(m).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        new Query('invoices').insert({ client_id: p.client_id, package_id: p.id, period_month: m, period_start: m, period_end: iso(new Date(new Date(m).getFullYear(), new Date(m).getMonth() + (p.billing_type === 'quarterly' ? 3 : p.billing_type === 'yearly' ? 12 : 1), 0)), issue_date: issue, due_date: iso(new Date(new Date(issue).getTime() + 7 * 86400000)),
          items: [{ description: `${p.name} — ${label}`, qty: 1, rate: p.fee }], status: 'draft', terms: settings().invoice_terms }).exec()
        n++
      }
      return { data: n, error: null }
    }
    if (name === 'portal_get') {
      const l = T('approval_links').find((x) => x.token === a.p_token && !x.revoked && new Date(x.expires_at) > new Date())
      if (!l) return { data: { error: 'This link is invalid or has expired.' }, error: null }
      const c = T('clients').find((x) => x.id === l.client_id); const st = settings()
      const posts = T('content_posts').filter((p) => p.client_id === c.id && ['client_approval', 'approved', 'scheduled', 'published'].includes(p.status) && p.publish_date >= day(-7)).sort((x, y) => x.publish_date.localeCompare(y.publish_date))
      const proofs = T('task_proofs').filter((pr) => {
        const t = T('design_tasks').find((x) => x.id === pr.task_id)
        if (!t || t.client_id !== c.id || pr.status !== 'approved') return false
        if (pr.client_decision && new Date(pr.client_decided_at) < new Date(Date.now() - 14 * 86400000)) return false
        return pr.version === Math.max(...T('task_proofs').filter((x) => x.task_id === t.id).map((x) => x.version))
      }).map((pr) => { const t = T('design_tasks').find((x) => x.id === pr.task_id); return { ...pr, task_code: t.code, task_title: t.title, task_type: t.task_type } })
      return { data: clone({ client: { name: c.name, contact: c.contact_person }, company: { name: st.company_name, phone: st.phone, website: st.website, approval_hours: st.approval_hours || 24 }, posts, proofs }), error: null }
    }
    if (name === 'portal_decide') {
      const l = T('approval_links').find((x) => x.token === a.p_token && !x.revoked); if (!l) return { data: { error: 'Link invalid or expired' }, error: null }
      const prev = currentUser; currentUser = null
      let ok = false
      if (a.p_kind === 'post') {
        const p = T('content_posts').find((x) => x.id === a.p_id && x.client_id === l.client_id && x.status === 'client_approval')
        if (p) { Object.assign(p, { status: a.p_decision === 'approved' ? 'approved' : 'copywriting', client_note: a.p_note || null, client_decided_at: nowISO() }); notify(p.created_by, `Client ${a.p_decision.replace('_', ' ')} a post`, p.title + (a.p_note ? ' — ' + a.p_note : ''), '/calendar'); ok = true }
      } else {
        const pr = T('task_proofs').find((x) => x.id === a.p_id && !x.client_decision)
        if (pr) {
          const old = { ...pr }; Object.assign(pr, { client_decision: a.p_decision, client_note: a.p_note || null, client_decided_at: nowISO() }); afterUpdate('task_proofs', old, pr); ok = true
          if (a.p_note) T('task_comments').push({ id: uuid(), task_id: pr.task_id, author_id: null, kind: 'client', body: 'Client feedback: ' + a.p_note, created_at: nowISO() })
        }
      }
      currentUser = prev; persist()
      return { data: { ok }, error: null }
    }
    return { data: null, error: { message: 'Unknown function ' + name } }
  } catch (e) { return { data: null, error: { message: e.message } } }
}

/* ---------------------------- auth / storage / realtime ---------------------------- */
function sessionFor(p) { return p ? { access_token: 'demo', user: { id: p.id, email: p.email } } : null }
function emit(evt) { const s = sessionFor(currentUser); authListeners.forEach((fn) => fn(evt, s)) }

export const demoClient = {
  from: (t) => new Query(t),
  rpc: (name, args) => Promise.resolve(rpc(name, args || {})),
  auth: {
    getSession: async () => { if (!db) load(); return { data: { session: sessionFor(currentUser) } } },
    getUser: async () => ({ data: { user: currentUser ? { id: currentUser.id, email: currentUser.email } : null } }),
    onAuthStateChange: (fn) => { authListeners.add(fn); return { data: { subscription: { unsubscribe: () => authListeners.delete(fn) } } } },
    signInWithPassword: async ({ email, password }) => {
      if (!db) load()
      const login = String(email).trim().toLowerCase()
      const p = T('profiles').find((x) => x.active && (x.email?.toLowerCase() === login || (x.username || DEMO_USERNAMES[x.id]) === login))
      const pw = p && ((db._pw || {})[p.id] || `${DEMO_USERNAMES[p.id]}@123`)
      if (!p || password !== pw) return { error: { message: 'Invalid login credentials' } }
      currentUser = p; try { localStorage.removeItem(SKEY); sessionStorage.removeItem(SKEY); sessStore().setItem(SKEY, p.id) } catch { /* ignore */ }
      emit('SIGNED_IN'); return { data: { session: sessionFor(p) }, error: null }
    },
    signOut: async () => { currentUser = null; try { sessionStorage.removeItem(SKEY); localStorage.removeItem(SKEY) } catch { /* ignore */ } emit('SIGNED_OUT'); return { error: null } },
    resetPasswordForEmail: async () => ({ error: null })
  },
  storage: {
    from: () => ({
      upload: async (path, file) => { files[path] = URL.createObjectURL(file); return { data: { path }, error: null } },
      createSignedUrl: async (path) => ({ data: files[path] ? { signedUrl: files[path] } : null, error: files[path] ? null : { message: 'not found' } }),
      remove: async (paths) => { paths.forEach((p) => delete files[p]); return { error: null } }
    })
  },
  channel: () => { const ch = { on: () => ch, subscribe: () => ch }; return ch },
  removeChannel: () => {}
}

const DEMO_USERNAMES = { 'u-admin': 'admin', 'u-mkt': 'marketer', 'u-arjun': 'designer', 'u-fathima': 'designer2', 'u-fin': 'finance' }
export async function demoApi(name, body) {
  db._pw ||= {}
  if (name === 'admin-users' && body.action === 'create') {
    if (T('profiles').some((p) => p.email === body.email)) throw new Error('A user with this email already exists')
    const id = uuid()
    if (!T('roles').some((r) => r.id === body.role_id)) throw new Error('Choose a role')
    T('profiles').push({ ...DEFAULTS.profiles(), id, email: body.email, full_name: body.full_name, role_id: body.role_id, active: true, created_at: nowISO(), ...body.profile })
    if (Number(body.monthly_salary) > 0) { const sp = { user_id: id, monthly_salary: Number(body.monthly_salary), cost_per_hour: 0 }; payCalc(sp); T('staff_pay').push(sp) }
    db._pw[id] = body.password
    persist(); return { ok: true }
  }
  if (name === 'admin-users' && body.action === 'set_password') { db._pw[body.user_id] = body.password; persist(); return { ok: true } }
  return { ok: true }
}
export const demoFileUrls = (ids) => Object.fromEntries(ids.map((id) => [id, files[T('task_proofs').find((p) => p.id === id)?.file_path]]).filter(([, u]) => u))

// restore a signed-in demo user for this tab
;(function restore() {
  if (import.meta.env.VITE_DEMO !== '1') return
  load()
  try { const id = sessionStorage.getItem(SKEY) || localStorage.getItem(SKEY); if (id) currentUser = T('profiles').find((p) => p.id === id) || null } catch { /* ignore */ }
})()

/* ---------------------------- seed ---------------------------- */
function seed() {
  db = { _seq: {} }
  db.roles = DEFAULT_ROLES.map((r) => ({ id: 'role-' + r.key, key: r.key, name: r.name, description: r.description, color: r.color, permissions: r.permissions, is_system: !!r.is_system, created_at: ago(3000) }))
  const P = (id, email, full_name, role, designation, salary) => ({ id, email, full_name, role_id: 'role-' + role, designation, weekly_hours: 54, work_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    work_start: '09:30', work_end: '18:30', joined_on: day(-400), active: true, created_at: ago(2000), _salary: salary })
  const ad = 'u-admin', mk = 'u-mkt', d1 = 'u-arjun', d2 = 'u-fathima', fn = 'u-fin'
  db.profiles = [P(ad, 'nabeel@aqlyon.demo', 'Nabeel Narangoli', 'admin', 'Managing Director', 0), P(mk, 'shahana@aqlyon.demo', 'Shahana K', 'marketer', 'Digital Marketing Executive', 28000),
    P(d1, 'arjun@aqlyon.demo', 'Arjun Das', 'designer', 'Senior Graphic Designer', 25000), P(d2, 'fathima@aqlyon.demo', 'Fathima Rinsha', 'designer', 'Graphic Designer & Video Editor', 20000),
    P(fn, 'rahul@aqlyon.demo', 'Rahul M', 'finance', 'Accounts', 22000)]
  db.staff_pay = db.profiles.filter((p) => p._salary).map((p) => { const r = { user_id: p.id, monthly_salary: p._salary, cost_per_hour: 0 }; return r })
  db.profiles.forEach((p) => delete p._salary)
  db.staff_pay.forEach(payCalc)
  db.settings = [{ id: 1, company_name: 'Aqlyon Brand Management', address: 'First Floor, Muhyiddin Building, behind Municipal Shopping Complex, Koyilandy, Keralam 673305, India',
    phone: '+91 70341 42256', email: 'hello@aqlyondm.com', website: 'www.aqlyondm.com', currency: 'INR', invoice_prefix: 'AQB-INV', quote_prefix: 'AQB-QT', po_prefix: 'AQB-PO', task_prefix: 'DT',
    bank_details: 'Aqlyon Brand Management\nYour Bank, Koyilandy branch\nA/c XXXX XXXX 1234\nIFSC XXXX0001234', upi_id: 'aqlyonbrand@upi',
    invoice_terms: 'Payment due within 7 days of invoice date. Thank you for your business!', default_max_revisions: 2, approval_hours: 24,
    quote_terms: QUOTE_TERMS, proposal_intro: PROPOSAL_INTRO, client_responsibilities: CLIENT_RESPONSIBILITIES, proposal_exclusions: PROPOSAL_EXCLUSIONS, proposal_acceptance: PROPOSAL_ACCEPTANCE }]
  const prev = currentUser
  const as = (id) => { currentUser = db.profiles.find((p) => p.id === id) }
  const ins = (t, v) => { const { data } = new Query(t).insert(v).exec(); return Array.isArray(data) ? data[0] : data }

  as(ad)
  ;[['Social Media Management – Starter (12 posts)', 'Social Media', 'per month', 8000], ['Social Media Management – Growth (20 posts + 4 reels)', 'Social Media', 'per month', 15000],
    ['Social Media Management – Premium (30 posts + 8 reels)', 'Social Media', 'per month', 25000], ['Static Post Design', 'Design', 'per item', 500], ['Carousel Design (up to 5 slides)', 'Design', 'per item', 1200],
    ['Story Design', 'Design', 'per item', 300], ['Reel Editing (up to 30 sec)', 'Video', 'per item', 1500], ['Logo Design', 'Branding', 'per project', 5000], ['Brand Identity Kit', 'Branding', 'per project', 15000],
    ['Brochure / Flyer Design', 'Design', 'per item', 2000], ['Meta Ads Management', 'Ads', 'per month', 6000], ['Google Ads Management', 'Ads', 'per month', 7000],
    ['SEO – Local / Google Business Profile', 'SEO', 'per month', 5000], ['Website Design – Landing Page', 'Web', 'per project', 15000], ['Product / Promo Shoot', 'Video', 'per project', 8000]]
    .forEach(([name, category, unit, rate]) => ins('services', { name, category, unit, rate }))
  PROPOSAL_SERVICES.forEach(([name, category, unit, rate, description]) => ins('services', { name, category, unit, rate, description }))

  as(mk)
  const c1 = ins('clients', { name: 'Malabar Bakes & Café', contact_person: 'Ashraf P', phone: '9847012345', whatsapp: '9847012345', city: 'Koyilandy', industry: 'Bakery', instagram: '@malabarbakes', account_manager_id: mk,
    brand_colors: '#8B2E16, #F4C27A', brand_fonts: 'Playfair Display, Poppins', brand_tone: 'Warm, family, festive', target_audience: 'Families and college students in Koyilandy & Vadakara', onboarded_on: mStart(-4) })
  const c2 = ins('clients', { name: 'Seashore Textiles', contact_person: 'Riyas T', phone: '9846098765', city: 'Koyilandy', industry: 'Textiles / Fashion', instagram: '@seashoretextiles', account_manager_id: mk, brand_colors: '#0E4D64, #F2E8CF', brand_tone: 'Premium, elegant', onboarded_on: mStart(-10) })
  as(ad)
  const c3 = ins('clients', { name: "Dr. Meera's Dental Clinic", contact_person: 'Dr. Meera Nair', phone: '9895011122', city: 'Payyoli', industry: 'Healthcare / Clinic', account_manager_id: ad, brand_colors: '#1F6FB2, #FFFFFF', onboarded_on: mStart(-2) })
  as(mk)
  const c4 = ins('clients', { name: 'Kappad Beach Resort', contact_person: 'Sameer K', phone: '9744055566', city: 'Kappad', industry: 'Hotel / Resort', account_manager_id: mk, status: 'onboarding', onboarded_on: day(-5) })

  ins('packages', { client_id: c1.id, name: 'Social Media Growth', fee: 15000, posts_per_month: 12, reels_per_month: 4, stories_per_month: 12, carousels_per_month: 2, start_date: mStart(-4), renewal_date: day(20), platforms: ['Instagram', 'Facebook'] })
  ins('packages', { client_id: c2.id, name: 'Premium Social + Meta Ads', fee: 25000, posts_per_month: 16, reels_per_month: 8, stories_per_month: 15, carousels_per_month: 4, ad_budget: 20000, start_date: mStart(-10), renewal_date: day(65), platforms: ['Instagram', 'Facebook'] })
  ins('packages', { client_id: c3.id, name: 'Clinic Starter', fee: 8000, posts_per_month: 12, reels_per_month: 2, stories_per_month: 8, start_date: mStart(-2), renewal_date: day(300), platforms: ['Instagram', 'Facebook', 'Google Business'] })

  const L = (o) => ins('leads', { city: 'Koyilandy', owner_id: mk, ...o })
  const hashim = L({ name: 'Hashim', company: 'Hashim Electronics', phone: '9447000001', source: 'Instagram', stage: 'proposal', estimated_value: 12000, temperature: 'hot', next_follow_up: day(0), industry: 'Electronics', services_interest: ['Social Media Management', 'Meta Ads'] })
  L({ name: 'Divya', company: 'Lotus Ayurveda Spa', phone: '9447000002', source: 'Referral', stage: 'meeting', estimated_value: 18000, next_follow_up: day(2), industry: 'Beauty / Salon', city: 'Vadakara', services_interest: ['Social Media Management', 'Branding / Logo'] })
  const gym = L({ name: 'Anas', company: 'Fit Zone Gym', phone: '9447000003', source: 'Walk-in', stage: 'contacted', estimated_value: 9000, next_follow_up: day(-1), industry: 'Gym / Fitness', services_interest: ['Reels / Video'] })
  L({ name: 'Joseph', company: "St. Mary's Academy", phone: '9447000004', source: 'Website', stage: 'new', estimated_value: 30000, temperature: 'cold', owner_id: ad, industry: 'Education / Coaching', city: 'Perambra', services_interest: ['Website', 'SEO'] })
  L({ name: 'Nisha', company: 'Nisha Boutique', phone: '9447000005', source: 'Instagram', stage: 'negotiation', estimated_value: 10000, temperature: 'hot', next_follow_up: day(1), industry: 'Textiles / Fashion' })
  L({ name: 'Faisal', company: 'Faisal Builders', phone: '9447000006', source: 'Google', stage: 'lost', estimated_value: 40000, temperature: 'cold', lost_reason: 'Budget too high', industry: 'Construction', city: 'Kozhikode' })
  L({ name: 'Sreejith', company: 'Kerala Spices Co', phone: '9447000007', source: 'Event', stage: 'won', estimated_value: 20000, owner_id: ad, industry: 'Manufacturing' })

  ins('interactions', { lead_id: gym.id, type: 'visit', summary: 'Anas walked in. Wants 8 reels a month showing trainers and transformations.', outcome: 'Interested, checking budget', next_action: 'Call back with reel package price', next_action_date: day(-1), occurred_at: ago(30) })
  ins('interactions', { lead_id: hashim.id, type: 'whatsapp', summary: 'Shared portfolio of electronics store posts. Asked for monthly plan with Meta ads.', outcome: 'Quote requested', next_action: 'Follow up on quotation', next_action_date: day(0), occurred_at: ago(48) })
  ins('interactions', { client_id: c1.id, type: 'meeting', summary: 'Monthly review with Ashraf. Christmas cake pre-order campaign discussed; wants 3 reels showing the bakery.', outcome: 'Approved December theme', next_action: 'Send December calendar for approval', next_action_date: day(0), occurred_at: ago(50) })
  ins('interactions', { client_id: c2.id, type: 'whatsapp', direction: 'incoming', summary: 'Riyas asked for wedding season ad creatives in Malayalam + English.', outcome: 'Needs 6 ad creatives', next_action: 'Share ad budget proposal', next_action_date: day(1), occurred_at: ago(20) })

  const task = (o) => ins('design_tasks', { platform: 'Instagram', size: '1080×1350 (Portrait)', ...o })
  const t1 = task({ client_id: c1.id, title: 'Christmas plum cake pre-order post', brief: 'Festive, warm lighting, show the plum cake with ribbon. Use brand maroon.', copy_text: 'Pre-order your Christmas Plum Cake! ₹450/kg · Call 98470 12345', priority: 'high', assignee_id: d1, due_date: day(1), estimated_hours: 2 })
  task({ client_id: c1.id, title: 'Reel cover – Behind the oven', task_type: 'Thumbnail', size: '1080×1920 (Story/Reel)', brief: 'Cover frame for bakery behind-the-scenes reel.', assignee_id: d2, due_date: day(3), estimated_hours: 1 })
  const t3 = task({ client_id: c2.id, title: 'Wedding collection carousel', task_type: 'Carousel', brief: '5-slide carousel of bridal sarees. Elegant, gold accents.', copy_text: 'Wedding Collection 2026 · Seashore Textiles', priority: 'urgent', assignee_id: d1, due_date: day(0), estimated_hours: 4 })
  const t4 = task({ client_id: c2.id, title: 'Meta ad creative – Bridal offer', task_type: 'Ad Creative', platform: 'Facebook', size: '1080×1080 (Square)', brief: 'Square ad, 10% off bridal.', copy_text: 'Flat 10% off on Bridal Sarees', assignee_id: d2, due_date: day(-1), estimated_hours: 1.5 })
  as(ad)
  const t5 = task({ client_id: c3.id, title: 'Dental hygiene tips post', size: '1080×1080 (Square)', brief: 'Educational, clean, blue.', copy_text: '5 tips for healthy gums', priority: 'low', assignee_id: d2, due_date: day(2), estimated_hours: 1 })
  const t6 = task({ client_id: c3.id, title: 'Clinic flyer A5', task_type: 'Flyer', platform: 'Print', size: 'A5', brief: 'Opening offer flyer.', copy_text: 'Free check-up this month', assignee_id: d1, due_date: day(-6), estimated_hours: 3 })
  as(mk)
  task({ client_id: c4.id, title: 'Resort logo refresh', task_type: 'Logo', platform: 'Print', size: 'Custom', brief: 'Modern beach-inspired logo concepts, 3 options.', due_date: day(7), estimated_hours: 6 })

  // walk tasks through the workflow so history looks real
  as(d1); new Query('design_tasks').update({ status: 'in_progress' }).eq('id', t1.id).exec()
  ins('task_proofs', { task_id: t3.id, external_link: 'https://www.canva.com/', note: 'Slides 1–5 ready, used gold foil texture' })
  as(d2); ins('task_proofs', { task_id: t4.id, external_link: 'https://www.canva.com/', note: 'First version' })
  as(mk); new Query('task_proofs').update({ status: 'changes_requested', review_note: 'Make the 10% bigger and add the shop phone number.', reviewed_by: mk }).eq('task_id', t4.id).exec()
  as(d2); ins('task_proofs', { task_id: t5.id, external_link: 'https://drive.google.com/', note: 'Blue theme' })
  ins('task_comments', { task_id: t5.id, body: 'Should I include the clinic phone number at the bottom?' })
  as(ad); new Query('task_proofs').update({ status: 'approved', reviewed_by: ad }).eq('task_id', t5.id).exec()
  as(d1); ins('task_proofs', { task_id: t6.id, external_link: 'https://drive.google.com/', note: 'Print-ready PDF' })
  as(ad); new Query('task_proofs').update({ status: 'approved', reviewed_by: ad, client_decision: 'approved', client_decided_at: ago(150) }).eq('task_id', t6.id).exec()
  new Query('design_tasks').update({ status: 'delivered' }).eq('id', t6.id).exec()

  as(mk)
  const post = (o) => ins('content_posts', { platforms: ['Instagram', 'Facebook'], ...o })
  post({ client_id: c1.id, publish_date: day(2), title: 'Christmas plum cake pre-order', pillar: 'Offer', caption: 'Our famous plum cake is back 🎄 Pre-order now and pick up fresh on 24th!', hashtags: '#koyilandy #plumcake #christmas', status: 'client_approval', design_task_id: t1.id })
  post({ client_id: c1.id, publish_date: day(4), title: 'Behind the oven', post_type: 'Reel', pillar: 'Behind the scenes', platforms: ['Instagram'], caption: 'Ever wondered how our cakes are made?', status: 'in_design' })
  post({ client_id: c1.id, publish_date: day(-3), title: 'Weekend special combo', pillar: 'Promotional', caption: 'Puffs + tea combo ₹49', status: 'published', reach: 2400, likes: 180, comments: 22, shares: 9, saves: 31 })
  post({ client_id: c1.id, publish_date: day(-8), title: 'Meet our head baker', pillar: 'Brand story', caption: '25 years of baking in Koyilandy.', status: 'published', reach: 3100, likes: 260, comments: 41, shares: 14, saves: 20 })
  post({ client_id: c1.id, publish_date: day(9), title: 'New Year party orders', pillar: 'Offer', status: 'idea' })
  post({ client_id: c2.id, publish_date: day(1), title: 'Wedding collection launch', post_type: 'Carousel', pillar: 'Product showcase', caption: 'Introducing Wedding Collection 2026 ✨', status: 'internal_review', design_task_id: t3.id })
  post({ client_id: c2.id, publish_date: day(5), title: 'Customer testimonial', post_type: 'Reel', pillar: 'Testimonial', platforms: ['Instagram'], status: 'idea' })
  post({ client_id: c2.id, publish_date: day(-5), title: 'Festive saree edit', pillar: 'Product showcase', status: 'published', reach: 5200, likes: 410, comments: 35, shares: 22, saves: 88 })
  as(ad)
  post({ client_id: c3.id, publish_date: day(3), title: 'Dental tips', pillar: 'Educational', caption: '5 tips for healthy gums 🦷', status: 'client_approval', design_task_id: t5.id })
  ins('approval_links', { token: 'demo-malabar', client_id: c1.id, expires_at: new Date(Date.now() + 365 * 86400000).toISOString() })
  ins('approval_links', { token: 'demo-dental', client_id: c3.id, expires_at: new Date(Date.now() + 365 * 86400000).toISOString() })

  as(fn)
  const inv1 = ins('invoices', { client_id: c1.id, issue_date: day(-35), due_date: day(-28), items: [{ description: 'Social Media Growth — previous month', qty: 1, rate: 15000 }], status: 'sent' })
  const inv2 = ins('invoices', { client_id: c2.id, issue_date: day(-30), due_date: day(-23), items: [{ description: 'Premium Social + Meta Ads', qty: 1, rate: 25000 }, { description: 'Extra reel', qty: 2, rate: 1500 }], status: 'sent' })
  ins('invoices', { client_id: c3.id, issue_date: day(-12), due_date: day(-5), items: [{ description: 'Clinic flyer A5 design', qty: 1, rate: 2000 }, { description: 'Printing 1000 nos', qty: 1, rate: 3500 }], status: 'sent' })
  ins('invoices', { client_id: c1.id, issue_date: day(-65), due_date: day(-58), items: [{ description: 'Social Media Growth', qty: 1, rate: 15000 }], status: 'sent' })
  ins('payments', { invoice_id: inv1.id, paid_on: day(-25), amount: 15000, method: 'UPI', reference: 'UPI/4521' })
  ins('payments', { invoice_id: inv2.id, paid_on: day(-2), amount: 10000, method: 'Bank Transfer', reference: 'NEFT-8812' })
  ins('payments', { invoice_id: T('invoices')[3].id, paid_on: day(-55), amount: 15000, method: 'Cash' })
  const E = (o) => ins('expenses', { method: 'Bank Transfer', recurring: true, ...o })
  for (const k of [-2, -1, 0]) {
    const m = mStart(k)
    E({ spent_on: m, category: 'Rent', vendor: 'Muhyiddin Building', amount: 18000 })
    E({ spent_on: m, category: 'Salary', vendor: 'Team salaries', amount: 62000 })
    E({ spent_on: m, category: 'Software / Subscriptions', vendor: 'Adobe Creative Cloud', amount: 4230, method: 'Card' })
    E({ spent_on: m, category: 'Internet / Phone', vendor: 'KeralaVision', amount: 1180, method: 'UPI' })
  }
  // paid by the founder from his own account; last month's Adobe already repaid
  const adId = T('profiles').find((p) => T('roles').find((x) => x.id === p.role_id)?.key === 'admin')?.id
  const fpPrev = E({ spent_on: day(-34), category: 'Software / Subscriptions', vendor: 'Canva Pro', amount: 3999, method: 'Card', recurring: false, paid_by: adId, description: 'Annual plan – paid from founder card' })
  E({ spent_on: day(-6), category: 'Software / Subscriptions', vendor: 'Google Workspace', amount: 1840, method: 'Card', recurring: false, paid_by: adId, description: 'Paid from founder card' })
  E({ spent_on: day(-2), category: 'Travel / Fuel', vendor: 'HP Petrol Pump', amount: 1200, method: 'UPI', recurring: false, paid_by: adId, description: 'Client visit – Kappad' })
  const rb = ins('reimbursements', { person_id: adId, paid_on: day(-20), amount: 3999, method: 'Bank Transfer', reference: 'NEFT-5521', note: 'Repaid Canva' })
  T('expenses').find((e) => e.id === fpPrev.id).reimbursement_id = rb.id
  E({ spent_on: day(-4), category: 'Stock Images / Assets', vendor: 'Envato Elements', amount: 1400, method: 'Card', recurring: false })
  E({ spent_on: day(-3), category: 'Ad Spend (Client)', vendor: 'Meta Ads', amount: 6000, method: 'Card', client_id: c2.id, rebillable: true, recurring: false })
  // Outsourced logo for Kappad Beach Resort: invoice 20K, 10K advance; supplier 5K paid 3K + 2K; client pays balance 10K
  const logoInv = ins('invoices', { client_id: c4.id, issue_date: day(-14), due_date: day(-7), items: [{ description: 'Logo design & brand identity – Kappad Beach Resort', qty: 1, rate: 20000 }], status: 'sent', notes: '50% advance, balance on delivery' })
  ins('payments', { invoice_id: logoInv.id, paid_on: day(-14), amount: 10000, method: 'UPI', reference: 'UPI/9001', note: 'Advance 50%' })
  const pixel = ins('suppliers', { name: 'Pixel Studio', category: 'Freelance Designer', contact_person: 'Akhil R', phone: '9746011223', upi_id: 'akhil.pixel@upi' })
  const press = ins('suppliers', { name: 'Sreeram Offset Press', category: 'Printing Press', contact_person: 'Sreeram', phone: '9447123456', bank_details: 'SBI Koyilandy · A/c XXXX5678 · IFSC SBIN000XXXX' })
  ins('suppliers', { name: 'Frame Factory Media', category: 'Videographer', contact_person: 'Jithin', phone: '9995012345' })
  const logoPO = ins('supplier_bills', { supplier_id: pixel.id, title: 'Logo design – Kappad Beach Resort', order_date: day(-13), due_date: day(-6), items: [{ description: 'Logo design – 3 concepts + final files', qty: 1, rate: 5000 }] })
  ins('supplier_bill_allocations', { bill_id: logoPO.id, client_id: c4.id, invoice_id: logoInv.id, amount: 5000 })
  ins('supplier_payments', { bill_id: logoPO.id, paid_on: day(-13), amount: 3000, kind: 'advance', method: 'UPI', reference: 'UPI/7710', note: 'Advance before starting' })
  new Query('supplier_bills').update({ work_status: 'received', received_on: day(-5) }).eq('id', logoPO.id).exec()
  ins('supplier_payments', { bill_id: logoPO.id, paid_on: day(-5), amount: 2000, kind: 'final', method: 'UPI', reference: 'UPI/7788', note: 'Balance after logo delivered' })
  ins('payments', { invoice_id: logoInv.id, paid_on: day(-3), amount: 10000, method: 'Bank Transfer', reference: 'NEFT-3321', note: 'Balance after logo shared' })
  // one print run shared by two customers, part paid
  const printPO = ins('supplier_bills', { supplier_id: press.id, title: 'Flyer & menu card printing (2 clients)', order_date: day(-4), due_date: day(2), items: [{ description: 'A5 flyers 1000 nos – Dental clinic', qty: 1, rate: 3500 }, { description: 'Menu cards 200 nos – Malabar Bakes', qty: 1, rate: 4500 }], work_status: 'in_progress' })
  ins('supplier_bill_allocations', { bill_id: printPO.id, client_id: c3.id, invoice_id: T('invoices').find((i) => i.client_id === c3.id)?.id, amount: 3500 })
  ins('supplier_bill_allocations', { bill_id: printPO.id, client_id: c1.id, amount: 4500 })
  ins('supplier_payments', { bill_id: printPO.id, paid_on: day(-4), amount: 4000, kind: 'advance', method: 'Cash', note: '50% advance' })
  // ---- social media clients, with the real weekly numbers from the marketer's KPI sheet ----
  as(ad)
  const dm = (k, d) => { const m = mStart(k); return m.slice(0, 8) + String(d).padStart(2, '0') }
  const star = ins('clients', { name: 'Star Health Insurance Koyilandy', contact_person: 'Branch Manager', phone: '9447001100', city: 'Koyilandy', industry: 'Insurance', instagram: '@star_healthinsurancekoyilandy_', account_manager_id: mk, onboarded_on: dm(-2, 28) })
  const sparrow = ins('clients', { name: 'Sparrow Bell', contact_person: 'Owner', phone: '9447001200', city: 'Koyilandy', industry: 'Retail', instagram: '@sparrowbellco', account_manager_id: mk, onboarded_on: dm(-2, 20) })
  const xmart = ins('clients', { name: 'Express Mart Koyilandy', contact_person: 'Manager', phone: '9447001300', city: 'Koyilandy', industry: 'Supermarket', instagram: '@expressmartqld', account_manager_id: mk, onboarded_on: dm(-2, 14) })
  ins('packages', { client_id: star.id, name: 'Social Media – Insurance', fee: 9000, posts_per_month: 12, stories_per_month: 4, platforms: ['Instagram', 'Facebook'], start_date: dm(-2, 1) })
  ins('packages', { client_id: sparrow.id, name: 'Social Media – Growth', fee: 14000, posts_per_month: 12, stories_per_month: 8, reels_per_month: 2, platforms: ['Instagram', 'Facebook'], start_date: dm(-2, 1) })
  ins('packages', { client_id: xmart.id, name: 'Social Media – Starter', fee: 8000, posts_per_month: 10, stories_per_month: 4, platforms: ['Instagram', 'Facebook'], start_date: dm(-2, 1) })
  let seedN = 7; const rnd = (lo, hi) => { seedN = (seedN * 9301 + 49297) % 233280; return Math.round(lo + (seedN / 233280) * (hi - lo)) }
  const res = (scale) => [
    { platform: 'Instagram', url: 'https://www.instagram.com/p/demo' + rnd(1000, 9999), reach: rnd(80, 900) * scale, views: rnd(150, 1600) * scale, likes: rnd(6, 70) * scale, comments: rnd(0, 9), shares: rnd(0, 12), saves: rnd(0, 15) },
    { platform: 'Facebook', url: 'https://www.facebook.com/demo/posts/' + rnd(1000, 9999), reach: rnd(20, 400) * scale, views: rnd(40, 600) * scale, likes: rnd(1, 25), comments: rnd(0, 4), shares: rnd(0, 6), saves: null }]
  const SP = (c, k, d, title, o = {}) => { const st = o.status || 'published'
    return ins('content_posts', { client_id: c.id, publish_date: dm(k, d), title, post_type: 'Post', platforms: ['Instagram', 'Facebook'], status: st, assignee_id: d % 2 ? d2 : d1,
      results: st === 'published' ? (k === 0 && d > 24 ? res(1).map((x) => ({ platform: x.platform, url: x.url })) : res(k === 0 && d > 6 && d < 20 ? 3 : 1)) : [], ...o, published_url: undefined }) }
  for (const [d, t, o] of [[1, 'Malayalam health tip – monsoon fevers'], [2, 'Malayalam health tip – sugar check'], [4, 'Why health insurance early?'], [5, "Teachers' Day"], [8, 'Malayalam health related – cashless claims'], [11, 'Claim settlement story'], [14, 'Bill related – hospital bill shock'], [23, 'Health insurance highlight', { post_type: 'Story' }], [26, 'Health importance – Malayalam content'], [29, 'World Heart Day']]) SP(star, -1, d, t, o)
  for (const [d, t, o] of [[1, 'Malayalam health tip – BP'], [3, 'Family floater explained'], [6, 'Senior citizen plan'], [8, 'Malayalam health tip – dengue'], [10, 'World Mental Health Day'], [13, 'Tax saving with health insurance', { post_type: 'Story' }], [15, 'Claim helpline story', { post_type: 'Story' }], [17, 'Customer review'], [20, 'Diwali greeting', { status: 'approved', published_url: null }], [22, 'Top-up plans', { status: 'client_approval', published_url: null }], [24, 'Malayalam health tip – heart', { status: 'internal_review', published_url: null }], [27, 'Renewal reminder', { status: 'in_design', published_url: null }], [29, 'Hospital network list', { status: 'idea', published_url: null }]]) SP(star, 0, d, t, o)
  for (const [d, t, o] of [[2, 'New arrivals – kids wear'], [3, 'Story: new stock', { post_type: 'Story' }], [5, 'Onam collection'], [6, 'Reel: store walkthrough', { post_type: 'Reel' }], [9, 'Weekend offer'], [10, 'Story: poll', { post_type: 'Story' }], [12, 'Festive gift ideas'], [16, 'Customer pick'], [18, 'Story: offer', { post_type: 'Story' }], [20, 'Back to school'], [23, 'Store timings'], [26, 'Reel: try-on', { post_type: 'Reel' }], [28, 'Month-end sale']]) SP(sparrow, -1, d, t, o)
  for (const [d, t, o] of [[2, 'Gandhi Jayanti'], [4, 'Story: new stock', { post_type: 'Story' }], [7, 'Diwali collection teaser'], [9, 'Reel: Diwali looks', { post_type: 'Reel' }], [11, 'Story: poll', { post_type: 'Story' }], [14, 'Kids party wear'], [18, 'Diwali offer', { status: 'scheduled', published_url: null }], [21, 'Story: countdown', { post_type: 'Story', status: 'client_approval', published_url: null }], [25, 'Gift cards', { status: 'in_design', published_url: null }]]) SP(sparrow, 0, d, t, o)
  for (const [d, t, o] of [[16, 'Fresh vegetables daily'], [18, 'Weekend combo offer'], [20, 'Story: today’s deals', { post_type: 'Story' }], [23, 'Onam kit'], [25, 'Home delivery'], [27, 'Story: fresh fish', { post_type: 'Story' }], [29, 'Banner: Grand offer', { post_type: 'Banner' }]]) SP(xmart, -1, d, t, o)
  for (const [d, t, o] of [[2, 'Monthly grocery kit'], [5, 'Story: deals', { post_type: 'Story' }], [9, 'Diwali sweets'], [12, 'Free delivery above ₹999'], [16, 'Snacks festival', { status: 'approved', published_url: null }], [22, 'Diwali hampers', { status: 'internal_review', published_url: null }]]) SP(xmart, 0, d, t, o)
  const K = (c, platform, k, rows) => rows.forEach((r, i) => { if (!r) return; const [reach, content_shared, new_followers, profile_visits, story_views, post_views, interactions, followers_pct] = r
    ins('social_kpis', { client_id: c.id, platform, month: mStart(k), week_no: i + 1, reach, content_shared, new_followers, profile_visits, story_views, post_views, interactions, followers_pct }) })
  K(star, 'Instagram', -1, [[256, 8, 1, 18, 0, 256, 4, 38.3], [143, 4, 4, 7, 41, 102, 2, 80.4], [302, 3, 3, 20, 45, 250, 1, 43], [77, 6, 9, 23, 83, 1300, 12, 56]])
  K(star, 'Facebook', -1, [[null, 4, 1, 9, 0, 108, 2, 8.3], [null, 2, 1, 23, 0, 79, 6, 14], [null, 2, 0, 0, 0, 4, 1, 25], [null, 5, 0, 2, 0, 88, 3, 14.3]])
  K(star, 'Instagram', 0, [[35, 2, 1, 14, 55, 103, 1, null], [2300, 5, 2, 25, 0, 2900, 26, 57.1], [1200, 6, 1, 29, 93, 1800, 6, null]])
  K(star, 'Facebook', 0, [[null, 2, 0, 2, 0, null, 1, null], [1900, 6, 2, 25, 0, 2900, 26, null], [2500, 6, 3, 33, 0, 1100, 39, null]])
  K(sparrow, 'Instagram', -1, [[380, 8, 1, 35, 225, 1200, 196, null], [457, 2, 1, 28, 409, 392, 162, 70], [161, 4, 0, 19, 234, 430, 25, null], [98, 8, 0, 26, 146, 597, 22, null]])
  K(sparrow, 'Facebook', -1, [[null, 8, 0, 34, 0, 134, 13, 16.5], [null, 3, 0, 10, 0, 76, 3, 19.7], [null, 3, 1, 0, 0, 15, 5, 27.3], [null, 8, 0, 15, 0, 371, 5, null]])
  K(xmart, 'Instagram', -1, [[727, 4, 2, 29, 150, 555, null, 55.3], [864, 7, 21, 56, 201, 647, null, 74.2], [514, 9, 0, 12, 194, 58, 6, 86], [459, 6, 0, 15, 139, 314, null, null]])
  K(xmart, 'Facebook', 0, [[null, null, 0, 17, null, null, 0, null], [null, 1, 11, 52, null, 47, 1, 30.7], [null, 4, 1, 1, 0, 29, 2, null]])
  as(d1)
  rpc('walkin_sale', { p_name: 'Rasheed K', p_phone: '9847012345', p_items: [{ description: 'Visiting card design', qty: 1, rate: 800 }, { description: 'Printing 100 nos', qty: 1, rate: 450 }], p_discount: 50, p_paid: 1000, p_method: 'Cash' })
  as(mk)
  ins('quotations', { lead_id: hashim.id, bill_to: 'Hashim Electronics\nKoyilandy\n9447000001', items: [{ description: 'Social Media Management – Starter (12 posts)', qty: 1, rate: 8000 }, { description: 'Meta Ads Management', qty: 1, rate: 6000 }], discount: 1000, status: 'sent' })

  // time logs
  for (const [u, t, d, m, note] of [[d1, t1, -1, 90, 'Concepts + photo retouch'], [d1, t3, -2, 180, 'Carousel layout'], [d1, t3, -1, 120, 'Gold foil texture'], [d2, t4, -2, 75, 'Ad v1'], [d2, t5, -3, 60, 'Tips post'], [d1, t6, -7, 200, 'Flyer + print file'], [d2, t4, 0, 40, 'Revision work'], [mk, null, -1, 90, 'Client meetings']]) {
    as(u); ins('time_logs', { user_id: u, task_id: t?.id || null, client_id: t?.client_id || null, log_date: day(d), minutes: m, note, billable: !!t })
  }
  as(d1); ins('queries', { subject: 'Malabar Bakes: need product photos', body: 'Can we get fresh photos of the plum cake? Current ones are low resolution.', category: 'Files / Access', to_role_id: 'role-marketer', client_id: c1.id })
  currentUser = prev
  return db
}
