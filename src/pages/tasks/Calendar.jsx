import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Plus, Palette, Trash2, Send, LayoutGrid, List, ExternalLink } from 'lucide-react'
import { supabase, q } from '../../lib/supabase'
import { useData, useLocal, isMobileNow } from '../../lib/hooks'
import { useAuth } from '../../lib/auth'
import { POST_STATUSES, POST_TYPES, PLATFORMS, CONTENT_PILLARS, TASK_STATUSES, byId } from '../../lib/constants'
import { toISO, todayISO, date, addDays, n } from '../../lib/format'
import {
  PageHeader, Button, Badge, StatusBadge, Modal, Field, Input, Select, Textarea, Chips, ClientSelect, MemberSelect, Loading, Empty, Progress, IconBtn,
  useAction, useForm, useToast, cx, Card
} from '../../components/ui'
import { TaskModal } from './TaskForm'

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function Calendar() {
  const { has } = useAuth()
  const { toast } = useToast()
  const [params, setParams] = useSearchParams()
  const [client, setClient] = useLocal('cal.client', '')
  const [view, setView] = useLocal('cal.view', isMobileNow() ? 'list' : 'month')
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [editing, setEditing] = useState(null)
  const [over, setOver] = useState(null)
  const [busy, run] = useAction()
  const isMgr = has('calendar.manage')

  useEffect(() => { const c = params.get('client'); if (c) { setClient(c); setParams({}, { replace: true }) } }, [params, setParams, setClient])

  const first = new Date(cursor); const startPad = (first.getDay() + 6) % 7
  const gridStart = new Date(first); gridStart.setDate(1 - startPad)
  const days = Array.from({ length: 42 }, (_, i) => { const d = new Date(gridStart); d.setDate(gridStart.getDate() + i); return d })
  const from = toISO(days[0]), to = toISO(days[41])
  const monthFrom = toISO(cursor), monthTo = toISO(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0))

  const { data, loading, reload, setData } = useData(async () => {
    let r = supabase.from('content_posts').select('*, clients(name), design_tasks(id,code,status)').gte('publish_date', from).lte('publish_date', to).order('publish_time', { nullsFirst: true })
    if (client) r = r.eq('client_id', client)
    const posts = await q(r)
    const packs = client ? await q(supabase.from('packages').select('*').eq('client_id', client).eq('status', 'active')).catch(() => []) : []
    return { posts, packs }
  }, [from, to, client], { posts: [], packs: [] })

  useEffect(() => {
    const pid = params.get('post')
    if (pid) { supabase.from('content_posts').select('*').eq('id', pid).single().then(({ data: p }) => p && setEditing(p)); setParams({}, { replace: true }) }
  }, [params, setParams])

  const byDay = useMemo(() => {
    const m = {}; data.posts.forEach((p) => { (m[p.publish_date] ||= []).push(p) }); return m
  }, [data.posts])

  const monthPosts = data.posts.filter((p) => p.publish_date >= monthFrom && p.publish_date <= monthTo && p.status !== 'cancelled')
  const commit = data.packs.reduce((a, p) => ({ posts: a.posts + p.posts_per_month + p.carousels_per_month, reels: a.reels + p.reels_per_month, stories: a.stories + p.stories_per_month }), { posts: 0, reels: 0, stories: 0 })
  const planned = { posts: monthPosts.filter((p) => ['Post', 'Carousel', 'Ad'].includes(p.post_type)).length, reels: monthPosts.filter((p) => ['Reel', 'Video'].includes(p.post_type)).length, stories: monthPosts.filter((p) => p.post_type === 'Story').length }
  const readyForClient = monthPosts.filter((p) => ['idea', 'copywriting', 'in_design', 'internal_review'].includes(p.status) && (p.caption || p.media_link || p.design_task_id))

  const move = async (id, day) => {
    const p = data.posts.find((x) => x.id === id); if (!p || p.publish_date === day || !isMgr) return
    setData((d) => ({ ...d, posts: d.posts.map((x) => (x.id === id ? { ...x, publish_date: day } : x)) }))
    const { error } = await supabase.from('content_posts').update({ publish_date: day }).eq('id', id)
    if (error) { toast(error.message, 'error'); reload() } else toast(`Moved to ${date(day)}`)
  }
  const sendAll = () => run(async () => {
    await q(supabase.from('content_posts').update({ status: 'client_approval' }).in('id', readyForClient.map((p) => p.id)))
    reload()
  }, `${readyForClient.length} posts sent for client approval — share the approval link from the client page`)
  const shift = (k) => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + k, 1))
  const today = todayISO()

  return (
    <>
      <PageHeader title="Content Calendar" subtitle="Plan, design, approve and publish every client's social content."
        actions={<>
          {isMgr && client && readyForClient.length > 0 && <Button variant="outline" icon={Send} loading={busy} onClick={sendAll}>Send {readyForClient.length} for client approval</Button>}
          {isMgr && <Button icon={Plus} onClick={() => setEditing({ client_id: client || '', publish_date: today })}>New post</Button>}
        </>} />
      <div className="filters">
        <div className="row gap-xs">
          <IconBtn icon={ChevronLeft} title="Previous month" onClick={() => shift(-1)} />
          <h2 style={{ minWidth: 170, textAlign: 'center' }}>{cursor.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</h2>
          <IconBtn icon={ChevronRight} title="Next month" onClick={() => shift(1)} />
          <Button size="sm" variant="ghost" onClick={() => { const d = new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)) }}>Today</Button>
        </div>
        <ClientSelect value={client} onChange={(v) => setClient(v || '')} placeholder="All clients" />
        <div className="grow" />
        <div className="seg">
          <button className={cx(view === 'month' && 'on')} onClick={() => setView('month')}><LayoutGrid size={14} />Month</button>
          <button className={cx(view === 'list' && 'on')} onClick={() => setView('list')}><List size={14} />List</button>
        </div>
      </div>

      {client && data.packs.length > 0 && (
        <Card className="mb"><div className="grid g3">
          {[['Posts & carousels', planned.posts, commit.posts], ['Reels / videos', planned.reels, commit.reels], ['Stories', planned.stories, commit.stories]].map(([l, a, b]) => (
            <div key={l}><div className="row between small"><span className="muted">{l} this month</span><b>{a} / {b}</b></div><Progress value={a} max={b || 1} tone={b && a < b ? 'amber' : 'green'} /></div>
          ))}
        </div></Card>
      )}

      {loading ? <Loading /> : view === 'month' ? (
        <div className="cal">
          {DOW.map((d) => <div key={d} className="cal-dow">{d}</div>)}
          {days.map((d) => {
            const iso = toISO(d); const out = d.getMonth() !== cursor.getMonth()
            const list = byDay[iso] || []
            return (
              <div key={iso} className={cx('cal-day', out && 'out', iso === today && 'today', over === iso && 'drop')}
                onDragOver={(e) => { if (isMgr) { e.preventDefault(); setOver(iso) } }} onDragLeave={() => setOver(null)}
                onDrop={(e) => { setOver(null); move(e.dataTransfer.getData('id'), iso) }}
                onDoubleClick={() => isMgr && setEditing({ client_id: client || '', publish_date: iso })}>
                <span className="dnum">{d.getDate()}</span>
                {isMgr && <IconBtn className="add" icon={Plus} size={13} title="Add post" onClick={() => setEditing({ client_id: client || '', publish_date: iso })} />}
                {list.slice(0, 4).map((p) => {
                  const s = byId(POST_STATUSES, p.status)
                  return (
                    <div key={p.id} className={cx('cal-post', `tone-${s.tone}`)} draggable={isMgr} onDragStart={(e) => e.dataTransfer.setData('id', p.id)}
                      title={`${p.clients?.name} · ${p.title} · ${s.label}`} onClick={() => setEditing(p)}>
                      {!client && <b>{p.clients?.name?.split(' ')[0]} · </b>}{p.post_type !== 'Post' && `${p.post_type}: `}{p.title}
                    </div>
                  )
                })}
                {list.length > 4 && <span className="tiny faint" style={{ cursor: 'pointer' }} onClick={() => setView('list')}>+{list.length - 4} more</span>}
              </div>
            )
          })}
        </div>
      ) : monthPosts.length === 0 ? <Empty title="No posts planned this month" /> : (
        <div className="card table-wrap"><table className="table stack-sm">
          <thead><tr><th>Date</th><th>Client</th><th>Post</th><th>Type</th><th>Platforms</th><th>Status</th><th>Design</th><th className="num">Reach</th></tr></thead>
          <tbody>{monthPosts.sort((a, b) => a.publish_date.localeCompare(b.publish_date)).map((p) => (
            <tr key={p.id} className="click" onClick={() => setEditing(p)}>
              <td className="nowrap">{date(p.publish_date, { weekday: 'short', day: 'numeric', month: 'short' })}{p.publish_time && <div className="cell-sub">{p.publish_time.slice(0, 5)}</div>}</td>
              <td>{p.clients?.name}</td><td><div className="cell-title">{p.title}</div><div className="cell-sub">{p.pillar}</div></td>
              <td>{p.post_type}</td><td className="small hide-sm">{(p.platforms || []).join(', ')}</td>
              <td><StatusBadge list={POST_STATUSES} value={p.status} /></td>
              <td>{p.design_tasks ? <StatusBadge list={TASK_STATUSES} value={p.design_tasks.status} /> : '—'}</td>
              <td className="num hide-sm">{p.reach ? n(p.reach) : '—'}</td>
            </tr>))}</tbody></table></div>
      )}
      <div className="legend mt">{POST_STATUSES.map((s) => <span key={s.id}><i style={{ background: `var(--${s.tone === 'dark' ? 'green-2' : s.tone === 'slate' ? 'slate' : s.tone})` }} />{s.label}</span>)}</div>
      {editing && <PostModal post={editing} readOnly={!isMgr} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload() }} />}
    </>
  )
}

function PostModal({ post, readOnly, onClose, onSaved }) {
  const nav = useNavigate()
  const { confirm, toast } = useToast()
  const [f, set, setF] = useForm({ client_id: '', publish_date: todayISO(), publish_time: '', platforms: ['Instagram', 'Facebook'], post_type: 'Post', pillar: '', title: '', caption: '',
    hashtags: '', cta: '', media_link: '', status: 'idea', published_url: '', reach: 0, likes: 0, comments: 0, shares: 0, saves: 0, design_task_id: null, client_note: '', assignee_id: '', results: [], ...post })
  const isNew = !f.id
  const [makeTask, setMakeTask] = useState(false)
  const [busy, run] = useAction()
  const task = useData(() => (f.design_task_id ? q(supabase.from('design_tasks').select('id,code,status,title,assignee_id').eq('id', f.design_task_id).maybeSingle()) : null), [f.design_task_id])

  const payload = () => {
    const p = { ...f }
    ;['id', 'created_at', 'updated_at', 'created_by', 'clients', 'design_tasks', 'client_decided_at'].forEach((k) => delete p[k])
    ;['reach', 'likes', 'comments', 'shares', 'saves'].forEach((k) => (p[k] = Number(p[k] || 0)))
    p.results = cleanResults(p.results)
    p.publish_time = p.publish_time || null; p.design_task_id = p.design_task_id || null; p.assignee_id = p.assignee_id || null
    return p
  }
  const save = (e) => { e?.preventDefault(); return run(async () => {
    if (!f.client_id) throw new Error('Choose a client')
    const row = isNew ? await q(supabase.from('content_posts').insert(payload()).select().single()) : await q(supabase.from('content_posts').update(payload()).eq('id', f.id).select().single())
    setF((st) => ({ ...st, id: row.id }))
    return row
  }, 'Post saved') }
  const saveAndClose = async (e) => { const r = await save(e); if (r) onSaved() }
  const del = async () => {
    if (!(await confirm('Delete this post?', { danger: true, okText: 'Delete' }))) return
    run(async () => { await q(supabase.from('content_posts').delete().eq('id', f.id)); onSaved() }, 'Post deleted')
  }
  const createTask = async () => {
    if (!f.client_id || !f.title) { toast('Add client and title first', 'error'); return }
    setMakeTask(true)
  }
  const TYPE_MAP = { Post: 'Social Post', Carousel: 'Carousel', Reel: 'Reel', Story: 'Story', Video: 'Video', Ad: 'Ad Creative' }
  const SIZE_MAP = { Story: '1080×1920 (Story/Reel)', Reel: '1080×1920 (Story/Reel)', Video: '1920×1080 (Landscape)' }

  return (
    <Modal open drawer size="lg" onClose={onClose} title={isNew ? 'New post' : f.title} subtitle={!isNew && <StatusBadge list={POST_STATUSES} value={f.status} />}
      footer={!readOnly && <>{!isNew && <Button variant="ghost" icon={Trash2} style={{ marginRight: 'auto', color: 'var(--red)' }} onClick={del}>Delete</Button>}
        <Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={saveAndClose} loading={busy}>Save post</Button></>}>
      {f.client_note && <div className="alert alert-warn"><b>Client feedback:</b> {f.client_note}</div>}
      <form className="form" onSubmit={saveAndClose}>
        <fieldset disabled={readOnly} style={{ display: 'contents' }}>
          <Field label="Client" required><ClientSelect value={f.client_id} onChange={set('client_id')} /></Field>
          <Field label="Status"><Select placeholder={false} options={POST_STATUSES} value={f.status} onChange={set('status')} /></Field>
          <Field label="Publish date" required><Input type="date" required value={f.publish_date} onChange={set('publish_date')} /></Field>
          <Field label="Time"><Input type="time" value={f.publish_time} onChange={set('publish_time')} /></Field>
          <Field label="Post type"><Select placeholder={false} options={POST_TYPES} value={f.post_type} onChange={set('post_type')} /></Field>
          <Field label="Assigned to"><MemberSelect value={f.assignee_id} onChange={set('assignee_id')} /></Field>
          <Field label="Content pillar"><Select options={CONTENT_PILLARS} value={f.pillar} onChange={set('pillar')} /></Field>
          <Field label="Platforms" span={2}><Chips options={PLATFORMS.slice(0, 7)} value={f.platforms || []} onChange={set('platforms')} /></Field>
          <Field label="Title / topic" span={2} required><Input required value={f.title} onChange={set('title')} placeholder="e.g. Diwali greeting, New menu launch" /></Field>
          <Field label="Caption" span={2} hint={`${(f.caption || '').length} characters`}><Textarea rows={6} value={f.caption} onChange={set('caption')} /></Field>
          <Field label="Hashtags" span={2}><Textarea rows={2} value={f.hashtags} onChange={set('hashtags')} placeholder="#koyilandy #kozhikode" /></Field>
          <Field label="Call to action"><Input value={f.cta} onChange={set('cta')} placeholder="DM to order, Call now…" /></Field>
          <Field label="Media / final creative link"><Input value={f.media_link} onChange={set('media_link')} placeholder="Drive / Canva link" /></Field>
        </fieldset>
      </form>

      <Card className="mt" title="Design">
        {f.design_task_id && task.data ? (
          <div className="row between gap-s wrap">
            <div><div className="cell-title">{task.data.code} · {task.data.title}</div><StatusBadge list={TASK_STATUSES} value={task.data.status} /></div>
            <Button size="sm" variant="outline" icon={ExternalLink} onClick={() => nav(`/tasks/${task.data.id}`)}>Open task</Button>
          </div>
        ) : readOnly ? <p className="faint small">No design task linked.</p> : (
          <div className="row between gap-s wrap"><p className="muted small">Create a design task pre-filled from this post — the designer sees caption, size and date.</p>
            <Button size="sm" icon={Palette} onClick={createTask}>Create design task</Button></div>
        )}
      </Card>

      {!isNew && ['approved', 'scheduled', 'published'].includes(f.status) && (
        <PostResults value={f.results} platforms={f.platforms || []} readOnly={readOnly} onChange={set('results')}
          legacy={!(f.results || []).length && (f.published_url || +f.reach) ? f : null} />
      )}

      {makeTask && <TaskModal
        task={{ client_id: f.client_id, title: f.title, task_type: TYPE_MAP[f.post_type] || 'Social Post', platform: (f.platforms || [])[0] || 'Instagram',
          size: SIZE_MAP[f.post_type] || '1080×1350 (Portrait)', due_date: addDays(f.publish_date, -2) < todayISO() ? todayISO() : addDays(f.publish_date, -2),
          brief: `For ${f.post_type} on ${date(f.publish_date)}${f.pillar ? ` · ${f.pillar}` : ''}.\n\nCaption:\n${f.caption || '(to be written)'}`, copy_text: f.cta ? `CTA: ${f.cta}` : '' }}
        onClose={() => setMakeTask(false)}
        onSaved={async (row) => {
          setMakeTask(false)
          const p = { ...payload(), design_task_id: row.id, status: f.status === 'idea' || f.status === 'copywriting' ? 'in_design' : f.status }
          const saved = isNew ? await q(supabase.from('content_posts').insert(p).select().single()) : await q(supabase.from('content_posts').update(p).eq('id', f.id).select().single())
          setF((s) => ({ ...s, ...saved })); toast('Design task created and linked')
        }} />}
    </Modal>
  )
}


/* ---------------- per-platform post results (link + numbers for each platform it went out on) ---------------- */
export const RESULT_FIELDS = [['reach', 'Reach'], ['views', 'Views'], ['likes', 'Likes'], ['comments', 'Comments'], ['shares', 'Shares'], ['saves', 'Saves']]
export const engagement = (r) => { const reach = Number(r.reach) || Number(r.views) || 0; const e = ['likes', 'comments', 'shares', 'saves'].reduce((a, k) => a + (Number(r[k]) || 0), 0); return reach ? (e / reach) * 100 : null }
const cleanResults = (rows) => (rows || []).map((r) => ({ platform: r.platform || 'Instagram', url: (r.url || '').trim() || null,
  ...Object.fromEntries(RESULT_FIELDS.map(([k]) => [k, r[k] === '' || r[k] === null || r[k] === undefined ? null : Number(r[k])])) }))
  .filter((r) => r.url || RESULT_FIELDS.some(([k]) => r[k]))

function PostResults({ value, platforms, readOnly, onChange, legacy }) {
  const start = () => {
    if (value && value.length) return value
    if (legacy) return [{ platform: platforms[0] || 'Instagram', url: legacy.published_url || '', reach: legacy.reach || '', likes: legacy.likes || '', comments: legacy.comments || '', shares: legacy.shares || '', saves: legacy.saves || '' }]
    return (platforms.length ? platforms : ['Instagram']).map((p) => ({ platform: p, url: '' }))
  }
  const rows = value && value.length ? value : start()
  const upd = (i, k, v) => onChange(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)))
  const next = PLATFORMS.find((p) => !rows.some((r) => r.platform === p) && platforms.includes(p)) || PLATFORMS.find((p) => !rows.some((r) => r.platform === p)) || 'Other'
  return (
    <Card className="mt" title="Post links & performance" actions={!readOnly && <Button size="sm" variant="ghost" icon={Plus} onClick={() => onChange([...rows, { platform: next, url: '' }])}>Add platform</Button>}>
      <p className="tiny faint" style={{ marginTop: -4 }}>One row for each platform this went out on. Paste the link when it's live; add the numbers from that platform's insights (any time later). These feed the client's monthly report.</p>
      {rows.map((r, i) => {
        const er = engagement(r)
        return (
          <div key={i} className="result-row">
            <div className="row gap-s wrap">
              <div style={{ width: 170 }}><Select placeholder={false} options={PLATFORMS} value={r.platform} onChange={(v) => upd(i, 'platform', v)} disabled={readOnly} /></div>
              <div className="grow" style={{ minWidth: 220 }}><Input value={r.url || ''} onChange={(e) => upd(i, 'url', e.target.value)} placeholder={`${r.platform} post link`} disabled={readOnly} /></div>
              {r.url && <a className="btn btn-ghost btn-sm" href={r.url} target="_blank" rel="noreferrer"><ExternalLink size={14} /></a>}
              {!readOnly && <IconBtn icon={Trash2} size={14} title="Remove" onClick={() => onChange(rows.filter((_, j) => j !== i))} />}
            </div>
            <div className="result-nums">
              {RESULT_FIELDS.map(([k, label]) => (
                <label key={k}><span>{label}</span><Input type="number" min="0" step="any" value={r[k] ?? ''} onChange={(e) => upd(i, k, e.target.value)} disabled={readOnly} /></label>
              ))}
              <label><span>Engagement</span><div className="input" style={{ background: 'var(--surface-2)' }}>{er === null ? '—' : `${er.toFixed(1)}%`}</div></label>
            </div>
          </div>
        )
      })}
    </Card>
  )
}
