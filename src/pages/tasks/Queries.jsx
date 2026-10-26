import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { Plus, Send, CheckCircle2, RotateCcw, MessagesSquare, ArrowLeft } from 'lucide-react'
import { supabase, q } from '../../lib/supabase'
import { useData, useRealtime } from '../../lib/hooks'
import { useAuth } from '../../lib/auth'
import { QUERY_STATUS, PRIORITIES, ROLES } from '../../lib/constants'
import { ago, dateTime } from '../../lib/format'
import { PageHeader, Button, Badge, StatusBadge, Member, Avatar, Card, Textarea, Loading, Empty, SearchInput, useAction, cx } from '../../components/ui'
import { AskQuery } from './TaskDetail'

export default function Queries() {
  const { id } = useParams()
  const nav = useNavigate()
  const { user, role, isAdmin } = useAuth()
  const [box, setBox] = useState('inbox')
  const [status, setStatus] = useState('active')
  const [search, setSearch] = useState('')
  const [asking, setAsking] = useState(false)
  const list = useData(() => q(supabase.from('queries').select('*, clients(name), design_tasks(code), query_replies(count)').order('updated_at', { ascending: false }).limit(300)), [], [])
  useRealtime('query_replies', null, () => list.reload())

  const rows = useMemo(() => list.data.filter((x) => {
    if (box === 'inbox' && !(x.to_user === user.id || (x.to_role === role && x.from_user !== user.id))) return false
    if (box === 'sent' && x.from_user !== user.id) return false
    if (status === 'active' && x.status === 'resolved') return false
    if (status === 'resolved' && x.status !== 'resolved') return false
    if (search && ![x.subject, x.body, x.clients?.name].some((v) => v?.toLowerCase().includes(search.toLowerCase()))) return false
    return true
  }), [list.data, box, status, search, user.id, role])
  const inboxOpen = list.data.filter((x) => (x.to_user === user.id || (x.to_role === role && x.from_user !== user.id)) && x.status === 'open').length

  return (
    <>
      <PageHeader title="Team Queries" subtitle="Questions between marketing, design and finance — tracked until resolved."
        actions={<Button icon={Plus} onClick={() => setAsking(true)}>New query</Button>} />
      <div className="grid" style={{ gridTemplateColumns: id ? 'minmax(0,1fr) minmax(0,1.5fr)' : '1fr', alignItems: 'start' }}>
        <div className={cx(id && 'hide-sm')}>
          <div className="filters">
            <div className="seg">
              <button className={cx(box === 'inbox' && 'on')} onClick={() => setBox('inbox')}>Inbox{inboxOpen > 0 && <Badge tone="red">{inboxOpen}</Badge>}</button>
              <button className={cx(box === 'sent' && 'on')} onClick={() => setBox('sent')}>Sent</button>
              {isAdmin && <button className={cx(box === 'all' && 'on')} onClick={() => setBox('all')}>All</button>}
            </div>
            <div className="seg">
              <button className={cx(status === 'active' && 'on')} onClick={() => setStatus('active')}>Open</button>
              <button className={cx(status === 'resolved' && 'on')} onClick={() => setStatus('resolved')}>Resolved</button>
            </div>
            <SearchInput value={search} onChange={setSearch} />
          </div>
          {list.loading ? <Loading /> : rows.length === 0 ? <Empty icon={MessagesSquare} title="No queries here" /> : (
            <Card pad={false}>
              {rows.map((x) => (
                <div key={x.id} className={cx('notif', x.id === id && 'unread')} onClick={() => nav(`/queries/${x.id}`)}>
                  <Member id={x.from_user} showName={false} size={30} />
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="row between gap-s"><b className="ellipsis">{x.subject}</b><span className="tiny faint nowrap">{ago(x.updated_at)}</span></div>
                    <div className="small muted ellipsis">{x.body}</div>
                    <div className="row gap-xs mt wrap" style={{ marginTop: 5 }}>
                      <StatusBadge list={QUERY_STATUS} value={x.status} />
                      {x.priority !== 'normal' && <StatusBadge list={PRIORITIES} value={x.priority} />}
                      <Badge tone="slate">{x.category}</Badge>
                      {x.clients?.name && <Badge tone="slate">{x.clients.name}</Badge>}
                      {x.query_replies?.[0]?.count > 0 && <span className="tiny faint">{x.query_replies[0].count} replies</span>}
                    </div>
                  </div>
                </div>
              ))}
            </Card>
          )}
        </div>
        {id && <Thread id={id} onChanged={list.reload} />}
      </div>
      {asking && <AskQuery onClose={() => setAsking(false)} onSaved={() => list.reload()} />}
    </>
  )
}

function Thread({ id, onChanged }) {
  const nav = useNavigate()
  const { user, member } = useAuth()
  const [text, setText] = useState('')
  const [busy, run] = useAction()
  const qd = useData(() => q(supabase.from('queries').select('*, clients(id,name), design_tasks(id,code,title)').eq('id', id).single()), [id])
  const replies = useData(() => q(supabase.from('query_replies').select('*').eq('query_id', id).order('created_at')), [id], [])
  useRealtime('query_replies', `query_id=eq.${id}`, () => replies.reload())
  const end = useRef()
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }) }, [replies.data.length])
  if (qd.loading) return <Loading />
  if (!qd.data) return <Empty title="Query not found" />
  const x = qd.data
  const send = (resolve) => run(async () => {
    if (text.trim()) await q(supabase.from('query_replies').insert({ query_id: id, body: text.trim(), author_id: user.id }))
    if (resolve) await q(supabase.from('queries').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', id))
    else await q(supabase.from('queries').update({ updated_at: new Date().toISOString() }).eq('id', id))
    setText(''); replies.reload(); qd.reload(); onChanged()
  }, resolve ? 'Marked resolved' : null)
  const reopen = () => run(async () => { await q(supabase.from('queries').update({ status: 'open', resolved_at: null }).eq('id', id)); qd.reload(); onChanged() })
  const to = x.to_user ? member(x.to_user)?.full_name : x.to_role ? `${ROLES[x.to_role]?.label} team` : '—'

  return (
    <Card title={<span className="row gap-s"><button className="icon-btn only-sm" onClick={() => nav('/queries')}><ArrowLeft size={16} /></button>{x.subject}</span>}
      actions={x.status === 'resolved' ? <Button size="sm" variant="ghost" icon={RotateCcw} onClick={reopen}>Reopen</Button> : <StatusBadge list={QUERY_STATUS} value={x.status} />}>
      <div className="row gap-s wrap small muted mb">
        <span>From <b>{member(x.from_user)?.full_name}</b> to <b>{to}</b></span>·<span>{dateTime(x.created_at)}</span>
        <Badge tone="slate">{x.category}</Badge>
        {x.clients && <Link to={`/clients/${x.clients.id}`}><Badge tone="green">{x.clients.name}</Badge></Link>}
        {x.design_tasks && <Link to={`/tasks/${x.design_tasks.id}`}><Badge tone="violet">{x.design_tasks.code}</Badge></Link>}
      </div>
      <div className="thread" style={{ maxHeight: 520, overflowY: 'auto' }}>
        <Bubble who={x.from_user} body={x.body} at={x.created_at} mine={x.from_user === user.id} />
        {replies.data.map((r) => <Bubble key={r.id} who={r.author_id} body={r.body} at={r.created_at} mine={r.author_id === user.id} />)}
        <div ref={end} />
      </div>
      {x.status !== 'resolved' && (
        <>
          <div className="composer">
            <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Reply… (Ctrl+Enter to send)" onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && text.trim()) send(false) }} />
            <Button icon={Send} loading={busy} disabled={!text.trim()} onClick={() => send(false)} />
          </div>
          <div className="row mt" style={{ justifyContent: 'flex-end' }}><Button size="sm" variant="soft" icon={CheckCircle2} onClick={() => send(true)}>{text.trim() ? 'Reply & resolve' : 'Mark resolved'}</Button></div>
        </>
      )}
    </Card>
  )
}
function Bubble({ who, body, at, mine }) {
  const { member } = useAuth()
  const name = member(who)?.full_name || 'Someone'
  return (
    <div className={cx('msg', mine && 'mine')}>
      <Avatar name={name} size={30} />
      <div><div className="msg-head"><b>{name}</b><span className="tiny faint">{ago(at)}</span></div><div className="msg-bubble pre">{body}</div></div>
    </div>
  )
}
