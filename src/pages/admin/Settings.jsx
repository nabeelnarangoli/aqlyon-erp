import { useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { supabase, q } from '../../lib/supabase'
import { useData } from '../../lib/hooks'
import { useAuth } from '../../lib/auth'
import { money } from '../../lib/format'
import { PageHeader, Button, Card, Tabs, Field, Input, Textarea, Select, Modal, Badge, IconBtn, Loading, useAction, useForm, useToast } from '../../components/ui'

import RichText from '../../components/RichText'
import { QUOTE_TERMS, PROPOSAL_INTRO, CLIENT_RESPONSIBILITIES, PROPOSAL_EXCLUSIONS, PROPOSAL_ACCEPTANCE } from '../../lib/proposal'

const CATS = ['Social Media', 'Design', 'Video', 'Ads', 'SEO', 'Web', 'Branding', 'Photography', 'Content', 'Other']

export default function Settings() {
  const [tab, setTab] = useState('company')
  return (
    <>
      <PageHeader title="Settings" subtitle="Company details printed on invoices, numbering and your service price list." />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'company', label: 'Company & invoices' }, { id: 'proposal', label: 'Quotation & proposal' }, { id: 'services', label: 'Services & pricing' }]} />
      {tab === 'company' ? <Company /> : tab === 'proposal' ? <Proposal /> : <Services />}
    </>
  )
}

function Company() {
  const { settings, refresh } = useAuth()
  const [f, set] = useForm(settings || {})
  const [busy, run] = useAction()
  const save = (e) => { e.preventDefault(); run(async () => {
    const p = { ...f, default_max_revisions: Number(f.default_max_revisions ?? 2), approval_hours: Number(f.approval_hours || 24), updated_at: new Date().toISOString() }
    delete p.id
    await q(supabase.from('settings').update(p).eq('id', 1)); refresh()
  }, 'Settings saved') }
  return (
    <form onSubmit={save} className="grid g2">
      <Card title="Company">
        <div className="form f1">
          <Field label="Company name"><Input value={f.company_name} onChange={set('company_name')} /></Field>
          <Field label="Address"><Textarea rows={3} value={f.address} onChange={set('address')} /></Field>
          <Field label="Phone"><Input value={f.phone} onChange={set('phone')} /></Field>
          <Field label="Email"><Input value={f.email} onChange={set('email')} /></Field>
          <Field label="Website"><Input value={f.website} onChange={set('website')} /></Field>
        </div>
      </Card>
      <div className="grid" style={{ alignContent: 'start' }}>
        <Card title="Invoicing">
          <div className="form">
            <Field label="Invoice prefix" hint="e.g. AQB-INV → AQB-INV-2026-0001"><Input value={f.invoice_prefix} onChange={set('invoice_prefix')} /></Field>
            <Field label="Quotation prefix"><Input value={f.quote_prefix} onChange={set('quote_prefix')} /></Field>
            <Field label="UPI ID"><Input value={f.upi_id} onChange={set('upi_id')} placeholder="aqlyon@upi" /></Field>
            <Field label="Task code prefix"><Input value={f.task_prefix} onChange={set('task_prefix')} /></Field>
            <Field label="Bank details" span={2}><Textarea rows={4} value={f.bank_details} onChange={set('bank_details')} placeholder={'Account name\nBank & branch\nA/c no.\nIFSC'} /></Field>
            <Field label="Default invoice terms" span={2}><Textarea rows={2} value={f.invoice_terms} onChange={set('invoice_terms')} /></Field>
          </div>
        </Card>
        <Card title="Design workflow">
          <div className="form">
            <Field label="Revisions included by default per task" hint="Your proposal says 2 per creative"><Input type="number" step="any" min="0" value={f.default_max_revisions} onChange={set('default_max_revisions')} /></Field>
            <Field label="Client approval window (hours)" hint="Shown on the client approval page"><Input type="number" step="any" min="1" value={f.approval_hours ?? 24} onChange={set('approval_hours')} /></Field>
          </div>
        </Card>
        <div className="row" style={{ justifyContent: 'flex-end' }}><Button type="submit" loading={busy}>Save settings</Button></div>
      </div>
    </form>
  )
}

// the standard commercial proposal: every new quotation starts from this text
function Proposal() {
  const { settings, refresh } = useAuth()
  const [f, set] = useForm({
    proposal_intro: settings?.proposal_intro ?? PROPOSAL_INTRO, client_responsibilities: settings?.client_responsibilities ?? CLIENT_RESPONSIBILITIES,
    proposal_exclusions: settings?.proposal_exclusions ?? PROPOSAL_EXCLUSIONS, quote_terms: settings?.quote_terms ?? QUOTE_TERMS, proposal_acceptance: settings?.proposal_acceptance ?? PROPOSAL_ACCEPTANCE
  })
  const [busy, run] = useAction()
  const save = (e) => { e.preventDefault(); run(async () => { await q(supabase.from('settings').update({ ...f, updated_at: new Date().toISOString() }).eq('id', 1)); refresh() }, 'Proposal text saved') }
  const hint = 'Format: ## Heading · - bullet · **bold**'
  return (
    <form onSubmit={save} className="grid">
      <p className="small muted" style={{ margin: 0 }}>Every new quotation starts with this text. A quotation can switch it off (short quote) or change it for that client only. Existing quotations keep what they were sent with.</p>
      <div className="grid g2">
        <Card title="About us & objectives (top of the proposal)"><Field hint={hint}><Textarea rows={16} value={f.proposal_intro} onChange={set('proposal_intro')} /></Field></Card>
        <div className="grid" style={{ alignContent: 'start' }}>
          <Card title="Client responsibilities"><Field hint={hint}><Textarea rows={7} value={f.client_responsibilities} onChange={set('client_responsibilities')} /></Field></Card>
          <Card title="Not included"><Field hint={hint}><Textarea rows={5} value={f.proposal_exclusions} onChange={set('proposal_exclusions')} /></Field></Card>
        </div>
      </div>
      <div className="grid g2">
        <Card title="Terms & conditions"><Field hint={hint}><Textarea rows={22} value={f.quote_terms} onChange={set('quote_terms')} /></Field></Card>
        <div className="grid" style={{ alignContent: 'start' }}>
          <Card title="Preview"><div className="small" style={{ maxHeight: 420, overflow: 'auto' }}><RichText text={f.quote_terms} numbered /></div></Card>
          <Card title="Acceptance (above the signature lines)"><Textarea rows={5} value={f.proposal_acceptance} onChange={set('proposal_acceptance')} /></Card>
        </div>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end' }}><Button type="submit" loading={busy}>Save proposal text</Button></div>
    </form>
  )
}

function Services() {
  const [editing, setEditing] = useState(null)
  const { data, loading, reload } = useData(() => q(supabase.from('services').select('*').order('category').order('name')), [], [])
  if (loading) return <Loading />
  return (
    <Card title="Service catalogue" actions={<Button size="sm" icon={Plus} onClick={() => setEditing({})}>Add service</Button>} pad={false}>
      <div className="table-wrap"><table className="table">
        <thead><tr><th>Service</th><th>Category</th><th>Unit</th><th className="num">Rate</th><th>Status</th><th /></tr></thead>
        <tbody>{data.map((s) => (
          <tr key={s.id}><td className="cell-title">{s.name}<div className="cell-sub">{s.description}</div></td><td>{s.category}</td><td>{s.unit}</td><td className="num">{Number(s.rate) ? money(s.rate) : <span className="faint">Quote per job</span>}</td>
            <td>{s.active ? <Badge tone="green">Active</Badge> : <Badge tone="slate">Hidden</Badge>}</td><td><IconBtn icon={Pencil} title="Edit" onClick={() => setEditing(s)} /></td></tr>))}</tbody>
      </table></div>
      {editing && <ServiceModal svc={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload() }} />}
    </Card>
  )
}

function ServiceModal({ svc, onClose, onSaved }) {
  const isNew = !svc.id
  const { confirm } = useToast()
  const [f, set] = useForm({ name: '', category: 'Design', unit: 'per item', rate: 0, description: '', active: true, ...svc })
  const [busy, run] = useAction()
  const save = (e) => { e.preventDefault(); run(async () => {
    const p = { name: f.name, category: f.category, unit: f.unit, rate: Number(f.rate || 0), description: f.description || null, active: !!f.active }
    isNew ? await q(supabase.from('services').insert(p)) : await q(supabase.from('services').update(p).eq('id', svc.id)); onSaved()
  }, 'Saved') }
  const del = async () => { if (await confirm('Delete this service?', { danger: true, okText: 'Delete' })) run(async () => { await q(supabase.from('services').delete().eq('id', svc.id)); onSaved() }) }
  return (
    <Modal open size="sm" onClose={onClose} title={isNew ? 'Add service' : 'Edit service'}
      footer={<>{!isNew && <IconBtn icon={Trash2} title="Delete" onClick={del} />}<div className="grow" /><Button variant="ghost" onClick={onClose}>Cancel</Button><Button form="svc" type="submit" loading={busy}>Save</Button></>}>
      <form id="svc" className="form f1" onSubmit={save}>
        <Field label="Name" required><Input required value={f.name} onChange={set('name')} /></Field>
        <Field label="Category"><Select placeholder={false} options={CATS} value={f.category} onChange={set('category')} /></Field>
        <Field label="Unit"><Select placeholder={false} options={['per item', 'per month', 'per project', 'per hour', 'per day', 'per event', 'per 1,000 contacts']} value={f.unit} onChange={set('unit')} /></Field>
        <Field label="Rate (₹)"><Input type="number" step="any" min="0" value={f.rate} onChange={set('rate')} /></Field>
        <Field label="Description"><Textarea rows={2} value={f.description} onChange={set('description')} /></Field>
        <label className="check"><input type="checkbox" checked={!!f.active} onChange={(e) => set('active')(e.target.checked)} />Show in quotation/invoice picker</label>
      </form>
    </Modal>
  )
}
