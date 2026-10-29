import { supabase, q } from '../../lib/supabase'
import { useData } from '../../lib/hooks'
import { useAuth } from '../../lib/auth'
import { TASK_TYPES, PLATFORMS, SIZES, PRIORITIES } from '../../lib/constants'
import { addDays, todayISO } from '../../lib/format'
import { Modal, Field, Input, Select, Textarea, ClientSelect, Button, useAction, useForm } from '../../components/ui'

export function TaskModal({ task = {}, onClose, onSaved }) {
  const { settings, workers } = useAuth()
  const isNew = !task.id
  const [f, set] = useForm({
    client_id: '', project_id: '', title: '', task_type: 'Social Post', platform: 'Instagram', size: '1080×1350 (Portrait)', quantity: 1,
    brief: '', copy_text: '', reference_links: '', priority: 'normal', assignee_id: '', due_date: addDays(todayISO(), 2), estimated_hours: 1,
    max_revisions: settings?.default_max_revisions ?? 3, billable: true, final_file_link: '', ...task
  })
  const load = useData(async () => {
    const [projects, open] = await Promise.all([
      f.client_id ? q(supabase.from('projects').select('id,name').eq('client_id', f.client_id).in('status', ['planning', 'active'])) : [],
      q(supabase.from('design_tasks').select('assignee_id, estimated_hours').in('status', ['todo', 'in_progress', 'revision', 'internal_review']))
    ])
    return { projects, open }
  }, [f.client_id], { projects: [], open: [] })
  const designers = workers
  const workload = (id) => load.data.open.filter((t) => t.assignee_id === id)
  const [busy, run] = useAction()

  const save = (e) => {
    e.preventDefault()
    run(async () => {
      const p = { ...f }
      ;['id', 'created_at', 'updated_at', 'code', 'created_by', 'revision_count', 'approved_at', 'delivered_at', 'clients', 'projects', 'task_proofs', 'task_comments', 'status', 'start_date'].forEach((k) => delete p[k])
      p.client_id = p.client_id || null; p.project_id = p.project_id || null; p.assignee_id = p.assignee_id || null; p.due_date = p.due_date || null
      p.quantity = Number(p.quantity || 1); p.estimated_hours = Number(p.estimated_hours || 0); p.max_revisions = Number(p.max_revisions || 0)
      const row = isNew
        ? await q(supabase.from('design_tasks').insert(p).select().single())
        : await q(supabase.from('design_tasks').update(p).eq('id', task.id).select().single())
      onSaved(row)
    }, isNew ? 'Task created & designer notified' : 'Task updated')
  }

  return (
    <Modal open size="lg" onClose={onClose} title={isNew ? 'New design task' : `Edit ${task.code || 'task'}`}
      subtitle="A clear brief saves revision rounds: include the copy, size and references."
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button form="task-form" type="submit" loading={busy}>{isNew ? 'Create task' : 'Save changes'}</Button></>}>
      <form id="task-form" className="form f3" onSubmit={save}>
        <Field label="Client" required><ClientSelect value={f.client_id} onChange={(v) => { set('client_id')(v); set('project_id')('') }} /></Field>
        <Field label="Task title" span={2} required><Input required value={f.title} onChange={set('title')} placeholder="e.g. Onam offer post – 20% off" /></Field>
        <Field label="Type"><Select placeholder={false} options={TASK_TYPES} value={f.task_type} onChange={set('task_type')} /></Field>
        <Field label="Platform"><Select options={PLATFORMS} value={f.platform} onChange={set('platform')} /></Field>
        <Field label="Size / format"><Select options={SIZES} value={f.size} onChange={set('size')} /></Field>
        <Field label="Quantity"><Input type="number" step="any" min="1" value={f.quantity} onChange={set('quantity')} /></Field>
        <Field label="Priority"><Select placeholder={false} options={PRIORITIES} value={f.priority} onChange={set('priority')} /></Field>
        <Field label="Due date"><Input type="date" value={f.due_date} onChange={set('due_date')} /></Field>
        <Field label="Assign designer" span={2} hint="Open tasks shown next to each name">
          <Select options={designers.map((d) => { const w = workload(d.id); return { id: d.id, label: `${d.full_name} — ${w.length} open · ${w.reduce((a, t) => a + Number(t.estimated_hours || 0), 0)}h` } })}
            value={f.assignee_id} onChange={set('assignee_id')} placeholder="Unassigned (designers can pick it up)" />
        </Field>
        <Field label="Campaign"><Select options={load.data.projects.map((p) => ({ id: p.id, label: p.name }))} value={f.project_id} onChange={set('project_id')} placeholder="None" /></Field>
        <Field label="Creative brief" span={3} required><Textarea rows={4} required value={f.brief} onChange={set('brief')} placeholder="Goal, key message, mood, must-include elements, things to avoid…" /></Field>
        <Field label="Text / copy on the design" span={3}><Textarea rows={3} value={f.copy_text} onChange={set('copy_text')} placeholder="Headline, offer, phone number, address, hashtags…" /></Field>
        <Field label="References & links" span={3}><Textarea rows={2} value={f.reference_links} onChange={set('reference_links')} placeholder="Pinterest / Instagram references, Drive folder with photos…" /></Field>
        <Field label="Estimated hours"><Input type="number" min="0" step="0.5" value={f.estimated_hours} onChange={set('estimated_hours')} /></Field>
        <Field label="Revisions included"><Input type="number" step="any" min="0" value={f.max_revisions} onChange={set('max_revisions')} /></Field>
        <Field label="Billing"><label className="check" style={{ height: 38 }}><input type="checkbox" checked={!!f.billable} onChange={(e) => set('billable')(e.target.checked)} />Billable client work</label></Field>
      </form>
    </Modal>
  )
}
