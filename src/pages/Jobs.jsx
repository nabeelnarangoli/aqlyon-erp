import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Pencil, Trash2, Receipt, Download, Briefcase, CheckCircle2, Wallet, CalendarClock } from 'lucide-react'
import { supabase, q } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useData } from '../lib/hooks'
import { PAYMENT_METHODS, INVOICE_STATUS, TASK_TYPES } from '../lib/constants'
import { rawMoney, rawMoney2, date, todayISO, addDays, downloadCSV } from '../lib/format'
import DateRange, { presetRange } from '../components/DateRange'
import {
  PageHeader, Button, Card, Field, Input, Select, Textarea, ClientSelect, Badge, StatusBadge, IconBtn, Empty, Loading, Stat, Modal, Tabs, Member,
  useAction, useForm, useToast
} from '../components/ui'

// On-demand jobs: single pieces of work for clients without a monthly package.
// Everyone can log a job with its amount; jobs are billed at month end or on the spot.
// Amounts on this page are shown to everyone on purpose (rawMoney) — the person logging the job sets the price.

const sum = (rows) => rows.reduce((a, j) => a + Number(j.amount ?? Number(j.qty) * Number(j.rate)), 0)

export default function Jobs() {
  const [editing, setEditing] = useState(null)
  const [tick, setTick] = useState(0)
  return (
    <>
      <PageHeader title="On-demand jobs"
        subtitle="Single jobs for clients who don’t take a monthly package — log each job with its amount, then bill it at month end or when the client pays."
        actions={<Button icon={Plus} onClick={() => setEditing({})}>Add job</Button>} />
      <JobsPanel key={tick} />
      {editing && <JobModal job={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setTick((t) => t + 1) }} />}
    </>
  )
}

/** the jobs list — used on the On-demand jobs page and on a client's page (clientId) */
export function JobsPanel({ clientId }) {
  const nav = useNavigate()
  const { has, user } = useAuth()
  const { confirm } = useToast()
  const [, run] = useAction()
  const [tab, setTab] = useState('bill')
  const [[from, to], setRange] = useState(() => presetRange('this_month'))
  const [client, setClient] = useState(clientId || '')
  const [editing, setEditing] = useState(null)
  const [billing, setBilling] = useState(null)
  const [skip, setSkip] = useState(() => new Set())   // jobs un-ticked in the "to bill" view
  const canManage = has('invoices.manage', 'clients.manage')
  const seeTasks = has('tasks.view', 'tasks.work', 'tasks.manage')

  const unbilled = useData(() => {
    let x = supabase.from('client_jobs').select('*, clients(name,customer_type,phone)').is('invoice_id', null).order('job_date')
    if (client) x = x.eq('client_id', client)
    return q(x)
  }, [client], [])
  const all = useData(() => {
    let x = supabase.from('client_jobs').select(`*, clients(name), invoices(number,status)${seeTasks ? ', design_tasks(code)' : ''}`)
      .gte('job_date', from).lte('job_date', to).order('job_date', { ascending: false }).order('created_at', { ascending: false })
    if (client) x = x.eq('client_id', client)
    return q(x)
  }, [client, from, to], [])
  const reload = () => { unbilled.reload(); all.reload() }

  const groups = useMemo(() => Object.values(unbilled.data.reduce((a, j) => {
    (a[j.client_id] ||= { id: j.client_id, name: j.clients?.name || 'Customer', walkin: j.clients?.customer_type === 'walkin', jobs: [] }).jobs.push(j); return a
  }, {})).sort((x, y) => sum(y.jobs) - sum(x.jobs)), [unbilled.data])
  const billedInPeriod = all.data.filter((j) => j.invoice_id)

  const del = async (j) => {
    if (!(await confirm(`Delete the job “${j.title}” (${rawMoney2(j.amount)})?`, { danger: true, okText: 'Delete' }))) return
    run(async () => { await q(supabase.from('client_jobs').delete().eq('id', j.id)); reload() }, 'Job deleted')
  }
  const canDelete = (j) => !j.invoice_id && (j.created_by === user.id || canManage)
  const toggle = (id) => setSkip((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const exportCSV = () => downloadCSV(`on-demand-jobs-${from}-to-${to}.csv`, all.data.map((j) => ({
    date: j.job_date, client: j.clients?.name, job: j.title, notes: j.notes, qty: j.qty, rate: j.rate, amount: j.amount, invoice: j.invoices?.number || (j.invoice_id ? 'billed' : 'not billed')
  })))

  return (
    <>
      <div className="stats">
        <Stat label="Waiting to be billed" value={rawMoney(sum(unbilled.data))} sub={`${unbilled.data.length} job${unbilled.data.length === 1 ? '' : 's'}${clientId ? '' : ` · ${groups.length} customer${groups.length === 1 ? '' : 's'}`} · any date`}
          icon={CalendarClock} tone={unbilled.data.length ? 'amber' : 'green'} onClick={() => setTab('bill')} />
        <Stat label="Jobs done in period" value={rawMoney(sum(all.data))} sub={`${all.data.length} job${all.data.length === 1 ? '' : 's'}`} icon={Briefcase} tone="blue" onClick={() => setTab('all')} />
        <Stat label="Billed in period" value={rawMoney(sum(billedInPeriod))} sub={`${billedInPeriod.length} job${billedInPeriod.length === 1 ? '' : 's'} invoiced`} icon={Receipt} tone="teal" onClick={() => setTab('all')} />
      </div>
      <div className="row between wrap gap-s">
        <Tabs value={tab} onChange={setTab} tabs={[{ id: 'bill', label: 'To bill', count: unbilled.data.length }, { id: 'all', label: 'All jobs' }]} />
        {clientId && <Button size="sm" icon={Plus} onClick={() => setEditing({ client_id: clientId })}>Add job</Button>}
      </div>

      {tab === 'bill' ? (
        <>
          {!clientId && <div className="filters"><ClientSelect value={client} onChange={(v) => setClient(v || '')} placeholder="All customers" includeInactive /></div>}
          {unbilled.loading ? <Loading /> : !groups.length ? (
            <Card><Empty icon={CheckCircle2} title="Nothing waiting to be billed">Jobs you add appear here until they are invoiced.</Empty></Card>
          ) : groups.map((g) => {
            const picked = g.jobs.filter((j) => !skip.has(j.id))
            return (
              <Card key={g.id} className="mb" pad={false}
                title={<span className="row gap-s">{clientId ? 'Not billed yet' : <Link to={`/clients/${g.id}`}>{g.name}</Link>}{g.walkin && <Badge tone="violet">Walk-in</Badge>}<span className="faint small">{g.jobs.length} job{g.jobs.length === 1 ? '' : 's'}</span></span>}
                actions={<Button size="sm" icon={Receipt} disabled={!picked.length} onClick={() => setBilling({ client: g, jobs: picked })}>Bill {picked.length === g.jobs.length ? 'all' : picked.length} · {rawMoney2(sum(picked))}</Button>}>
                <div className="table-wrap"><table className="table">
                  <thead><tr><th style={{ width: 34 }} /><th>Date</th><th>Job</th><th className="num">Qty</th><th className="num">Rate</th><th className="num">Amount</th><th>Added by</th><th /></tr></thead>
                  <tbody>{g.jobs.map((j) => (
                    <tr key={j.id} className={skip.has(j.id) ? 'faint' : undefined}>
                      <td><input type="checkbox" checked={!skip.has(j.id)} onChange={() => toggle(j.id)} title="Include in this bill" /></td>
                      <td className="nowrap">{date(j.job_date)}</td>
                      <td><div className="cell-title">{j.title}</div>{j.notes && <div className="cell-sub">{j.notes}</div>}</td>
                      <td className="num">{Number(j.qty)}</td><td className="num">{rawMoney2(j.rate)}</td><td className="num strong">{rawMoney2(j.amount)}</td>
                      <td><Member id={j.created_by} size={20} fallback="—" /></td>
                      <td className="nowrap right">
                        <IconBtn icon={Pencil} size={14} title="Edit" onClick={() => setEditing(j)} />
                        {canDelete(j) && <IconBtn icon={Trash2} size={14} title="Delete" onClick={() => del(j)} />}
                      </td>
                    </tr>))}</tbody>
                  <tfoot><tr><td /><td colSpan={4}>Selected</td><td className="num">{rawMoney2(sum(picked))}</td><td colSpan={2} /></tr></tfoot>
                </table></div>
              </Card>
            )
          })}
          {groups.length > 0 && <p className="small faint">Untick a job to leave it for a later bill. Each bill creates one invoice for that customer, with every ticked job as a line and the first–last job dates as the invoice period.</p>}
        </>
      ) : (
        <>
          <div className="filters">
            {!clientId && <ClientSelect value={client} onChange={(v) => setClient(v || '')} placeholder="All customers" includeInactive />}
            <DateRange from={from} to={to} onChange={(a, b) => setRange([a, b])} />
            <div className="grow" />
            <Button variant="outline" size="sm" icon={Download} onClick={exportCSV}>Export</Button>
          </div>
          <Card pad={false}>
            {all.loading ? <Loading /> : !all.data.length ? <Empty icon={Briefcase} title="No jobs in this period" /> : (
              <div className="table-wrap"><table className="table">
                <thead><tr><th>Date</th>{!clientId && <th>Customer</th>}<th>Job</th><th className="num">Qty × rate</th><th className="num">Amount</th><th>Invoice</th><th>Added by</th><th /></tr></thead>
                <tbody>{all.data.map((j) => (
                  <tr key={j.id}>
                    <td className="nowrap">{date(j.job_date)}</td>
                    {!clientId && <td>{j.clients?.name}</td>}
                    <td><div className="cell-title">{j.title}</div><div className="cell-sub">{[j.notes, j.design_tasks?.code && `Task ${j.design_tasks.code}`].filter(Boolean).join(' · ')}</div></td>
                    <td className="num nowrap">{Number(j.qty)} × {rawMoney2(j.rate)}</td>
                    <td className="num strong">{rawMoney2(j.amount)}</td>
                    <td>{j.invoice_id
                      ? <span className="row gap-xs"><Link to={`/finance/invoices/${j.invoice_id}`}>{j.invoices?.number || 'Billed'}</Link>{j.invoices?.status && <StatusBadge list={INVOICE_STATUS} value={j.invoices.status} />}</span>
                      : <Badge tone="amber">Not billed</Badge>}</td>
                    <td><Member id={j.created_by} size={20} fallback="—" /></td>
                    <td className="nowrap right">
                      {j.design_task_id && seeTasks && <Link className="small" to={`/tasks/${j.design_task_id}`}>Task</Link>}
                      {!j.invoice_id && <IconBtn icon={Pencil} size={14} title="Edit" onClick={() => setEditing(j)} />}
                      {canDelete(j) && <IconBtn icon={Trash2} size={14} title="Delete" onClick={() => del(j)} />}
                    </td>
                  </tr>))}</tbody>
                <tfoot><tr><td colSpan={clientId ? 3 : 4}>{all.data.length} jobs</td><td className="num">{rawMoney2(sum(all.data))}</td><td colSpan={3} /></tr></tfoot>
              </table></div>
            )}
          </Card>
        </>
      )}
      {editing && <JobModal job={editing} fixedClient={clientId} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload() }} />}
      {billing && <BillModal {...billing} onClose={() => setBilling(null)}
        onDone={(r) => { setBilling(null); setSkip(new Set()); reload(); nav(`/finance/invoices/${r.invoice_id}`) }} />}
    </>
  )
}

/* ---------------- add / edit a job ---------------- */
export function JobModal({ job, fixedClient, onClose, onSaved }) {
  const { has } = useAuth()
  const isNew = !job.id
  const [f, set] = useForm({ client_id: fixedClient || '', job_date: todayISO(), title: '', qty: 1, rate: '', notes: '', design_task_id: '', ...job })
  const [makeTask, setMakeTask] = useState(false)
  const [busy, run] = useAction()
  const seeTasks = has('tasks.view', 'tasks.work', 'tasks.manage')
  const canTask = has('tasks.manage')
  const tasks = useData(() => (f.client_id && seeTasks
    ? q(supabase.from('design_tasks').select('id,code,title,status').eq('client_id', f.client_id).order('created_at', { ascending: false }).limit(40))
    : Promise.resolve([])), [f.client_id], [])
  const past = useData(() => q(supabase.from('client_jobs').select('title').order('created_at', { ascending: false }).limit(200)), [], [])
  const suggestions = [...new Set([...past.data.map((x) => x.title), ...TASK_TYPES])].slice(0, 60)
  const amount = Number(f.qty || 0) * Number(f.rate || 0)

  const save = (e) => {
    e.preventDefault()
    run(async () => {
      if (!f.client_id) throw new Error('Choose the customer')
      if (!String(f.title).trim()) throw new Error('Write what the job is, e.g. Poster – Friday offer')
      if (!(Number(f.qty) > 0)) throw new Error('Quantity must be more than 0')
      if (f.rate === '' || Number(f.rate) < 0) throw new Error('Enter the rate (amount for one)')
      let taskId = f.design_task_id || null
      if (isNew && makeTask && !taskId) {
        const t = await q(supabase.from('design_tasks').insert({
          client_id: f.client_id, title: f.title.trim(), quantity: Math.max(1, Math.round(Number(f.qty))), due_date: f.job_date,
          brief: f.notes || f.title.trim(), billable: true
        }).select('id').single())
        taskId = t.id
      }
      const p = { client_id: f.client_id, job_date: f.job_date, title: f.title.trim(), qty: Number(f.qty), rate: Number(f.rate), notes: f.notes || null, design_task_id: taskId }
      if (isNew) await q(supabase.from('client_jobs').insert(p))
      else await q(supabase.from('client_jobs').update(p).eq('id', job.id))
      onSaved()
    }, isNew ? (makeTask ? 'Job added and design task created' : 'Job added') : 'Job updated')
  }

  return (
    <Modal open onClose={onClose} title={isNew ? 'Add on-demand job' : 'Edit job'} subtitle="One piece of work for a customer, with what we charge for it."
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" form="job-form" loading={busy}>{isNew ? 'Add job' : 'Save job'}</Button></>}>
      <form id="job-form" className="form" onSubmit={save}>
        {!fixedClient && <Field label="Customer" required span={2}><ClientSelect value={f.client_id} onChange={set('client_id')} allowCreate placeholder="Choose customer…" /></Field>}
        <Field label="What was done" required span={2}>
          <Input list="job-titles" autoFocus value={f.title} onChange={set('title')} placeholder="e.g. Poster – Friday offer" />
          <datalist id="job-titles">{suggestions.map((s) => <option key={s} value={s} />)}</datalist>
        </Field>
        <Field label="Date"><Input type="date" value={f.job_date} onChange={set('job_date')} /></Field>
        <Field label="Quantity"><Input type="number" min="0" value={f.qty} onChange={set('qty')} /></Field>
        <Field label="Rate (₹ for one)" required><Input type="number" min="0" value={f.rate} onChange={set('rate')} placeholder="e.g. 600" /></Field>
        <Field label="Amount"><div className="input" style={{ background: 'var(--surface-2)', fontWeight: 700 }}>{rawMoney2(amount)}</div></Field>
        <Field label="Notes" span={2} hint="Shown under the line on the invoice"><Textarea rows={2} value={f.notes} onChange={set('notes')} placeholder="Size, platform, revisions… e.g. A4 + Instagram post" /></Field>
        {seeTasks && f.client_id && (
          <Field label="Design task (optional)" span={2} hint={canTask && isNew ? 'Link the task this job is for, or create one for the designer below.' : 'Link the task this job is for.'}>
            <Select value={f.design_task_id} onChange={(v) => { set('design_task_id')(v || ''); if (v) setMakeTask(false) }} placeholder="Not linked"
              options={tasks.data.map((t) => ({ id: t.id, label: `${t.code} · ${t.title}` }))} />
          </Field>
        )}
        {canTask && isNew && !f.design_task_id && (
          <label className="check" style={{ gridColumn: '1 / -1' }}><input type="checkbox" checked={makeTask} onChange={(e) => setMakeTask(e.target.checked)} />Also create a design task for this job (due on the job date — assign it on the task)</label>
        )}
      </form>
    </Modal>
  )
}

/* ---------------- bill selected jobs of one customer ---------------- */
function BillModal({ client, jobs, onClose, onDone }) {
  const { has } = useAuth()
  const isFin = has('invoices.manage')
  const total = sum(jobs)
  const [f, set] = useForm({ paid: '', method: 'Cash', reference: '', due: addDays(todayISO(), 7), draft: isFin })
  const [busy, run] = useAction()
  const paid = Number(f.paid || 0)
  const asDraft = isFin && f.draft && paid === 0
  const go = () => run(async () => {
    if (paid < 0 || paid > total + 0.01) throw new Error(`Amount received must be between ₹0 and ${rawMoney2(total)}`)
    const r = await q(supabase.rpc('bill_client_jobs', { p_job_ids: jobs.map((j) => j.id), p_paid: paid, p_method: f.method, p_reference: f.reference || null, p_draft: asDraft, p_due_date: f.due || null }))
    onDone(r)
    return r
  }, asDraft ? 'Draft invoice created — review and send it' : paid ? 'Invoice created and payment recorded' : 'Invoice created')

  return (
    <Modal open onClose={onClose} title={`Bill ${client.name}`} subtitle={`${jobs.length} job${jobs.length === 1 ? '' : 's'} → one invoice`}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button icon={Receipt} loading={busy} onClick={go}>{asDraft ? 'Create draft invoice' : paid ? `Create invoice & record ${rawMoney2(paid)}` : 'Create invoice'}</Button></>}>
      <div className="table-wrap" style={{ marginBottom: 14 }}><table className="table">
        <tbody>{jobs.map((j) => <tr key={j.id}><td className="nowrap">{date(j.job_date)}</td><td>{j.title}{Number(j.qty) !== 1 && <span className="faint"> × {Number(j.qty)}</span>}</td><td className="num">{rawMoney2(j.amount)}</td></tr>)}</tbody>
        <tfoot><tr><td colSpan={2}>Invoice total</td><td className="num">{rawMoney2(total)}</td></tr></tfoot>
      </table></div>
      <div className="form">
        <Field label="Received now (₹)" hint="Leave 0 if the customer will pay later">
          <div className="row gap-xs"><Input type="number" min="0" value={f.paid} onChange={set('paid')} placeholder="0" /><Button size="sm" variant="soft" icon={Wallet} onClick={() => set('paid')(String(total))}>Full</Button></div>
        </Field>
        <Field label="Due date"><Input type="date" value={f.due} onChange={set('due')} /></Field>
        {paid > 0 && <>
          <Field label="Method"><Select placeholder={false} options={PAYMENT_METHODS.map((m) => ({ id: m, label: m }))} value={f.method} onChange={set('method')} /></Field>
          <Field label="Reference"><Input value={f.reference} onChange={set('reference')} placeholder="UPI ref / cheque no. (optional)" /></Field>
        </>}
      </div>
      {isFin && paid === 0 && (
        <label className="check mt"><input type="checkbox" checked={f.draft} onChange={(e) => set('draft')(e.target.checked)} />Save as a draft to review before sending (it won’t count as owed until you press Mark sent)</label>
      )}
      {paid > 0 && <p className="small faint mt">The payment is recorded as collected by you.</p>}
    </Modal>
  )
}
