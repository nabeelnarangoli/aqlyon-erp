import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Trash2, Clock } from 'lucide-react'
import { supabase, q } from '../../lib/supabase'
import { useData } from '../../lib/hooks'
import { useAuth } from '../../lib/auth'
import { toISO, todayISO, hours, date, pct } from '../../lib/format'
import { PageHeader, Button, Card, Stat, MemberSelect, ClientSelect, Field, Input, Loading, Empty, IconBtn, Progress, useAction, useForm } from '../../components/ui'

export default function Timesheet() {
  const { user, has, member, isAdmin } = useAuth()
  const [who, setWho] = useState(user.id)
  const [week, setWeek] = useState(() => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d })
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(week); d.setDate(week.getDate() + i); return toISO(d) })
  const { data, loading, reload } = useData(async () => {
    const [logs, tasks, recent] = await Promise.all([
      q(supabase.from('time_logs').select('*, design_tasks(code,title), clients(name)').eq('user_id', who).gte('log_date', days[0]).lte('log_date', days[6]).order('log_date')),
      q(supabase.from('design_tasks').select('id,code,title,client_id, clients(name)').or(`assignee_id.eq.${who},created_by.eq.${who}`).not('status', 'in', '(delivered,cancelled)').order('due_date')),
      q(supabase.from('time_logs').select('activity').eq('user_id', who).not('activity', 'is', null).order('created_at', { ascending: false }).limit(60))
    ])
    return { logs, tasks, recent: [...new Set(recent.map((r) => r.activity))].slice(0, 8) }
  }, [who, days[0]], { logs: [], tasks: [], recent: [] })
  const m = member(who)
  const capacity = (m?.weekly_hours || 48) * 60
  const total = data.logs.reduce((a, x) => a + x.minutes, 0)
  const billable = data.logs.filter((x) => x.billable).reduce((a, x) => a + x.minutes, 0)
  const perDay = useMemo(() => days.map((d) => data.logs.filter((x) => x.log_date === d).reduce((a, x) => a + x.minutes, 0)), [data.logs, days])

  const [f, set, setF] = useForm({ log_date: todayISO(), task_id: '', activity: '', client_id: '', hours: '', note: '', billable: true })
  const [busy, run] = useAction()
  const add = (e) => { e.preventDefault(); run(async () => {
    const minutes = Math.round(Number(f.hours) * 60); if (!minutes) throw new Error('Enter hours')
    const t = data.tasks.find((x) => x.id === f.task_id)
    if (!t && !f.activity.trim()) throw new Error('Type what you worked on, or pick a task')
    await q(supabase.from('time_logs').insert({ user_id: who, log_date: f.log_date, task_id: t?.id || null, activity: t ? null : f.activity.trim(), client_id: t?.client_id || f.client_id || null, minutes, note: f.note || null, billable: !!f.billable }))
    setF((s) => ({ ...s, task_id: '', activity: '', hours: '', note: '' })); reload()
  }, 'Logged') }
  const del = (x) => run(async () => { await q(supabase.from('time_logs').delete().eq('id', x.id)); reload() })
  const shift = (k) => setWeek((w) => { const d = new Date(w); d.setDate(d.getDate() + 7 * k); return d })
  const canEdit = who === user.id || has('team.manage')

  return (
    <>
      <PageHeader title="Timesheet" subtitle="Log time against tasks and clients — it powers utilisation and client profitability reports."
        actions={has('timesheet.all') && <MemberSelect value={who} onChange={(v) => setWho(v || user.id)} placeholder="Me" />} />
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
            <Field label="Task / what you did" required hint={f.task_id ? 'Linked to the design task — client is taken from it' : 'Type freely, or pick one of your tasks'}>
              <TaskCombo tasks={data.tasks} recent={data.recent} taskId={f.task_id} text={f.activity}
                onChange={(task_id, activity) => setF((s) => ({ ...s, task_id, activity }))} />
            </Field>
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
                  <td>{x.design_tasks ? <><b>{x.design_tasks.code}</b> {x.design_tasks.title}</> : x.activity || x.note || '—'}{x.note && (x.design_tasks || x.activity) && <div className="tiny faint">{x.note}</div>}{!x.billable && <span className="tiny faint"> · non-billable</span>}</td>
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

const ACTIVITIES = ['Client meeting', 'Client call / follow-up', 'Content planning', 'Copywriting / captions', 'Poster design', 'Reel editing', 'Video shoot',
  'Photo shoot', 'Posting & scheduling', 'Ads setup / optimisation', 'Reporting', 'Revisions', 'Internal meeting', 'Training', 'Admin work']

// type freely or pick: your open tasks (linked, with client) + recent and common activities
function TaskCombo({ tasks, recent, taskId, text, onChange }) {
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const task = tasks.find((t) => t.id === taskId)
  const value = task ? `${task.code} · ${task.title}` : text
  const qy = (task ? '' : text).trim().toLowerCase()
  const tMatch = tasks.filter((t) => !qy || `${t.code} ${t.title} ${t.clients?.name || ''}`.toLowerCase().includes(qy)).slice(0, 6)
  const aMatch = [...new Set([...recent, ...ACTIVITIES])].filter((a) => !qy || a.toLowerCase().includes(qy)).slice(0, 7)
  const items = [...tMatch.map((t) => ({ k: 't' + t.id, t })), ...aMatch.map((a) => ({ k: 'a' + a, a }))]
  const choose = (it) => { it.t ? onChange(it.t.id, '') : onChange('', it.a); setOpen(false) }
  return (
    <div style={{ position: 'relative' }}>
      <input className="input" value={value} placeholder="e.g. Reel editing for Star Health, or pick a task…"
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => { onChange('', e.target.value); setOpen(true); setHi(0) }}
        onKeyDown={(e) => {
          if (!open || !items.length) return
          if (e.key === 'ArrowDown') { e.preventDefault(); setHi((hi + 1) % items.length) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((hi - 1 + items.length) % items.length) }
          else if (e.key === 'Enter' && qy && items[hi]) { e.preventDefault(); choose(items[hi]) }
          else if (e.key === 'Escape') setOpen(false)
        }} />
      {task && <button type="button" className="link-btn tiny" style={{ position: 'absolute', right: 10, top: 11 }} onMouseDown={(e) => { e.preventDefault(); onChange('', '') }}>clear</button>}
      {open && items.length > 0 && (
        <div className="mention-list" style={{ top: '100%', bottom: 'auto', marginTop: 4, marginBottom: 0, width: '100%', maxHeight: 300, overflow: 'auto' }}>
          {tMatch.length > 0 && <div className="tiny faint" style={{ padding: '6px 10px 2px' }}>Your tasks</div>}
          {items.map((it, i) => (
            <button type="button" key={it.k} className={i === hi ? 'on' : ''} onMouseDown={(e) => { e.preventDefault(); choose(it) }}>
              {it.t ? <span><b>{it.t.code}</b> {it.t.title}{it.t.clients?.name && <span className="faint"> · {it.t.clients.name}</span>}</span> : <span>{it.a}</span>}
            </button>
          )).flatMap((el, i) => (i === tMatch.length && tMatch.length ? [<div key="sep" className="tiny faint" style={{ padding: '6px 10px 2px', borderTop: '1px solid var(--line)' }}>Activities</div>, el] : [el]))}
        </div>
      )}
    </div>
  )
}
