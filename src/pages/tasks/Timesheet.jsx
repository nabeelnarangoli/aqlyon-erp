import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Trash2, Clock } from 'lucide-react'
import { supabase, q } from '../../lib/supabase'
import { useData } from '../../lib/hooks'
import { useAuth } from '../../lib/auth'
import { toISO, todayISO, hours, date, pct } from '../../lib/format'
import { PageHeader, Button, Card, Stat, MemberSelect, ClientSelect, Field, Input, Select, Loading, Empty, IconBtn, Progress, useAction, useForm } from '../../components/ui'

export default function Timesheet() {
  const { user, can, member, isAdmin } = useAuth()
  const [who, setWho] = useState(user.id)
  const [week, setWeek] = useState(() => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d })
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(week); d.setDate(week.getDate() + i); return toISO(d) })
  const { data, loading, reload } = useData(async () => {
    const [logs, tasks] = await Promise.all([
      q(supabase.from('time_logs').select('*, design_tasks(code,title), clients(name)').eq('user_id', who).gte('log_date', days[0]).lte('log_date', days[6]).order('log_date')),
      q(supabase.from('design_tasks').select('id,code,title,client_id').eq('assignee_id', who).not('status', 'in', '(delivered,cancelled)'))
    ])
    return { logs, tasks }
  }, [who, days[0]], { logs: [], tasks: [] })
  const m = member(who)
  const capacity = (m?.weekly_hours || 48) * 60
  const total = data.logs.reduce((a, x) => a + x.minutes, 0)
  const billable = data.logs.filter((x) => x.billable).reduce((a, x) => a + x.minutes, 0)
  const perDay = useMemo(() => days.map((d) => data.logs.filter((x) => x.log_date === d).reduce((a, x) => a + x.minutes, 0)), [data.logs, days])

  const [f, set, setF] = useForm({ log_date: todayISO(), task_id: '', client_id: '', hours: '', note: '', billable: true })
  const [busy, run] = useAction()
  const add = (e) => { e.preventDefault(); run(async () => {
    const minutes = Math.round(Number(f.hours) * 60); if (!minutes) throw new Error('Enter hours')
    const t = data.tasks.find((x) => x.id === f.task_id)
    await q(supabase.from('time_logs').insert({ user_id: who, log_date: f.log_date, task_id: f.task_id || null, client_id: t?.client_id || f.client_id || null, minutes, note: f.note || null, billable: !!f.billable }))
    setF((s) => ({ ...s, hours: '', note: '' })); reload()
  }, 'Logged') }
  const del = (x) => run(async () => { await q(supabase.from('time_logs').delete().eq('id', x.id)); reload() })
  const shift = (k) => setWeek((w) => { const d = new Date(w); d.setDate(d.getDate() + 7 * k); return d })
  const canEdit = who === user.id || isAdmin

  return (
    <>
      <PageHeader title="Timesheet" subtitle="Log time against tasks and clients — it powers utilisation and client profitability reports."
        actions={can('marketer') && <MemberSelect value={who} onChange={(v) => setWho(v || user.id)} placeholder="Me" />} />
      <div className="filters">
        <IconBtn icon={ChevronLeft} title="Previous week" onClick={() => shift(-1)} />
        <b>{date(days[0], { day: 'numeric', month: 'short' })} – {date(days[6])}</b>
        <IconBtn icon={ChevronRight} title="Next week" onClick={() => shift(1)} />
      </div>
      <div className="stats">
        <Stat label="Logged this week" value={hours(total)} sub={`of ${m?.weekly_hours || 48}h capacity`} icon={Clock} />
        <Stat label="Billable" value={hours(billable)} sub={`${pct(billable, total)}% of logged`} icon={Clock} tone="teal" />
        <Stat label="Utilisation" value={`${pct(billable, capacity)}%`} sub="Billable ÷ capacity (target 65–75%)" icon={Clock} tone={pct(billable, capacity) < 50 ? 'amber' : 'green'} />
      </div>
      <div className="grid g-1-2">
        {canEdit && <Card title="Add entry">
          <form className="form f1" onSubmit={add}>
            <Field label="Date"><Input type="date" value={f.log_date} onChange={set('log_date')} /></Field>
            <Field label="Task"><Select options={data.tasks.map((t) => ({ id: t.id, label: `${t.code} · ${t.title}` }))} value={f.task_id} onChange={set('task_id')} placeholder="No task (general work)" /></Field>
            {!f.task_id && <Field label="Client (optional)"><ClientSelect value={f.client_id} onChange={set('client_id')} placeholder="Internal / no client" /></Field>}
            <Field label="Hours"><Input type="number" step="0.25" min="0" value={f.hours} onChange={set('hours')} placeholder="1.5" /></Field>
            <Field label="Note"><Input value={f.note} onChange={set('note')} placeholder="Client meeting, shoot, editing…" /></Field>
            <label className="check"><input type="checkbox" checked={!!f.billable} onChange={(e) => set('billable')(e.target.checked)} />Billable client work</label>
            <Button type="submit" icon={Plus} loading={busy}>Log time</Button>
          </form>
        </Card>}
        <Card title="This week" pad={false}>
          <div className="card-body">
            <div className="grid" style={{ gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
              {days.map((d, i) => (
                <div key={d} className="center small">
                  <div className="faint">{new Date(d).toLocaleDateString('en-IN', { weekday: 'short' })}</div>
                  <b>{hours(perDay[i])}</b>
                  <Progress value={perDay[i]} max={(capacity / 6) || 480} />
                </div>
              ))}
            </div>
          </div>
          {loading ? <Loading /> : data.logs.length === 0 ? <Empty title="No time logged this week" /> : (
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Date</th><th>Work</th><th>Client</th><th className="num">Hours</th><th></th></tr></thead>
              <tbody>{data.logs.map((x) => (
                <tr key={x.id}>
                  <td className="nowrap">{date(x.log_date, { weekday: 'short', day: 'numeric' })}</td>
                  <td>{x.design_tasks ? <b>{x.design_tasks.code}</b> : null} {x.note || x.design_tasks?.title}{!x.billable && <span className="tiny faint"> · non-billable</span>}</td>
                  <td>{x.clients?.name || '—'}</td>
                  <td className="num">{hours(x.minutes)}</td>
                  <td>{canEdit && <IconBtn icon={Trash2} size={14} title="Delete" onClick={() => del(x)} />}</td>
                </tr>))}</tbody>
              <tfoot><tr><td colSpan={3}>Total</td><td className="num">{hours(total)}</td><td /></tr></tfoot>
            </table></div>
          )}
        </Card>
      </div>
    </>
  )
}
