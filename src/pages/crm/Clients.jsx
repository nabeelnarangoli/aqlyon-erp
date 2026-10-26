import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Download, Building2 } from 'lucide-react'
import { supabase, q } from '../../lib/supabase'
import { useData } from '../../lib/hooks'
import { useAuth } from '../../lib/auth'
import { CLIENT_STATUS, INDUSTRIES } from '../../lib/constants'
import { money, downloadCSV, date } from '../../lib/format'
import {
  PageHeader, Button, StatusBadge, Member, Modal, Field, Input, Select, Textarea, MemberSelect, SearchInput,
  Loading, ErrorBox, Empty, useAction, useForm, invalidateClients
} from '../../components/ui'

export default function Clients() {
  const { has } = useAuth()
  const nav = useNavigate()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('active')
  const [am, setAm] = useState('')
  const [adding, setAdding] = useState(false)
  const { data, loading, error, reload } = useData(async () => {
    const [clients, packs, tasks] = await Promise.all([
      q(supabase.from('clients').select('*').order('name')),
      has('packages.view', 'packages.manage') ? q(supabase.from('packages').select('client_id, fee, billing_type, status').eq('status', 'active')) : [],
      has('tasks.view', 'tasks.work', 'tasks.manage') ? q(supabase.from('design_tasks').select('client_id, status').not('status', 'in', '(delivered,cancelled)')) : []
    ])
    return clients.map((c) => ({
      ...c,
      mrr: packs.filter((p) => p.client_id === c.id).reduce((a, p) => a + monthly(p), 0),
      openTasks: tasks.filter((t) => t.client_id === c.id).length
    }))
  }, [], [])

  const rows = useMemo(() => data.filter((c) => {
    const s = search.toLowerCase()
    return (!s || [c.name, c.contact_person, c.phone, c.code, c.city, c.industry].some((v) => v?.toLowerCase().includes(s)))
      && (!status || c.status === status) && (!am || c.account_manager_id === am)
  }), [data, search, status, am])
  const totalMrr = rows.reduce((a, c) => a + c.mrr, 0)

  return (
    <>
      <PageHeader title="Clients" subtitle={`${rows.length} clients${has('packages.view', 'packages.manage') ? ` · ${money(totalMrr)} monthly recurring` : ''}`}
        actions={<>
          <Button variant="outline" icon={Download} onClick={() => downloadCSV('clients.csv', rows.map((c) => ({ code: c.code, name: c.name, contact: c.contact_person, phone: c.phone, email: c.email, city: c.city, industry: c.industry, status: c.status, monthly_fee: c.mrr })))}>Export</Button>
          {has('clients.manage') && <Button icon={Plus} onClick={() => setAdding(true)}>New client</Button>}
        </>} />
      <div className="filters">
        <SearchInput value={search} onChange={setSearch} placeholder="Search clients…" />
        <Select options={CLIENT_STATUS} value={status} onChange={(v) => setStatus(v || '')} placeholder="All statuses" />
        <MemberSelect perm={['leads.manage', 'clients.manage']} value={am} onChange={(v) => setAm(v || '')} placeholder="All account managers" />
      </div>
      <ErrorBox error={error} onRetry={reload} />
      {loading ? <Loading /> : rows.length === 0 ? <Empty icon={Building2} title="No clients found">Convert a won lead or add a client directly.</Empty> : (
        <div className="card table-wrap">
          <table className="table">
            <thead><tr><th>Client</th><th>Contact</th><th>Industry</th><th>Status</th><th>Account manager</th>{has('tasks.view', 'tasks.work', 'tasks.manage') && <th className="num">Open tasks</th>}{has('packages.view', 'packages.manage') && <th className="num">Monthly fee</th>}<th>Since</th></tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="click" onClick={() => nav(`/clients/${c.id}`)}>
                  <td><div className="cell-title">{c.name}</div><div className="cell-sub">{c.code}{c.city ? ` · ${c.city}` : ''}</div></td>
                  <td><div>{c.contact_person || '—'}</div><div className="cell-sub">{c.phone}</div></td>
                  <td>{c.industry || '—'}</td>
                  <td><StatusBadge list={CLIENT_STATUS} value={c.status} /></td>
                  <td><Member id={c.account_manager_id} size={22} /></td>
                  {has('tasks.view', 'tasks.work', 'tasks.manage') && <td className="num">{c.openTasks || '—'}</td>}
                  {has('packages.view', 'packages.manage') && <td className="num">{c.mrr ? money(c.mrr) : '—'}</td>}
                  <td className="nowrap">{date(c.onboarded_on)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {adding && <ClientModal onClose={() => setAdding(false)} onSaved={(c) => { setAdding(false); nav(`/clients/${c.id}`) }} />}
    </>
  )
}

export const monthly = (p) => {
  const f = Number(p.fee || 0)
  return p.billing_type === 'quarterly' ? f / 3 : p.billing_type === 'yearly' ? f / 12 : p.billing_type === 'one_time' ? 0 : f
}

export function ClientModal({ client = {}, onClose, onSaved }) {
  const { user } = useAuth()
  const isNew = !client.id
  const [f, set] = useForm({
    name: '', contact_person: '', phone: '', whatsapp: '', email: '', address: '', city: 'Koyilandy', industry: '', website: '', instagram: '',
    facebook: '', linkedin: '', youtube: '', other_links: '', account_manager_id: user.id, status: 'active', brand_colors: '', brand_fonts: '',
    brand_tone: '', brand_assets_link: '', target_audience: '', notes: '', onboarded_on: new Date().toISOString().slice(0, 10), ...client
  })
  const [busy, run] = useAction()
  const save = (e) => {
    e.preventDefault()
    run(async () => {
      const p = { ...f }
      ;['id', 'created_at', 'updated_at', 'created_by', 'code', 'mrr', 'openTasks'].forEach((k) => delete p[k])
      p.account_manager_id = p.account_manager_id || null
      const row = isNew ? await q(supabase.from('clients').insert(p).select().single()) : await q(supabase.from('clients').update(p).eq('id', client.id).select().single())
      invalidateClients(); onSaved(row)
    }, isNew ? 'Client created' : 'Client updated')
  }
  return (
    <Modal open size="lg" onClose={onClose} title={isNew ? 'New client' : `Edit ${client.name}`}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button form="client-form" type="submit" loading={busy}>{isNew ? 'Create client' : 'Save'}</Button></>}>
      <form id="client-form" className="form" onSubmit={save}>
        <Field label="Brand / business name" required><Input required value={f.name} onChange={set('name')} /></Field>
        <Field label="Contact person"><Input value={f.contact_person} onChange={set('contact_person')} /></Field>
        <Field label="Phone"><Input value={f.phone} onChange={set('phone')} /></Field>
        <Field label="WhatsApp"><Input value={f.whatsapp} onChange={set('whatsapp')} /></Field>
        <Field label="Email"><Input type="email" value={f.email} onChange={set('email')} /></Field>
        <Field label="City"><Input value={f.city} onChange={set('city')} /></Field>
        <Field label="Address" span={2}><Input value={f.address} onChange={set('address')} /></Field>
        <Field label="Industry"><Select options={INDUSTRIES} value={f.industry} onChange={set('industry')} /></Field>
        <Field label="Status"><Select placeholder={false} options={CLIENT_STATUS} value={f.status} onChange={set('status')} /></Field>
        <Field label="Account manager"><MemberSelect perm={['leads.manage', 'clients.manage']} value={f.account_manager_id} onChange={set('account_manager_id')} /></Field>
        <Field label="Client since"><Input type="date" value={f.onboarded_on} onChange={set('onboarded_on')} /></Field>
        <div className="field span-2"><h3 className="mt">Online presence</h3></div>
        <Field label="Instagram"><Input value={f.instagram} onChange={set('instagram')} placeholder="@handle or URL" /></Field>
        <Field label="Facebook"><Input value={f.facebook} onChange={set('facebook')} /></Field>
        <Field label="Website"><Input value={f.website} onChange={set('website')} /></Field>
        <Field label="YouTube"><Input value={f.youtube} onChange={set('youtube')} /></Field>
        <Field label="LinkedIn"><Input value={f.linkedin} onChange={set('linkedin')} /></Field>
        <Field label="Other links"><Input value={f.other_links} onChange={set('other_links')} placeholder="Google Business, Threads…" /></Field>
        <div className="field span-2"><h3 className="mt">Brand kit (designers see this on every task)</h3></div>
        <Field label="Brand colours" hint="e.g. #1BA76A, #1E0203"><Input value={f.brand_colors} onChange={set('brand_colors')} /></Field>
        <Field label="Brand fonts"><Input value={f.brand_fonts} onChange={set('brand_fonts')} /></Field>
        <Field label="Tone of voice"><Input value={f.brand_tone} onChange={set('brand_tone')} placeholder="Friendly, premium, family…" /></Field>
        <Field label="Logo & assets folder link"><Input value={f.brand_assets_link} onChange={set('brand_assets_link')} placeholder="Google Drive link" /></Field>
        <Field label="Target audience" span={2}><Textarea rows={2} value={f.target_audience} onChange={set('target_audience')} /></Field>
        <Field label="Internal notes" span={2}><Textarea value={f.notes} onChange={set('notes')} /></Field>
      </form>
    </Modal>
  )
}
