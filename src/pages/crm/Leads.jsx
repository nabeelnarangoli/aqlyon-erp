import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, LayoutGrid, List, Phone, MessageCircle, UserCheck, Flame, Snowflake, Sun, Trash2, FileSignature, Download } from 'lucide-react'
import { supabase, q } from '../../lib/supabase'
import { useData, useLocal, isMobileNow } from '../../lib/hooks'
import { useAuth } from '../../lib/auth'
import { LEAD_STAGES, LEAD_SOURCES, INDUSTRIES, SERVICE_TAGS, byId } from '../../lib/constants'
import { money, compact, date, dueLabel, waLink, downloadCSV, ago, showMoney } from '../../lib/format'
import {
  PageHeader, Button, Badge, StatusBadge, Member, Modal, Field, Input, Select, Textarea, Chips, MemberSelect,
  SearchInput, Loading, ErrorBox, Empty, Tabs, useAction, useForm, useToast, cx, invalidateClients
} from '../../components/ui'
import Interactions from '../../components/Interactions'

const TEMP = { hot: { icon: Flame, tone: 'red' }, warm: { icon: Sun, tone: 'amber' }, cold: { icon: Snowflake, tone: 'blue' } }

export default function Leads() {
  const [view, setView] = useLocal('leads.view', isMobileNow() ? 'list' : 'board')
  const [search, setSearch] = useState('')
  const [owner, setOwner] = useState('')
  const [source, setSource] = useState('')
  const [editing, setEditing] = useState(null)
  const [params, setParams] = useSearchParams()
  const { data, loading, error, reload, setData } = useData(() => q(supabase.from('leads').select('*').order('updated_at', { ascending: false })), [], [])

  useEffect(() => {
    const id = params.get('open')
    if (id && data.length) { const l = data.find((x) => x.id === id); if (l) setEditing(l); setParams({}, { replace: true }) }
  }, [params, data, setParams])

  const rows = useMemo(() => data.filter((l) => {
    const s = search.toLowerCase()
    return (!s || [l.name, l.company, l.phone, l.city, l.email].some((v) => v?.toLowerCase().includes(s)))
      && (!owner || l.owner_id === owner) && (!source || l.source === source)
  }), [data, search, owner, source])

  const open = rows.filter((l) => !['won', 'lost'].includes(l.stage))
  const pipeline = open.reduce((a, l) => a + Number(l.estimated_value || 0), 0)
  const won = data.filter((l) => l.stage === 'won').length
  const closed = data.filter((l) => ['won', 'lost'].includes(l.stage)).length

  const moveStage = async (id, stage) => {
    setData((d) => d.map((l) => (l.id === id ? { ...l, stage } : l)))
    const { error } = await supabase.from('leads').update({ stage }).eq('id', id)
    if (error) reload()
  }

  return (
    <>
      <PageHeader title="Leads & Pipeline"
        subtitle={`${open.length} open · ${showMoney() ? `${money(pipeline)} in pipeline · ` : ''}${closed ? Math.round((won / closed) * 100) : 0}% win rate`}
        actions={<>
          <Button variant="outline" icon={Download} onClick={() => downloadCSV('leads.csv', rows.map((l) => ({ name: l.name, company: l.company, phone: l.phone, email: l.email, city: l.city, source: l.source, stage: l.stage, value: l.estimated_value, follow_up: l.next_follow_up })))}>Export</Button>
          <Button icon={Plus} onClick={() => setEditing({})}>New lead</Button>
        </>} />
      <div className="filters">
        <SearchInput value={search} onChange={setSearch} placeholder="Search name, company, phone…" />
        <MemberSelect value={owner} onChange={(v) => setOwner(v || '')} perm={['leads.manage', 'clients.manage']} placeholder="All owners" />
        <Select options={LEAD_SOURCES} value={source} onChange={(v) => setSource(v || '')} placeholder="All sources" />
        <div className="grow" />
        <div className="seg">
          <button className={cx(view === 'board' && 'on')} onClick={() => setView('board')}><LayoutGrid size={14} />Board</button>
          <button className={cx(view === 'list' && 'on')} onClick={() => setView('list')}><List size={14} />List</button>
        </div>
      </div>
      <ErrorBox error={error} onRetry={reload} />
      {loading ? <Loading /> : view === 'board' ? <Board rows={rows} onOpen={setEditing} onMove={moveStage} /> : <LeadTable rows={rows} onOpen={setEditing} />}
      {editing && <LeadModal lead={editing} onClose={() => setEditing(null)} onSaved={() => { reload() }} />}
    </>
  )
}

function Board({ rows, onOpen, onMove }) {
  const [over, setOver] = useState(null)
  return (
    <div className="board">
      {LEAD_STAGES.map((s) => {
        const items = rows.filter((l) => l.stage === s.id)
        const total = items.reduce((a, l) => a + Number(l.estimated_value || 0), 0)
        return (
          <div key={s.id} className={cx('lane', over === s.id && 'drop')}
            onDragOver={(e) => { e.preventDefault(); setOver(s.id) }} onDragLeave={() => setOver(null)}
            onDrop={(e) => { setOver(null); const id = e.dataTransfer.getData('id'); if (id) onMove(id, s.id) }}>
            <div className="lane-head"><span><Badge tone={s.tone} dot>{s.label}</Badge> <span className="sum">{items.length}</span></span>{showMoney() && <span className="sum">{compact(total)}</span>}</div>
            {items.map((l) => <LeadCard key={l.id} l={l} onOpen={onOpen} />)}
          </div>
        )
      })}
    </div>
  )
}

function LeadCard({ l, onOpen }) {
  const T = TEMP[l.temperature] || TEMP.warm
  const due = l.next_follow_up && !['won', 'lost'].includes(l.stage) ? dueLabel(l.next_follow_up) : null
  return (
    <div className="kcard" draggable onDragStart={(e) => e.dataTransfer.setData('id', l.id)} onClick={() => onOpen(l)}>
      <div className="row between gap-s">
        <div className="grow"><div className="title ellipsis">{l.company || l.name}</div>{l.company && <div className="tiny faint">{l.name}</div>}</div>
        <T.icon size={15} color={`var(--${T.tone})`} />
      </div>
      <div className="meta">
        {l.source && <Badge tone="slate">{l.source}</Badge>}
        {showMoney() && Number(l.estimated_value) > 0 && <b style={{ color: 'var(--ink)' }}>{money(l.estimated_value)}</b>}
      </div>
      <div className="foot">
        <Member id={l.owner_id} size={20} showName={false} fallback="" />
        {due ? <Badge tone={due.tone}>{due.text.replace('Due', 'Follow-up')}</Badge> : <span className="tiny faint">{ago(l.updated_at)}</span>}
      </div>
    </div>
  )
}

function LeadTable({ rows, onOpen }) {
  if (!rows.length) return <Empty title="No leads match">Add your first lead or clear filters.</Empty>
  return (
    <div className="card table-wrap">
      <table className="table stack-sm">
        <thead><tr><th>Lead</th><th>Contact</th><th>Source</th><th>Stage</th>{showMoney() && <th className="num">Value</th>}<th>Owner</th><th>Follow-up</th></tr></thead>
        <tbody>
          {rows.map((l) => (
            <tr key={l.id} className="click" onClick={() => onOpen(l)}>
              <td><div className="cell-title">{l.company || l.name}</div><div className="cell-sub">{l.industry || l.city}</div></td>
              <td><div>{l.name}</div><div className="cell-sub">{l.phone}</div></td>
              <td className="hide-sm">{l.source}</td>
              <td><StatusBadge list={LEAD_STAGES} value={l.stage} /></td>
              {showMoney() && <td className="num">{money(l.estimated_value)}</td>}
              <td><Member id={l.owner_id} size={22} /></td>
              <td>{l.next_follow_up ? <Badge tone={dueLabel(l.next_follow_up).tone}>{date(l.next_follow_up)}</Badge> : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function LeadModal({ lead, onClose, onSaved }) {
  const { user } = useAuth()
  const { confirm } = useToast()
  const nav = useNavigate()
  const [tab, setTab] = useState(lead.id ? 'log' : 'details')
  const [f, set, setF] = useForm({
    name: '', company: '', phone: '', whatsapp: '', email: '', city: 'Koyilandy', industry: '', source: 'Instagram',
    services_interest: [], estimated_value: '', stage: 'new', temperature: 'warm', owner_id: user.id, next_follow_up: '', lost_reason: '', notes: '', ...lead
  })
  const isNew = !f.id
  const [busy, run] = useAction()

  const save = (e) => {
    e?.preventDefault()
    return run(async () => {
      const payload = { ...f, estimated_value: Number(f.estimated_value || 0), next_follow_up: f.next_follow_up || null, owner_id: f.owner_id || null }
      delete payload.id; delete payload.created_at; delete payload.updated_at; delete payload.created_by
      const row = isNew
        ? await q(supabase.from('leads').insert(payload).select().single())
        : await q(supabase.from('leads').update(payload).eq('id', f.id).select().single())
      setF(row); onSaved?.()
      if (isNew) setTab('log')
      return row
    }, isNew ? 'Lead added' : 'Lead updated')
  }
  const convert = async () => {
    if (!(await confirm(`Convert "${f.company || f.name}" into a client? Their conversation log moves with them.`, { okText: 'Convert to client' }))) return
    run(async () => {
      const id = await q(supabase.rpc('convert_lead', { p_lead: f.id }))
      invalidateClients(); onSaved?.(); onClose(); nav(`/clients/${id}`)
    }, 'Converted to client 🎉')
  }
  const del = async () => {
    if (!(await confirm('Delete this lead and its conversation log?', { danger: true, okText: 'Delete' }))) return
    run(async () => { await q(supabase.from('leads').delete().eq('id', f.id)); onSaved?.(); onClose() }, 'Lead deleted')
  }

  return (
    <Modal open drawer size="lg" onClose={onClose}
      title={isNew ? 'New lead' : f.company || f.name}
      subtitle={!isNew && <span className="row gap-s"><StatusBadge list={LEAD_STAGES} value={f.stage} />{f.converted_client_id && <Badge tone="green">Converted</Badge>}</span>}
      footer={<>
        {!isNew && <Button variant="ghost" icon={Trash2} onClick={del} style={{ marginRight: 'auto', color: 'var(--red)' }}>Delete</Button>}
        {!isNew && !f.converted_client_id && <Button variant="outline" icon={FileSignature} onClick={() => nav(`/finance/quotations?new=1&lead=${f.id}`)}>Quotation</Button>}
        {!isNew && !f.converted_client_id && <Button variant="dark" icon={UserCheck} onClick={convert}>Convert to client</Button>}
        {f.converted_client_id && <Button variant="outline" onClick={() => nav(`/clients/${f.converted_client_id}`)}>Open client</Button>}
        {tab === 'details' && <Button onClick={save} loading={busy}>{isNew ? 'Create lead' : 'Save changes'}</Button>}
      </>}>
      {!isNew && (
        <div className="row gap-s mb wrap">
          {f.phone && <a className="btn btn-outline btn-sm" href={`tel:${f.phone}`}><Phone size={14} />Call</a>}
          {(f.whatsapp || f.phone) && <a className="btn btn-outline btn-sm" target="_blank" rel="noreferrer" href={waLink(f.whatsapp || f.phone, `Hi ${f.name}, this is from Aqlyon Brand Management.`)}><MessageCircle size={14} />WhatsApp</a>}
          <div className="grow" />
          <Select placeholder={false} options={LEAD_STAGES} value={f.stage} onChange={(v) => { set('stage')(v); run(() => q(supabase.from('leads').update({ stage: v }).eq('id', f.id)).then(onSaved), 'Stage updated') }} />
        </div>
      )}
      {!isNew && <Tabs value={tab} onChange={setTab} tabs={[{ id: 'log', label: 'Conversation log' }, { id: 'details', label: 'Details' }]} />}
      {tab === 'log' && !isNew ? <Interactions leadId={f.id} /> : (
        <form className="form" onSubmit={save}>
          <Field label="Contact name" required><Input required value={f.name} onChange={set('name')} /></Field>
          <Field label="Business / brand"><Input value={f.company} onChange={set('company')} /></Field>
          <Field label="Phone"><Input value={f.phone} onChange={set('phone')} inputMode="tel" /></Field>
          <Field label="WhatsApp" hint="If different from phone"><Input value={f.whatsapp} onChange={set('whatsapp')} inputMode="tel" /></Field>
          <Field label="Email"><Input type="email" value={f.email} onChange={set('email')} /></Field>
          <Field label="City / area"><Input value={f.city} onChange={set('city')} /></Field>
          <Field label="Industry"><Select options={INDUSTRIES} value={f.industry} onChange={set('industry')} /></Field>
          <Field label="Lead source"><Select options={LEAD_SOURCES} value={f.source} onChange={set('source')} /></Field>
          <Field label="Interested in" span={2}><Chips options={SERVICE_TAGS} value={f.services_interest || []} onChange={set('services_interest')} /></Field>
          {showMoney() && <Field label="Estimated monthly / deal value (₹)"><Input type="number" step="any" min="0" value={f.estimated_value} onChange={set('estimated_value')} /></Field>}
          <Field label="Temperature"><Select placeholder={false} options={[{ id: 'hot', label: '🔥 Hot' }, { id: 'warm', label: '☀️ Warm' }, { id: 'cold', label: '❄️ Cold' }]} value={f.temperature} onChange={set('temperature')} /></Field>
          <Field label="Stage"><Select placeholder={false} options={LEAD_STAGES} value={f.stage} onChange={set('stage')} /></Field>
          <Field label="Owner"><MemberSelect perm={['leads.manage', 'clients.manage']} value={f.owner_id} onChange={set('owner_id')} /></Field>
          <Field label="Next follow-up"><Input type="date" value={f.next_follow_up} onChange={set('next_follow_up')} /></Field>
          {f.stage === 'lost' && <Field label="Lost reason"><Select options={['Budget too high', 'Chose competitor', 'No response', 'Not ready yet', 'Doing it in-house', 'Other']} value={f.lost_reason} onChange={set('lost_reason')} /></Field>}
          <Field label="Notes" span={2}><Textarea value={f.notes} onChange={set('notes')} placeholder="Requirements, budget, decision maker, competitors…" /></Field>
        </form>
      )}
    </Modal>
  )
}

