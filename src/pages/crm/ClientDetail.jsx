import { useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, Pencil, Phone, MessageCircle, Mail, Globe, Camera, ThumbsUp, Plus, Link2, Copy, Ban, Palette, CalendarDays,
  FileText, Package, Trash2, ExternalLink, Megaphone
} from 'lucide-react'
import { supabase, q, appLink, DEMO } from '../../lib/supabase'
import { useData } from '../../lib/hooks'
import { useAuth } from '../../lib/auth'
import { CLIENT_STATUS, TASK_STATUSES, INVOICE_STATUS, BILLING_TYPES, PLATFORMS, PROJECT_STATUS, byId } from '../../lib/constants'
import { money, date, waLink, monthStart, monthEnd, dueLabel, addDays, todayISO, showMoney } from '../../lib/format'
import {
  Button, Badge, StatusBadge, Member, Modal, Field, Input, Select, Textarea, Chips, Tabs, Card, Stat, Loading, ErrorBox, Empty,
  Progress, useAction, useForm, useToast, IconBtn
} from '../../components/ui'
import Interactions from '../../components/Interactions'
import { SocialReportLink } from '../reports/SocialReports'
import { ClientModal, monthly } from './Clients'
import { TaskModal } from '../tasks/TaskForm'
import { ProjectModal } from './Projects'
import { MoneyFlow } from '../finance/Suppliers'

export default function ClientDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { has, member } = useAuth()
  const [tab, setTab] = useState('overview')
  const [editing, setEditing] = useState(false)
  const { data: c, loading, error, reload } = useData(() => q(supabase.from('clients').select('*').eq('id', id).single()), [id])
  if (loading) return <Loading />
  if (error) return <ErrorBox error={error} />
  const tabs = [
    { id: 'overview', label: 'Overview' },
    has('leads.manage', 'clients.manage') && { id: 'log', label: 'Conversations' },
    has('tasks.view', 'tasks.work', 'tasks.manage') && { id: 'tasks', label: 'Design tasks' },
    has('projects.view', 'projects.manage') && { id: 'projects', label: 'Campaigns' },
    has('packages.view', 'packages.manage') && { id: 'packages', label: 'Packages' },
    has('invoices.view', 'invoices.manage') && { id: 'invoices', label: 'Invoices & money flow' },
    has('calendar.manage', 'clients.manage') && { id: 'links', label: 'Client approval links' }
  ].filter(Boolean)

  return (
    <>
      <button className="btn btn-ghost btn-sm mb" onClick={() => nav('/clients')}><ArrowLeft size={14} />All clients</button>
      <div className="page-head">
        <div>
          <div className="row gap-s wrap"><h1>{c.name}</h1><StatusBadge list={CLIENT_STATUS} value={c.status} /><Badge tone="slate">{c.code}</Badge></div>
          <p className="muted">{[c.industry, c.city, c.contact_person, (c.salesman_id || c.salesman_name) && `Brought by ${c.salesman_id ? member(c.salesman_id)?.full_name || 'team member' : c.salesman_name}`].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="page-actions">
          {has('calendar.view', 'calendar.manage', 'clients.view', 'clients.manage', 'reports.content') && <SocialReportLink clientId={c.id} />}
          {c.phone && <a className="btn btn-outline" href={`tel:${c.phone}`}><Phone size={15} />Call</a>}
          {(c.whatsapp || c.phone) && <a className="btn btn-outline" target="_blank" rel="noreferrer" href={waLink(c.whatsapp || c.phone)}><MessageCircle size={15} />WhatsApp</a>}
          {has('clients.manage') && <Button variant="dark" icon={Pencil} onClick={() => setEditing(true)}>Edit</Button>}
        </div>
      </div>
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === 'overview' && <Overview c={c} goTab={setTab} />}
      {tab === 'log' && <Card><Interactions clientId={c.id} /></Card>}
      {tab === 'tasks' && <ClientTasks clientId={c.id} />}
      {tab === 'projects' && <ClientProjects clientId={c.id} />}
      {tab === 'packages' && <Packages clientId={c.id} />}
      {tab === 'invoices' && <><ClientInvoices clientId={c.id} /><div className="mt"><MoneyFlow clientId={c.id} /></div></>}
      {tab === 'links' && <ApprovalLinks client={c} />}
      {editing && <ClientModal client={c} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); reload() }} />}
    </>
  )
}

function Overview({ c, goTab }) {
  const { has } = useAuth()
  const nav = useNavigate()
  const ms = monthStart(), me = monthEnd()
  const { data } = useData(async () => {
    const [packs, tasks, posts, inv] = await Promise.all([
      has('packages.view', 'packages.manage') ? q(supabase.from('packages').select('*').eq('client_id', c.id).eq('status', 'active')) : [],
      has('tasks.view', 'tasks.work', 'tasks.manage') ? q(supabase.from('design_tasks').select('id,status,due_date,title,code').eq('client_id', c.id)) : [],
      has('calendar.view', 'calendar.manage') ? q(supabase.from('content_posts').select('id,status,post_type,publish_date').eq('client_id', c.id).gte('publish_date', ms).lte('publish_date', me)) : [],
      has('invoices.view', 'invoices.manage') ? q(supabase.from('invoices').select('total,amount_paid,status').eq('client_id', c.id).neq('status', 'cancelled')) : []
    ])
    return { packs, tasks, posts, inv }
  }, [c.id], { packs: [], tasks: [], posts: [], inv: [] })
  const open = data.tasks.filter((t) => !['delivered', 'cancelled', 'approved'].includes(t.status))
  const overdue = open.filter((t) => t.due_date && dueLabel(t.due_date).tone === 'red')
  const billed = data.inv.reduce((a, i) => a + Number(i.total), 0)
  const due = data.inv.reduce((a, i) => a + Number(i.total) - Number(i.amount_paid), 0)
  const live = data.posts.filter((p) => p.status !== 'cancelled')
  const commit = data.packs.reduce((a, p) => ({ posts: a.posts + (p.posts_per_month || 0) + (p.carousels_per_month || 0), reels: a.reels + (p.reels_per_month || 0), stories: a.stories + (p.stories_per_month || 0) }), { posts: 0, reels: 0, stories: 0 })
  const planned = { posts: live.filter((p) => ['Post', 'Carousel', 'Ad'].includes(p.post_type)).length, reels: live.filter((p) => ['Reel', 'Video'].includes(p.post_type)).length, stories: live.filter((p) => p.post_type === 'Story').length }
  const Link_ = ({ href, icon: I, label }) => href ? <a className="row gap-s" href={href.startsWith('http') ? href : `https://${href.replace(/^@/, 'instagram.com/')}`} target="_blank" rel="noreferrer"><I size={15} />{label || href}</a> : null

  return (
    <>
      <div className="stats">
        {has('tasks.view', 'tasks.work', 'tasks.manage') && <Stat label="Open design tasks" value={open.length} sub={overdue.length ? `${overdue.length} overdue` : 'None overdue'} icon={Palette} tone={overdue.length ? 'red' : 'green'} onClick={() => goTab('tasks')} />}
        {has('calendar.view', 'calendar.manage') && <Stat label="Posts planned this month" value={live.length} sub={`${live.filter((p) => p.status === 'published').length} published`} icon={CalendarDays} tone="violet" onClick={() => nav(`/calendar?client=${c.id}`)} />}
        {showMoney() && has('packages.view', 'packages.manage') && <Stat label="Monthly retainer" value={money(data.packs.reduce((a, p) => a + monthly(p), 0))} sub={`${data.packs.length} active package(s)`} icon={Package} tone="teal" onClick={() => goTab('packages')} />}
        {has('invoices.view', 'invoices.manage') && <Stat label="Outstanding" value={money(due)} sub={`${money(billed)} billed lifetime`} icon={FileText} tone={due > 0 ? 'amber' : 'green'} onClick={() => goTab('invoices')} />}
      </div>
      <div className="grid g-2-1">
        <div className="grid">
          {data.packs.length > 0 && (
            <Card title={`Deliverables this month vs package`} actions={<Button size="sm" variant="ghost" onClick={() => nav(`/calendar?client=${c.id}`)}>Open calendar</Button>}>
              <div className="grid g3">
                {[['Posts & carousels', planned.posts, commit.posts], ['Reels / videos', planned.reels, commit.reels], ['Stories', planned.stories, commit.stories]].map(([l, a, b]) => (
                  <div key={l}><div className="row between small"><span className="muted">{l}</span><b>{a} / {b}</b></div><Progress value={a} max={b || 1} tone={b && a < b ? 'amber' : 'green'} /></div>
                ))}
              </div>
            </Card>
          )}
          <Card title="Brand kit">
            <dl className="kv">
              <dt>Colours</dt><dd>{c.brand_colors ? <span className="row gap-s wrap">{c.brand_colors.split(/[,\s]+/).filter((x) => /^#?[0-9a-f]{3,8}$/i.test(x)).map((h) => <span key={h} className="row gap-xs"><i style={{ width: 16, height: 16, borderRadius: 4, background: h.startsWith('#') ? h : '#' + h, border: '1px solid var(--line)' }} /><code>{h}</code></span>)}{!/#?[0-9a-f]{3,8}/i.test(c.brand_colors) && c.brand_colors}</span> : '—'}</dd>
              <dt>Fonts</dt><dd>{c.brand_fonts || '—'}</dd>
              <dt>Tone</dt><dd>{c.brand_tone || '—'}</dd>
              <dt>Audience</dt><dd className="pre">{c.target_audience || '—'}</dd>
              <dt>Assets</dt><dd>{c.brand_assets_link ? <a href={c.brand_assets_link} target="_blank" rel="noreferrer">Open logo & assets folder <ExternalLink size={12} /></a> : '—'}</dd>
            </dl>
          </Card>
          {c.notes && <Card title="Notes"><p className="pre">{c.notes}</p></Card>}
        </div>
        <div className="grid" style={{ alignContent: 'start' }}>
          <Card title="Contact">
            <div className="col gap-s">
              <b>{c.contact_person || '—'}</b>
              {c.phone && <a className="row gap-s" href={`tel:${c.phone}`}><Phone size={15} />{c.phone}</a>}
              {c.email && <a className="row gap-s" href={`mailto:${c.email}`}><Mail size={15} />{c.email}</a>}
              {c.address && <span className="small muted">{c.address}</span>}
              <hr style={{ border: 0, borderTop: '1px solid var(--line-2)', width: '100%' }} />
              <Link_ href={c.instagram} icon={Camera} />
              <Link_ href={c.facebook} icon={ThumbsUp} />
              <Link_ href={c.website} icon={Globe} />
              {c.other_links && <span className="small muted pre">{c.other_links}</span>}
              <div className="row between small mt"><span className="muted">Account manager</span><Member id={c.account_manager_id} size={22} /></div>
              <div className="row between small"><span className="muted">Client since</span><span>{date(c.onboarded_on)}</span></div>
            </div>
          </Card>
          {has('tasks.view', 'tasks.work', 'tasks.manage') && open.length > 0 && (
            <Card title="Upcoming deliveries">
              <div className="list">
                {open.sort((a, b) => (a.due_date || '9').localeCompare(b.due_date || '9')).slice(0, 6).map((t) => (
                  <Link key={t.id} to={`/tasks/${t.id}`} className="list-item" style={{ color: 'inherit', textDecoration: 'none' }}>
                    <div className="grow"><div className="cell-title ellipsis">{t.title}</div><div className="cell-sub">{t.code}</div></div>
                    <Badge tone={dueLabel(t.due_date).tone}>{dueLabel(t.due_date).text}</Badge>
                  </Link>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}

function ClientTasks({ clientId }) {
  const nav = useNavigate()
  const { has } = useAuth()
  const [adding, setAdding] = useState(false)
  const { data, loading, reload } = useData(() => q(supabase.from('design_tasks').select('*').eq('client_id', clientId).order('created_at', { ascending: false })), [clientId], [])
  return (
    <Card title={`Design tasks (${data.length})`} actions={has('tasks.manage') && <Button size="sm" icon={Plus} onClick={() => setAdding(true)}>New task</Button>} pad={false}>
      {loading ? <Loading /> : data.length === 0 ? <Empty title="No design tasks yet" /> : (
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Task</th><th>Type</th><th>Status</th><th>Designer</th><th>Due</th><th className="num">Revisions</th></tr></thead>
          <tbody>{data.map((t) => (
            <tr key={t.id} className="click" onClick={() => nav(`/tasks/${t.id}`)}>
              <td><div className="cell-title">{t.title}</div><div className="cell-sub">{t.code}</div></td>
              <td>{t.task_type}{t.quantity > 1 ? ` ×${t.quantity}` : ''}</td>
              <td><StatusBadge list={TASK_STATUSES} value={t.status} /></td>
              <td><Member id={t.assignee_id} size={22} /></td>
              <td>{t.due_date ? date(t.due_date) : '—'}</td>
              <td className="num">{t.revision_count}/{t.max_revisions}</td>
            </tr>))}
          </tbody></table></div>
      )}
      {adding && <TaskModal task={{ client_id: clientId }} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); reload() }} />}
    </Card>
  )
}

function ClientProjects({ clientId }) {
  const { has } = useAuth()
  const [editing, setEditing] = useState(null)
  const { data, loading, reload } = useData(() => q(supabase.from('projects').select('*').eq('client_id', clientId).order('created_at', { ascending: false })), [clientId], [])
  return (
    <Card title="Campaigns & projects" actions={has('projects.manage') && <Button size="sm" icon={Plus} onClick={() => setEditing({ client_id: clientId })}>New campaign</Button>} pad={false}>
      {loading ? <Loading /> : data.length === 0 ? <Empty icon={Megaphone} title="No campaigns yet" /> : (
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Name</th><th>Type</th><th>Status</th><th>Dates</th>{showMoney() && <th className="num">Ad spend</th>}<th className="num">Leads</th></tr></thead>
          <tbody>{data.map((p) => (
            <tr key={p.id} className="click" onClick={() => has('projects.manage') && setEditing(p)}>
              <td><div className="cell-title">{p.name}</div><div className="cell-sub">{p.platform}</div></td>
              <td>{p.type}</td><td><StatusBadge list={PROJECT_STATUS} value={p.status} /></td>
              <td className="nowrap">{p.start_date ? date(p.start_date) : '—'} → {p.end_date ? date(p.end_date) : '—'}</td>
              {showMoney() && <td className="num">{money(p.ad_spend)}</td>}<td className="num">{p.leads_generated || 0}</td>
            </tr>))}
          </tbody></table></div>
      )}
      {editing && <ProjectModal project={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload() }} />}
    </Card>
  )
}

function Packages({ clientId }) {
  const { has } = useAuth()
  const [editing, setEditing] = useState(null)
  const { data, loading, reload } = useData(() => q(supabase.from('packages').select('*').eq('client_id', clientId).order('start_date', { ascending: false })), [clientId], [])
  return (
    <>
      <div className="row between mb"><p className="muted">Retainer packages drive monthly invoices and the deliverable targets on the content calendar.</p>{has('packages.manage') && <Button icon={Plus} onClick={() => setEditing({})}>Add package</Button>}</div>
      {loading ? <Loading /> : data.length === 0 ? <Empty icon={Package} title="No packages yet">Add the client's monthly retainer: fee, posts, reels and stories per month.</Empty> : (
        <div className="grid g2">
          {data.map((p) => (
            <Card key={p.id} title={p.name} actions={<><Badge tone={p.status === 'active' ? 'green' : 'slate'}>{p.status}</Badge>{has('packages.manage') && <IconBtn icon={Pencil} title="Edit" onClick={() => setEditing(p)} />}</>}>
              <div className="row between"><span className="stat-value">{showMoney() ? money(p.fee) : 'Package'}</span><span className="muted">{byId(BILLING_TYPES, p.billing_type).label}</span></div>
              <div className="grid g4 mt small">
                <div><div className="muted">Posts</div><b>{p.posts_per_month}</b></div>
                <div><div className="muted">Carousels</div><b>{p.carousels_per_month}</b></div>
                <div><div className="muted">Reels</div><b>{p.reels_per_month}</b></div>
                <div><div className="muted">Stories</div><b>{p.stories_per_month}</b></div>
              </div>
              <dl className="kv mt small">
                <dt>Period</dt><dd>{date(p.start_date)} → {p.end_date ? date(p.end_date) : 'ongoing'}</dd>
                {p.renewal_date && <><dt>Renewal</dt><dd><Badge tone={dueLabel(p.renewal_date).tone}>{date(p.renewal_date)}</Badge></dd></>}
                <dt>Platforms</dt><dd>{(p.platforms || []).join(', ') || '—'}</dd>
                {showMoney() && Number(p.ad_budget) > 0 && <><dt>Ad budget</dt><dd>{money(p.ad_budget)} / month (client pays)</dd></>}
                {p.scope_notes && <><dt>Scope</dt><dd className="pre">{p.scope_notes}</dd></>}
              </dl>
            </Card>
          ))}
        </div>
      )}
      {editing && <PackageModal pkg={editing} clientId={clientId} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload() }} />}
    </>
  )
}

function PackageModal({ pkg, clientId, onClose, onSaved }) {
  const isNew = !pkg.id
  const { confirm } = useToast()
  const [f, set] = useForm({ name: 'Social Media Management', billing_type: 'monthly', fee: '', start_date: monthStart(), end_date: '', renewal_date: addDays(todayISO(), 365), billing_day: 1,
    posts_per_month: 12, carousels_per_month: 0, reels_per_month: 4, stories_per_month: 8, ad_budget: 0, platforms: ['Instagram', 'Facebook'], scope_notes: '', status: 'active', ...pkg })
  const [busy, run] = useAction()
  const save = (e) => {
    e.preventDefault()
    run(async () => {
      const p = { ...f, client_id: clientId, end_date: f.end_date || null, renewal_date: f.renewal_date || null }
      ;['id', 'created_at', 'created_by'].forEach((k) => delete p[k])
      ;['fee', 'ad_budget', 'posts_per_month', 'carousels_per_month', 'reels_per_month', 'stories_per_month', 'billing_day'].forEach((k) => (p[k] = Number(p[k] || 0)))
      if (!showMoney()) { delete p.fee; delete p.ad_budget }   // people without money access never overwrite the fee
      p.billing_day = Math.min(28, Math.max(1, p.billing_day || 1))
      isNew ? await q(supabase.from('packages').insert(p)) : await q(supabase.from('packages').update(p).eq('id', pkg.id))
      onSaved()
    }, 'Package saved')
  }
  const del = async () => {
    if (!(await confirm('Delete this package? Invoices already raised stay.', { danger: true, okText: 'Delete' }))) return
    run(async () => { await q(supabase.from('packages').delete().eq('id', pkg.id)); onSaved() }, 'Package deleted')
  }
  return (
    <Modal open size="lg" onClose={onClose} title={isNew ? 'Add package' : 'Edit package'}
      footer={<>{!isNew && <Button variant="ghost" icon={Trash2} style={{ marginRight: 'auto', color: 'var(--red)' }} onClick={del}>Delete</Button>}<Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" form="pkg" loading={busy}>Save package</Button></>}>
      <form id="pkg" className="form f3" onSubmit={save}>
        <Field label="Package name" span={2} required><Input required value={f.name} onChange={set('name')} /></Field>
        <Field label="Status"><Select placeholder={false} options={['active', 'paused', 'ended'].map((x) => ({ id: x, label: x }))} value={f.status} onChange={set('status')} /></Field>
        {showMoney() && <Field label="Fee (₹)" required><Input type="number" step="any" min="0" required value={f.fee} onChange={set('fee')} /></Field>}
        <Field label="Billing"><Select placeholder={false} options={BILLING_TYPES} value={f.billing_type} onChange={set('billing_type')} /></Field>
        <Field label="Invoice day of month"><Input type="number" step="any" min="1" max="28" value={f.billing_day} onChange={set('billing_day')} /></Field>
        <Field label="Start date"><Input type="date" value={f.start_date} onChange={set('start_date')} /></Field>
        <Field label="End date" hint="Empty = ongoing"><Input type="date" value={f.end_date} onChange={set('end_date')} /></Field>
        <Field label="Renewal date"><Input type="date" value={f.renewal_date} onChange={set('renewal_date')} /></Field>
        <Field label="Posts / month"><Input type="number" step="any" min="0" value={f.posts_per_month} onChange={set('posts_per_month')} /></Field>
        <Field label="Carousels / month"><Input type="number" step="any" min="0" value={f.carousels_per_month} onChange={set('carousels_per_month')} /></Field>
        <Field label="Reels / month"><Input type="number" step="any" min="0" value={f.reels_per_month} onChange={set('reels_per_month')} /></Field>
        <Field label="Stories / month"><Input type="number" step="any" min="0" value={f.stories_per_month} onChange={set('stories_per_month')} /></Field>
        {showMoney() && <Field label="Ad budget / month (₹)" hint="Client's ad spend"><Input type="number" step="any" min="0" value={f.ad_budget} onChange={set('ad_budget')} /></Field>}
        <div />
        <Field label="Platforms" span={3}><Chips options={PLATFORMS} value={f.platforms || []} onChange={set('platforms')} /></Field>
        <Field label="Scope / inclusions" span={3}><Textarea value={f.scope_notes} onChange={set('scope_notes')} placeholder="Community management, monthly report, 1 shoot per month…" /></Field>
      </form>
    </Modal>
  )
}

function ClientInvoices({ clientId }) {
  const nav = useNavigate()
  const { has } = useAuth()
  const { data, loading } = useData(() => q(supabase.from('invoices').select('*').eq('client_id', clientId).order('issue_date', { ascending: false })), [clientId], [])
  const due = data.filter((i) => i.status !== 'cancelled').reduce((a, i) => a + Number(i.total) - Number(i.amount_paid), 0)
  return (
    <Card title={`Invoices · ${money(due)} outstanding`} actions={has('invoices.manage') && <Button size="sm" icon={Plus} onClick={() => nav(`/finance/invoices?new=1&client=${clientId}`)}>New invoice</Button>} pad={false}>
      {loading ? <Loading /> : data.length === 0 ? <Empty title="No invoices yet" /> : (
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Number</th><th>Date</th><th>Due</th><th>Status</th><th className="num">Total</th><th className="num">Balance</th></tr></thead>
          <tbody>{data.map((i) => (
            <tr key={i.id} className="click" onClick={() => nav(`/finance/invoices/${i.id}`)}>
              <td className="cell-title">{i.number}</td><td>{date(i.issue_date)}</td><td>{date(i.due_date)}</td>
              <td><StatusBadge list={INVOICE_STATUS} value={i.status} /></td>
              <td className="num">{money(i.total)}</td><td className="num">{money(i.total - i.amount_paid)}</td>
            </tr>))}
          </tbody></table></div>
      )}
    </Card>
  )
}

function ApprovalLinks({ client }) {
  const nav = useNavigate()
  const { toast } = useToast()
  const [busy, run] = useAction()
  const { data, loading, reload } = useData(() => q(supabase.from('approval_links').select('*').eq('client_id', client.id).order('created_at', { ascending: false })), [client.id], [])
  const url = (t) => appLink(`/p/${t}`)
  const create = () => run(async () => {
    const row = await q(supabase.from('approval_links').insert({ client_id: client.id, label: `Approval link · ${new Date().toLocaleDateString('en-IN')}`, expires_at: new Date(Date.now() + 60 * 86400000).toISOString() }).select().single())
    await navigator.clipboard?.writeText(url(row.token)).catch(() => {})
    reload()
  }, 'Link created and copied')
  const copy = async (t) => { await navigator.clipboard?.writeText(url(t)); toast('Link copied') }
  const revoke = (l) => run(async () => { await q(supabase.from('approval_links').update({ revoked: true }).eq('token', l.token)); reload() }, 'Link revoked')
  const active = data.filter((l) => !l.revoked && new Date(l.expires_at) > new Date())
  return (
    <Card title="Client approval portal" actions={<Button size="sm" icon={Link2} loading={busy} onClick={create}>Create new link</Button>}>
      <p className="muted mb">Send this link to {client.contact_person || 'the client'} on WhatsApp. They can see posts waiting for approval and the latest design proofs, then approve or request changes from their phone — no login needed. Their decisions update tasks and the calendar instantly.</p>
      {loading ? <Loading /> : active.length === 0 ? <Empty icon={Link2} title="No active link">Create one to start collecting approvals.</Empty> : (
        <div className="list">
          {active.map((l) => (
            <div key={l.token} className="list-item">
              <div className="grow"><div className="cell-title ellipsis">{url(l.token)}</div><div className="cell-sub">Expires {date(l.expires_at)}</div></div>
              {DEMO && <Button size="sm" variant="dark" icon={ExternalLink} onClick={() => nav(`/p/${l.token}`)}>Preview as client</Button>}
              <Button size="sm" variant="outline" icon={Copy} onClick={() => copy(l.token)}>Copy</Button>
              <a className="btn btn-sm btn-soft" target="_blank" rel="noreferrer" href={waLink(client.whatsapp || client.phone, `Hi ${client.contact_person || ''}, please review and approve your upcoming content here: ${url(l.token)}`)}><MessageCircle size={14} />Send</a>
              <IconBtn icon={Ban} title="Revoke" onClick={() => revoke(l)} />
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
