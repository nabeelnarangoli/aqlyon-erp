import { useState } from 'react'
import { UserPlus, Pencil, KeyRound, ShieldCheck } from 'lucide-react'
import { supabase, q, api } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { ROLES } from '../../lib/constants'
import { PageHeader, Button, Badge, Avatar, Card, Modal, Field, Input, Select, IconBtn, useAction, useForm } from '../../components/ui'

const ROLE_OPTS = Object.entries(ROLES).map(([id, r]) => ({ id, label: r.label }))
const ACCESS = [
  ['Dashboard', '✓', '✓', '✓', '✓'],
  ['Leads, follow-ups', '✓', '✓', '—', '—'],
  ['Clients', 'Full', 'Full', 'View', 'View'],
  ['Packages / retainers', 'Full', 'Full', '—', 'View'],
  ['Design tasks', 'Full', 'Create, review, approve', 'Work, upload proofs', '—'],
  ['Content calendar', 'Full', 'Full', 'View', '—'],
  ['Quotations', 'Full', 'Full', '—', 'Full'],
  ['Invoices', 'Full', 'View', '—', 'Full'],
  ['Payments & expenses', 'Full', '—', '—', 'Full'],
  ['Reports', 'All', 'Sales, team, content, clients', 'Own productivity', 'P&L, receivables, clients'],
  ['Team & settings', 'Full', '—', '—', '—']
]

export default function Team() {
  const { team, refresh, user } = useAuth()
  const [editing, setEditing] = useState(null)
  const [resetting, setResetting] = useState(null)
  return (
    <>
      <PageHeader title="Team & Access" subtitle="Create logins, set roles, internal cost rates and weekly capacity."
        actions={<Button icon={UserPlus} onClick={() => setEditing({})}>Add team member</Button>} />
      <Card pad={false}>
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Name</th><th>Role</th><th>Designation</th><th className="num">Cost / hour</th><th className="num">Weekly hours</th><th>Status</th><th /></tr></thead>
          <tbody>{team.map((m) => (
            <tr key={m.id}>
              <td><span className="row gap-s"><Avatar name={m.full_name} url={m.avatar_url} size={32} /><span><b>{m.full_name}</b>{m.id === user.id && <span className="tiny faint"> (you)</span>}<div className="cell-sub">{m.email}</div></span></span></td>
              <td><Badge tone={ROLES[m.role]?.tone}>{ROLES[m.role]?.label}</Badge></td>
              <td>{m.designation || '—'}</td>
              <td className="num">₹{Number(m.cost_per_hour || 0).toLocaleString('en-IN')}</td>
              <td className="num">{m.weekly_hours}</td>
              <td>{m.active ? <Badge tone="green">Active</Badge> : <Badge tone="red">Disabled</Badge>}</td>
              <td className="nowrap"><IconBtn icon={Pencil} title="Edit" onClick={() => setEditing(m)} /><IconBtn icon={KeyRound} title="Reset password" onClick={() => setResetting(m)} /></td>
            </tr>))}</tbody>
        </table></div>
      </Card>
      <Card className="mt" title={<span className="row gap-s"><ShieldCheck size={16} />What each role can do</span>} pad={false}>
        <div className="table-wrap"><table className="table small">
          <thead><tr><th>Area</th><th>Admin</th><th>Digital Marketer</th><th>Graphic Designer</th><th>Finance</th></tr></thead>
          <tbody>{ACCESS.map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i} className={i === 0 ? 'strong' : c === '—' ? 'faint' : ''}>{c}</td>)}</tr>)}</tbody>
        </table></div>
        <p className="small faint card-body">Permissions are enforced by the database itself (row-level security), not just hidden in the menu.</p>
      </Card>
      {editing && <MemberModal member={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh() }} />}
      {resetting && <ResetModal member={resetting} onClose={() => setResetting(null)} />}
    </>
  )
}

function MemberModal({ member, onClose, onSaved }) {
  const { user } = useAuth()
  const isNew = !member.id
  const [f, set] = useForm({ full_name: '', email: '', password: '', phone: '', role: 'designer', designation: '', cost_per_hour: 0, weekly_hours: 48, active: true, ...member })
  const [busy, run] = useAction()
  const save = (e) => { e.preventDefault(); run(async () => {
    if (isNew) {
      if ((f.password || '').length < 8) throw new Error('Password must be at least 8 characters')
      await api('admin-users', { action: 'create', email: f.email.trim(), password: f.password, full_name: f.full_name, role: f.role,
        profile: { phone: f.phone || null, designation: f.designation || null, cost_per_hour: Number(f.cost_per_hour || 0), weekly_hours: Number(f.weekly_hours || 48) } })
    } else {
      if (member.id === user.id && (f.role !== 'admin' || !f.active)) throw new Error('You cannot remove your own admin access')
      await q(supabase.from('profiles').update({ full_name: f.full_name, phone: f.phone || null, role: f.role, designation: f.designation || null,
        cost_per_hour: Number(f.cost_per_hour || 0), weekly_hours: Number(f.weekly_hours || 48), active: !!f.active }).eq('id', member.id))
    }
    onSaved()
  }, isNew ? 'Team member added — share their email and password with them' : 'Saved') }
  return (
    <Modal open size="md" onClose={onClose} title={isNew ? 'Add team member' : `Edit ${member.full_name}`}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button form="mem" type="submit" loading={busy}>{isNew ? 'Create login' : 'Save'}</Button></>}>
      <form id="mem" className="form" onSubmit={save}>
        <Field label="Full name" required><Input required value={f.full_name} onChange={set('full_name')} /></Field>
        <Field label="Role"><Select placeholder={false} options={ROLE_OPTS} value={f.role} onChange={set('role')} /></Field>
        {isNew && <Field label="Login email" required><Input type="email" required value={f.email} onChange={set('email')} /></Field>}
        {isNew && <Field label="Temporary password" required hint="Min 8 characters"><Input type="text" required value={f.password} onChange={set('password')} /></Field>}
        <Field label="Designation"><Input value={f.designation} onChange={set('designation')} placeholder="Senior Graphic Designer" /></Field>
        <Field label="Phone"><Input value={f.phone} onChange={set('phone')} /></Field>
        <Field label="Internal cost per hour (₹)" hint="Salary ÷ monthly hours — for profitability"><Input type="number" min="0" value={f.cost_per_hour} onChange={set('cost_per_hour')} /></Field>
        <Field label="Weekly capacity (hours)"><Input type="number" min="1" value={f.weekly_hours} onChange={set('weekly_hours')} /></Field>
        {!isNew && <label className="check"><input type="checkbox" checked={!!f.active} onChange={(e) => set('active')(e.target.checked)} />Active (untick to block login)</label>}
      </form>
    </Modal>
  )
}

function ResetModal({ member, onClose }) {
  const [pw, setPw] = useState('')
  const [busy, run] = useAction()
  const save = () => run(async () => {
    if (pw.length < 8) throw new Error('Min 8 characters')
    await api('admin-users', { action: 'set_password', user_id: member.id, password: pw })
    onClose()
  }, 'Password updated')
  return (
    <Modal open size="sm" onClose={onClose} title={`Reset password · ${member.full_name}`}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={save}>Set password</Button></>}>
      <Field label="New password"><Input value={pw} onChange={(e) => setPw(e.target.value)} autoFocus /></Field>
    </Modal>
  )
}
