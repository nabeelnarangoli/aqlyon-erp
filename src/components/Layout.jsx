import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Target, Building2, PhoneCall, Megaphone, Palette, CalendarDays, MessagesSquare,
  FileText, FileSignature, Wallet, Receipt, BarChart3, Users, Settings, LogOut, Bell, Menu, Clock, CheckCheck
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import { supabase, q } from '../lib/supabase'
import { useData, useRealtime, useDebounced } from '../lib/hooks'
import { ROLES } from '../lib/constants'
import { ago } from '../lib/format'
import { Avatar, IconBtn, SearchInput, Badge, cx } from './ui'

const NAV = [
  { group: null, items: [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['marketer', 'designer', 'finance'], end: true }
  ] },
  { group: 'CRM', items: [
    { to: '/leads', label: 'Leads & Pipeline', icon: Target, roles: ['marketer'] },
    { to: '/clients', label: 'Clients', icon: Building2, roles: ['marketer', 'designer', 'finance'] },
    { to: '/followups', label: 'Follow-ups', icon: PhoneCall, roles: ['marketer'], badge: 'followups' },
    { to: '/projects', label: 'Campaigns & Projects', icon: Megaphone, roles: ['marketer', 'designer'] }
  ] },
  { group: 'Production', items: [
    { to: '/tasks', label: 'Design Tasks', icon: Palette, roles: ['marketer', 'designer'], badge: 'tasks' },
    { to: '/calendar', label: 'Content Calendar', icon: CalendarDays, roles: ['marketer', 'designer'] },
    { to: '/timesheet', label: 'Timesheet', icon: Clock, roles: ['marketer', 'designer'] },
    { to: '/queries', label: 'Team Queries', icon: MessagesSquare, roles: ['marketer', 'designer', 'finance'], badge: 'queries' }
  ] },
  { group: 'Finance', items: [
    { to: '/finance/quotations', label: 'Quotations', icon: FileSignature, roles: ['marketer', 'finance'] },
    { to: '/finance/invoices', label: 'Invoices', icon: FileText, roles: ['finance', 'marketer'] },
    { to: '/finance/payments', label: 'Payments', icon: Wallet, roles: ['finance'] },
    { to: '/finance/expenses', label: 'Expenses', icon: Receipt, roles: ['finance'] }
  ] },
  { group: 'Insights', items: [
    { to: '/reports', label: 'Reports', icon: BarChart3, roles: ['marketer', 'finance', 'designer'] }
  ] },
  { group: 'Admin', items: [
    { to: '/team', label: 'Team & Access', icon: Users, roles: [] },
    { to: '/settings', label: 'Settings', icon: Settings, roles: [] }
  ] }
]

export default function Layout() {
  const { profile, can, signOut, user } = useAuth()
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  useEffect(() => setOpen(false), [loc.pathname])

  const counts = useData(async () => {
    const uid = user.id
    const [tasks, queries, fups] = await Promise.all([
      profile.role === 'designer'
        ? supabase.from('design_tasks').select('id', { count: 'exact', head: true }).eq('assignee_id', uid).in('status', ['todo', 'in_progress', 'revision'])
        : supabase.from('design_tasks').select('id', { count: 'exact', head: true }).in('status', ['internal_review']),
      supabase.from('queries').select('id', { count: 'exact', head: true }).neq('status', 'resolved').neq('from_user', uid),
      can('marketer')
        ? supabase.from('interactions').select('id', { count: 'exact', head: true }).eq('done', false).not('next_action_date', 'is', null).lte('next_action_date', new Date().toISOString().slice(0, 10))
        : Promise.resolve({ count: 0 })
    ])
    return { tasks: tasks.count || 0, queries: queries.count || 0, followups: fups.count || 0 }
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
            const items = g.items.filter((i) => can(...i.roles))
            if (!items.length) return null
            return (
              <div key={g.group || 'main'}>
                {g.group && <div className="nav-group">{g.group}</div>}
                {items.map((i) => (
                  <NavLink key={i.to} to={i.to} end={i.end}>
                    <i.icon size={17} />{i.label}
                    {i.badge && counts.data?.[i.badge] > 0 && <span className="count">{counts.data[i.badge]}</span>}
                  </NavLink>
                ))}
              </div>
            )
          })}
        </nav>
        <div className="side-foot">
          <Avatar name={profile.full_name} url={profile.avatar_url} size={34} />
          <div className="who"><b className="ellipsis">{profile.full_name}</b><span>{ROLES[profile.role]?.label}</span></div>
          <IconBtn icon={LogOut} title="Sign out" onClick={signOut} />
        </div>
      </aside>
      <div className="main">
        <header className="topbar no-print">
          <IconBtn className="menu-btn" icon={Menu} title="Menu" onClick={() => setOpen(true)} />
          <GlobalSearch />
          <div className="grow" />
          <Notifications />
        </header>
        <main className="content"><Outlet /></main>
      </div>
    </div>
  )
}

function GlobalSearch() {
  const { can } = useAuth()
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
    if (can('marketer', 'designer')) jobs.push(
      supabase.from('design_tasks').select('id,title,code').or(`title.ilike.${like},code.ilike.${like}`).limit(5)
        .then((r) => (r.data || []).map((x) => ({ k: 'Task', label: x.title, sub: x.code, to: `/tasks/${x.id}` }))))
    if (can('marketer')) jobs.push(
      supabase.from('leads').select('id,name,company,phone').or(`name.ilike.${like},company.ilike.${like},phone.ilike.${like}`).limit(5)
        .then((r) => (r.data || []).map((x) => ({ k: 'Lead', label: x.company || x.name, sub: x.name, to: `/leads?open=${x.id}` }))))
    if (can('finance', 'marketer')) jobs.push(
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
  const list = useData(() => q(supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(40)), [], [])
  useRealtime('notifications', `user_id=eq.${user.id}`, () => list.reload())
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
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <IconBtn icon={Bell} title="Notifications" size={18} onClick={() => setOpen((v) => !v)} />
      {unread > 0 && <span className="pip" style={{ position: 'absolute', top: 2, right: 2, pointerEvents: 'none', background: 'var(--red)', color: '#fff', borderRadius: 99, fontSize: 10, fontWeight: 700, minWidth: 16, height: 16, display: 'grid', placeItems: 'center', padding: '0 4px' }}>{unread}</span>}
      {open && (
        <div className="popover">
          <div className="popover-head"><b>Notifications</b>{unread > 0 && <button className="btn btn-ghost btn-sm" onClick={markAll}><CheckCheck size={14} /> Mark all read</button>}</div>
          {(list.data || []).length === 0 && <div className="empty small">You're all caught up.</div>}
          {(list.data || []).map((x) => (
            <div key={x.id} className={cx('notif', !x.read && 'unread')} onClick={() => openItem(x)}>
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
