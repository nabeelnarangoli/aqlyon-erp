import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, Pencil, Play, UploadCloud, CheckCircle2, XCircle, Send, Clock, Trash2, Link2, FileText, Film, ExternalLink, Truck,
  HelpCircle, ThumbsUp, ThumbsDown, Ban, Copy, Plus
} from 'lucide-react'
import { supabase, q, uploadFile, signedUrl } from '../../lib/supabase'
import { optimizeImage, fmtBytes } from '../../lib/imageOptimize'
import { useData, useRealtime } from '../../lib/hooks'
import { useAuth } from '../../lib/auth'
import { TASK_STATUSES, PRIORITIES, QUERY_CATEGORIES } from '../../lib/constants'
import { date, dateTime, dueLabel, ago, hours, todayISO } from '../../lib/format'
import {
  Button, Badge, StatusBadge, Member, Avatar, Card, Modal, Field, Input, Textarea, MentionTextarea, Select, Loading, ErrorBox, Empty, IconBtn,
  MemberSelect, useAction, useForm, useToast, cx
} from '../../components/ui'
import { TaskModal } from './TaskForm'

export default function TaskDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { user, has } = useAuth()
  const { confirm } = useToast()
  const [editing, setEditing] = useState(false)
  const [reviewing, setReviewing] = useState(null) // { proof, decision }
  const [asking, setAsking] = useState(false)
  const [busy, run] = useAction()

  const task = useData(() => q(supabase.from('design_tasks').select('*, clients(*), projects(name)').eq('id', id).single()), [id])
  const proofs = useData(async () => {
    const rows = await q(supabase.from('task_proofs').select('*').eq('task_id', id).order('version', { ascending: false }))
    return Promise.all(rows.map(async (p) => ({ ...p, url: p.file_path ? await signedUrl('proofs', p.file_path) : null })))
  }, [id], [])
  const posts = useData(() => q(supabase.from('content_posts').select('id,title,publish_date,status').eq('design_task_id', id)), [id], [])
  useRealtime('design_tasks', `id=eq.${id}`, () => task.reload())

  if (task.loading) return <Loading />
  if (task.error) return <ErrorBox error={task.error} />
  const t = task.data
  const c = t.clients
  const mine = t.assignee_id === user.id
  const isMgr = has('tasks.manage', 'tasks.review')
  const closed = ['delivered', 'cancelled'].includes(t.status)
  const latest = proofs.data[0]

  const setStatus = (status, msg) => run(async () => { await q(supabase.from('design_tasks').update({ status }).eq('id', id)); task.reload() }, msg)
  const claim = () => run(async () => { await q(supabase.from('design_tasks').update({ assignee_id: user.id, status: 'in_progress' }).eq('id', id)); task.reload() }, 'Task picked up — it’s yours')
  const reassign = (v) => run(async () => { await q(supabase.from('design_tasks').update({ assignee_id: v || null }).eq('id', id)); task.reload() }, 'Designer updated')
  const del = async () => {
    if (!(await confirm('Delete this task, its proofs and discussion?', { danger: true, okText: 'Delete task' }))) return
    run(async () => { await q(supabase.from('design_tasks').delete().eq('id', id)); nav('/tasks') }, 'Task deleted')
  }
  const due = dueLabel(t.due_date)

  return (
    <>
      <button className="btn btn-ghost btn-sm mb" onClick={() => nav(-1)}><ArrowLeft size={14} />Back</button>
      <div className="page-head">
        <div style={{ minWidth: 0 }}>
          <div className="row gap-s wrap"><Badge tone="slate">{t.code}</Badge><StatusBadge list={TASK_STATUSES} value={t.status} /><StatusBadge list={PRIORITIES} value={t.priority} />
            {!closed && t.due_date && <Badge tone={due.tone}>{due.text}</Badge>}</div>
          <h1 style={{ marginTop: 6 }}>{t.title}</h1>
          <p className="muted">{c ? <Link to={`/clients/${c.id}`}>{c.name}</Link> : 'No client'}{t.projects?.name && <> · {t.projects.name}</>} · {t.task_type}{t.quantity > 1 && ` ×${t.quantity}`} · {t.platform} · {t.size}</p>
        </div>
        <div className="page-actions">
          {!t.assignee_id && has('tasks.work') && <Button icon={Play} onClick={claim} loading={busy}>Pick up this task</Button>}
          {(mine || isMgr) && ['todo', 'revision'].includes(t.status) && t.assignee_id && <Button icon={Play} onClick={() => setStatus('in_progress', 'Started')} loading={busy}>Start work</Button>}
          {isMgr && t.status === 'client_review' && <>
            <Button variant="outline" icon={ThumbsDown} onClick={() => setReviewing({ proof: latest, decision: 'client_changes' })}>Client wants changes</Button>
            <Button icon={ThumbsUp} onClick={() => setStatus('approved', 'Marked client-approved')} loading={busy}>Client approved</Button>
          </>}
          {isMgr && t.status === 'approved' && <Button icon={Truck} onClick={() => setStatus('delivered', 'Delivered ✓')} loading={busy}>Mark delivered</Button>}
          <Button variant="outline" icon={HelpCircle} onClick={() => setAsking(true)}>Raise query</Button>
          {isMgr && <Button variant="dark" icon={Pencil} onClick={() => setEditing(true)}>Edit</Button>}
        </div>
      </div>

      {t.revision_count > t.max_revisions && (
        <div className="alert alert-warn">Revisions ({t.revision_count}) have exceeded the {t.max_revisions} included in scope. Consider billing extra revisions.</div>
      )}

      <div className="grid g-2-1">
        <div className="grid" style={{ alignContent: 'start' }}>
          <Card title="Creative brief">
            <p className="pre">{t.brief || <span className="faint">No brief written.</span>}</p>
            {t.copy_text && <><h4 className="mt small muted" style={{ textTransform: 'uppercase', letterSpacing: '.06em' }}>Text on design</h4>
              <div className="row gap-s" style={{ alignItems: 'flex-start' }}>
                <p className="pre grow" style={{ background: 'var(--surface-2)', border: '1px solid var(--line-2)', padding: 10, borderRadius: 8 }}>{t.copy_text}</p>
                <IconBtn icon={Copy} title="Copy text" onClick={() => navigator.clipboard?.writeText(t.copy_text)} />
              </div></>}
            {t.reference_links && <><h4 className="mt small muted" style={{ textTransform: 'uppercase', letterSpacing: '.06em' }}>References</h4><Linkify text={t.reference_links} /></>}
          </Card>

          <ProofsSection t={t} proofs={proofs} canUpload={(mine || isMgr || (!t.assignee_id && has('tasks.work'))) && !closed}
            canReview={isMgr} onReview={(proof, decision) => setReviewing({ proof, decision })} onChanged={() => { proofs.reload(); task.reload() }} />

          <Discussion taskId={id} />
        </div>

        <div className="grid" style={{ alignContent: 'start' }}>
          <Card title="Details">
            <dl className="kv">
              <dt>Designer</dt><dd>{isMgr ? <MemberSelect perm={['tasks.work']} value={t.assignee_id} onChange={reassign} /> : <Member id={t.assignee_id} />}</dd>
              <dt>Requested by</dt><dd><Member id={t.created_by} size={22} /></dd>
              <dt>Due</dt><dd>{t.due_date ? date(t.due_date) : '—'}</dd>
              <dt>Started</dt><dd>{t.start_date ? date(t.start_date) : '—'}</dd>
              <dt>Revisions</dt><dd><b style={{ color: t.revision_count > t.max_revisions ? 'var(--red)' : undefined }}>{t.revision_count}</b> of {t.max_revisions} included</dd>
              <dt>Estimate</dt><dd>{t.estimated_hours || 0}h</dd>
              <dt>Billable</dt><dd>{t.billable ? 'Yes' : 'No (internal)'}</dd>
              {t.approved_at && <><dt>Approved</dt><dd>{dateTime(t.approved_at)}</dd></>}
              {t.delivered_at && <><dt>Delivered</dt><dd>{dateTime(t.delivered_at)}</dd></>}
              <dt>Final files</dt><dd><FinalLink t={t} canEdit={mine || isMgr} onSaved={task.reload} /></dd>
            </dl>
            {posts.data.length > 0 && <div className="mt">
              <div className="small muted mb">Linked calendar posts</div>
              {posts.data.map((p) => <Link key={p.id} to={`/calendar?post=${p.id}`} className="row between small" style={{ padding: '4px 0' }}><span>{p.title}</span><span className="faint">{date(p.publish_date)}</span></Link>)}
            </div>}
            {(mine || isMgr) && !closed && DESIGNER_TRANSITIONS(t, isMgr).length > 0 && (
              <div className="row gap-s wrap mt">
                {DESIGNER_TRANSITIONS(t, isMgr).map((x) => <Button key={x.to} size="sm" variant="outline" onClick={() => setStatus(x.to, x.msg)}>{x.label}</Button>)}
              </div>
            )}
            {isMgr && (
              <div className="row gap-s wrap mt" style={{ borderTop: '1px solid var(--line-2)', paddingTop: 12 }}>
                {!closed && <Button size="sm" variant="ghost" icon={Ban} onClick={() => setStatus('cancelled', 'Task cancelled')}>Cancel task</Button>}
                {closed && <Button size="sm" variant="ghost" onClick={() => setStatus('todo', 'Reopened')}>Reopen</Button>}
                <Button size="sm" variant="ghost" icon={Trash2} style={{ color: 'var(--red)' }} onClick={del}>Delete</Button>
              </div>
            )}
          </Card>

          {c && <Card title="Brand kit">
            <dl className="kv small">
              <dt>Colours</dt><dd>{c.brand_colors ? <span className="row gap-xs wrap">{c.brand_colors.split(/[,\s]+/).filter((x) => /^#?[0-9a-f]{3,8}$/i.test(x)).map((h) => <i key={h} title={h} style={{ width: 20, height: 20, borderRadius: 5, background: h.startsWith('#') ? h : '#' + h, border: '1px solid var(--line)', cursor: 'copy' }} onClick={() => navigator.clipboard?.writeText(h)} />)}<span className="faint">{c.brand_colors}</span></span> : '—'}</dd>
              <dt>Fonts</dt><dd>{c.brand_fonts || '—'}</dd>
              <dt>Tone</dt><dd>{c.brand_tone || '—'}</dd>
              <dt>Assets</dt><dd>{c.brand_assets_link ? <a href={c.brand_assets_link} target="_blank" rel="noreferrer">Logo & files <ExternalLink size={11} /></a> : '—'}</dd>
              <dt>Instagram</dt><dd>{c.instagram || '—'}</dd>
            </dl>
          </Card>}

          <TimeLog t={t} canLog={mine || isMgr} />
        </div>
      </div>

      {editing && <TaskModal task={t} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); task.reload() }} />}
      {reviewing && <ReviewModal state={reviewing} task={t} onClose={() => setReviewing(null)} onDone={() => { setReviewing(null); proofs.reload(); task.reload() }} />}
      {asking && <AskQuery task={t} onClose={() => setAsking(false)} />}
    </>
  )
}

const DESIGNER_TRANSITIONS = (t, isMgr) => {
  const out = []
  if (t.status === 'in_progress') out.push({ to: 'todo', label: 'Move back to To do', msg: 'Moved to To do' })
  if (isMgr && t.status === 'internal_review') out.push({ to: 'in_progress', label: 'Send back to designer', msg: 'Sent back' })
  return out
}

function Linkify({ text }) {
  return <p className="pre small">{text.split(/(\s+)/).map((w, i) => /^https?:\/\//.test(w) ? <a key={i} href={w} target="_blank" rel="noreferrer">{w.length > 60 ? w.slice(0, 60) + '…' : w}</a> : w)}</p>
}

function FinalLink({ t, canEdit, onSaved }) {
  const [edit, setEdit] = useState(false)
  const [v, setV] = useState(t.final_file_link || '')
  const [busy, run] = useAction()
  if (edit) return (
    <div className="row gap-xs"><Input className="input input-sm" value={v} onChange={(e) => setV(e.target.value)} placeholder="Drive link to source + finals" />
      <Button size="sm" loading={busy} onClick={() => run(async () => { await q(supabase.from('design_tasks').update({ final_file_link: v || null }).eq('id', t.id)); setEdit(false); onSaved() }, 'Saved')}>Save</Button></div>
  )
  return t.final_file_link
    ? <span className="row gap-s"><a href={t.final_file_link} target="_blank" rel="noreferrer">Open <ExternalLink size={11} /></a>{canEdit && <IconBtn icon={Pencil} size={13} title="Edit" onClick={() => setEdit(true)} />}</span>
    : canEdit ? <button className="btn btn-ghost btn-sm" onClick={() => setEdit(true)}><Plus size={13} />Add link</button> : '—'
}

/* ------------------------------ Proofs ------------------------------ */
function ProofsSection({ t, proofs, canUpload, canReview, onReview, onChanged }) {
  const { user, isAdmin, member } = useAuth()
  const { confirm } = useToast()
  const [file, setFileRaw] = useState(null)
  const [opt, setOpt] = useState(null)        // optimised copy of an image
  const [original, setOriginal] = useState(false)
  const [link, setLink] = useState('')
  const [note, setNote] = useState('')
  const [over, setOver] = useState(false)
  const [zoom, setZoom] = useState(null)
  const [busy, run] = useAction()
  const input = useRef()

  const pick = useRef(0)
  const setFile = async (f) => {
    const n = ++pick.current
    setFileRaw(f || null); setOpt(f && f.type.startsWith('image/') ? 'working' : null)
    if (f && f.type.startsWith('image/')) { const r = await optimizeImage(f, 'design'); if (n === pick.current) setOpt(r) }
  }
  const upload = () => run(async () => {
    if (!file && !link) throw new Error('Choose a file or paste a link')
    if (opt === 'working') throw new Error('Still optimising the image — one moment')
    const send = file && !original && opt?.changed ? opt.file : file
    if (send && send.size > 50 * 1024 * 1024) throw new Error('File is over 50 MB — share a Drive link instead')
    const path = send ? await uploadFile('proofs', send, t.id) : null
    await q(supabase.from('task_proofs').insert({ task_id: t.id, file_path: path, file_name: file?.name || null, file_type: send?.type || null, external_link: link || null, note: note || null }))
    setFileRaw(null); setOpt(null); setOriginal(false); setLink(''); setNote(''); onChanged()
  }, 'Proof uploaded — sent for internal review')
  const remove = async (p) => {
    if (!(await confirm(`Delete proof v${p.version}?`, { danger: true, okText: 'Delete' }))) return
    run(async () => { if (p.file_path) await supabase.storage.from('proofs').remove([p.file_path]); await q(supabase.from('task_proofs').delete().eq('id', p.id)); onChanged() }, 'Proof deleted')
  }

  return (
    <Card title={`Proofs & versions (${proofs.data.length})`}>
      {canUpload && (
        <div className="mb">
          <div className={cx('dropzone', over && 'over')} onClick={() => input.current.click()}
            onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); setFile(e.dataTransfer.files[0]) }}>
            <UploadCloud size={22} />
            <div className="strong" style={{ marginTop: 4 }}>{file ? file.name : 'Drop design file here or click to choose'}</div>
            <div className="tiny">JPG, PNG, PDF, MP4 · up to 50 MB · or paste a Drive/Canva link below</div>
            <input ref={input} type="file" hidden accept="image/*,video/*,application/pdf" onChange={(e) => { setFile(e.target.files[0]); e.target.value = '' }} />
          </div>
          {file && opt && (
            <div className="row between wrap gap-s small mt" style={{ padding: '8px 12px', background: 'var(--green-50)', borderRadius: 10 }}>
              <span>{opt === 'working' ? 'Optimising image…'
                : opt.changed ? (original ? <>Uploading the original · {fmtBytes(opt.before)}</> : <>Optimised for storage: <b>{fmtBytes(opt.before)} → {fmtBytes(opt.after)}</b> ({Math.round(100 - (opt.after / opt.before) * 100)}% smaller) · full {opt.width}×{opt.height} px, same visible quality</>)
                  : <>Image is already compact · {fmtBytes(opt.before)}</>}</span>
              {opt !== 'working' && opt.changed && <label className="check tiny"><input type="checkbox" checked={original} onChange={(e) => setOriginal(e.target.checked)} />Keep original file (print-ready)</label>}
            </div>
          )}
          <div className="form mt">
            <Field label="Or link (Drive / Canva / Figma)"><Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" /></Field>
            <Field label="Note for reviewer"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What changed in this version?" /></Field>
          </div>
          <div className="row mt" style={{ justifyContent: 'flex-end' }}><Button icon={Send} loading={busy} onClick={upload} disabled={!file && !link}>Submit v{(proofs.data[0]?.version || 0) + 1} for review</Button></div>
        </div>
      )}
      {proofs.loading ? <Loading /> : proofs.data.length === 0 ? <Empty icon={UploadCloud} title="No proofs yet">The designer uploads each version here; reviewers approve or request changes.</Empty> : (
        <div className="proofs">
          {proofs.data.map((p, i) => {
            const isImg = p.file_type?.startsWith('image/'), isVid = p.file_type?.startsWith('video/')
            return (
              <div key={p.id} className="proof" style={i === 0 ? { borderColor: 'var(--green-100)', boxShadow: '0 0 0 2px var(--green-50)' } : undefined}>
                <div className="thumb" style={isImg && p.url ? { backgroundImage: `url(${p.url})` } : undefined}
                  onClick={() => (isImg || isVid) && p.url ? setZoom(p) : (p.url || p.external_link) && window.open(p.url || p.external_link, '_blank')}>
                  <span className="ver">v{p.version}</span>
                  {!isImg && (isVid ? <Film size={30} /> : p.external_link && !p.file_path ? <Link2 size={30} /> : <FileText size={30} />)}
                </div>
                <div className="info">
                  <div className="row between gap-xs">
                    <ProofStatus p={p} />
                    <span className="tiny faint">{ago(p.created_at)}</span>
                  </div>
                  <div className="row gap-xs tiny"><Avatar name={member(p.uploaded_by)?.full_name || '?'} size={18} /><span className="faint ellipsis">{p.file_name || (p.external_link ? 'Link' : '')}</span></div>
                  {p.note && <div className="small">{p.note}</div>}
                  {p.review_note && <div className="small" style={{ color: p.status === 'changes_requested' ? 'var(--orange)' : 'var(--green-d)' }}><b>Review:</b> {p.review_note}</div>}
                  {p.client_note && <div className="small" style={{ color: 'var(--amber)' }}><b>Client:</b> {p.client_note}</div>}
                  <div className="row gap-xs wrap">
                    {p.url && <a className="btn btn-ghost btn-sm" href={p.url} target="_blank" rel="noreferrer" download={p.file_name}>Open</a>}
                    {p.external_link && <a className="btn btn-ghost btn-sm" href={p.external_link} target="_blank" rel="noreferrer">Link <ExternalLink size={11} /></a>}
                    {canReview && p.status === 'pending' && <>
                      <Button size="sm" variant="soft" icon={CheckCircle2} onClick={() => onReview(p, 'approved')}>Approve</Button>
                      <Button size="sm" variant="outline" icon={XCircle} onClick={() => onReview(p, 'changes_requested')}>Changes</Button>
                    </>}
                    {(isAdmin || (p.uploaded_by === user.id && p.status === 'pending')) && <IconBtn icon={Trash2} size={14} title="Delete" onClick={() => remove(p)} />}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {zoom && <div className="lightbox" onClick={() => setZoom(null)}>{zoom.file_type?.startsWith('video/') ? <video src={zoom.url} controls autoPlay onClick={(e) => e.stopPropagation()} /> : <img src={zoom.url} alt="" />}</div>}
    </Card>
  )
}
function ProofStatus({ p }) {
  if (p.client_decision === 'approved') return <Badge tone="green">Client approved</Badge>
  if (p.client_decision === 'changes_requested') return <Badge tone="orange">Client: changes</Badge>
  if (p.status === 'approved') return <Badge tone="teal">Approved internally</Badge>
  if (p.status === 'changes_requested') return <Badge tone="orange">Changes requested</Badge>
  return <Badge tone="violet">Awaiting review</Badge>
}

function ReviewModal({ state, task, onClose, onDone }) {
  const { proof, decision } = state
  const [note, setNote] = useState('')
  const [busy, run] = useAction()
  const titles = { approved: 'Approve proof', changes_requested: 'Request changes', client_changes: 'Client requested changes' }
  const submit = () => run(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (decision === 'client_changes') {
      if (proof) await q(supabase.from('task_proofs').update({ client_decision: 'changes_requested', client_note: note || null, client_decided_at: new Date().toISOString() }).eq('id', proof.id))
      else await q(supabase.from('design_tasks').update({ status: 'revision' }).eq('id', task.id))
      if (note) await q(supabase.from('task_comments').insert({ task_id: task.id, body: `Client feedback: ${note}`, author_id: user.id }))
    } else {
      await q(supabase.from('task_proofs').update({ status: decision, review_note: note || null, reviewed_by: user.id, reviewed_at: new Date().toISOString() }).eq('id', proof.id))
    }
    onDone()
  }, decision === 'approved' ? 'Approved — now with client for review' : 'Sent back to designer for revision')
  return (
    <Modal open size="sm" onClose={onClose} title={titles[decision]} subtitle={proof && `${task.code} · v${proof.version}`}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant={decision === 'approved' ? 'primary' : 'dark'} loading={busy} onClick={submit} disabled={decision !== 'approved' && !note.trim()}>{decision === 'approved' ? 'Approve' : 'Send for revision'}</Button></>}>
      {decision === 'approved' && <p className="muted mb small">Approving moves the task to <b>Client review</b>. It will appear on the client's approval link, or mark it client-approved yourself after sharing on WhatsApp.</p>}
      {decision !== 'approved' && task.revision_count >= task.max_revisions && <div className="alert alert-warn small">This will be revision {task.revision_count + 1}; only {task.max_revisions} are included.</div>}
      <Field label={decision === 'approved' ? 'Note (optional)' : 'What needs to change?'} required={decision !== 'approved'}>
        <Textarea rows={5} autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder={decision === 'approved' ? 'Great work!' : '1. Make the headline bigger\n2. Use the client’s green\n3. Add phone number at bottom'} />
      </Field>
    </Modal>
  )
}

/* ------------------------------ Discussion ------------------------------ */
function Discussion({ taskId }) {
  const { user } = useAuth()
  const [text, setText] = useState('')
  const [busy, run] = useAction()
  const list = useData(() => q(supabase.from('task_comments').select('*').eq('task_id', taskId).order('created_at')), [taskId], [])
  useRealtime('task_comments', `task_id=eq.${taskId}`, () => list.reload())
  const end = useRef()
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }) }, [list.data.length])
  const send = () => text.trim() && run(async () => {
    await q(supabase.from('task_comments').insert({ task_id: taskId, body: text.trim(), author_id: user.id }))
    setText(''); list.reload()
  })
  return (
    <Card title="Discussion & activity">
      <div className="thread" style={{ maxHeight: 460, overflowY: 'auto', paddingRight: 4 }}>
        {list.data.length === 0 && <p className="faint small center">No messages yet. Ask questions or give feedback here — everyone on the task is notified.</p>}
        {list.data.map((m) => m.kind === 'system'
          ? <div key={m.id} className="msg system">{m.body} · {ago(m.created_at)}</div>
          : <Msg key={m.id} m={m} mine={m.author_id === user.id} />)}
        <div ref={end} />
      </div>
      <div className="composer">
        <MentionTextarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a message… type @ to mention someone (Ctrl+Enter to send)"
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send() }} />
        <Button icon={Send} loading={busy} onClick={send} disabled={!text.trim()} />
      </div>
    </Card>
  )
}
function Msg({ m, mine }) {
  const { member } = useAuth()
  const who = m.kind === 'client' ? 'Client' : member(m.author_id)?.full_name || 'Someone'
  return (
    <div className={cx('msg', mine && 'mine', m.kind === 'client' && 'client')}>
      <Avatar name={who} size={30} />
      <div><div className="msg-head"><b>{who}</b><span className="tiny faint">{ago(m.created_at)}</span></div><div className="msg-bubble pre">{m.body}</div></div>
    </div>
  )
}

/* ------------------------------ Time log ------------------------------ */
function TimeLog({ t, canLog }) {
  const { user, isAdmin } = useAuth()
  const [f, set, setF] = useForm({ minutes: '', note: '', log_date: todayISO() })
  const [busy, run] = useAction()
  const list = useData(() => q(supabase.from('time_logs').select('*').eq('task_id', t.id).order('log_date', { ascending: false })), [t.id], [])
  const total = list.data.reduce((a, x) => a + x.minutes, 0)
  const add = (e) => { e.preventDefault(); run(async () => {
    const m = Math.round(Number(f.minutes) * 60)
    if (!m) throw new Error('Enter hours, e.g. 1.5')
    await q(supabase.from('time_logs').insert({ task_id: t.id, client_id: t.client_id, minutes: m, note: f.note || null, log_date: f.log_date, billable: t.billable, user_id: user.id }))
    setF({ minutes: '', note: '', log_date: todayISO() }); list.reload()
  }, 'Time logged') }
  const del = (x) => run(async () => { await q(supabase.from('time_logs').delete().eq('id', x.id)); list.reload() })
  const over = t.estimated_hours && total / 60 > t.estimated_hours
  return (
    <Card title={<span className="row gap-s"><Clock size={15} />Time · {hours(total)}{t.estimated_hours ? ` / ${t.estimated_hours}h est.` : ''}</span>}>
      {over && <div className="alert alert-warn small">Over the time estimate.</div>}
      {canLog && (
        <form className="row gap-s mb wrap" onSubmit={add}>
          <input className="input input-sm" style={{ width: 80 }} type="number" step="0.25" min="0" placeholder="Hours" value={f.minutes} onChange={set('minutes')} />
          <input className="input input-sm" style={{ width: 140 }} type="date" value={f.log_date} onChange={set('log_date')} />
          <input className="input input-sm grow" style={{ minWidth: 100 }} placeholder="What did you do?" value={f.note} onChange={set('note')} />
          <Button size="sm" type="submit" loading={busy}>Log</Button>
        </form>
      )}
      <div className="list">
        {list.data.map((x) => (
          <div key={x.id} className="list-item small">
            <Member id={x.user_id} size={20} showName={false} />
            <div className="grow"><b>{hours(x.minutes)}</b> <span className="muted">{x.note}</span></div>
            <span className="faint">{date(x.log_date, { day: 'numeric', month: 'short' })}</span>
            {(isAdmin || x.user_id === user.id) && <IconBtn icon={Trash2} size={13} title="Delete" onClick={() => del(x)} />}
          </div>
        ))}
        {list.data.length === 0 && <p className="faint small">No time logged yet.</p>}
      </div>
    </Card>
  )
}

/* ------------------------------ Raise query ------------------------------ */
export function AskQuery({ task, client, onClose, onSaved }) {
  const nav = useNavigate()
  const { user, roles } = useAuth()
  const [f, set] = useForm({
    subject: task ? `${task.code}: ` : '', body: '', category: task ? 'Brief clarification' : 'General', priority: 'normal',
    to_user: task ? (task.assignee_id === user.id ? task.created_by : task.assignee_id) || '' : '', to_role_id: ''
  })
  const [busy, run] = useAction()
  const submit = (e) => { e.preventDefault(); run(async () => {
    const row = await q(supabase.from('queries').insert({
      subject: f.subject, body: f.body, category: f.category, priority: f.priority, to_user: f.to_user || null, to_role_id: f.to_user ? null : f.to_role_id || null,
      task_id: task?.id || null, client_id: task?.client_id || client || null
    }).select().single())
    onSaved?.(row); onClose(); nav(`/queries/${row.id}`)
  }, 'Query sent') }
  return (
    <Modal open size="md" onClose={onClose} title="Raise a query" subtitle="Questions between team members stay tracked until resolved."
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" form="ask" loading={busy}>Send query</Button></>}>
      <form id="ask" className="form" onSubmit={submit}>
        <Field label="Subject" span={2} required><Input required value={f.subject} onChange={set('subject')} /></Field>
        <Field label="Send to person"><MemberSelect value={f.to_user} onChange={set('to_user')} placeholder="— or choose a team —" /></Field>
        <Field label="…or to a whole team"><Select disabled={!!f.to_user} options={roles.map((r) => ({ id: r.id, label: `Everyone in ${r.name}` }))} value={f.to_role_id} onChange={set('to_role_id')} /></Field>
        <Field label="Category"><Select placeholder={false} options={QUERY_CATEGORIES} value={f.category} onChange={set('category')} /></Field>
        <Field label="Priority"><Select placeholder={false} options={PRIORITIES} value={f.priority} onChange={set('priority')} /></Field>
        <Field label="Details" span={2} required hint="Type @ to mention someone"><MentionTextarea rows={5} required value={f.body} onChange={set('body')} /></Field>
      </form>
    </Modal>
  )
}
