import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Megaphone, Trash2 } from 'lucide-react'
import { supabase, q } from '../../lib/supabase'
import { useData } from '../../lib/hooks'
import { useAuth } from '../../lib/auth'
import { PROJECT_TYPES, PROJECT_STATUS } from '../../lib/constants'
import { money, date, n } from '../../lib/format'
import {
  PageHeader, Button, StatusBadge, Member, Modal, Field, Input, Select, Textarea, MemberSelect, ClientSelect, SearchInput,
  Loading, Empty, useAction, useForm, useToast
} from '../../components/ui'

export default function Projects() {
  const { has } = useAuth()
  const [editing, setEditing] = useState(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const { data, loading, reload } = useData(() => q(supabase.from('projects').select('*, clients(name)').order('created_at', { ascending: false })), [], [])
  const rows = useMemo(() => data.filter((p) => (!status || p.status === status) &&
    (!search || [p.name, p.clients?.name, p.platform, p.type].some((v) => v?.toLowerCase().includes(search.toLowerCase())))), [data, search, status])
  const active = data.filter((p) => p.status === 'active')
  const spend = active.reduce((a, p) => a + Number(p.ad_spend || 0), 0)
  const leads = active.reduce((a, p) => a + Number(p.leads_generated || 0), 0)
  return (
    <>
      <PageHeader title="Campaigns & Projects" subtitle={`${active.length} active · ${money(spend)} ad spend · ${n(leads)} leads generated (${leads ? money(spend / leads) : '—'} per lead)`}
        actions={has('projects.manage') && <Button icon={Plus} onClick={() => setEditing({})}>New campaign</Button>} />
      <div className="filters">
        <SearchInput value={search} onChange={setSearch} />
        <Select options={PROJECT_STATUS} value={status} onChange={(v) => setStatus(v || '')} placeholder="All statuses" />
      </div>
      {loading ? <Loading /> : rows.length === 0 ? <Empty icon={Megaphone} title="No campaigns yet">Track ad campaigns, launches, shoots and branding projects with their budgets and results.</Empty> : (
        <div className="card table-wrap"><table className="table">
          <thead><tr><th>Campaign</th><th>Client</th><th>Type</th><th>Status</th><th>Dates</th><th className="num">Fee</th><th className="num">Ad spend</th><th className="num">Reach</th><th className="num">Leads</th><th className="num">CPL</th><th>Owner</th></tr></thead>
          <tbody>{rows.map((p) => (
            <tr key={p.id} className="click" onClick={() => setEditing(p)}>
              <td><div className="cell-title">{p.name}</div><div className="cell-sub">{p.platform || p.objective}</div></td>
              <td><Link to={`/clients/${p.client_id}`} onClick={(e) => e.stopPropagation()}>{p.clients?.name}</Link></td>
              <td>{p.type}</td><td><StatusBadge list={PROJECT_STATUS} value={p.status} /></td>
              <td className="nowrap small">{p.start_date ? date(p.start_date) : '—'} → {p.end_date ? date(p.end_date) : '—'}</td>
              <td className="num">{money(p.budget)}</td><td className="num">{money(p.ad_spend)}</td><td className="num">{n(p.reach)}</td>
              <td className="num">{n(p.leads_generated)}</td><td className="num">{p.leads_generated ? money(p.ad_spend / p.leads_generated) : '—'}</td>
              <td><Member id={p.owner_id} size={22} showName={false} /></td>
            </tr>))}
          </tbody></table></div>
      )}
      {editing && <ProjectModal project={editing} readOnly={!has('projects.manage')} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload() }} />}
    </>
  )
}

export function ProjectModal({ project, onClose, onSaved, readOnly }) {
  const { user } = useAuth()
  const { confirm } = useToast()
  const isNew = !project.id
  const [f, set] = useForm({ name: '', client_id: '', type: 'Campaign', platform: '', objective: '', start_date: '', end_date: '', budget: 0, ad_spend: 0, status: 'planning',
    reach: 0, impressions: 0, clicks: 0, leads_generated: 0, conversions: 0, results_notes: '', owner_id: user.id, ...project })
  const [busy, run] = useAction()
  const save = (e) => {
    e.preventDefault()
    run(async () => {
      const p = { ...f }
      ;['id', 'created_at', 'clients'].forEach((k) => delete p[k])
      ;['budget', 'ad_spend', 'reach', 'impressions', 'clicks', 'leads_generated', 'conversions'].forEach((k) => (p[k] = Number(p[k] || 0)))
      p.start_date = p.start_date || null; p.end_date = p.end_date || null; p.owner_id = p.owner_id || null
      isNew ? await q(supabase.from('projects').insert(p)) : await q(supabase.from('projects').update(p).eq('id', project.id))
      onSaved()
    }, 'Campaign saved')
  }
  const del = async () => {
    if (!(await confirm('Delete this campaign?', { danger: true, okText: 'Delete' }))) return
    run(async () => { await q(supabase.from('projects').delete().eq('id', project.id)); onSaved() }, 'Deleted')
  }
  const ctr = f.impressions ? ((f.clicks / f.impressions) * 100).toFixed(2) + '%' : '—'
  return (
    <Modal open size="lg" onClose={onClose} title={isNew ? 'New campaign / project' : f.name}
      footer={!readOnly && <>{!isNew && <Button variant="ghost" icon={Trash2} style={{ marginRight: 'auto', color: 'var(--red)' }} onClick={del}>Delete</Button>}<Button variant="ghost" onClick={onClose}>Cancel</Button><Button form="proj" type="submit" loading={busy}>Save</Button></>}>
      <form id="proj" className="form f3" onSubmit={save}>
        <fieldset disabled={readOnly} style={{ display: 'contents' }}>
          <Field label="Name" span={2} required><Input required value={f.name} onChange={set('name')} placeholder="e.g. Onam Sale – Meta Ads" /></Field>
          <Field label="Client" required><ClientSelect value={f.client_id} onChange={set('client_id')} /></Field>
          <Field label="Type"><Select placeholder={false} options={PROJECT_TYPES} value={f.type} onChange={set('type')} /></Field>
          <Field label="Platform"><Input value={f.platform} onChange={set('platform')} placeholder="Meta, Google, YouTube…" /></Field>
          <Field label="Status"><Select placeholder={false} options={PROJECT_STATUS} value={f.status} onChange={set('status')} /></Field>
          <Field label="Start"><Input type="date" value={f.start_date} onChange={set('start_date')} /></Field>
          <Field label="End"><Input type="date" value={f.end_date} onChange={set('end_date')} /></Field>
          <Field label="Owner"><MemberSelect perm={['leads.manage', 'clients.manage']} value={f.owner_id} onChange={set('owner_id')} /></Field>
          <Field label="Objective" span={3}><Input value={f.objective} onChange={set('objective')} placeholder="Leads, awareness, store visits, sales…" /></Field>
          <Field label="Agency fee (₹)"><Input type="number" min="0" value={f.budget} onChange={set('budget')} /></Field>
          <Field label="Ad spend (₹)"><Input type="number" min="0" value={f.ad_spend} onChange={set('ad_spend')} /></Field>
          <div />
          <div className="field span-3"><h3 className="mt">Results</h3></div>
          <Field label="Reach"><Input type="number" min="0" value={f.reach} onChange={set('reach')} /></Field>
          <Field label="Impressions"><Input type="number" min="0" value={f.impressions} onChange={set('impressions')} /></Field>
          <Field label="Clicks" hint={`CTR ${ctr}`}><Input type="number" min="0" value={f.clicks} onChange={set('clicks')} /></Field>
          <Field label="Leads generated" hint={f.leads_generated > 0 ? `Cost per lead ${money(f.ad_spend / f.leads_generated)}` : ''}><Input type="number" min="0" value={f.leads_generated} onChange={set('leads_generated')} /></Field>
          <Field label="Conversions / sales"><Input type="number" min="0" value={f.conversions} onChange={set('conversions')} /></Field>
          <div />
          <Field label="Results notes" span={3}><Textarea value={f.results_notes} onChange={set('results_notes')} placeholder="What worked, best creative, learnings…" /></Field>
        </fieldset>
      </form>
    </Modal>
  )
}
