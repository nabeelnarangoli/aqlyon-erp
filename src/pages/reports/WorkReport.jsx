import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Printer, Download, Palette, CalendarDays, Briefcase, ClipboardList } from 'lucide-react'
import { supabase, q } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useData } from '../../lib/hooks'
import { TASK_STATUSES, POST_STATUSES } from '../../lib/constants'
import { date, rawMoney2, downloadCSV } from '../../lib/format'
import { downloadPdf } from '../../lib/pdf'
import DateRange, { presetRange } from '../../components/DateRange'
import { Button, Card, Stat, Loading, Empty, ClientSelect, StatusBadge, Member, cx } from '../../components/ui'

// Work report for one customer over any period: how many designs, posts and on-demand jobs were done, by type.
//   Designs:  counted by quantity (a task "Social Post ×3" = 3). Finished = approved or delivered, dated on the day it was finished;
//             unfinished tasks are dated by their due date.
//   Posts:    content-calendar posts by publish date. Finished = approved, scheduled or published.
//   Jobs:     on-demand jobs by job date (always finished — they're logged when done).

const TASK_DONE = ['approved', 'delivered']
const POST_DONE = ['approved', 'scheduled', 'published']
const postType = (t) => (t === 'Post' ? 'Poster' : t || 'Other')
const day = (ts) => (ts ? String(ts).slice(0, 10) : null)

export function WorkReportLink({ clientId }) {
  return <Link className="btn btn-outline" to={`/clients/${clientId}/report`}><ClipboardList size={15} />Work report</Link>
}

export default function WorkReport() {
  const { id } = useParams()
  const nav = useNavigate()
  const { has, settings } = useAuth()
  const [[from, to], setRange] = useState(() => presetRange('this_month'))
  const [scope, setScope] = useState('done')     // done | all
  const [details, setDetails] = useState(true)
  const [pdfBusy, setPdfBusy] = useState(false)
  const seeTasks = has('tasks.view', 'tasks.work', 'tasks.manage', 'tasks.review')
  const seePosts = has('calendar.view', 'calendar.manage')

  const { data, loading } = useData(async () => {
    const [client, tasks, posts, jobs] = await Promise.all([
      q(supabase.from('clients').select('id,name,code,contact_person,city').eq('id', id).single()),
      seeTasks ? q(supabase.from('design_tasks').select('id,code,title,task_type,quantity,status,assignee_id,due_date,created_at,approved_at,delivered_at').eq('client_id', id).neq('status', 'cancelled')) : [],
      seePosts ? q(supabase.from('content_posts').select('id,title,post_type,status,publish_date,platforms,assignee_id').eq('client_id', id).neq('status', 'cancelled').gte('publish_date', from).lte('publish_date', to)) : [],
      q(supabase.from('client_jobs').select('id,title,qty,rate,amount,job_date,invoice_id,created_by').eq('client_id', id).gte('job_date', from).lte('job_date', to))
    ])
    return { client, tasks, posts, jobs }
  }, [id, from, to], null)

  if (loading || !data) return <Loading />
  const c = data.client

  // designs: dated on the day they were finished, otherwise by due date
  const taskDate = (t) => (TASK_DONE.includes(t.status) ? day(t.delivered_at) || day(t.approved_at) || t.due_date || day(t.created_at) : t.due_date || day(t.created_at))
  const tasks = data.tasks.filter((t) => { const d = taskDate(t); return d >= from && d <= to }).filter((t) => scope === 'all' || TASK_DONE.includes(t.status))
  const posts = data.posts.filter((p) => scope === 'all' || POST_DONE.includes(p.status))
  const jobs = data.jobs

  const group = (rows, key, qty, isDone) => Object.values(rows.reduce((a, r) => {
    const k = key(r); const g = (a[k] ||= { type: k, done: 0, open: 0, n: 0 }); const n = qty(r)
    g.n += n; if (isDone(r)) g.done += n; else g.open += n; return a
  }, {})).sort((x, y) => y.n - x.n)
  const tByType = group(tasks, (t) => t.task_type || 'Other', (t) => Number(t.quantity || 1), (t) => TASK_DONE.includes(t.status))
  const pByType = group(posts, (p) => postType(p.post_type), () => 1, (p) => POST_DONE.includes(p.status))
  const jByType = Object.values(jobs.reduce((a, j) => { const g = (a[j.title] ||= { type: j.title, n: 0, amount: 0 }); g.n += Number(j.qty); g.amount += Number(j.amount); return a }, {})).sort((x, y) => y.n - x.n)
  const tot = (rows, k = 'n') => rows.reduce((a, r) => a + r[k], 0)

  const rows = [
    ...tasks.map((t) => ({ d: taskDate(t), kind: 'Design', title: t.title, ref: t.code, type: t.task_type, qty: Number(t.quantity || 1), status: <StatusBadge list={TASK_STATUSES} value={t.status} />, statusText: t.status, who: t.assignee_id })),
    ...posts.map((p) => ({ d: p.publish_date, kind: 'Post', title: p.title, ref: (p.platforms || []).join(', '), type: postType(p.post_type), qty: 1, status: <StatusBadge list={POST_STATUSES} value={p.status} />, statusText: p.status, who: p.assignee_id })),
    ...jobs.map((j) => ({ d: j.job_date, kind: 'On-demand job', title: j.title, ref: '', type: 'Job', qty: Number(j.qty), status: <span className="small">{j.invoice_id ? 'Billed' : 'Not billed'}</span>, statusText: j.invoice_id ? 'billed' : 'not billed', who: j.created_by }))
  ].sort((a, b) => String(a.d).localeCompare(String(b.d)))

  const fmt = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  const period = `${fmt(from)} – ${fmt(to)}`
  const fileName = `${c.name} work report ${from} to ${to}`
  const empty = !tasks.length && !posts.length && !jobs.length

  return (
    <>
      <div className="row between wrap gap-s mb no-print">
        <button className="btn btn-ghost btn-sm" onClick={() => nav(`/clients/${id}`)}><ArrowLeft size={14} />Client page</button>
        <div className="row gap-s wrap">
          <div style={{ minWidth: 240 }}><ClientSelect value={id} onChange={(v) => v && nav(`/clients/${v}/report`)} includeInactive /></div>
          <DateRange from={from} to={to} onChange={(a, b) => setRange([a, b])} />
        </div>
      </div>
      <div className="row between wrap gap-s mb no-print">
        <div className="seg">
          <button className={cx(scope === 'done' && 'on')} onClick={() => setScope('done')}>Completed work</button>
          <button className={cx(scope === 'all' && 'on')} onClick={() => setScope('all')}>Everything in period</button>
        </div>
        <div className="row gap-s wrap">
          <label className="check small"><input type="checkbox" checked={details} onChange={(e) => setDetails(e.target.checked)} />Show item list</label>
          <Button variant="outline" size="sm" icon={Download} onClick={() => downloadCSV(`${fileName}.csv`, rows.map((r) => ({ date: r.d, kind: r.kind, title: r.title, ref: r.ref, type: r.type, qty: r.qty, status: r.statusText })))}>CSV</Button>
          <Button variant="outline" size="sm" icon={Printer} onClick={() => window.print()}>Print</Button>
          <Button size="sm" icon={Download} loading={pdfBusy} onClick={async () => { setPdfBusy(true); try { await downloadPdf(document.querySelector('.work-report'), fileName) } finally { setPdfBusy(false) } }}>Download PDF</Button>
        </div>
      </div>

      <div className="work-report social-report">
        <div className="row between wrap" style={{ alignItems: 'flex-end', marginBottom: 16 }}>
          <div>
            <div className="tiny" style={{ textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--text-3)', fontWeight: 700 }}>Work report · {period}</div>
            <h1 style={{ margin: '4px 0 2px' }}>{c.name}</h1>
            <div className="small muted">{[c.code, c.contact_person, c.city].filter(Boolean).join(' · ')} · {scope === 'done' ? 'Completed work' : 'All work in the period, finished or not'}</div>
          </div>
          <img src="/logo-full.png" alt={settings?.company_name || ''} style={{ height: 38 }} className="print-only" />
        </div>

        <div className="stats">
          {seeTasks && <Stat label="Designs" value={tot(tByType)} sub={scope === 'all' ? `${tot(tByType, 'done')} finished · ${tot(tByType, 'open')} in progress` : `${tasks.length} task${tasks.length === 1 ? '' : 's'} approved / delivered`} icon={Palette} tone="violet" />}
          {seePosts && <Stat label="Posts" value={tot(pByType)} sub={scope === 'all' ? `${tot(pByType, 'done')} approved / posted · ${tot(pByType, 'open')} pending` : 'approved, scheduled or posted'} icon={CalendarDays} tone="green" />}
          {jobs.length > 0 && <Stat label="On-demand jobs" value={tot(jByType)} sub={`${jobs.length} job entr${jobs.length === 1 ? 'y' : 'ies'} · ${rawMoney2(tot(jByType, 'amount'))}`} icon={Briefcase} tone="amber" />}
        </div>

        {empty ? <Card><Empty icon={ClipboardList} title="No work in this period">Pick another period, or switch to “Everything in period”.</Empty></Card> : (
          <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
            {seeTasks && tByType.length > 0 && <TypeTable title="Designs by type" rows={tByType} split={scope === 'all'} doneLabel="Finished" openLabel="In progress" />}
            {seePosts && pByType.length > 0 && <TypeTable title="Posts by type" rows={pByType} split={scope === 'all'} doneLabel="Approved / posted" openLabel="Pending" />}
            {jByType.length > 0 && (
              <Card title="On-demand jobs" pad={false}>
                <table className="table">
                  <thead><tr><th>Job</th><th className="num">Qty</th><th className="num">Amount</th></tr></thead>
                  <tbody>{jByType.map((r) => <tr key={r.type}><td>{r.type}</td><td className="num strong">{r.n}</td><td className="num">{rawMoney2(r.amount)}</td></tr>)}</tbody>
                  <tfoot><tr><td>Total</td><td className="num">{tot(jByType)}</td><td className="num">{rawMoney2(tot(jByType, 'amount'))}</td></tr></tfoot>
                </table>
              </Card>
            )}
          </div>
        )}

        {details && rows.length > 0 && (
          <Card title={`All items (${rows.length})`} pad={false} className="mt">
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Date</th><th>Item</th><th>Type</th><th className="num">Qty</th><th>Status</th><th className="no-pdf">By</th></tr></thead>
              <tbody>{rows.map((r, i) => (
                <tr key={i}>
                  <td className="nowrap">{date(r.d)}</td>
                  <td><div className="cell-title">{r.title}</div><div className="cell-sub">{[r.kind, r.ref].filter(Boolean).join(' · ')}</div></td>
                  <td>{r.type}</td><td className="num">{r.qty}</td><td>{r.status}</td>
                  <td className="no-pdf"><Member id={r.who} size={20} fallback="—" /></td>
                </tr>))}</tbody>
            </table></div>
          </Card>
        )}
        <p className="tiny faint mt">Designs count each piece (a task of 3 posters = 3) and are dated on the day they were approved or delivered{scope === 'all' ? '; unfinished tasks by their due date' : ''}. Posts are dated by their publish date. A post made from a design task appears in both Designs and Posts.</p>
      </div>
    </>
  )
}

function TypeTable({ title, rows, split, doneLabel, openLabel }) {
  const t = (k) => rows.reduce((a, r) => a + r[k], 0)
  return (
    <Card title={title} pad={false}>
      <table className="table">
        <thead><tr><th>Type</th>{split && <><th className="num">{doneLabel}</th><th className="num">{openLabel}</th></>}<th className="num">Total</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.type}><td>{r.type}</td>{split && <><td className="num">{r.done}</td><td className="num">{r.open || '—'}</td></>}<td className="num strong">{r.n}</td></tr>)}</tbody>
        <tfoot><tr><td>Total</td>{split && <><td className="num">{t('done')}</td><td className="num">{t('open')}</td></>}<td className="num">{t('n')}</td></tr></tfoot>
      </table>
    </Card>
  )
}
