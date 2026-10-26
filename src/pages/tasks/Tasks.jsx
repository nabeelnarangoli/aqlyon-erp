import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, LayoutGrid, List, Paperclip, RotateCcw, Download } from 'lucide-react'
import { supabase, q } from '../../lib/supabase'
import { useData, useLocal, useRealtime } from '../../lib/hooks'
import { useAuth } from '../../lib/auth'
import { TASK_STATUSES, TASK_TYPES, PRIORITIES, DESIGNER_STATUSES } from '../../lib/constants'
import { date, dueLabel, downloadCSV } from '../../lib/format'
import {
  PageHeader, Button, Badge, StatusBadge, Member, Select, MemberSelect, ClientSelect, SearchInput, Loading, ErrorBox, Empty, useToast, cx
} from '../../components/ui'
import { TaskModal } from './TaskForm'

const BOARD_COLS = ['todo', 'in_progress', 'internal_review', 'client_review', 'revision', 'approved', 'delivered']

export default function Tasks() {
  const { user, role, can } = useAuth()
  const nav = useNavigate()
  const { toast } = useToast()
  const [view, setView] = useLocal('tasks.view', 'board')
  const [scope, setScope] = useLocal('tasks.scope', role === 'designer' ? 'mine' : 'all')
  const [client, setClient] = useState('')
  const [designer, setDesigner] = useState('')
  const [type, setType] = useState('')
  const [search, setSearch] = useState('')
  const [showDone, setShowDone] = useState(false)
  const [adding, setAdding] = useState(false)
  const [over, setOver] = useState(null)

  const { data, loading, error, reload, setData } = useData(() =>
    q(supabase.from('design_tasks').select('*, clients(name), task_proofs(count), task_comments(count)').order('due_date', { ascending: true, nullsFirst: false }).limit(1000)), [], [])
  useRealtime('design_tasks', null, () => reload())

  const rows = useMemo(() => data.filter((t) => {
    if (scope === 'mine' && t.assignee_id !== user.id) return false
    if (scope === 'unassigned' && t.assignee_id) return false
    if (scope === 'review' && t.status !== 'internal_review') return false
    if (scope === 'created' && t.created_by !== user.id) return false
    if (client && t.client_id !== client) return false
    if (designer && t.assignee_id !== designer) return false
    if (type && t.task_type !== type) return false
    if (!showDone && view === 'list' && ['delivered', 'cancelled'].includes(t.status)) return false
    if (search) { const s = search.toLowerCase(); if (![t.title, t.code, t.clients?.name, t.brief].some((v) => v?.toLowerCase().includes(s))) return false }
    return true
  }), [data, scope, client, designer, type, search, showDone, view, user.id])

  const move = async (id, status) => {
    const t = data.find((x) => x.id === id)
    if (!t || t.status === status) return
    if (role === 'designer' && !DESIGNER_STATUSES.includes(status)) { toast('Designers can move tasks to To do, In progress or Internal review. Upload a proof to send for review.', 'info'); return }
    setData((d) => d.map((x) => (x.id === id ? { ...x, status } : x)))
    const { error } = await supabase.from('design_tasks').update({ status }).eq('id', id)
    if (error) { toast(error.message, 'error'); reload() }
  }

  const overdue = rows.filter((t) => !['approved', 'delivered', 'cancelled'].includes(t.status) && t.due_date && dueLabel(t.due_date).tone === 'red').length
  const scopes = [
    { id: 'all', label: 'All tasks' }, { id: 'mine', label: 'Assigned to me' },
    can('marketer') && { id: 'created', label: 'Created by me' }, can('marketer') && { id: 'review', label: 'Needs review' },
    { id: 'unassigned', label: 'Unassigned' }
  ].filter(Boolean)

  return (
    <>
      <PageHeader title="Design Tasks" subtitle={`${rows.filter((t) => !['delivered', 'cancelled'].includes(t.status)).length} in production${overdue ? ` · ${overdue} overdue` : ''}`}
        actions={<>
          <Button variant="outline" icon={Download} onClick={() => downloadCSV('design-tasks.csv', rows.map((t) => ({ code: t.code, title: t.title, client: t.clients?.name, type: t.task_type, qty: t.quantity, status: t.status, priority: t.priority, due: t.due_date, revisions: t.revision_count })))}>Export</Button>
          {can('marketer') && <Button icon={Plus} onClick={() => setAdding(true)}>New task</Button>}
        </>} />
      <div className="filters">
        <div className="seg">{scopes.map((s) => <button key={s.id} className={cx(scope === s.id && 'on')} onClick={() => setScope(s.id)}>{s.label}</button>)}</div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search tasks…" />
        <ClientSelect value={client} onChange={(v) => setClient(v || '')} placeholder="All clients" />
        {role !== 'designer' && <MemberSelect roles={['designer', 'admin']} value={designer} onChange={(v) => setDesigner(v || '')} placeholder="All designers" />}
        <Select options={TASK_TYPES} value={type} onChange={(v) => setType(v || '')} placeholder="All types" />
        <div className="grow" />
        {view === 'list' && <label className="check small"><input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />Show delivered</label>}
        <div className="seg">
          <button className={cx(view === 'board' && 'on')} onClick={() => setView('board')}><LayoutGrid size={14} />Board</button>
          <button className={cx(view === 'list' && 'on')} onClick={() => setView('list')}><List size={14} />List</button>
        </div>
      </div>
      <ErrorBox error={error} onRetry={reload} />
      {loading ? <Loading /> : view === 'board' ? (
        <div className="board">
          {BOARD_COLS.map((sid) => {
            const s = TASK_STATUSES.find((x) => x.id === sid)
            let items = rows.filter((t) => t.status === sid)
            if (sid === 'delivered') items = items.sort((a, b) => (b.delivered_at || '').localeCompare(a.delivered_at || '')).slice(0, 15)
            return (
              <div key={sid} className={cx('lane', over === sid && 'drop')}
                onDragOver={(e) => { e.preventDefault(); setOver(sid) }} onDragLeave={() => setOver(null)}
                onDrop={(e) => { setOver(null); move(e.dataTransfer.getData('id'), sid) }}>
                <div className="lane-head"><Badge tone={s.tone} dot>{s.label}</Badge><span className="sum">{items.length}</span></div>
                {items.map((t) => <TaskCard key={t.id} t={t} onOpen={() => nav(`/tasks/${t.id}`)} />)}
              </div>
            )
          })}
        </div>
      ) : rows.length === 0 ? <Empty title="No tasks match these filters" /> : (
        <div className="card table-wrap"><table className="table">
          <thead><tr><th>Task</th><th>Client</th><th>Type</th><th>Priority</th><th>Status</th><th>Designer</th><th>Due</th><th className="num">Rev.</th><th className="num">Proofs</th></tr></thead>
          <tbody>{rows.map((t) => {
            const d = dueLabel(t.due_date); const late = !['approved', 'delivered', 'cancelled'].includes(t.status)
            return (
              <tr key={t.id} className="click" onClick={() => nav(`/tasks/${t.id}`)}>
                <td><div className="cell-title">{t.title}</div><div className="cell-sub">{t.code}</div></td>
                <td>{t.clients?.name || '—'}</td>
                <td className="nowrap">{t.task_type}{t.quantity > 1 ? ` ×${t.quantity}` : ''}</td>
                <td><StatusBadge list={PRIORITIES} value={t.priority} /></td>
                <td><StatusBadge list={TASK_STATUSES} value={t.status} /></td>
                <td><Member id={t.assignee_id} size={22} /></td>
                <td>{t.due_date ? (late ? <Badge tone={d.tone}>{date(t.due_date)}</Badge> : date(t.due_date)) : '—'}</td>
                <td className="num">{t.revision_count}/{t.max_revisions}</td>
                <td className="num">{t.task_proofs?.[0]?.count || 0}</td>
              </tr>)
          })}</tbody></table></div>
      )}
      {adding && <TaskModal onClose={() => setAdding(false)} onSaved={(row) => { setAdding(false); reload(); nav(`/tasks/${row.id}`) }} />}
    </>
  )
}

function TaskCard({ t, onOpen }) {
  const d = dueLabel(t.due_date)
  const active = !['approved', 'delivered', 'cancelled'].includes(t.status)
  return (
    <div className={cx('kcard', `prio-${t.priority}`)} draggable onDragStart={(e) => e.dataTransfer.setData('id', t.id)} onClick={onOpen}>
      <div>
        <div className="tiny faint">{t.code} · {t.clients?.name || 'No client'}</div>
        <div className="title">{t.title}</div>
      </div>
      <div className="meta">
        <Badge tone="slate">{t.task_type}{t.quantity > 1 ? ` ×${t.quantity}` : ''}</Badge>
        {t.priority === 'urgent' && <Badge tone="red">Urgent</Badge>}
        {t.priority === 'high' && <Badge tone="orange">High</Badge>}
        {t.revision_count > 0 && <span className="row gap-xs" title="Revisions" style={{ color: t.revision_count > t.max_revisions ? 'var(--red)' : undefined }}><RotateCcw size={12} />{t.revision_count}/{t.max_revisions}</span>}
        {t.task_proofs?.[0]?.count > 0 && <span className="row gap-xs" title="Proofs"><Paperclip size={12} />{t.task_proofs[0].count}</span>}
      </div>
      <div className="foot">
        <Member id={t.assignee_id} size={22} showName={false} fallback={<Badge tone="amber">Unassigned</Badge>} />
        {t.due_date && <Badge tone={active ? d.tone : 'slate'}>{active ? d.text : date(t.due_date)}</Badge>}
      </div>
    </div>
  )
}
