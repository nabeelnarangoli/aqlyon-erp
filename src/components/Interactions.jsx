import { useState } from 'react'
import { Phone, MessageCircle, Users, MapPin, Video, Mail, StickyNote, Check, Plus, Trash2 } from 'lucide-react'
import { supabase, q } from '../lib/supabase'
import { useData } from '../lib/hooks'
import { useAuth } from '../lib/auth'
import { INTERACTION_TYPES, byId } from '../lib/constants'
import { dateTime, date, dueLabel, todayISO, addDays } from '../lib/format'
import { Button, Field, Input, Select, Textarea, Badge, Member, Empty, Loading, useAction, useForm, useToast, IconBtn } from './ui'

const ICONS = { Phone, MessageCircle, Users, MapPin, Video, Mail, StickyNote }

export default function Interactions({ clientId, leadId, onChange }) {
  const { user, isAdmin } = useAuth()
  const { confirm } = useToast()
  const [adding, setAdding] = useState(false)
  const list = useData(() => {
    let r = supabase.from('interactions').select('*').order('occurred_at', { ascending: false }).limit(200)
    r = clientId ? r.eq('client_id', clientId) : r.eq('lead_id', leadId)
    return q(r)
  }, [clientId, leadId], [])
  const [busy, run] = useAction()
  const markDone = (it) => run(async () => { await q(supabase.from('interactions').update({ done: true }).eq('id', it.id)); list.reload(); onChange?.() }, 'Follow-up marked done')
  const del = async (it) => {
    if (!(await confirm('Delete this log entry?', { danger: true, okText: 'Delete' }))) return
    run(async () => { await q(supabase.from('interactions').delete().eq('id', it.id)); list.reload() })
  }

  return (
    <div>
      <div className="row between mb">
        <h3>Conversation log</h3>
        {!adding && <Button size="sm" icon={Plus} onClick={() => setAdding(true)}>Log interaction</Button>}
      </div>
      {adding && <InteractionForm clientId={clientId} leadId={leadId} onDone={() => { setAdding(false); list.reload(); onChange?.() }} onCancel={() => setAdding(false)} />}
      {list.loading ? <Loading /> : list.data.length === 0 && !adding ? (
        <Empty title="No interactions yet">Log every call, WhatsApp chat, meeting and visit so the whole team knows the context.</Empty>
      ) : (
        <div className="timeline mt">
          {list.data.map((it) => {
            const t = byId(INTERACTION_TYPES, it.type); const Icon = ICONS[t.icon] || StickyNote
            const due = it.next_action_date && !it.done ? dueLabel(it.next_action_date) : null
            return (
              <div className="tl-item" key={it.id}>
                <span className="tl-icon"><Icon size={16} /></span>
                <div className="tl-body">
                  <div className="row between gap-s wrap">
                    <div className="row gap-s wrap"><b>{t.label}</b>{it.type !== 'note' && <Badge tone="slate">{it.direction}</Badge>}<span className="tiny faint">{dateTime(it.occurred_at)}</span></div>
                    <div className="row gap-xs"><Member id={it.created_by} size={20} />{(isAdmin || it.created_by === user.id) && <IconBtn icon={Trash2} title="Delete" size={14} onClick={() => del(it)} />}</div>
                  </div>
                  <p className="pre mt" style={{ marginTop: 6 }}>{it.summary}</p>
                  {it.outcome && <p className="small muted" style={{ marginTop: 4 }}><b>Outcome:</b> {it.outcome}</p>}
                  {it.next_action && (
                    <div className="row between gap-s wrap" style={{ marginTop: 8, padding: '7px 10px', background: '#fff', borderRadius: 8, border: '1px solid var(--line-2)' }}>
                      <span className="small"><b>Next:</b> {it.next_action}{it.next_action_date && <> · {date(it.next_action_date)}</>}</span>
                      {it.done ? <Badge tone="green">Done</Badge> : <div className="row gap-s">{due && <Badge tone={due.tone}>{due.text}</Badge>}<Button size="sm" variant="soft" icon={Check} loading={busy} onClick={() => markDone(it)}>Done</Button></div>}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function InteractionForm({ clientId, leadId, onDone, onCancel }) {
  const [f, set] = useForm({ type: 'call', direction: 'outgoing', summary: '', outcome: '', next_action: '', next_action_date: addDays(todayISO(), 2), occurred: '' })
  const [busy, run] = useAction()
  const save = (e) => {
    e.preventDefault()
    run(async () => {
      await q(supabase.from('interactions').insert({
        client_id: clientId || null, lead_id: leadId || null, type: f.type, direction: f.direction, summary: f.summary, outcome: f.outcome || null,
        next_action: f.next_action || null, next_action_date: f.next_action ? f.next_action_date || null : null,
        occurred_at: f.occurred ? new Date(f.occurred).toISOString() : new Date().toISOString()
      }))
      onDone()
    }, 'Interaction logged')
  }
  return (
    <form className="card card-body" style={{ background: 'var(--surface-2)' }} onSubmit={save}>
      <div className="form f3">
        <Field label="Type"><Select placeholder={false} options={INTERACTION_TYPES} value={f.type} onChange={set('type')} /></Field>
        <Field label="Direction"><Select placeholder={false} options={[{ id: 'outgoing', label: 'We contacted them' }, { id: 'incoming', label: 'They contacted us' }]} value={f.direction} onChange={set('direction')} /></Field>
        <Field label="When" hint="Leave empty for now"><Input type="datetime-local" value={f.occurred} onChange={set('occurred')} /></Field>
        <Field label="What was discussed?" span={3} required><Textarea required value={f.summary} onChange={set('summary')} placeholder="Requirements, feedback, objections, budget discussed…" /></Field>
        <Field label="Outcome" span={3}><Input value={f.outcome} onChange={set('outcome')} placeholder="e.g. Interested, asked for quote / Approved March calendar" /></Field>
        <Field label="Next action" span={2}><Input value={f.next_action} onChange={set('next_action')} placeholder="e.g. Send quotation, call back after Onam" /></Field>
        <Field label="Follow-up date"><Input type="date" value={f.next_action_date} onChange={set('next_action_date')} /></Field>
      </div>
      <div className="row gap-s mt" style={{ justifyContent: 'flex-end' }}>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={busy}>Save log</Button>
      </div>
    </form>
  )
}
