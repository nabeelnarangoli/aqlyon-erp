import { useNavigate, Link } from 'react-router-dom'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'
import {
  Target, Building2, Palette, AlertTriangle, Wallet, TrendingUp, Receipt, PhoneCall, CalendarDays, MessagesSquare, Clock, Plus,
  CheckCircle2, RotateCcw, FileText, Eye
} from 'lucide-react'
import { supabase, q } from '../lib/supabase'
import { useData } from '../lib/hooks'
import { useAuth } from '../lib/auth'
import { TASK_STATUSES, LEAD_STAGES, POST_STATUSES, ROLES } from '../lib/constants'
import { money, compact, date, dueLabel, daysFrom, monthStart, monthEnd, todayISO, addDays, hours, pct, toISO } from '../lib/format'
import { Stat, Card, Badge, StatusBadge, Member, Loading, Empty, Button, Progress, Avatar } from '../components/ui'
import { monthly } from './crm/Clients'

export default function Dashboard() {
  const { profile, role, can } = useAuth()
  const nav = useNavigate()
  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  return (
    <>
      <div className="hero">
        <div>
          <p className="small" style={{ color: 'var(--green-2)', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1>{greet}, {profile.full_name.split(' ')[0]}</h1>
          <p>{ROLES[role].label} · Aqlyon Brand Management</p>
        </div>
        <div className="row gap-s wrap" style={{ position: 'relative', zIndex: 1 }}>
          {can('marketer') && <Button variant="primary" icon={Plus} onClick={() => nav('/leads')}>Lead</Button>}
          {can('marketer') && <Button variant="outline" icon={Palette} onClick={() => nav('/tasks')}>Design task</Button>}
          {role === 'designer' && <Button icon={Palette} onClick={() => nav('/tasks')}>My tasks</Button>}
          {can('finance') && <Button variant="outline" icon={FileText} onClick={() => nav('/finance/invoices?new=1')}>Invoice</Button>}
        </div>
      </div>
      {role === 'admin' && <AdminDash />}
      {role === 'marketer' && <MarketerDash />}
      {role === 'designer' && <DesignerDash />}
      {role === 'finance' && <FinanceDash />}
    </>
  )
}

/* ---------------- shared widgets ---------------- */
function useFinance(months = 6) {
  return useData(async () => {
    const start = new Date(); start.setMonth(start.getMonth() - (months - 1)); const from = monthStart(start)
    const [inv, pay, exp, sb, sp] = await Promise.all([
      q(supabase.from('invoices').select('issue_date,total,amount_paid,status,due_date').neq('status', 'cancelled')),
      q(supabase.from('payments').select('paid_on,amount').gte('paid_on', from)),
      q(supabase.from('expenses').select('spent_on,amount').gte('spent_on', from)),
      q(supabase.from('supplier_bills').select('total,amount_paid,status').neq('status', 'cancelled')),
      q(supabase.from('supplier_payments').select('paid_on,amount').gte('paid_on', from))
    ])
    const series = Array.from({ length: months }, (_, i) => {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1); const k = toISO(d).slice(0, 7)
      return {
        m: d.toLocaleDateString('en-IN', { month: 'short' }),
        Invoiced: inv.filter((x) => x.issue_date.startsWith(k)).reduce((a, x) => a + Number(x.total), 0),
        Collected: pay.filter((x) => x.paid_on.startsWith(k)).reduce((a, x) => a + Number(x.amount), 0),
        Expenses: exp.filter((x) => x.spent_on.startsWith(k)).reduce((a, x) => a + Number(x.amount), 0)
          + sp.filter((x) => x.paid_on.startsWith(k)).reduce((a, x) => a + Number(x.amount), 0)
      }
    })
    const open = inv.filter((x) => ['sent', 'partial'].includes(x.status))
    const outstanding = open.reduce((a, x) => a + Number(x.total) - Number(x.amount_paid), 0)
    const overdue = open.filter((x) => daysFrom(x.due_date) < 0).reduce((a, x) => a + Number(x.total) - Number(x.amount_paid), 0)
    const cur = series[series.length - 1]
    const payable = sb.reduce((a, x) => a + Number(x.total) - Number(x.amount_paid), 0)
    return { series, outstanding, overdue, cur, payable, drafts: inv.filter((x) => x.status === 'draft').length }
  }, [], null)
}

function CashChart({ data }) {
  return (
    <Card title="Revenue vs expenses (6 months)">
      <div className="chart-box">
        <ResponsiveContainer>
          <BarChart data={data} barGap={2}>
            <CartesianGrid vertical={false} stroke="#eee" />
            <XAxis dataKey="m" tickLine={false} axisLine={false} fontSize={12} />
            <YAxis tickFormatter={compact} tickLine={false} axisLine={false} fontSize={12} width={56} />
            <Tooltip formatter={(v) => money(v)} cursor={{ fill: 'rgba(27,167,106,.06)' }} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Invoiced" fill="#b9e6d0" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Collected" fill="#1ba76a" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Expenses" name="Paid out" fill="#2b1416" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

function TaskList({ title, tasks, empty, action }) {
  const nav = useNavigate()
  return (
    <Card title={title} actions={action}>
      {tasks.length === 0 ? <p className="faint small">{empty}</p> : (
        <div className="list">
          {tasks.slice(0, 8).map((t) => {
            const d = dueLabel(t.due_date)
            return (
              <div key={t.id} className="list-item click" onClick={() => nav(`/tasks/${t.id}`)}>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="cell-title ellipsis">{t.title}</div>
                  <div className="cell-sub">{t.code} · {t.clients?.name || '—'} · {t.task_type}</div>
                </div>
                <StatusBadge list={TASK_STATUSES} value={t.status} />
                {t.due_date && <Badge tone={d.tone}>{d.text}</Badge>}
                <Member id={t.assignee_id} size={22} showName={false} fallback="" />
              </div>
            )
          })}
          {tasks.length > 8 && <Link to="/tasks" className="small" style={{ paddingTop: 8 }}>View all {tasks.length} →</Link>}
        </div>
      )}
    </Card>
  )
}

function useOps() {
  const { user } = useAuth()
  return useData(async () => {
    const today = todayISO()
    const [tasks, fups, posts, leads, queries, clients, packs] = await Promise.all([
      q(supabase.from('design_tasks').select('id,code,title,status,due_date,assignee_id,created_by,task_type,priority,revision_count,max_revisions, clients(name)').not('status', 'in', '(delivered,cancelled)').order('due_date', { nullsFirst: false })),
      q(supabase.from('interactions').select('id,next_action,next_action_date,created_by,client_id,lead_id, clients(name), leads(name,company)').eq('done', false).not('next_action', 'is', null).lte('next_action_date', today).order('next_action_date')),
      q(supabase.from('content_posts').select('id,title,publish_date,status,client_id, clients(name)').gte('publish_date', today).lte('publish_date', addDays(today, 7)).neq('status', 'cancelled').order('publish_date')),
      q(supabase.from('leads').select('id,stage,estimated_value,next_follow_up,owner_id,created_at')),
      q(supabase.from('queries').select('id,subject,status,to_user,to_role,from_user,created_at').neq('status', 'resolved').order('created_at', { ascending: false })),
      q(supabase.from('clients').select('id,status')),
      q(supabase.from('packages').select('fee,billing_type,status,client_id').eq('status', 'active'))
    ])
    return { tasks, fups, posts, leads, queries, clients, packs, uid: user.id }
  }, [], null)
}

/* ---------------- ADMIN ---------------- */
function AdminDash() {
  const fin = useFinance()
  const ops = useOps()
  const { team } = useAuth()
  const nav = useNavigate()
  if (!fin.data || !ops.data) return <Loading />
  const o = ops.data
  const mrr = o.packs.reduce((a, p) => a + monthly(p), 0)
  const pipe = o.leads.filter((l) => !['won', 'lost'].includes(l.stage))
  const overdue = o.tasks.filter((t) => !['approved'].includes(t.status) && t.due_date && daysFrom(t.due_date) < 0)
  const review = o.tasks.filter((t) => t.status === 'internal_review')
  const designers = team.filter((m) => m.active && m.role === 'designer')
  return (
    <>
      <div className="stats">
        <Stat label="Monthly recurring revenue" value={money(mrr)} sub={`${o.clients.filter((c) => c.status === 'active').length} active clients`} icon={TrendingUp} onClick={() => nav('/clients')} />
        <Stat label="Collected this month" value={money(fin.data.cur.Collected)} sub={`Paid out ${money(fin.data.cur.Expenses)}`} icon={Wallet} tone="teal" onClick={() => nav('/finance/payments')} />
        <Stat label="Outstanding from customers" value={money(fin.data.outstanding)} sub={`${money(fin.data.overdue)} overdue · ${money(fin.data.payable)} owed to suppliers`} icon={Receipt} tone={fin.data.overdue ? 'red' : 'amber'} onClick={() => nav('/finance/invoices')} />
        <Stat label="Open pipeline" value={money(pipe.reduce((a, l) => a + Number(l.estimated_value || 0), 0))} sub={`${pipe.length} leads`} icon={Target} tone="violet" onClick={() => nav('/leads')} />
        <Stat label="Design tasks in production" value={o.tasks.length} sub={`${overdue.length} overdue · ${review.length} to review`} icon={Palette} tone={overdue.length ? 'red' : 'blue'} onClick={() => nav('/tasks')} />
      </div>
      <div className="grid g-2-1">
        <CashChart data={fin.data.series} />
        <Card title="Designer workload">
          {designers.length === 0 ? <p className="faint small">Add designers in Team & Access.</p> : designers.map((d) => {
            const mine = o.tasks.filter((t) => t.assignee_id === d.id)
            const late = mine.filter((t) => t.due_date && daysFrom(t.due_date) < 0).length
            return (
              <div key={d.id} style={{ marginBottom: 12 }}>
                <div className="row between small"><span className="row gap-s"><Avatar name={d.full_name} size={22} />{d.full_name}</span><span><b>{mine.length}</b> open{late ? <span style={{ color: 'var(--red)' }}> · {late} late</span> : ''}</span></div>
                <Progress value={mine.length} max={12} tone={mine.length > 10 ? 'red' : mine.length > 7 ? 'amber' : 'green'} />
              </div>
            )
          })}
        </Card>
      </div>
      <div className="grid g2 mt">
        <TaskList title="Overdue design tasks" tasks={overdue} empty="Nothing overdue 🎉" />
        <TaskList title="Waiting for internal review" tasks={review} empty="No proofs waiting." />
      </div>
      <div className="grid g2 mt">
        <FollowUpCard fups={o.fups} />
        <PostsCard posts={o.posts} />
      </div>
    </>
  )
}

function FollowUpCard({ fups, mineOnly, uid }) {
  const nav = useNavigate()
  const list = mineOnly ? fups.filter((f) => f.created_by === uid) : fups
  return (
    <Card title={<span className="row gap-s"><PhoneCall size={15} />Follow-ups due</span>} actions={<Button size="sm" variant="ghost" onClick={() => nav('/followups')}>All</Button>}>
      {list.length === 0 ? <p className="faint small">No follow-ups due today.</p> : (
        <div className="list">{list.slice(0, 7).map((f) => (
          <div key={f.id} className="list-item click" onClick={() => nav(f.client_id ? `/clients/${f.client_id}` : `/leads?open=${f.lead_id}`)}>
            <div className="grow"><div className="cell-title">{f.clients?.name || f.leads?.company || f.leads?.name}</div><div className="cell-sub">{f.next_action}</div></div>
            <Badge tone={dueLabel(f.next_action_date).tone}>{dueLabel(f.next_action_date).text}</Badge>
            <Member id={f.created_by} size={20} showName={false} />
          </div>))}</div>
      )}
    </Card>
  )
}
function PostsCard({ posts }) {
  const nav = useNavigate()
  return (
    <Card title={<span className="row gap-s"><CalendarDays size={15} />Publishing in the next 7 days</span>} actions={<Button size="sm" variant="ghost" onClick={() => nav('/calendar')}>Calendar</Button>}>
      {posts.length === 0 ? <p className="faint small">Nothing scheduled this week.</p> : (
        <div className="list">{posts.slice(0, 8).map((p) => (
          <div key={p.id} className="list-item click" onClick={() => nav(`/calendar?post=${p.id}`)}>
            <div className="center" style={{ width: 42 }}><div className="tiny faint">{date(p.publish_date, { weekday: 'short' })}</div><b>{date(p.publish_date, { day: 'numeric' })}</b></div>
            <div className="grow"><div className="cell-title ellipsis">{p.title}</div><div className="cell-sub">{p.clients?.name}</div></div>
            <StatusBadge list={POST_STATUSES} value={p.status} />
          </div>))}</div>
      )}
    </Card>
  )
}

/* ---------------- MARKETER ---------------- */
function MarketerDash() {
  const ops = useOps()
  const nav = useNavigate()
  if (!ops.data) return <Loading />
  const o = ops.data
  const mineTasks = o.tasks.filter((t) => t.created_by === o.uid)
  const review = o.tasks.filter((t) => t.status === 'internal_review')
  const clientWait = o.tasks.filter((t) => t.status === 'client_review')
  const myLeads = o.leads.filter((l) => l.owner_id === o.uid && !['won', 'lost'].includes(l.stage))
  const awaiting = o.posts.filter((p) => p.status === 'client_approval')
  const notReady = o.posts.filter((p) => ['idea', 'copywriting', 'in_design'].includes(p.status) && daysFrom(p.publish_date) <= 3)
  const monthWon = o.leads.filter((l) => l.stage === 'won' && l.created_at >= monthStart())
  return (
    <>
      <div className="stats">
        <Stat label="Follow-ups due" value={o.fups.filter((f) => f.created_by === o.uid).length} icon={PhoneCall} tone="red" onClick={() => nav('/followups')} />
        <Stat label="Proofs to review" value={review.length} icon={Eye} tone="violet" onClick={() => nav('/tasks')} />
        <Stat label="Waiting on client" value={clientWait.length + awaiting.length} sub={`${clientWait.length} designs · ${awaiting.length} posts`} icon={Clock} tone="amber" />
        <Stat label="My open leads" value={myLeads.length} sub={money(myLeads.reduce((a, l) => a + Number(l.estimated_value || 0), 0))} icon={Target} tone="blue" onClick={() => nav('/leads')} />
        <Stat label="Won this month" value={monthWon.length} icon={CheckCircle2} onClick={() => nav('/leads')} />
      </div>
      {notReady.length > 0 && <div className="alert alert-warn"><AlertTriangle size={16} /><span><b>{notReady.length} post(s)</b> publish within 3 days but aren’t designed/approved yet.</span><Button size="sm" variant="ghost" onClick={() => nav('/calendar')}>Open calendar</Button></div>}
      <div className="grid g2">
        <TaskList title="Proofs waiting for your review" tasks={review} empty="No proofs waiting." />
        <FollowUpCard fups={o.fups} mineOnly uid={o.uid} />
      </div>
      <div className="grid g2 mt">
        <TaskList title="Tasks I requested" tasks={mineTasks} empty="You haven't created any open tasks." action={<Button size="sm" variant="ghost" onClick={() => nav('/tasks')}>All tasks</Button>} />
        <PostsCard posts={o.posts} />
      </div>
      <PipelineMini leads={o.leads} />
    </>
  )
}
function PipelineMini({ leads }) {
  const open = LEAD_STAGES.filter((s) => !['won', 'lost'].includes(s.id))
  const max = Math.max(1, ...open.map((s) => leads.filter((l) => l.stage === s.id).length))
  return (
    <Card className="mt" title="Pipeline">
      <div className="funnel">
        {open.map((s) => { const n = leads.filter((l) => l.stage === s.id); return (
          <div key={s.id} className="funnel-row"><span>{s.label}</span><div className="funnel-bar" style={{ width: `${(n.length / max) * 100}%` }} /><span className="right small"><b>{n.length}</b> · {compact(n.reduce((a, l) => a + Number(l.estimated_value || 0), 0))}</span></div>
        ) })}
      </div>
    </Card>
  )
}

/* ---------------- DESIGNER ---------------- */
function DesignerDash() {
  const { user } = useAuth()
  const nav = useNavigate()
  const d = useData(async () => {
    const weekStart = (() => { const x = new Date(); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return toISO(x) })()
    const [tasks, unassigned, logs, queries, done] = await Promise.all([
      q(supabase.from('design_tasks').select('*, clients(name)').eq('assignee_id', user.id).not('status', 'in', '(delivered,cancelled)').order('due_date', { nullsFirst: false })),
      q(supabase.from('design_tasks').select('*, clients(name)').is('assignee_id', null).not('status', 'in', '(delivered,cancelled)').order('due_date')),
      q(supabase.from('time_logs').select('minutes,billable').eq('user_id', user.id).gte('log_date', weekStart)),
      q(supabase.from('queries').select('id').neq('status', 'resolved').or(`to_user.eq.${user.id},to_role.eq.designer`)),
      q(supabase.from('design_tasks').select('id').eq('assignee_id', user.id).in('status', ['approved', 'delivered']).gte('approved_at', monthStart()))
    ])
    return { tasks, unassigned, logs, queries, done }
  }, [], null)
  if (!d.data) return <Loading />
  const x = d.data
  const active = x.tasks.filter((t) => ['todo', 'in_progress', 'revision'].includes(t.status))
  const revisions = x.tasks.filter((t) => t.status === 'revision')
  const today = active.filter((t) => t.due_date && daysFrom(t.due_date) <= 0)
  const inReview = x.tasks.filter((t) => ['internal_review', 'client_review'].includes(t.status))
  const mins = x.logs.reduce((a, l) => a + l.minutes, 0)
  return (
    <>
      <div className="stats">
        <Stat label="Due today / overdue" value={today.length} icon={AlertTriangle} tone={today.length ? 'red' : 'green'} onClick={() => nav('/tasks')} />
        <Stat label="Revisions requested" value={revisions.length} icon={RotateCcw} tone="orange" />
        <Stat label="In review" value={inReview.length} icon={Eye} tone="violet" />
        <Stat label="Approved this month" value={x.done.length} icon={CheckCircle2} />
        <Stat label="Time logged this week" value={hours(mins)} icon={Clock} tone="teal" onClick={() => nav('/timesheet')} />
      </div>
      {x.queries.length > 0 && <div className="alert alert-info"><MessagesSquare size={16} /><span>You have <b>{x.queries.length}</b> open team quer{x.queries.length === 1 ? 'y' : 'ies'}.</span><Button size="sm" variant="ghost" onClick={() => nav('/queries')}>Open</Button></div>}
      <div className="grid g2">
        <TaskList title="My work queue" tasks={active} empty="No active tasks — pick one up from the unassigned list." />
        <div className="grid" style={{ alignContent: 'start' }}>
          <TaskList title="Revisions to fix" tasks={revisions} empty="No revisions requested 👏" />
          <TaskList title="Unassigned — pick one up" tasks={x.unassigned} empty="Nothing unassigned." />
        </div>
      </div>
    </>
  )
}

/* ---------------- FINANCE ---------------- */
function FinanceDash() {
  const fin = useFinance()
  const nav = useNavigate()
  const list = useData(() => q(supabase.from('v_invoice_status').select('*').eq('overdue', true).order('due_date')), [], [])
  const renew = useData(() => q(supabase.from('packages').select('*, clients(name)').eq('status', 'active')), [], [])
  if (!fin.data) return <Loading />
  const mrr = renew.data.reduce((a, p) => a + monthly(p), 0)
  return (
    <>
      <div className="stats">
        <Stat label="Outstanding" value={money(fin.data.outstanding)} icon={Wallet} tone="amber" onClick={() => nav('/finance/invoices')} />
        <Stat label="Overdue" value={money(fin.data.overdue)} sub={`${list.data.length} invoices`} icon={AlertTriangle} tone="red" />
        <Stat label="Collected this month" value={money(fin.data.cur.Collected)} icon={TrendingUp} onClick={() => nav('/finance/payments')} />
        <Stat label="Paid out this month" value={money(fin.data.cur.Expenses)} sub={`Net ${money(fin.data.cur.Collected - fin.data.cur.Expenses)}`} icon={Receipt} tone="violet" onClick={() => nav('/finance/payments')} />
        <Stat label="Payable to suppliers" value={money(fin.data.payable)} icon={Wallet} tone="orange" onClick={() => nav('/finance/work-orders')} />
        <Stat label="Retainer run-rate" value={money(mrr)} sub={`${fin.data.drafts} draft invoices`} icon={FileText} tone="teal" />
      </div>
      <div className="grid g-2-1">
        <CashChart data={fin.data.series} />
        <Card title="Overdue invoices" actions={<Button size="sm" variant="ghost" onClick={() => nav('/finance/invoices')}>All</Button>}>
          {list.data.length === 0 ? <Empty icon={CheckCircle2} title="Nothing overdue" /> : (
            <div className="list">{list.data.slice(0, 8).map((i) => (
              <div key={i.id} className="list-item click" onClick={() => nav(`/finance/invoices/${i.id}`)}>
                <div className="grow"><div className="cell-title">{i.client_name}</div><div className="cell-sub">{i.number} · {i.days_overdue}d late</div></div>
                <b>{money(i.balance)}</b>
              </div>))}</div>
          )}
        </Card>
      </div>
    </>
  )
}

