import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, MessageSquareWarning, ExternalLink, FileText, Film, Loader2 } from 'lucide-react'
import { supabase, configured } from '../lib/supabase'
import { date } from '../lib/format'

// Public, no-login page where a client approves posts and design proofs.
export default function Portal() {
  const { token } = useParams()
  const [data, setData] = useState(null)
  const [urls, setUrls] = useState({})
  const [err, setErr] = useState(null)
  const [tab, setTab] = useState('pending')

  const load = async () => {
    if (!configured) { setErr('Portal is not configured.'); return }
    const { data: d, error } = await supabase.rpc('portal_get', { p_token: token })
    if (error || d?.error) { setErr(d?.error || error.message); return }
    setData(d)
    const ids = (d.proofs || []).filter((p) => p.file_path).map((p) => p.id)
    if (ids.length) {
      fetch('/api/portal-file', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, proof_ids: ids }) })
        .then((r) => r.json()).then((r) => setUrls(r.urls || {})).catch(() => {})
    }
  }
  useEffect(() => { load() }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  if (err) return <Shell><div className="card card-body center" style={{ padding: 40 }}><h2>Link unavailable</h2><p className="muted">{err}</p><p className="muted small mt">Please ask your account manager for a new link.</p></div></Shell>
  if (!data) return <Shell><div className="loading"><Loader2 className="spin" size={20} />Loading your content…</div></Shell>

  const pendingPosts = data.posts.filter((p) => p.status === 'client_approval')
  const pendingProofs = data.proofs.filter((p) => !p.client_decision)
  const donePosts = data.posts.filter((p) => p.status !== 'client_approval')
  const doneProofs = data.proofs.filter((p) => p.client_decision)
  const pendingCount = pendingPosts.length + pendingProofs.length

  return (
    <Shell company={data.company}>
      <div className="hero" style={{ marginBottom: 16 }}>
        <div><p className="small" style={{ color: 'var(--green-2)', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>Content approvals</p>
          <h1>Hello {data.client.contact || data.client.name} 👋</h1>
          <p>{pendingCount ? `${pendingCount} item${pendingCount > 1 ? 's' : ''} waiting for your approval.` : 'Everything is approved — thank you!'}</p></div>
      </div>
      <div className="seg mb">
        <button className={tab === 'pending' ? 'on' : ''} onClick={() => setTab('pending')}>Waiting for you ({pendingCount})</button>
        <button className={tab === 'done' ? 'on' : ''} onClick={() => setTab('done')}>Reviewed ({donePosts.length + doneProofs.length})</button>
      </div>
      {tab === 'pending' ? (
        <div className="grid">
          {pendingProofs.map((p) => <ProofCard key={p.id} p={p} url={urls[p.id]} token={token} onDone={load} />)}
          {pendingPosts.map((p) => <PostCard key={p.id} p={p} token={token} onDone={load} />)}
          {pendingCount === 0 && <div className="empty"><CheckCircle2 size={32} color="var(--green)" /><strong>You’re all caught up</strong><p>We’ll send a new link when the next batch is ready.</p></div>}
        </div>
      ) : (
        <div className="grid">
          {doneProofs.map((p) => <ProofCard key={p.id} p={p} url={urls[p.id]} token={token} done />)}
          {donePosts.map((p) => <PostCard key={p.id} p={p} token={token} done />)}
        </div>
      )}
    </Shell>
  )
}

function Shell({ children, company }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div className="portal">
        <div className="portal-head">
          <img src="/logo-full.png" alt="Aqlyon Brand Management" />
          {company && <span className="small muted">{company.phone}{company.website && ` · ${company.website}`}</span>}
        </div>
        {children}
      </div>
    </div>
  )
}

function Decide({ kind, id, token, onDone }) {
  const [mode, setMode] = useState(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const send = async (decision) => {
    setBusy(true)
    const { data, error } = await supabase.rpc('portal_decide', { p_token: token, p_kind: kind, p_id: id, p_decision: decision, p_note: note })
    setBusy(false)
    if (error || data?.error || !data?.ok) { setMsg(data?.error || error?.message || 'Could not save — it may already be reviewed.'); return }
    onDone?.()
  }
  if (mode === 'changes') return (
    <div className="col gap-s mt">
      <textarea className="input" rows={3} autoFocus placeholder="What would you like us to change?" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="row gap-s"><button className="btn btn-ghost" onClick={() => setMode(null)}>Back</button>
        <button className="btn btn-dark" disabled={!note.trim() || busy} onClick={() => send('changes_requested')}>{busy ? 'Sending…' : 'Send feedback'}</button></div>
      {msg && <div className="alert alert-error small">{msg}</div>}
    </div>
  )
  return (
    <div className="col gap-s mt">
      <div className="row gap-s wrap">
        <button className="btn btn-primary btn-lg" disabled={busy} onClick={() => send('approved')}><CheckCircle2 size={18} />{busy ? 'Saving…' : 'Approve'}</button>
        <button className="btn btn-outline btn-lg" onClick={() => setMode('changes')}><MessageSquareWarning size={18} />Request changes</button>
      </div>
      {msg && <div className="alert alert-error small">{msg}</div>}
    </div>
  )
}

function ProofCard({ p, url, token, onDone, done }) {
  const isImg = p.file_type?.startsWith('image/'), isVid = p.file_type?.startsWith('video/')
  return (
    <div className="card">
      <div className="card-head"><h3>{p.task_title}</h3><span className="badge tone-slate">{p.task_type} · v{p.version}</span></div>
      <div className="card-body">
        {url && isImg && <img src={url} alt={p.task_title} style={{ width: '100%', maxHeight: 640, objectFit: 'contain', borderRadius: 10, background: '#f0f0ec' }} />}
        {url && isVid && <video src={url} controls style={{ width: '100%', borderRadius: 10 }} />}
        {url && !isImg && !isVid && <a className="btn btn-outline" href={url} target="_blank" rel="noreferrer"><FileText size={16} />Open file</a>}
        {!url && p.file_path && <div className="loading small">{isVid ? <Film size={18} /> : null}Loading preview…</div>}
        {p.external_link && <a className="btn btn-outline mt" href={p.external_link} target="_blank" rel="noreferrer"><ExternalLink size={15} />View design</a>}
        {p.note && <p className="small muted mt">{p.note}</p>}
        {done ? <div className={`alert mt ${p.client_decision === 'approved' ? 'alert-ok' : 'alert-warn'}`}>{p.client_decision === 'approved' ? 'Approved' : 'Changes requested'}{p.client_note && ` — “${p.client_note}”`}</div>
          : <Decide kind="proof" id={p.id} token={token} onDone={onDone} />}
      </div>
    </div>
  )
}

function PostCard({ p, token, onDone, done }) {
  return (
    <div className="card">
      <div className="card-head"><h3>{p.title}</h3><span className="badge tone-blue">{date(p.publish_date, { weekday: 'short', day: 'numeric', month: 'short' })}{p.publish_time && ` · ${p.publish_time.slice(0, 5)}`}</span></div>
      <div className="card-body">
        <div className="row gap-s wrap small muted mb"><span className="badge tone-slate">{p.post_type}</span>{(p.platforms || []).join(' · ')}</div>
        {p.caption && <p className="pre" style={{ background: 'var(--surface-2)', border: '1px solid var(--line-2)', borderRadius: 10, padding: 12 }}>{p.caption}{p.hashtags && `\n\n${p.hashtags}`}</p>}
        {p.media_link && <a className="btn btn-outline mt" href={p.media_link} target="_blank" rel="noreferrer"><ExternalLink size={15} />View creative</a>}
        {done ? <div className={`alert mt ${['approved', 'scheduled', 'published'].includes(p.status) ? 'alert-ok' : 'alert-warn'}`}>{['approved', 'scheduled', 'published'].includes(p.status) ? 'Approved' : 'Changes requested'}{p.client_note && ` — “${p.client_note}”`}</div>
          : <Decide kind="post" id={p.id} token={token} onDone={onDone} />}
      </div>
    </div>
  )
}
