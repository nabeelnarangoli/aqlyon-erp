import { useMemo, useState } from 'react'
import { UserPlus, Pencil, KeyRound, ShieldCheck, Plus, Copy, Trash2, Lock, Users } from 'lucide-react'
import { supabase, q, api } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useData } from '../../lib/hooks'
import { PERMISSION_GROUPS, ROLE_COLORS } from '../../lib/permissions'
import { money } from '../../lib/format'
import { PageHeader, Button, Badge, Avatar, Card, Modal, Field, Input, Select, Textarea, IconBtn, Tabs, useAction, useForm, useToast, cx } from '../../components/ui'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const hoursBetween = (a, b) => {
  const [h1, m1] = String(a || '09:30').split(':').map(Number), [h2, m2] = String(b || '18:30').split(':').map(Number)
  return Math.max(0, (h2 * 60 + m2 - (h1 * 60 + m1)) / 60)
}
const fmtTime = (t) => { if (!t) return ''; const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}` }
const costPerHour = (salary, days, start, end) => {
  const monthly = (days?.length || 0) * hoursBetween(start, end) * 52 / 12
  return monthly && Number(salary) > 0 ? Math.round((Number(salary) / monthly) * 100) / 100 : 0
}

export default function Team() {
  const [tab, setTab] = useState('users')
  const { team, roles } = useAuth()
  return (
    <>
      <PageHeader title="Team & Access" subtitle="Create logins, build roles from permissions, and record salary and working hours." />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'users', label: 'Users', icon: Users, count: team.length }, { id: 'roles', label: 'Roles & permissions', icon: ShieldCheck, count: roles.length }]} />
      {tab === 'users' ? <UsersTab /> : <RolesTab />}
    </>
  )
}

/* ============================== USERS ============================== */
function UsersTab() {
  const { team, roleOf, refresh, user } = useAuth()
  const [editing, setEditing] = useState(null)
  const [resetting, setResetting] = useState(null)
  const pay = useData(() => q(supabase.from('staff_pay').select('*')), [team.length], [])
  const salaryOf = (id) => pay.data.find((p) => p.user_id === id)
  const payroll = pay.data.filter((p) => team.find((m) => m.id === p.user_id)?.active).reduce((a, p) => a + Number(p.monthly_salary || 0), 0)
  return (
    <>
      <div className="row between mb wrap gap-s">
        <p className="muted">{team.filter((m) => m.active).length} active users · monthly payroll {money(payroll)}</p>
        <Button icon={UserPlus} onClick={() => setEditing({})}>Add user</Button>
      </div>
      <Card pad={false}>
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Name</th><th>Role</th><th>Working days & hours</th><th className="num">Monthly salary</th><th className="num">Cost / hour</th><th>Status</th><th /></tr></thead>
          <tbody>{team.map((m) => {
            const r = roleOf(m.role_id), sp = salaryOf(m.id)
            const hrs = hoursBetween(m.work_start, m.work_end)
            return (
              <tr key={m.id}>
                <td><span className="row gap-s"><Avatar name={m.full_name} url={m.avatar_url} size={32} /><span><b>{m.full_name}</b>{m.id === user.id && <span className="tiny faint"> (you)</span>}<div className="cell-sub">{m.designation || m.email}</div></span></span></td>
                <td>{r ? <Badge tone={r.color}>{r.name}</Badge> : <Badge tone="red">No role</Badge>}</td>
                <td className="small"><div>{(m.work_days || []).join(', ') || '—'}</div><div className="faint">{fmtTime(m.work_start)} – {fmtTime(m.work_end)} · {hrs.toFixed(1).replace(/\.0$/, '')}h/day · {Math.round((m.work_days?.length || 0) * hrs)}h/week</div></td>
                <td className="num">{sp?.monthly_salary ? money(sp.monthly_salary) : <span className="faint">—</span>}</td>
                <td className="num">{sp?.cost_per_hour ? `₹${Number(sp.cost_per_hour).toLocaleString('en-IN')}` : <span className="faint">—</span>}</td>
                <td>{m.active ? <Badge tone="green">Active</Badge> : <Badge tone="red">Disabled</Badge>}</td>
                <td className="nowrap"><IconBtn icon={Pencil} title="Edit" onClick={() => setEditing({ ...m, monthly_salary: sp?.monthly_salary || '' })} /><IconBtn icon={KeyRound} title="Reset password" onClick={() => setResetting(m)} /></td>
              </tr>
            )
          })}</tbody>
        </table></div>
      </Card>
      <p className="small faint mt">Salaries are private: only people whose role includes “Manage users and roles” can see them. Cost per hour is worked out from salary, working days and hours, and feeds client profitability reports.</p>
      {editing && <UserModal member={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); pay.reload() }} />}
      {resetting && <ResetModal member={resetting} onClose={() => setResetting(null)} />}
    </>
  )
}

function UserModal({ member, onClose, onSaved }) {
  const { user, roles, isAdmin } = useAuth()
  const isNew = !member.id
  const defaultRole = roles.find((r) => !r.permissions.includes('*'))?.id || ''
  const [f, set, setF] = useForm({ full_name: '', email: '', password: '', phone: '', role_id: defaultRole, designation: '', active: true,
    work_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], work_start: '09:30', work_end: '18:30', joined_on: '', monthly_salary: '', ...member,
    work_start: (member.work_start || '09:30').slice(0, 5), work_end: (member.work_end || '18:30').slice(0, 5) })
  const [busy, run] = useAction()
  const hrs = hoursBetween(f.work_start, f.work_end)
  const weekly = Math.round((f.work_days?.length || 0) * hrs * 10) / 10
  const cph = costPerHour(f.monthly_salary, f.work_days, f.work_start, f.work_end)
  const roleChoices = roles.filter((r) => isAdmin || !r.permissions.includes('*') || r.id === f.role_id)
  const toggleDay = (d) => setF((s) => ({ ...s, work_days: s.work_days.includes(d) ? s.work_days.filter((x) => x !== d) : DAYS.filter((x) => [...s.work_days, d].includes(x)) }))

  const save = (e) => { e.preventDefault(); run(async () => {
    if (!f.role_id) throw new Error('Choose a role')
    if (!f.work_days.length) throw new Error('Pick at least one working day')
    if (hrs <= 0) throw new Error('Work end time must be after start time')
    const profile = { phone: f.phone || null, designation: f.designation || null, weekly_hours: weekly, work_days: f.work_days, work_start: f.work_start, work_end: f.work_end, joined_on: f.joined_on || null }
    if (isNew) {
      if ((f.password || '').length < 8) throw new Error('Password must be at least 8 characters')
      await api('admin-users', { action: 'create', email: f.email.trim(), password: f.password, full_name: f.full_name, role_id: f.role_id, profile, monthly_salary: Number(f.monthly_salary || 0) })
    } else {
      const adminRole = roles.find((r) => r.permissions.includes('*'))
      if (member.id === user.id && (f.role_id !== adminRole?.id || !f.active) && member.role_id === adminRole?.id) throw new Error('You cannot remove your own Administrator access')
      await q(supabase.from('profiles').update({ full_name: f.full_name, role_id: f.role_id, active: !!f.active, ...profile }).eq('id', member.id))
      await q(supabase.from('staff_pay').upsert({ user_id: member.id, monthly_salary: Number(f.monthly_salary || 0) }))
    }
    onSaved()
  }, isNew ? 'User created — share their login details with them' : 'Saved') }

  return (
    <Modal open size="lg" onClose={onClose} title={isNew ? 'Add user' : `Edit ${member.full_name}`}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button form="usr" type="submit" loading={busy}>{isNew ? 'Create user' : 'Save'}</Button></>}>
      <form id="usr" className="form" onSubmit={save}>
        <Field label="Full name" required><Input required value={f.full_name} onChange={set('full_name')} /></Field>
        <Field label="Role" required hint="Build roles in the Roles & permissions tab"><Select options={roleChoices.map((r) => ({ id: r.id, label: r.name }))} value={f.role_id} onChange={set('role_id')} placeholder="Choose a role…" /></Field>
        {isNew && <Field label="Login email" required><Input type="email" required value={f.email} onChange={set('email')} /></Field>}
        {isNew && <Field label="Temporary password" required hint="Min 8 characters"><Input type="text" required value={f.password} onChange={set('password')} /></Field>}
        <Field label="Designation"><Input value={f.designation} onChange={set('designation')} placeholder="Senior Graphic Designer" /></Field>
        <Field label="Phone"><Input value={f.phone} onChange={set('phone')} /></Field>
        <Field label="Joined on"><Input type="date" value={f.joined_on} onChange={set('joined_on')} /></Field>
        <Field label="Monthly salary (₹)" hint={cph ? `Cost per hour ≈ ₹${cph.toLocaleString('en-IN')} (salary ÷ ${Math.round(weekly * 52 / 12)} working hours a month)` : 'Private — used to work out cost per hour'}>
          <Input type="number" min="0" value={f.monthly_salary} onChange={set('monthly_salary')} placeholder="25000" />
        </Field>
        <div className="field span-2">
          <span className="field-label">Working days</span>
          <div className="chips">{DAYS.map((d) => <button type="button" key={d} className={cx('chip', f.work_days.includes(d) && 'on')} onClick={() => toggleDay(d)}>{d}</button>)}</div>
        </div>
        <Field label="Work starts"><Input type="time" value={f.work_start} onChange={set('work_start')} /></Field>
        <Field label="Work ends" hint={`${hrs.toFixed(1).replace(/\.0$/, '')} h/day · ${weekly} h/week`}><Input type="time" value={f.work_end} onChange={set('work_end')} /></Field>
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

/* ============================== ROLES ============================== */
function RolesTab() {
  const { roles, team, refresh } = useAuth()
  const [editing, setEditing] = useState(null)
  const count = (id) => team.filter((m) => m.role_id === id).length
  return (
    <>
      <div className="row between mb wrap gap-s">
        <p className="muted">Create a role, tick what it can see and do, then assign it to users. Changes apply the next time they open a page.</p>
        <Button icon={Plus} onClick={() => setEditing({})}>New role</Button>
      </div>
      <div className="grid g3">
        {roles.map((r) => {
          const all = r.permissions.includes('*')
          return (
            <Card key={r.id} title={<span className="row gap-s"><Badge tone={r.color}>{r.name}</Badge>{all && <Lock size={13} className="faint" />}</span>}
              actions={<><IconBtn icon={Copy} title="Duplicate" onClick={() => setEditing({ ...r, id: undefined, key: undefined, name: `${r.name} (copy)`, is_system: false, permissions: all ? [] : r.permissions })} />
                {!all && <IconBtn icon={Pencil} title="Edit" onClick={() => setEditing(r)} />}</>}>
              <p className="small muted" style={{ minHeight: 20 }}>{r.description || '—'}</p>
              <div className="row between small mt"><span className="muted">{count(r.id)} user{count(r.id) === 1 ? '' : 's'}</span><span className="muted">{all ? 'Everything' : `${r.permissions.length} permissions`}</span></div>
              {!all && <div className="row gap-xs wrap mt">{PERMISSION_GROUPS.map((g) => {
                const n = g.perms.filter(([k]) => r.permissions.includes(k)).length
                return n ? <Badge key={g.id} tone="slate">{g.label} {n}/{g.perms.length}</Badge> : null
              })}</div>}
            </Card>
          )
        })}
      </div>
      <PermissionMatrix />
      {editing && <RoleModal role={editing} users={editing.id ? count(editing.id) : 0} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh() }} />}
    </>
  )
}

function PermissionMatrix() {
  const { roles } = useAuth()
  if (!roles.length) return null
  return (
    <Card className="mt-l" title="Permission overview" pad={false}>
      <div className="table-wrap"><table className="table small">
        <thead><tr><th>Permission</th>{roles.map((r) => <th key={r.id} className="center">{r.name}</th>)}</tr></thead>
        <tbody>{PERMISSION_GROUPS.map((g) => [
          <tr key={g.id}><td colSpan={roles.length + 1} style={{ background: 'var(--surface-2)', fontWeight: 700, color: 'var(--ink)' }}>{g.label}</td></tr>,
          ...g.perms.map(([k, label]) => (
            <tr key={k}><td>{label}</td>{roles.map((r) => <td key={r.id} className="center">{r.permissions.includes('*') || r.permissions.includes(k) ? <span style={{ color: 'var(--green-d)', fontWeight: 700 }}>✓</span> : <span className="faint">—</span>}</td>)}</tr>
          ))
        ])}</tbody>
      </table></div>
    </Card>
  )
}

function RoleModal({ role, users, onClose, onSaved }) {
  const { confirm } = useToast()
  const isNew = !role.id
  const [f, set, setF] = useForm({ name: '', description: '', color: 'blue', permissions: [], ...role })
  const [busy, run] = useAction()
  const sel = useMemo(() => new Set(f.permissions), [f.permissions])
  const toggle = (k) => setF((s) => ({ ...s, permissions: sel.has(k) ? s.permissions.filter((x) => x !== k) : [...s.permissions, k] }))
  const toggleGroup = (g) => {
    const keys = g.perms.map(([k]) => k), allOn = keys.every((k) => sel.has(k))
    setF((s) => ({ ...s, permissions: allOn ? s.permissions.filter((x) => !keys.includes(x)) : [...new Set([...s.permissions, ...keys])] }))
  }
  // sensible pairings: "manage" implies "view"
  const imply = (perms) => {
    const out = new Set(perms)
    for (const p of perms) {
      const [mod, act] = p.split('.')
      if (['manage', 'pay'].includes(act) && [`${mod}.view`].some((v) => PERMISSION_GROUPS.some((g) => g.perms.some(([k]) => k === v)))) out.add(`${mod}.view`)
      if (p === 'tasks.review') out.add('tasks.view')
    }
    return [...out]
  }
  const save = (e) => { e.preventDefault(); run(async () => {
    if (!f.name.trim()) throw new Error('Give the role a name')
    if (!f.permissions.length) throw new Error('Tick at least one permission')
    const p = { name: f.name.trim(), description: f.description || null, color: f.color, permissions: imply(f.permissions) }
    isNew ? await q(supabase.from('roles').insert(p)) : await q(supabase.from('roles').update(p).eq('id', role.id))
    onSaved()
  }, isNew ? 'Role created' : 'Role updated') }
  const del = async () => {
    if (users) { await confirm(`${users} user(s) have this role. Move them to another role first.`, { title: 'Role in use', okText: 'OK' }); return }
    if (!(await confirm(`Delete the role "${role.name}"?`, { danger: true, okText: 'Delete' }))) return
    run(async () => { await q(supabase.from('roles').delete().eq('id', role.id)); onSaved() }, 'Role deleted')
  }
  return (
    <Modal open size="lg" onClose={onClose} title={isNew ? 'New role' : `Edit role · ${role.name}`} subtitle={!isNew && users ? `${users} user(s) have this role — changes apply to all of them` : undefined}
      footer={<>{!isNew && <Button variant="ghost" icon={Trash2} style={{ marginRight: 'auto', color: 'var(--red)' }} onClick={del}>Delete</Button>}
        <span className="muted small" style={{ marginRight: 'auto' }}>{f.permissions.length} selected</span>
        <Button variant="ghost" onClick={onClose}>Cancel</Button><Button form="role" type="submit" loading={busy}>Save role</Button></>}>
      <form id="role" onSubmit={save}>
        <div className="form">
          <Field label="Role name" required><Input required value={f.name} onChange={set('name')} placeholder="e.g. Social Media Executive" /></Field>
          <Field label="Colour"><div className="chips">{ROLE_COLORS.map((c) => <button type="button" key={c} className={cx('badge', `tone-${c}`)} style={{ border: f.color === c ? '2px solid var(--ink)' : '2px solid transparent', cursor: 'pointer' }} onClick={() => set('color')(c)}>{c}</button>)}</div></Field>
          <Field label="Description" span={2}><Textarea rows={2} value={f.description} onChange={set('description')} placeholder="What this person does" /></Field>
        </div>
        <div className="grid g2 mt-l" style={{ gap: 14 }}>
          {PERMISSION_GROUPS.map((g) => {
            const keys = g.perms.map(([k]) => k), n = keys.filter((k) => sel.has(k)).length
            return (
              <div key={g.id} className="card" style={{ boxShadow: 'none' }}>
                <div className="card-head" style={{ minHeight: 0, padding: '10px 14px' }}>
                  <label className="check strong"><input type="checkbox" checked={n === keys.length} ref={(el) => el && (el.indeterminate = n > 0 && n < keys.length)} onChange={() => toggleGroup(g)} />{g.label}</label>
                  <span className="tiny faint">{n}/{keys.length}</span>
                </div>
                <div className="col gap-s" style={{ padding: '10px 14px' }}>
                  {g.perms.map(([k, label]) => (
                    <label key={k} className="check small" style={{ fontWeight: 400, alignItems: 'flex-start' }}><input type="checkbox" checked={sel.has(k)} onChange={() => toggle(k)} style={{ marginTop: 2 }} />{label}</label>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
        <p className="small faint mt">Everyone can always see their dashboard, team queries and log their own time. “Manage” permissions automatically include the matching “see” permission.</p>
      </form>
    </Modal>
  )
}


