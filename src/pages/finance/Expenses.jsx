import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { SupplierModal } from './Suppliers'
import { Plus, Download, Receipt, Paperclip, Trash2, Repeat, HandCoins, Undo2 } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { supabase, q, uploadFile, signedUrl } from '../../lib/supabase'
import { useData } from '../../lib/hooks'
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from '../../lib/constants'
import { money, money2, date, monthStart, monthEnd, todayISO, downloadCSV } from '../../lib/format'
import {
  PageHeader, Button, Stat, Modal, Field, Input, Select, Textarea, ClientSelect, MemberSelect, Loading, Empty, Badge, IconBtn, Progress, Card,
  useAction, useForm, useToast
} from '../../components/ui'

export default function Expenses() {
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(monthEnd())
  const [cat, setCat] = useState('')
  const [editing, setEditing] = useState(null)
  const [show, setShow] = useState('')
  const [repay, setRepay] = useState(null)
  const { member } = useAuth()
  const { confirm } = useToast()
  const [, run] = useAction()
  const { data, loading, reload } = useData(() => q(supabase.from('expenses').select('*, clients(name)').gte('spent_on', from).lte('spent_on', to).order('spent_on', { ascending: false })), [from, to], [])
  // out-of-pocket payments still owed to founders / staff (all dates, not just this period)
  const owed = useData(() => q(supabase.from('expenses').select('id,paid_by,amount').not('paid_by', 'is', null).is('reimbursement_id', null)), [data], [])
  const owedBy = useMemo(() => Object.values(owed.data.reduce((a, e) => { a[e.paid_by] ||= { id: e.paid_by, total: 0, n: 0 }; a[e.paid_by].total += Number(e.amount); a[e.paid_by].n++; return a }, {})).sort((a, b) => b.total - a.total), [owed.data])
  const owedTotal = owedBy.reduce((a, x) => a + x.total, 0)
  const rows = useMemo(() => data.filter((e) => (!cat || e.category === cat) && (!show || (show === 'payable' ? e.paid_by && !e.reimbursement_id : show === 'own' ? e.paid_by : !e.paid_by))), [data, cat, show])
  const total = rows.reduce((a, e) => a + Number(e.amount), 0)
  const byPayee = useMemo(() => Object.values(data.filter((e) => e.supplier_id).reduce((a, e) => {
    const k = e.supplier_id; a[k] ||= { id: k, name: e.vendor, total: 0, n: 0 }; a[k].total += Number(e.amount); a[k].n++; return a
  }, {})).sort((a, b) => b.total - a.total), [data])
  const byCat = useMemo(() => Object.entries(data.reduce((a, e) => ({ ...a, [e.category]: (a[e.category] || 0) + Number(e.amount) }), {})).sort((a, b) => b[1] - a[1]), [data])
  const all = data.reduce((a, e) => a + Number(e.amount), 0)
  const rebill = data.filter((e) => e.rebillable).reduce((a, e) => a + Number(e.amount), 0)
  const openReceipt = async (e) => { const u = await signedUrl('receipts', e.receipt_path); if (u) window.open(u, '_blank') }
  const del = async (e) => {
    if (!(await confirm(`Delete expense of ${money2(e.amount)}?`, { danger: true, okText: 'Delete' }))) return
    run(async () => { if (e.receipt_path) await supabase.storage.from('receipts').remove([e.receipt_path]); await q(supabase.from('expenses').delete().eq('id', e.id)); reload() }, 'Deleted')
  }
  const copyRecurring = async () => {
    const prev = new Date(from); prev.setMonth(prev.getMonth() - 1)
    const pf = monthStart(prev), pt = monthEnd(prev)
    const rec = await q(supabase.from('expenses').select('*').eq('recurring', true).gte('spent_on', pf).lte('spent_on', pt))
    if (!rec.length) { await confirm('No recurring expenses were found last month. Tick “Recurring monthly” on rent, salaries, subscriptions etc.', { okText: 'OK' }); return }
    if (!(await confirm(`Copy ${rec.length} recurring expense(s) from last month into ${new Date(from).toLocaleDateString('en-IN', { month: 'long' })}?`, { okText: 'Copy' }))) return
    run(async () => {
      await q(supabase.from('expenses').insert(rec.map((e) => ({ spent_on: from, category: e.category, vendor: e.vendor, description: e.description, amount: e.amount, method: e.method, client_id: e.client_id, rebillable: e.rebillable, recurring: true, supplier_id: e.supplier_id }))))
      reload()
    }, 'Recurring expenses added')
  }
  return (
    <>
      <PageHeader title="Expenses" subtitle="Rent, salaries, subscriptions, ad spend and every other cost."
        actions={<>
          <Button variant="outline" icon={Download} onClick={() => downloadCSV(`expenses-${from}-to-${to}.csv`, rows.map((e) => ({ date: e.spent_on, category: e.category, vendor: e.vendor, description: e.description, amount: e.amount, method: e.method, paid_from: e.paid_by ? member(e.paid_by)?.full_name || 'Team member' : 'Company account', repaid: e.paid_by ? (e.reimbursement_id ? 'yes' : 'no') : '', client: e.clients?.name })))}>Export</Button>
          <Button variant="outline" icon={Repeat} onClick={copyRecurring}>Copy recurring</Button>
          <Button icon={Plus} onClick={() => setEditing({})}>Add expense</Button>
        </>} />
      <div className="filters">
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ width: 160 }} />
        <span className="muted">to</span>
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ width: 160 }} />
        <Select options={EXPENSE_CATEGORIES} value={cat} onChange={(v) => setCat(v || '')} placeholder="All categories" />
        <Select options={[{ id: 'company', label: 'Paid from company account' }, { id: 'own', label: 'Paid by founder / staff' }, { id: 'payable', label: 'Still payable to founder / staff' }]} value={show} onChange={(v) => setShow(v || '')} placeholder="All payments" />
      </div>
      <div className="stats">
        <Stat label="Spent in period" value={money(all)} sub={`${data.length} entries`} icon={Receipt} tone="red" />
        <Stat label="Re-billable to clients" value={money(rebill)} sub="Ad spend / costs to invoice" icon={Receipt} tone="amber" />
        <Stat label="Payable to founder / staff" value={money(owedTotal)} sub={owedTotal ? `${owed.data.length} unpaid · all dates` : 'Nothing owed'} icon={HandCoins} tone={owedTotal ? 'orange' : 'green'} onClick={() => setShow(show === 'payable' ? '' : 'payable')} />
        <Stat label="Biggest category" value={byCat[0]?.[0] || '—'} sub={byCat[0] ? money(byCat[0][1]) : ''} icon={Receipt} tone="violet" />
      </div>
      <div className="grid g-2-1">
        <div>
          {loading ? <Loading /> : rows.length === 0 ? <Empty icon={Receipt} title="No expenses in this period" /> : (
            <div className="card table-wrap"><table className="table">
              <thead><tr><th>Date</th><th>Category</th><th>Details</th><th>Method</th><th className="num">Amount</th><th /></tr></thead>
              <tbody>{rows.map((e) => (
                <tr key={e.id} className="click" onClick={() => setEditing(e)}>
                  <td className="nowrap">{date(e.spent_on)}</td>
                  <td><div>{e.category}</div>{e.recurring && <Badge tone="slate">Recurring</Badge>}</td>
                  <td><div className="cell-title">{e.supplier_id ? <Link to={`/finance/suppliers/${e.supplier_id}`} onClick={(ev) => ev.stopPropagation()}>{e.vendor}</Link> : e.vendor || e.description || '—'}</div><div className="cell-sub">{e.vendor && e.description}{e.clients?.name && ` · for ${e.clients.name}`}{e.rebillable && ' · re-billable'}</div></td>
                  <td>{e.method}{e.paid_by && <div style={{ marginTop: 4 }}><PaidByBadge e={e} name={member(e.paid_by)?.full_name} /></div>}</td>
                  <td className="num strong">{money2(e.amount)}</td>
                  <td onClick={(ev) => ev.stopPropagation()} className="nowrap">{e.receipt_path && <IconBtn icon={Paperclip} size={14} title="Receipt" onClick={() => openReceipt(e)} />}<IconBtn icon={Trash2} size={14} title="Delete" onClick={() => del(e)} /></td>
                </tr>))}</tbody>
              <tfoot><tr><td colSpan={4}>Total</td><td className="num">{money2(total)}</td><td /></tr></tfoot>
            </table></div>
          )}
        </div>
        <div className="grid" style={{ alignContent: 'start' }}>
        <Card title="Payable to founder / staff" actions={<Button variant="ghost" size="sm" icon={HandCoins} onClick={() => setRepay({})}>Repayments</Button>}>
          {owedBy.length === 0 ? <p className="faint small">Nothing owed. When someone pays a company cost from their own account, choose them under “Paid from” on the expense.</p> : owedBy.map((x) => (
            <div key={x.id} className="row between" style={{ marginBottom: 10, gap: 8 }}>
              <div><div className="strong">{member(x.id)?.full_name || 'Team member'}</div><div className="tiny faint">{x.n} unpaid expense{x.n > 1 ? 's' : ''}</div></div>
              <div className="row gap-s"><b style={{ color: 'var(--orange, #c2410c)' }}>{money(x.total)}</b><Button size="sm" onClick={() => setRepay({ person: x.id })}>Repay</Button></div>
            </div>
          ))}
        </Card>
        <Card title="By payee" actions={<Link className="btn btn-ghost btn-sm" to="/finance/suppliers">All payees</Link>}>
          {byPayee.length === 0 ? <p className="faint small">No data.</p> : byPayee.slice(0, 10).map((x) => (
            <Link key={x.id} to={`/finance/suppliers/${x.id}`} style={{ display: 'block', marginBottom: 10, color: 'inherit', textDecoration: 'none' }}>
              <div className="row between small"><span className="strong" style={{ color: 'var(--green-d)' }}>{x.name}</span><b>{money(x.total)}</b></div>
              <Progress value={x.total} max={byPayee[0].total} />
            </Link>
          ))}
        </Card>
        <Card title="By category">
          {byCat.length === 0 ? <p className="faint small">No data.</p> : byCat.map(([k, v]) => (
            <div key={k} style={{ marginBottom: 10, cursor: 'pointer' }} onClick={() => setCat(cat === k ? '' : k)}>
              <div className="row between small"><span className={cat === k ? 'strong' : ''}>{k}</span><b>{money(v)}</b></div>
              <Progress value={v} max={byCat[0][1]} />
            </div>
          ))}
        </Card>
        </div>
      </div>
      {repay && <RepayModal person={repay.person} onClose={() => setRepay(null)} onDone={() => { reload(); owed.reload() }} />}
      {editing && <ExpenseModal exp={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload() }} />}
    </>
  )
}

function ExpenseModal({ exp, onClose, onSaved }) {
  const isNew = !exp.id
  const { member } = useAuth()
  const [f, set] = useForm({ spent_on: todayISO(), category: 'Office Supplies', supplier_id: '', description: '', amount: '', method: 'UPI', client_id: '', paid_by: '', rebillable: false, recurring: false, ...exp })
  const [addPayee, setAddPayee] = useState(false)
  const payees = useData(() => q(supabase.from('suppliers').select('id,name,category').eq('active', true).order('name')), [addPayee], [])
  const [file, setFile] = useState(null)
  const inp = useRef()
  const [busy, run] = useAction()
  const save = (e) => { e.preventDefault(); run(async () => {
    if (!f.supplier_id) throw new Error('Choose who you paid (or add a new payee with +)')
    const p = { spent_on: f.spent_on, category: f.category, supplier_id: f.supplier_id, description: f.description || null, amount: Number(f.amount), method: f.method, client_id: f.client_id || null, rebillable: !!f.rebillable, recurring: !!f.recurring, paid_by: f.paid_by || null }
    if (!(p.amount > 0)) throw new Error('Enter amount')
    if (file) p.receipt_path = await uploadFile('receipts', file, f.spent_on.slice(0, 7))
    isNew ? await q(supabase.from('expenses').insert(p)) : await q(supabase.from('expenses').update(p).eq('id', exp.id))
    onSaved()
  }, 'Expense saved') }
  return (
    <Modal open size="md" onClose={onClose} title={isNew ? 'Add expense' : 'Edit expense'}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" form="exp" loading={busy}>Save</Button></>}>
      <form id="exp" className="form" onSubmit={save}>
        <Field label="Date"><Input type="date" value={f.spent_on} onChange={set('spent_on')} /></Field>
        <Field label="Amount (₹)" required><Input type="number" min="0" step="any" required value={f.amount} onChange={set('amount')} /></Field>
        <Field label="Category"><Select placeholder={false} options={EXPENSE_CATEGORIES} value={f.category} onChange={set('category')} /></Field>
        <Field label="Paid from" hint={f.paid_by ? 'Shows as payable to this person until the company repays them' : undefined}>
          {exp.reimbursement_id ? <div className="row gap-s" style={{ minHeight: 38 }}><PaidByBadge e={exp} name={member(exp.paid_by)?.full_name} /></div>
            : <MemberSelect value={f.paid_by} onChange={set('paid_by')} placeholder="Company account" />}
        </Field>
        <Field label="Paid via"><Select placeholder={false} options={PAYMENT_METHODS} value={f.method} onChange={set('method')} /></Field>
        <Field label="Vendor / paid to" required>
          <div className="row gap-xs"><Select options={payees.data.map((x) => ({ id: x.id, label: `${x.name} · ${x.category}` }))} value={f.supplier_id} onChange={set('supplier_id')} placeholder="Choose payee…" />
            <IconBtn icon={Plus} title="Add new payee" onClick={() => setAddPayee(true)} /></div>
        </Field>
        <Field label="For client (optional)"><ClientSelect value={f.client_id} onChange={set('client_id')} placeholder="Agency expense" includeInactive /></Field>
        <Field label="Description" span={2}><Textarea rows={2} value={f.description} onChange={set('description')} /></Field>
        <Field label="Receipt / bill" span={2}>
          <div className="row gap-s"><Button type="button" variant="outline" size="sm" icon={Paperclip} onClick={() => inp.current.click()}>{file ? file.name : exp.receipt_path ? 'Replace receipt' : 'Attach photo / PDF'}</Button>
            <input ref={inp} type="file" hidden accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files[0])} /></div>
        </Field>
        <label className="check"><input type="checkbox" checked={!!f.recurring} onChange={(e) => set('recurring')(e.target.checked)} />Recurring monthly</label>
        <label className="check"><input type="checkbox" checked={!!f.rebillable} onChange={(e) => set('rebillable')(e.target.checked)} />Re-bill to client</label>
      </form>
      {addPayee && <SupplierModal supplier={{ category: CATEGORY_TO_PAYEE[f.category] || 'Other' }} onClose={() => setAddPayee(false)} onSaved={(row) => { setAddPayee(false); set('supplier_id')(row.id) }} />}
    </Modal>
  )
}

function PaidByBadge({ e, name }) {
  const who = (name || 'team member').split(' ')[0]
  return e.reimbursement_id ? <Badge tone="green">Paid by {who} · repaid</Badge> : <Badge tone="orange">Payable to {who}</Badge>
}

// Repay out-of-pocket expenses to a founder / staff member, and see / undo past repayments
export function RepayModal({ person: initial, onClose, onDone }) {
  const { member } = useAuth()
  const { confirm } = useToast()
  const [person, setPerson] = useState(initial || '')
  const [pick, setPick] = useState(null)
  const [f, set] = useForm({ paid_on: todayISO(), method: 'Bank Transfer', reference: '', note: '' })
  const [busy, run] = useAction()
  const open = useData(() => person ? q(supabase.from('expenses').select('*').eq('paid_by', person).is('reimbursement_id', null).order('spent_on')) : [], [person], [])
  const hist = useData(() => q(supabase.from('reimbursements').select('*').order('paid_on', { ascending: false }).limit(50)), [], [])
  const chosen = pick || new Set(open.data.map((e) => e.id))
  const total = open.data.filter((e) => chosen.has(e.id)).reduce((a, e) => a + Number(e.amount), 0)
  const toggle = (id) => { const n = new Set(chosen); n.has(id) ? n.delete(id) : n.add(id); setPick(n) }
  const pay = () => run(async () => {
    if (!chosen.size) throw new Error('Tick the expenses you are repaying')
    await q(supabase.rpc('repay_expenses', { p_person: person, p_expense_ids: [...chosen], p_paid_on: f.paid_on, p_method: f.method, p_reference: f.reference || null, p_note: f.note || null }))
    setPick(null); open.reload(); hist.reload(); onDone?.()
  }, `Repaid ${money2(total)} to ${member(person)?.full_name || 'team member'}`)
  const undo = async (r) => {
    if (!(await confirm(`Undo the repayment of ${money2(r.amount)} to ${member(r.person_id)?.full_name || 'team member'}? Its expenses become payable again.`, { danger: true, okText: 'Undo repayment' }))) return
    run(async () => { await q(supabase.from('reimbursements').delete().eq('id', r.id)); open.reload(); hist.reload(); onDone?.() }, 'Repayment undone')
  }
  const shown = hist.data.filter((r) => !person || r.person_id === person)
  return (
    <Modal open size="lg" onClose={onClose} title="Repay founder / staff" subtitle="Costs paid from someone's own account, repaid by the company"
      footer={<><Button variant="ghost" onClick={onClose}>Close</Button>{person && open.data.length > 0 && <Button icon={HandCoins} loading={busy} onClick={pay}>Repay {money2(total)}</Button>}</>}>
      <div className="form">
        <Field label="Repay to"><MemberSelect value={person} onChange={(v) => { setPerson(v || ''); setPick(null) }} placeholder="Choose person…" /></Field>
        <Field label="Date paid"><Input type="date" value={f.paid_on} onChange={set('paid_on')} /></Field>
        <Field label="Paid via"><Select placeholder={false} options={PAYMENT_METHODS} value={f.method} onChange={set('method')} /></Field>
        <Field label="Reference"><Input value={f.reference} onChange={set('reference')} placeholder="UTR / cheque no." /></Field>
      </div>
      {person && (open.loading ? <Loading /> : open.data.length === 0 ? <p className="faint small mt">Nothing is payable to {member(person)?.full_name || 'this person'}.</p> : (
        <div className="table-wrap mt"><table className="table">
          <thead><tr><th style={{ width: 30 }} /><th>Date</th><th>Paid to</th><th>Category</th><th className="num">Amount</th></tr></thead>
          <tbody>{open.data.map((e) => (
            <tr key={e.id} className="click" onClick={() => toggle(e.id)}>
              <td><input type="checkbox" checked={chosen.has(e.id)} readOnly /></td>
              <td className="nowrap">{date(e.spent_on)}</td><td><div className="cell-title">{e.vendor}</div>{e.description && <div className="cell-sub">{e.description}</div>}</td>
              <td className="small">{e.category}</td><td className="num strong">{money2(e.amount)}</td>
            </tr>))}</tbody>
          <tfoot><tr><td colSpan={4}>Repaying {chosen.size} of {open.data.length}</td><td className="num">{money2(total)}</td></tr></tfoot>
        </table></div>
      ))}
      <h4 className="mt">Past repayments{person ? ` to ${member(person)?.full_name || ''}` : ''}</h4>
      {shown.length === 0 ? <p className="faint small">None yet.</p> : (
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Date</th><th>To</th><th>Method</th><th className="num">Amount</th><th /></tr></thead>
          <tbody>{shown.map((r) => (
            <tr key={r.id}><td className="nowrap">{date(r.paid_on)}</td><td>{member(r.person_id)?.full_name || '—'}</td>
              <td className="small">{r.method}{r.reference && ` · ${r.reference}`}</td><td className="num strong">{money2(r.amount)}</td>
              <td><IconBtn icon={Undo2} size={14} title="Undo repayment" onClick={() => undo(r)} /></td></tr>))}</tbody>
        </table></div>
      )}
    </Modal>
  )
}

const CATEGORY_TO_PAYEE = { Rent: 'Landlord', Salary: 'Staff', 'Electricity / Water': 'Utility', 'Internet / Phone': 'Utility', 'Software / Subscriptions': 'Software / Subscription',
  'Ad Spend (Client)': 'Ad Platform', 'Own Marketing': 'Ad Platform', 'Stock Images / Assets': 'Software / Subscription', Printing: 'Printing Press', Freelancer: 'Freelance Designer',
  'Bank Charges / Fees': 'Bank / Government', 'Travel / Fuel': 'Other', 'Office Supplies': 'Shop / Store', Equipment: 'Shop / Store', Maintenance: 'Other' }
