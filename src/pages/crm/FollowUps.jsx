import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Phone, MessageCircle, PhoneCall, CalendarClock } from 'lucide-react'
import { supabase, q } from '../../lib/supabase'
import { useData } from '../../lib/hooks'
import { useAuth } from '../../lib/auth'
import { INTERACTION_TYPES, LEAD_STAGES, byId } from '../../lib/constants'
import { date, dueLabel, daysFrom, waLink, todayISO, addDays } from '../../lib/format'
import { PageHeader, Button, Badge, Member, Card, Loading, Empty, Tabs, MemberSelect, useAction, Stat } from '../../components/ui'

export default function FollowUps() {
  const { user } = useAuth()
  const nav = useNavigate()
  const [who, setWho] = useState(user.id)
  const [tab, setTab] = useState('due')
  const [busy, run] = useAction()
  const { data, loading, reload } = useData(async () => {
    const [acts, leads, renewals] = await Promise.all([
      q(supabase.from('interactions').select('*, clients(id,name,phone,whatsapp), leads(id,name,company,phone,whatsapp,owner_id)').eq('done', false).not('next_action', 'is', null).order('next_action_date')),
      q(supabase.from('leads').select('*').not('stage', 'in', '(won,lost)').not('next_follow_up', 'is', null).order('next_follow_up')),
      q(supabase.from('packages').select('*, clients(id,name,account_manager_id)').eq('status', 'active').not('renewal_date', 'is', null).lte('renewal_date', addDays(todayISO(), 45)).order('renewal_date'))
    ])
    return { acts, leads, renewals }
  }, [], { acts: [], leads: [], renewals: [] })

  const items = useMemo(() => {
    const a = data.acts.map((x) => ({
      key: 'i' + x.id, id: x.id, kind: 'interaction', when: x.next_action_date, text: x.next_action, owner: x.created_by,
      name: x.clients?.name || x.leads?.company || x.leads?.name, phone: x.clients?.whatsapp || x.clients?.phone || x.leads?.whatsapp || x.leads?.phone,
      go: x.client_id ? `/clients/${x.client_id}` : `/leads?open=${x.lead_id}`, tag: x.client_id ? 'Client' : 'Lead', type: x.type
    }))
    const l = data.leads.map((x) => ({
      key: 'l' + x.id, id: x.id, kind: 'lead', when: x.next_follow_up, text: `Follow up · ${byId(LEAD_STAGES, x.stage).label}`, owner: x.owner_id,
      name: x.company || x.name, phone: x.whatsapp || x.phone, go: `/leads?open=${x.id}`, tag: 'Lead'
    }))
    return [...a, ...l].filter((x) => !who || x.owner === who).sort((p, r) => (p.when || '9').localeCompare(r.when || '9'))
  }, [data, who])
  const due = items.filter((x) => x.when && daysFrom(x.when) <= 0)
  const upcoming = items.filter((x) => !x.when || daysFrom(x.when) > 0)
  const renewals = data.renewals.filter((p) => !who || p.clients?.account_manager_id === who)

  const done = (x) => run(async () => {
    if (x.kind === 'interaction') await q(supabase.from('interactions').update({ done: true }).eq('id', x.id))
    else await q(supabase.from('leads').update({ next_follow_up: null }).eq('id', x.id))
    reload()
  }, 'Done ✓')
  const snooze = (x, d) => run(async () => {
    const when = addDays(todayISO(), d)
    if (x.kind === 'interaction') await q(supabase.from('interactions').update({ next_action_date: when }).eq('id', x.id))
    else await q(supabase.from('leads').update({ next_follow_up: when }).eq('id', x.id))
    reload()
  }, `Moved to ${date(addDays(todayISO(), d))}`)

  const list = tab === 'due' ? due : upcoming
  return (
    <>
      <PageHeader title="Follow-ups" subtitle="Every promised call-back, quote and check-in — so no client or lead goes cold."
        actions={<MemberSelect perm={['leads.manage', 'clients.manage']} value={who} onChange={(v) => setWho(v || '')} placeholder="Everyone" />} />
      <div className="stats">
        <Stat label="Due today or overdue" value={due.length} icon={PhoneCall} tone={due.length ? 'red' : 'green'} onClick={() => setTab('due')} />
        <Stat label="Upcoming" value={upcoming.length} icon={CalendarClock} tone="blue" onClick={() => setTab('upcoming')} />
        <Stat label="Renewals in 45 days" value={renewals.length} icon={CalendarClock} tone="amber" onClick={() => setTab('renewals')} />
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'due', label: 'Due now', count: due.length }, { id: 'upcoming', label: 'Upcoming', count: upcoming.length }, { id: 'renewals', label: 'Package renewals', count: renewals.length }]} />
      {loading ? <Loading /> : tab === 'renewals' ? (
        renewals.length === 0 ? <Empty title="No renewals coming up" /> : (
          <Card pad={false}><div className="table-wrap"><table className="table">
            <thead><tr><th>Client</th><th>Package</th><th>Renewal</th><th>Account manager</th></tr></thead>
            <tbody>{renewals.map((p) => (
              <tr key={p.id} className="click" onClick={() => nav(`/clients/${p.client_id}`)}>
                <td className="cell-title">{p.clients?.name}</td><td>{p.name}</td>
                <td><Badge tone={dueLabel(p.renewal_date).tone}>{date(p.renewal_date)}</Badge></td>
                <td><Member id={p.clients?.account_manager_id} size={22} /></td>
              </tr>))}</tbody></table></div></Card>)
      ) : list.length === 0 ? <Empty icon={Check} title={tab === 'due' ? 'All caught up 🎉' : 'Nothing scheduled'} /> : (
        <Card pad={false}>
          <div className="list" style={{ padding: '0 16px' }}>
            {list.map((x) => {
              const d = dueLabel(x.when)
              return (
                <div key={x.key} className="list-item wrap">
                  <div className="grow" style={{ cursor: 'pointer', minWidth: 200 }} onClick={() => nav(x.go)}>
                    <div className="row gap-s"><span className="cell-title">{x.name}</span><Badge tone={x.tag === 'Client' ? 'green' : 'blue'}>{x.tag}</Badge>{x.type && <span className="tiny faint">via {byId(INTERACTION_TYPES, x.type).label}</span>}</div>
                    <div className="small muted">{x.text}</div>
                  </div>
                  <Badge tone={d.tone}>{x.when ? d.text : 'No date'}</Badge>
                  <Member id={x.owner} size={22} showName={false} />
                  {x.phone && <a className="icon-btn" title="Call" href={`tel:${x.phone}`}><Phone size={15} /></a>}
                  {x.phone && <a className="icon-btn" title="WhatsApp" target="_blank" rel="noreferrer" href={waLink(x.phone)}><MessageCircle size={15} /></a>}
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => snooze(x, 1)}>+1d</Button>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => snooze(x, 7)}>+1w</Button>
                  <Button size="sm" variant="soft" icon={Check} disabled={busy} onClick={() => done(x)}>Done</Button>
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </>
  )
}
