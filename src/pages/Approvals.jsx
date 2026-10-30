import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2, XCircle, ExternalLink, Palette, CalendarDays, RotateCcw, MessagesSquare, Hourglass, Send, FileText } from 'lucide-react'
import { supabase, q, signedUrl } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useData, useRealtime } from '../lib/hooks'
import { date, ago, daysFrom } from '../lib/format'
import { PageHeader, Button, Badge, Card, Empty, Loading, Avatar, Textarea, useAction } from '../components/ui'

// Everything waiting for the signed-in person to approve or act on, in one place.
export default function Approvals() {
  const { has, user, profile } = useAuth()
  const canProof = has('tasks.review'), canPost = has('calendar.manage'), works = has('tasks.work')
  const { data, loading, reload } = useData(async () => {
    const [proofTasks, posts, revisions, queries, clientTasks, clientPosts] = await Promise.all([
      canProof ? q(supabase.from('design_tasks').select('*, clients(name)').eq('status', 'internal_review').order('due_date')) : [],
      canPost ? q(supabase.from('content_posts').select('*, clients(name)').eq('status', 'internal_review').order('publish_date')) : [],
      works ? q(supabase.from('design_tasks').select('*, clients(name)').eq('status', 'revision').eq('assignee_id', user.id).order('due_date')) : [],
      q(supabase.from('queries').select('*').neq('status', 'resolved').neq('from_user', user.id).order('created_at', { ascending: false })),
      canProof ? q(supabase.from('design_tasks').select('id,code,title,updated_at, clients(name)').eq('status', 'client_review').order('updated_at')) : [],
      canPost ? q(supabase.from('content_posts').select('id,title,publish_date,updated_at, clients(name)').eq('status', 'client_approval').order('publish_date')) : []
    ])
    const ids = proofTasks.map((t) => t.id)
    const proofs = ids.length ? await q(supabase.from('task_proofs').select('*').in('task_id', ids).order('version', { ascending: false })) : []
    const latest = await Promise.all(proofTasks.map(async (t) => {
      const p = proofs.find((x) => x.task_id === t.id)
      const url = p?.file_path && p.file_type?.startsWith('image/') ? await signedUrl('proofs', p.file_path).catch(() => null) : null
      return { t, p, url }
    }))
    const mineQ = queries.filter((x) => x.to_user === user.id || (x.to_role_id && x.to_role_id === profile.role_id))
    return { proofs: latest, posts, revisions, queries: mineQ, clientTasks, clientPosts }
  }, [], null)
  useRealtime('design_tasks', null, () => reload(), canProof || works)

  if (loading || !data) return <Loading />
  const total = data.proofs.length + data.posts.length + data.revisions.length + data.queries.length
  return (
    <>
      <PageHeader title="Approvals & actions" subtitle={total ? `${total} item${total === 1 ? '' : 's'} waiting for you` : 'Nothing is waiting for you right now.'} />
      {total === 0 && <Card><Empty icon={CheckCircle2} title="All clear">New design proofs, posts for approval, revisions and queries for you appear here.</Empty></Card>}

      {data.proofs.length > 0 && (
        <Section icon={Palette} tone="amber" title="Design proofs to approve" count={data.proofs.length}>
          <div className="approval-grid">{data.proofs.map((x) => <ProofCard key={x.t.id} {...x} onDone={reload} />)}</div>
        </Section>
      )}
      {data.posts.length > 0 && (
        <Section icon={CalendarDays} tone="amber" title="Posts to approve" count={data.posts.length}>
          <div className="approval-grid">{data.posts.map((p) => <PostCard key={p.id} p={p} onDone={reload} />)}</div>
        </Section>
      )}
      {data.revisions.length > 0 && (
        <Section icon={RotateCcw} tone="orange" title="Changes requested on your designs" count={data.revisions.length}>
          <ListRows rows={data.revisions.map((t) => ({ id: t.id, to: `/tasks/${t.id}`, title: t.title, sub: `${t.code} · ${t.clients?.name || ''} · revision ${t.revision_count}`, right: t.due_date && <Due d={t.due_date} /> }))} />
        </Section>
      )}
      {data.queries.length > 0 && (
        <Section icon={MessagesSquare} tone="blue" title="Queries waiting for your answer" count={data.queries.length}>
          <ListRows rows={data.queries.map((x) => ({ id: x.id, to: `/queries/${x.id}`, title: x.subject, sub: `${x.category} · ${ago(x.created_at)}`, right: x.priority !== 'normal' && <Badge tone={x.priority === 'urgent' ? 'red' : 'orange'}>{x.priority}</Badge> }))} />
        </Section>
      )}
      {(data.clientTasks.length > 0 || data.clientPosts.length > 0) && (
        <Section icon={Hourglass} tone="slate" title="Waiting on clients" count={data.clientTasks.length + data.clientPosts.length} note="Approved by the team and sent to the client. Follow up if it's been a while.">
          <ListRows rows={[
            ...data.clientTasks.map((t) => ({ id: t.id, to: `/tasks/${t.id}`, title: t.title, sub: `Design · ${t.clients?.name || ''}`, right: <span className="tiny faint">sent {ago(t.updated_at)}</span> })),
            ...data.clientPosts.map((p) => ({ id: p.id, to: '/calendar', title: p.title, sub: `Post · ${p.clients?.name || ''} · ${date(p.publish_date)}`, right: <span className="tiny faint">sent {ago(p.updated_at)}</span> }))
          ]} />
        </Section>
      )}
    </>
  )
}

function Section({ icon: Icon, tone, title, count, note, children }) {
  return (
    <section className="approval-section">
      <div className="row gap-s" style={{ marginBottom: 10 }}>
        <span className={`stat-icon tone-${tone}`} style={{ width: 30, height: 30 }}><Icon size={16} /></span>
        <h3 style={{ margin: 0 }}>{title}</h3><Badge tone={tone === 'slate' ? 'slate' : tone}>{count}</Badge>
      </div>
      {note && <p className="small faint" style={{ marginTop: -4 }}>{note}</p>}
      {children}
    </section>
  )
}

function Due({ d }) {
  const n = daysFrom(d)
  return <Badge tone={n < 0 ? 'red' : n <= 1 ? 'orange' : 'slate'}>{n < 0 ? `${-n}d late` : n === 0 ? 'due today' : `due ${date(d)}`}</Badge>
}

function ListRows({ rows }) {
  return (
    <Card pad={false}><div className="list">{rows.map((r) => (
      <Link key={r.id} to={r.to} className="list-item" style={{ color: 'inherit', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
        <div className="grow"><div className="strong">{r.title}</div><div className="tiny faint">{r.sub}</div></div>{r.right}
      </Link>))}</div></Card>
  )
}

function ProofCard({ t, p, url, onDone }) {
  const { user, member } = useAuth()
  const nav = useNavigate()
  const [mode, setMode] = useState(null)
  const [note, setNote] = useState('')
  const [busy, run] = useAction()
  const decide = (decision) => run(async () => {
    if (!p) throw new Error('No proof uploaded yet — open the task')
    if (decision === 'changes_requested' && !note.trim()) throw new Error('Write what needs to change')
    await q(supabase.from('task_proofs').update({ status: decision, review_note: note || null, reviewed_by: user.id, reviewed_at: new Date().toISOString() }).eq('id', p.id))
    if (note.trim()) await q(supabase.from('task_comments').insert({ task_id: t.id, author_id: user.id, body: (decision === 'approved' ? 'Approved: ' : 'Changes needed: ') + note.trim(), kind: 'comment' }))
    onDone()
  }, decision === 'approved' ? 'Approved — ready for the client' : 'Sent back to the designer')
  return (
    <Card className="approval-card">
      <div className="approval-thumb" onClick={() => (url || p?.external_link) ? window.open(url || p.external_link, '_blank') : nav(`/tasks/${t.id}`)}
        style={url ? { backgroundImage: `url(${url})` } : undefined}>
        {!url && (p?.external_link ? <span className="small"><ExternalLink size={16} /> Open proof link</span> : <FileText size={28} />)}
        {p && <span className="ver">v{p.version}</span>}
        {(p?.files?.length || 0) > 1 && <span className="count">{p.files.length} files</span>}
      </div>
      <div className="card-body">
        <div className="row between gap-s"><Link to={`/tasks/${t.id}`} className="strong">{t.title}</Link>{t.due_date && <Due d={t.due_date} />}</div>
        <div className="tiny faint" style={{ marginTop: 2 }}>{t.code} · {t.clients?.name} · {t.task_type}{t.revision_count ? ` · revision ${t.revision_count}` : ''}</div>
        <div className="row gap-xs tiny" style={{ marginTop: 6 }}><Avatar name={member(t.assignee_id)?.full_name || '?'} size={18} /><span className="faint">{member(t.assignee_id)?.full_name || 'Unassigned'}{p && ` · uploaded ${ago(p.created_at)}`}</span></div>
        {p?.note && <p className="small" style={{ margin: '8px 0 0' }}>“{p.note}”</p>}
        {mode ? (
          <div className="mt">
            <Textarea rows={3} autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder={mode === 'approved' ? 'Optional note for the designer' : '1. Make the headline bigger\n2. Use the client’s green'} />
            <div className="row gap-xs mt" style={{ justifyContent: 'flex-end' }}>
              <Button size="sm" variant="ghost" onClick={() => { setMode(null); setNote('') }}>Cancel</Button>
              <Button size="sm" variant={mode === 'approved' ? 'primary' : 'danger'} loading={busy} onClick={() => decide(mode)}>{mode === 'approved' ? 'Approve' : 'Send back'}</Button>
            </div>
          </div>
        ) : (
          <div className="row gap-xs mt wrap">
            <Button size="sm" icon={CheckCircle2} loading={busy} onClick={() => decide('approved')}>Approve</Button>
            <Button size="sm" variant="outline" icon={XCircle} onClick={() => setMode('changes_requested')}>Request changes</Button>
            <Button size="sm" variant="ghost" onClick={() => setMode('approved')}>Approve with note</Button>
          </div>
        )}
      </div>
    </Card>
  )
}

function PostCard({ p, onDone }) {
  const { member } = useAuth()
  const [busy, run] = useAction()
  const set = (status, msg) => run(async () => { await q(supabase.from('content_posts').update({ status }).eq('id', p.id)); onDone() }, msg)
  return (
    <Card className="approval-card">
      <div className="card-body">
        <div className="row between gap-s"><b>{p.title}</b><Badge tone="slate">{p.post_type === 'Post' ? 'Poster' : p.post_type}</Badge></div>
        <div className="tiny faint" style={{ marginTop: 2 }}>{p.clients?.name} · {date(p.publish_date)} · {(p.platforms || []).join(', ')}{p.assignee_id && ` · ${member(p.assignee_id)?.full_name || ''}`}</div>
        {p.caption ? <p className="small pre" style={{ margin: '8px 0 0', maxHeight: 110, overflow: 'auto', background: 'var(--surface-2)', padding: 8, borderRadius: 8 }}>{p.caption}</p> : <p className="small faint" style={{ margin: '8px 0 0' }}>No caption yet.</p>}
        {p.media_link && <a className="small" href={p.media_link} target="_blank" rel="noreferrer">Open creative <ExternalLink size={11} /></a>}
        <div className="row gap-xs mt wrap">
          <Button size="sm" icon={Send} loading={busy} onClick={() => set('client_approval', 'Approved — sent for client approval')}>Approve → client</Button>
          <Button size="sm" variant="outline" icon={CheckCircle2} onClick={() => set('approved', 'Approved')}>Approve (final)</Button>
          <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => set('copywriting', 'Sent back for changes')}>Send back</Button>
        </div>
      </div>
    </Card>
  )
}
