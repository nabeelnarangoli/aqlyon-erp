import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Target, Building2, PhoneCall, Megaphone, Palette, CalendarDays, MessagesSquare,
  FileText, FileSignature, Wallet, Receipt, BarChart3, Users, Settings, LogOut, Bell, Menu, Clock, CheckCheck, Truck, Store, ShoppingBag, TrendingUp, BadgeCheck, AtSign, X, HelpCircle, Briefcase
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import { supabase, q, DEMO } from '../lib/supabase'
import { resetDemo } from '../lib/demo'
import { useData, useRealtime, useDebounced } from '../lib/hooks'
import { REPORT_PERMS } from '../lib/permissions'
import { HelpDrawer } from '../pages/Help'
import { ago } from '../lib/format'
import { Avatar, IconBtn, SearchInput, Badge, cx } from './ui'

const NAV = [
  { group: null, items: [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, perm: [], end: true },
    { to: '/approvals', label: 'Approvals', icon: BadgeCheck, perm: [], badge: 'approvals', hot: true },
    { to: '/walkin', label: 'Walk-in sale', icon: ShoppingBag, perm: [] },
    { to: '/jobs', label: 'On-demand jobs', icon: Briefcase, perm: [] }
  ] },
  { group: 'CRM', items: [
    { to: '/leads', label: 'Leads & Pipeline', icon: Target, perm: ['leads.view', 'leads.manage'] },
    { to: '/clients', label: 'Clients', icon: Building2, perm: ['clients.view', 'clients.manage'] },
    { to: '/followups', label: 'Follow-ups', icon: PhoneCall, perm: ['leads.manage', 'clients.manage'], badge: 'followups' },
    { to: '/projects', label: 'Campaigns & Projects', icon: Megaphone, perm: ['projects.view', 'projects.manage'] }
  ] },
  { group: 'Production', items: [
    { to: '/tasks', label: 'Design Tasks', icon: Palette, perm: ['tasks.view', 'tasks.work', 'tasks.manage', 'tasks.review'], badge: 'tasks' },
    { to: '/calendar', label: 'Content Calendar', icon: CalendarDays, perm: ['calendar.view', 'calendar.manage'] },
    { to: '/timesheet', label: 'Timesheet', icon: Clock, perm: ['tasks.work', 'tasks.manage', 'timesheet.all'] },
    { to: '/queries', label: 'Team Queries', icon: MessagesSquare, perm: [], badge: 'queries' }
  ] },
  { group: 'Finance', items: [
    { to: '/finance/quotations', label: 'Quotations', icon: FileSignature, perm: ['quotations.view', 'quotations.manage'] },
    { to: '/finance/invoices', label: 'Invoices', icon: FileText, perm: ['invoices.view', 'invoices.manage'] },
    { to: '/finance/payments', label: 'Payments & cash flow', icon: Wallet, perm: ['payments.manage'] },
    { to: '/finance/work-orders', label: 'Supplier work orders', icon: Truck, perm: ['suppliers.view', 'suppliers.manage', 'suppliers.pay'] },
    { to: '/finance/suppliers', label: 'Suppliers & payees', icon: Store, perm: ['suppliers.view', 'suppliers.manage', 'suppliers.pay', 'expenses.manage', 'payments.manage'] },
    { to: '/finance/expenses', label: 'Expenses', icon: Receipt, perm: ['expenses.manage'] }
  ] },
  { group: 'Insights', items: [
    { to: '/social', label: 'Client social reports', icon: TrendingUp, perm: ['calendar.view', 'calendar.manage', 'clients.view', 'clients.manage', 'reports.content'] },
    { to: '/reports', label: 'Reports', icon: BarChart3, perm: REPORT_PERMS }
  ] },
  { group: 'Admin', items: [
    { to: '/team', label: 'Team & Access', icon: Users, perm: ['team.manage'] },
    { to: '/settings', label: 'Settings', icon: Settings, perm: ['settings.manage'] },
    { to: '/help', label: 'Help & guide', icon: HelpCircle, perm: [] }
  ] }
]

export default function Layout() {
  const { profile, has, role, signOut, user } = useAuth()
  const [open, setOpen] = useState(false)
  const [help, setHelp] = useState(false)
  const loc = useLocation()
  useEffect(() => setOpen(false), [loc.pathname])
  // "?" opens the guide for this page (unless typing in a field)
  useEffect(() => {
    const k = (e) => { if (e.key === '?' && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) && !e.target.isContentEditable) { e.preventDefault(); setHelp(true) } }
    document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k)
  }, [])

  const counts = useData(async () => {
    const uid = user.id
    const [tasks, queries, fups, apProofs, apPosts, apRev] = await Promise.all([
      has('tasks.work') && !has('tasks.manage', 'tasks.review')
        ? supabase.from('design_tasks').select('id', { count: 'exact', head: true }).eq('assignee_id', uid).in('status', ['todo', 'in_progress', 'revision'])
        : supabase.from('design_tasks').select('id', { count: 'exact', head: true }).in('status', ['internal_review']),
      supabase.from('queries').select('id', { count: 'exact', head: true }).neq('status', 'resolved').neq('from_user', uid),
      has('leads.manage', 'clients.manage')
        ? supabase.from('interactions').select('id', { count: 'exact', head: true }).eq('done', false).not('next_action_date', 'is', null).lte('next_action_date', new Date().toISOString().slice(0, 10))
        : Promise.resolve({ count: 0 }),
      has('tasks.review') ? supabase.from('design_tasks').select('id', { count: 'exact', head: true }).eq('status', 'internal_review') : Promise.resolve({ count: 0 }),
      has('calendar.manage') ? supabase.from('content_posts').select('id', { count: 'exact', head: true }).eq('status', 'internal_review') : Promise.resolve({ count: 0 }),
      has('tasks.work') ? supabase.from('design_tasks').select('id', { count: 'exact', head: true }).eq('status', 'revision').eq('assignee_id', uid) : Promise.resolve({ count: 0 })
    ])
    return { tasks: tasks.count || 0, queries: queries.count || 0, followups: fups.count || 0, approvals: (apProofs.count || 0) + (apPosts.count || 0) + (apRev.count || 0) }
  }, [loc.pathname], {})

  return (
    <div className={cx('shell', open && 'nav-open')}>
      <aside className="sidebar">
        <div className="brand">
          <img src="/logo-mark.png" alt="" />
          <div><b>AQLYON</b><small>Brand · ERP</small></div>
        </div>
        <nav className="nav">
          {NAV.map((g) => {
            const items = g.items.filter((i) => !i.perm.length || has(...i.perm))
            if (!items.length) return null
            return (
              <div key={g.group || 'main'}>
                {g.group && <div className="nav-group">{g.group}</div>}
                {items.map((i) => (
                  <NavLink key={i.to} to={i.to} end={i.end}>
                    <i.icon size={17} />{i.label}
                    {i.badge && counts.data?.[i.badge] > 0 && <span className={cx('count', i.hot && 'hot')}>{counts.data[i.badge]}</span>}
                  </NavLink>
                ))}
              </div>
            )
          })}
        </nav>
        <div className="side-foot">
          <Avatar name={profile.full_name} url={profile.avatar_url} size={34} />
          <div className="who"><b className="ellipsis">{profile.full_name}</b><span>{role?.name || 'No role'}</span></div>
          <IconBtn icon={LogOut} title="Sign out" onClick={signOut} />
        </div>
      </aside>
      <div className="main">
        <header className="topbar no-print">
          <IconBtn className="menu-btn" icon={Menu} title="Menu" onClick={() => setOpen(true)} />
          <GlobalSearch />
          <div className="grow" />
          {DEMO && <DemoBar />}
          <button type="button" className="btn btn-ghost btn-sm help-btn" title="Help for this page (press ?)" onClick={() => setHelp(true)}><HelpCircle size={17} /><span>Help</span></button>
          <Notifications />
        </header>
        <HelpDrawer open={help} onClose={() => setHelp(false)} path={loc.pathname} />
        <main className="content"><Outlet /></main>
      </div>
    </div>
  )
}

function GlobalSearch() {
  const { has } = useAuth()
  const nav = useNavigate()
  const [term, setTerm] = useState('')
  const [open, setOpen] = useState(false)
  const t = useDebounced(term.trim(), 250)
  const ref = useRef()
  const res = useData(async () => {
    if (t.length < 2) return []
    const like = `%${t}%`
    const jobs = [
      supabase.from('clients').select('id,name,code').or(`name.ilike.${like},contact_person.ilike.${like},phone.ilike.${like},code.ilike.${like}`).limit(5)
        .then((r) => (r.data || []).map((x) => ({ k: 'Client', label: x.name, sub: x.code, to: `/clients/${x.id}` })))
    ]
    if (has('tasks.view', 'tasks.work', 'tasks.manage')) jobs.push(
      supabase.from('design_tasks').select('id,title,code').or(`title.ilike.${like},code.ilike.${like}`).limit(5)
        .then((r) => (r.data || []).map((x) => ({ k: 'Task', label: x.title, sub: x.code, to: `/tasks/${x.id}` }))))
    if (has('leads.view', 'leads.manage')) jobs.push(
      supabase.from('leads').select('id,name,company,phone').or(`name.ilike.${like},company.ilike.${like},phone.ilike.${like}`).limit(5)
        .then((r) => (r.data || []).map((x) => ({ k: 'Lead', label: x.company || x.name, sub: x.name, to: `/leads?open=${x.id}` }))))
    if (has('invoices.view', 'invoices.manage')) jobs.push(
      supabase.from('invoices').select('id,number,total').ilike('number', like).limit(5)
        .then((r) => (r.data || []).map((x) => ({ k: 'Invoice', label: x.number, sub: '', to: `/finance/invoices/${x.id}` }))))
    return (await Promise.all(jobs)).flat()
  }, [t], [])
  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])
  return (
    <div ref={ref} style={{ position: 'relative', flex: 1, maxWidth: 420 }}>
      <SearchInput value={term} onChange={(v) => { setTerm(v); setOpen(true) }} placeholder="Search clients, tasks, leads, invoices…" />
      {open && t.length >= 2 && (
        <div className="popover" style={{ left: 0, right: 'auto', width: '100%' }}>
          {(res.data || []).length === 0 && <div className="loading small">{res.loading ? 'Searching…' : 'No matches'}</div>}
          {(res.data || []).map((r, i) => (
            <div key={i} className="notif" onClick={() => { nav(r.to); setOpen(false); setTerm('') }}>
              <Badge tone="slate">{r.k}</Badge>
              <div className="grow"><div className="strong ellipsis">{r.label}</div>{r.sub && <div className="tiny faint">{r.sub}</div>}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Notifications() {
  const { user } = useAuth()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef()
  const loc = useLocation()
  const list = useData(() => q(supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(40)), [loc.pathname], [])
  useRealtime('notifications', `user_id=eq.${user.id}`, () => list.reload())
  useEffect(() => { const t = setInterval(() => list.reload(), 60000); return () => clearInterval(t) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const markRead = async (x) => { await supabase.from('notifications').update({ read: true }).eq('id', x.id); list.reload() }
  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])
  const unread = (list.data || []).filter((x) => !x.read).length
  const openItem = async (x) => {
    if (!x.read) await supabase.from('notifications').update({ read: true }).eq('id', x.id)
    setOpen(false); list.reload()
    if (x.link) nav(x.link)
  }
  const markAll = async () => { await supabase.from('notifications').update({ read: true }).eq('read', false); list.reload() }
  const popups = (list.data || []).filter((x) => !x.read)
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <NotificationPopups items={popups} onOpen={openItem} onRead={markRead} onReadAll={markAll} />
      <IconBtn icon={Bell} title="Notifications" size={18} onClick={() => setOpen((v) => !v)} />
      {unread > 0 && <span className="pip" style={{ position: 'absolute', top: 2, right: 2, pointerEvents: 'none', background: 'var(--red)', color: '#fff', borderRadius: 99, fontSize: 10, fontWeight: 700, minWidth: 16, height: 16, display: 'grid', placeItems: 'center', padding: '0 4px' }}>{unread}</span>}
      {open && (
        <div className="popover">
          <div className="popover-head"><b>Notifications</b>{unread > 0 && <button className="btn btn-ghost btn-sm" onClick={markAll}><CheckCheck size={14} /> Mark all read</button>}</div>
          {(list.data || []).length === 0 && <div className="empty small">You're all caught up.</div>}
          {(list.data || []).map((x) => (
            <div key={x.id} className={cx('notif', !x.read && 'unread')} onClick={() => openItem(x)}>
              <KindIcon kind={x.kind} />
              <div className="grow">
                <div className="strong">{x.title}</div>
                {x.body && <div className="small muted">{x.body}</div>}
                <div className="tiny faint">{ago(x.created_at)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const KIND = { approval: { icon: BadgeCheck, tone: 'amber', label: 'Approval' }, mention: { icon: AtSign, tone: 'blue', label: 'Mention' } }
function KindIcon({ kind }) {
  const k = KIND[kind] || { icon: Bell, tone: 'slate' }
  return <span className={`stat-icon tone-${k.tone}`} style={{ width: 28, height: 28, borderRadius: 8 }}><k.icon size={14} /></span>
}

// pop-up cards for unread notifications; each stays until marked read (or opened)
function NotificationPopups({ items, onOpen, onRead, onReadAll }) {
  if (!items.length) return null
  const show = [...items].sort((a, b) => (a.kind === 'approval' ? -1 : 0) - (b.kind === 'approval' ? -1 : 0)).slice(0, 3)
  return createPortal(
    <div className="notif-pops no-print">
      {show.map((x) => {
        const k = KIND[x.kind]
        return (
          <div key={x.id} className={cx('notif-pop', x.kind && `kind-${x.kind}`)}>
            <KindIcon kind={x.kind} />
            <div className="grow" style={{ minWidth: 0 }}>
              {k && <div className="tiny" style={{ fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-3)' }}>{k.label}</div>}
              <div className="strong">{x.title}</div>
              {x.body && <div className="small muted" style={{ overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{x.body}</div>}
              <div className="row gap-xs" style={{ marginTop: 8 }}>
                {x.link && <button className="btn btn-sm btn-primary" onClick={() => onOpen(x)}>{x.kind === 'approval' ? 'Review' : 'Open'}</button>}
                <button className="btn btn-sm btn-ghost" onClick={() => onRead(x)}>Mark read</button>
                <span className="tiny faint" style={{ marginLeft: 'auto' }}>{ago(x.created_at)}</span>
              </div>
            </div>
            <button className="icon-btn" title="Mark read" onClick={() => onRead(x)}><X size={14} /></button>
          </div>
        )
      })}
      {items.length > show.length && (
        <div className="notif-more">+{items.length - show.length} more unread · <button className="link-btn" onClick={onReadAll}>Mark all read</button></div>
      )}
    </div>, document.body)
}

function DemoBar() {
  const { signOut } = useAuth()
  const [ask, setAsk] = useState(false)
  return (
    <div className="row gap-s hide-sm" style={{ fontSize: 12.5 }}>
      <Badge tone="amber">Demo · sample data</Badge>
      {ask
        ? <><span className="muted">Reset all demo data?</span><button className="btn btn-sm btn-danger" onClick={() => { resetDemo(); window.location.reload() }}>Reset</button><button className="btn btn-sm btn-ghost" onClick={() => setAsk(false)}>Cancel</button></>
        : <><button className="btn btn-sm btn-ghost" onClick={() => setAsk(true)}>Reset data</button><button className="btn btn-sm btn-outline" onClick={signOut}>Switch role</button></>}
    </div>
  )
}
