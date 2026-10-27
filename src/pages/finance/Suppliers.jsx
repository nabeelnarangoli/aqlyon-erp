import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Plus, Truck, Wallet, Pencil, Trash2, Split, PackageCheck, ArrowLeft, Phone, MessageCircle, Download } from 'lucide-react'
import { supabase, q } from '../../lib/supabase'
import { useData } from '../../lib/hooks'
import { useAuth } from '../../lib/auth'
import { PAYMENT_METHODS } from '../../lib/constants'
import { money, money2, date, todayISO, addDays, waLink, downloadCSV, daysFrom } from '../../lib/format'
import {
  PageHeader, Button, Badge, Stat, Card, Modal, Field, Input, Select, Textarea, ClientSelect, SearchInput, Loading, Empty, IconBtn, Tabs,
  useAction, useForm, useToast, useClients
} from '../../components/ui'

export const SUPPLIER_CATEGORIES = ['Freelance Designer', 'Printing Press', 'Videographer', 'Photographer', 'Video Editor', 'Developer', 'Content Writer',
  'Ad Agency', 'Ad Platform', 'Influencer', 'Signage / Fabrication', 'Landlord', 'Utility', 'Software / Subscription', 'Staff', 'Shop / Store', 'Bank / Government', 'Other']
export const WORK_STATUS = [
  { id: 'ordered', label: 'Ordered', tone: 'blue' }, { id: 'in_progress', label: 'In progress', tone: 'violet' },
  { id: 'received', label: 'Work received', tone: 'green' }, { id: 'cancelled', label: 'Cancelled', tone: 'red' }
]
export const BILL_PAY_STATUS = [
  { id: 'unpaid', label: 'Unpaid', tone: 'amber' }, { id: 'partial', label: 'Part paid', tone: 'orange' },
  { id: 'paid', label: 'Paid', tone: 'green' }, { id: 'cancelled', label: 'Cancelled', tone: 'slate' }
]
const PAY_KIND = [{ id: 'advance', label: 'Advance' }, { id: 'part', label: 'Part payment' }, { id: 'final', label: 'Final / balance' }]
const tone = (list, v) => list.find((x) => x.id === v) || { label: v, tone: 'slate' }
const Pill = ({ list, v }) => { const s = tone(list, v); return <Badge tone={s.tone} dot>{s.label}</Badge> }

/* =========================================================== Suppliers list */
export default function Suppliers() {
  const { id } = useParams()
  const nav = useNavigate()
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const { data, loading, reload } = useData(async () => {
    const [sup, bills, exps] = await Promise.all([
      q(supabase.from('suppliers').select('*').order('name')),
      q(supabase.from('supplier_bills').select('supplier_id,total,amount_paid,status').neq('status', 'cancelled')),
      q(supabase.from('expenses').select('supplier_id,amount').not('supplier_id', 'is', null))
    ])
    return sup.map((s) => {
      const b = bills.filter((x) => x.supplier_id === s.id)
      const e = exps.filter((x) => x.supplier_id === s.id).reduce((a, x) => a + Number(x.amount), 0)
      return { ...s, orders: b.length, billed: b.reduce((a, x) => a + Number(x.total), 0), paid: b.reduce((a, x) => a + Number(x.amount_paid), 0), spent: e }
    })
  }, [], [])
  if (id) return <SupplierDetail id={id} onBack={() => nav('/finance/suppliers')} />
  const rows = data.filter((s) => !search || [s.name, s.category, s.phone, s.contact_person].some((v) => v?.toLowerCase().includes(search.toLowerCase())))
  const owed = data.reduce((a, s) => a + s.billed - s.paid, 0)
  return (
    <>
      <PageHeader title="Suppliers & payees" subtitle={`${data.length} accounts · ${money(owed)} payable to suppliers`}
        actions={<><Button variant="outline" icon={Truck} onClick={() => nav('/finance/work-orders')}>Work orders</Button><Button icon={Plus} onClick={() => setEditing({})}>Add supplier / payee</Button></>} />
      <div className="filters"><SearchInput value={search} onChange={setSearch} placeholder="Search suppliers…" /></div>
      {loading ? <Loading /> : rows.length === 0 ? <Empty icon={Truck} title="No suppliers or payees yet">Add freelancers and printers you outsource to, and anyone you pay expenses to — landlord, KSEB, Adobe…</Empty> : (
        <div className="card table-wrap"><table className="table">
          <thead><tr><th>Supplier / payee</th><th>Category</th><th>Contact</th><th className="num">Work orders</th><th className="num">Expenses</th><th className="num">Total spent</th><th className="num">Payable</th></tr></thead>
          <tbody>{rows.map((s) => (
            <tr key={s.id} className="click" onClick={() => nav(`/finance/suppliers/${s.id}`)}>
              <td><div className="cell-title">{s.name}</div>{!s.active && <Badge tone="slate">Inactive</Badge>}</td>
              <td>{s.category}</td><td><div>{s.contact_person || '—'}</div><div className="cell-sub">{s.phone}</div></td>
              <td className="num">{s.orders || '—'}</td><td className="num">{s.spent ? money(s.spent) : '—'}</td><td className="num">{money(s.billed + s.spent)}</td>
              <td className="num strong" style={{ color: s.billed - s.paid > 0 ? 'var(--orange)' : undefined }}>{money(s.billed - s.paid)}</td>
            </tr>))}</tbody>
        </table></div>
      )}
      {editing && <SupplierModal supplier={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload() }} />}
    </>
  )
}

export function SupplierModal({ supplier, onClose, onSaved }) {
  const isNew = !supplier.id
  const [f, set] = useForm({ name: '', category: 'Freelance Designer', contact_person: '', phone: '', whatsapp: '', email: '', upi_id: '', bank_details: '', notes: '', active: true, ...supplier })
  const [busy, run] = useAction()
  const save = (e) => { e.preventDefault(); run(async () => {
    const p = { name: f.name, category: f.category, contact_person: f.contact_person || null, phone: f.phone || null, whatsapp: f.whatsapp || null, email: f.email || null,
      upi_id: f.upi_id || null, bank_details: f.bank_details || null, notes: f.notes || null, active: !!f.active }
    const row = isNew ? await q(supabase.from('suppliers').insert(p).select().single()) : await q(supabase.from('suppliers').update(p).eq('id', supplier.id).select().single())
    onSaved(row)
  }, 'Supplier saved') }
  return (
    <Modal open size="md" onClose={onClose} title={isNew ? 'Add supplier / payee' : `Edit ${supplier.name}`}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button form="sup" type="submit" loading={busy}>Save</Button></>}>
      <form id="sup" className="form" onSubmit={save}>
        <Field label="Name" required><Input required value={f.name} onChange={set('name')} /></Field>
        <Field label="Category"><Select placeholder={false} options={SUPPLIER_CATEGORIES} value={f.category} onChange={set('category')} /></Field>
        <Field label="Contact person"><Input value={f.contact_person} onChange={set('contact_person')} /></Field>
        <Field label="Phone"><Input value={f.phone} onChange={set('phone')} /></Field>
        <Field label="WhatsApp"><Input value={f.whatsapp} onChange={set('whatsapp')} /></Field>
        <Field label="Email"><Input type="email" value={f.email} onChange={set('email')} /></Field>
        <Field label="UPI ID"><Input value={f.upi_id} onChange={set('upi_id')} /></Field>
        <Field label="Bank details"><Textarea rows={2} value={f.bank_details} onChange={set('bank_details')} /></Field>
        <Field label="Notes" span={2}><Textarea rows={2} value={f.notes} onChange={set('notes')} placeholder="Rates, turnaround time, quality notes…" /></Field>
        {!isNew && <label className="check"><input type="checkbox" checked={!!f.active} onChange={(e) => set('active')(e.target.checked)} />Active</label>}
      </form>
    </Modal>
  )
}

function SupplierDetail({ id, onBack }) {
  const { has, member } = useAuth()
  const [editing, setEditing] = useState(false)
  const [order, setOrder] = useState(null)
  const [tab, setTab] = useState('statement')
  const [from, setFrom] = useState(() => { const d = new Date(); return `${d.getFullYear() - (d.getMonth() < 3 ? 1 : 0)}-04-01` })
  const [to, setTo] = useState(todayISO())
  const sup = useData(() => q(supabase.from('suppliers').select('*').eq('id', id).single()), [id])
  const bills = useData(() => q(supabase.from('supplier_bills').select('*, supplier_bill_allocations(*, clients(name))').eq('supplier_id', id).order('order_date', { ascending: false })), [id], [])
  const pays = useData(() => q(supabase.from('supplier_payments').select('*, supplier_bills(number,title)').eq('supplier_id', id).order('paid_on', { ascending: false })), [id], [])
  const exps = useData(() => q(supabase.from('expenses').select('*, clients(name)').eq('supplier_id', id).order('spent_on', { ascending: false })), [id], [])
  if (sup.loading) return <Loading />
  const s = sup.data
  const live = bills.data.filter((b) => b.status !== 'cancelled')
  const billed = live.reduce((a, b) => a + Number(b.total), 0), paidBills = pays.data.reduce((a, p) => a + Number(p.amount), 0)
  const expTotal = exps.data.reduce((a, e) => a + Number(e.amount), 0)

  // account statement: billed (what we owe) vs paid; expenses are billed and paid on the same day
  const opening = [...live.filter((b) => b.order_date < from).map((b) => Number(b.total)), ...exps.data.filter((e) => e.spent_on < from).map((e) => Number(e.amount))].reduce((a, x) => a + x, 0)
    - [...pays.data.filter((p) => p.paid_on < from).map((p) => Number(p.amount)), ...exps.data.filter((e) => e.spent_on < from).map((e) => Number(e.amount))].reduce((a, x) => a + x, 0)
  const inRange = (d) => d >= from && d <= to
  const lines = [
    ...live.filter((b) => inRange(b.order_date)).map((b) => ({ d: b.order_date, k: 'b' + b.id, type: 'Work order', ref: b.number, text: b.title, billed: Number(b.total), paid: 0, open: () => setOrder({ open: b.id }) })),
    ...pays.data.filter((p) => inRange(p.paid_on)).map((p) => ({ d: p.paid_on, k: 'p' + p.id, type: `Payment · ${p.kind}`, ref: p.supplier_bills?.number, text: [p.method, p.reference, p.note].filter(Boolean).join(' · '), billed: 0, paid: Number(p.amount), open: p.bill_id && (() => setOrder({ open: p.bill_id })) })),
    ...exps.data.filter((e) => inRange(e.spent_on)).map((e) => ({ d: e.spent_on, k: 'e' + e.id, type: `Expense · ${e.category}`, ref: '', text: [e.description, e.clients?.name && `for ${e.clients.name}`, e.method, e.paid_by && `paid by ${member(e.paid_by)?.full_name || 'team member'}${e.reimbursement_id ? ' (repaid)' : ' (repayment pending)'}`].filter(Boolean).join(' · '), billed: Number(e.amount), paid: Number(e.amount) }))
  ].sort((x, y) => x.d.localeCompare(y.d) || (x.billed ? -1 : 1))
  let bal = opening
  const rows = lines.map((l) => ({ ...l, bal: (bal += l.billed - l.paid) }))
  const tB = rows.reduce((a, r) => a + r.billed, 0), tP = rows.reduce((a, r) => a + r.paid, 0)
  const csv = () => downloadCSV(`${s.name}-statement-${from}-to-${to}.csv`, [{ date: from, type: 'Opening balance', reference: '', details: '', billed: '', paid: '', balance: opening },
    ...rows.map((r) => ({ date: r.d, type: r.type, reference: r.ref, details: r.text, billed: r.billed || '', paid: r.paid || '', balance: r.bal }))])

  return (
    <>
      <button className="btn btn-ghost btn-sm mb" onClick={onBack}><ArrowLeft size={14} />All suppliers & payees</button>
      <PageHeader title={s.name} subtitle={[s.category, s.contact_person, s.phone].filter(Boolean).join(' · ')}
        actions={<>
          {s.phone && <a className="btn btn-outline" href={`tel:${s.phone}`}><Phone size={15} />Call</a>}
          {(s.whatsapp || s.phone) && <a className="btn btn-outline" target="_blank" rel="noreferrer" href={waLink(s.whatsapp || s.phone)}><MessageCircle size={15} />WhatsApp</a>}
          <Button variant="outline" icon={Pencil} onClick={() => setEditing(true)}>Edit</Button>
          {has('suppliers.manage') && <Button icon={Plus} onClick={() => setOrder({ supplier_id: id })}>New work order</Button>}
        </>} />
      <div className="stats">
        <Stat label="Total spent with them" value={money(billed + expTotal)} sub={`${live.length} work orders · ${exps.data.length} expenses`} icon={Truck} tone="violet" />
        <Stat label="Paid" value={money(paidBills + expTotal)} icon={Wallet} tone="teal" />
        <Stat label="Balance owed" value={money(billed - paidBills)} icon={Wallet} tone={billed - paidBills > 0 ? 'orange' : 'green'} />
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'statement', label: 'Account statement' }, { id: 'orders', label: 'Work orders', count: bills.data.length }, { id: 'expenses', label: 'Expenses', count: exps.data.length }, { id: 'details', label: 'Details' }]} />
      {tab === 'statement' && (
        <>
          <div className="filters">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ width: 160 }} />
            <span className="muted">to</span>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ width: 160 }} />
            <div className="grow" />
            <Button variant="outline" icon={Download} onClick={csv}>Export statement</Button>
          </div>
          <Card pad={false}><div className="table-wrap"><table className="table">
            <thead><tr><th>Date</th><th>Type</th><th>Ref</th><th>Details</th><th className="num">Billed</th><th className="num">Paid</th><th className="num">Balance owed</th></tr></thead>
            <tbody>
              <tr><td className="nowrap">{date(from)}</td><td colSpan={5} className="strong">Opening balance</td><td className="num strong">{money2(opening)}</td></tr>
              {rows.length === 0 && <tr><td colSpan={7} className="center faint">No transactions in this period</td></tr>}
              {rows.map((r) => (
                <tr key={r.k} className={r.open ? 'click' : ''} onClick={() => r.open && r.open()}>
                  <td className="nowrap">{date(r.d)}</td>
                  <td><Badge tone={r.type.startsWith('Work') ? 'violet' : r.type.startsWith('Payment') ? 'teal' : 'slate'}>{r.type}</Badge></td>
                  <td className="small nowrap">{r.ref || '—'}</td><td className="small">{r.text || '—'}</td>
                  <td className="num">{r.billed ? money2(r.billed) : ''}</td><td className="num" style={{ color: 'var(--green-d)' }}>{r.paid ? money2(r.paid) : ''}</td>
                  <td className="num strong">{money2(r.bal)}</td>
                </tr>))}
            </tbody>
            <tfoot><tr><td colSpan={4}>Closing balance · {date(to)}</td><td className="num">{money2(tB)}</td><td className="num">{money2(tP)}</td><td className="num">{money2(bal)}</td></tr></tfoot>
          </table></div></Card>
          <p className="small faint mt">Work orders add to what you owe; supplier payments reduce it. Expenses are paid on the spot, so they appear in both columns.</p>
        </>
      )}
      {tab === 'orders' && <Card pad={false}><BillTable rows={bills.data} onOpen={(b) => setOrder({ open: b.id })} /></Card>}
      {tab === 'expenses' && (exps.data.length === 0 ? <Empty icon={Wallet} title="No expenses recorded for this payee" /> : (
        <Card pad={false}><div className="table-wrap"><table className="table">
          <thead><tr><th>Date</th><th>Category</th><th>Details</th><th>Method</th><th className="num">Amount</th></tr></thead>
          <tbody>{exps.data.map((e) => <tr key={e.id}><td className="nowrap">{date(e.spent_on)}</td><td>{e.category}{e.recurring && <> <Badge tone="slate">Recurring</Badge></>}</td><td className="small">{e.description || '—'}{e.clients?.name && ` · for ${e.clients.name}`}</td><td>{e.method}</td><td className="num strong">{money2(e.amount)}</td></tr>)}</tbody>
          <tfoot><tr><td colSpan={4}>Total</td><td className="num">{money2(expTotal)}</td></tr></tfoot>
        </table></div></Card>
      ))}
      {tab === 'details' && (
        <Card><dl className="kv">
          <dt>Category</dt><dd>{s.category}</dd><dt>Contact</dt><dd>{s.contact_person || '—'}</dd><dt>Phone</dt><dd>{s.phone || '—'}</dd><dt>Email</dt><dd>{s.email || '—'}</dd>
          <dt>Pay to</dt><dd className="pre">{[s.upi_id && `UPI: ${s.upi_id}`, s.bank_details].filter(Boolean).join('\n') || '—'}</dd><dt>Notes</dt><dd className="pre">{s.notes || '—'}</dd>
        </dl></Card>
      )}
      {editing && <SupplierModal supplier={s} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); sup.reload() }} />}
      {order && (order.open
        ? <WorkOrderView id={order.open} onClose={() => { setOrder(null); bills.reload(); pays.reload() }} />
        : <WorkOrderModal order={order} onClose={() => setOrder(null)} onSaved={(row) => { setOrder({ open: row.id }); bills.reload() }} />)}
    </>
  )
}

function BillTable({ rows, onOpen, showSupplier }) {
  if (!rows.length) return <Empty icon={Truck} title="No work orders" />
  return (
    <div className="table-wrap"><table className="table">
      <thead><tr><th>Order</th>{showSupplier && <th>Supplier</th>}<th>For customer(s)</th><th>Work</th><th>Payment</th><th className="num">Total</th><th className="num">Paid</th><th className="num">Balance</th></tr></thead>
      <tbody>{rows.map((b) => (
        <tr key={b.id} className="click" onClick={() => onOpen(b)}>
          <td><div className="cell-title">{b.title}</div><div className="cell-sub">{b.number} · {date(b.order_date)}</div></td>
          {showSupplier && <td>{b.suppliers?.name}</td>}
          <td className="small">{(b.supplier_bill_allocations || []).map((a) => a.clients?.name).filter(Boolean).join(', ') || <span className="faint">Not assigned</span>}</td>
          <td><Pill list={WORK_STATUS} v={b.work_status} /></td>
          <td><Pill list={BILL_PAY_STATUS} v={b.status} /></td>
          <td className="num">{money(b.total)}</td><td className="num">{money(b.amount_paid)}</td><td className="num strong">{money(b.total - b.amount_paid)}</td>
        </tr>))}</tbody>
    </table></div>
  )
}

/* =========================================================== Work orders list */
export function WorkOrders() {
  const [params, setParams] = useSearchParams()
  const [status, setStatus] = useState('open')
  const [search, setSearch] = useState('')
  const [client, setClient] = useState('')
  const [order, setOrder] = useState(null)
  const { data, loading, reload } = useData(() => q(supabase.from('supplier_bills').select('*, suppliers(name), supplier_bill_allocations(*, clients(name))').order('order_date', { ascending: false })), [], [])
  useEffect(() => {
    if (params.get('new')) { setOrder({ alloc: params.get('client') ? [{ client_id: params.get('client'), invoice_id: params.get('invoice') || '', amount: '' }] : undefined }); setParams({}, { replace: true }) }
    if (params.get('open')) { setOrder({ open: params.get('open') }); setParams({}, { replace: true }) }
  }, [params, setParams])
  const rows = useMemo(() => data.filter((b) => {
    if (status === 'open' && ['paid', 'cancelled'].includes(b.status) && b.work_status !== 'ordered' && b.work_status !== 'in_progress') return false
    if (status !== 'open' && status && b.status !== status) return false
    if (client && !(b.supplier_bill_allocations || []).some((a) => a.client_id === client)) return false
    if (search && ![b.title, b.number, b.suppliers?.name].some((v) => v?.toLowerCase().includes(search.toLowerCase()))) return false
    return true
  }), [data, status, client, search])
  const live = data.filter((b) => b.status !== 'cancelled')
  const payable = live.reduce((a, b) => a + Number(b.total) - Number(b.amount_paid), 0)
  const pending = live.filter((b) => ['ordered', 'in_progress'].includes(b.work_status))
  return (
    <>
      <PageHeader title="Supplier work orders" subtitle="Work you outsource, which customer it’s for, and what you’ve paid."
        actions={<>
          <Button variant="outline" icon={Download} onClick={() => downloadCSV('supplier-work-orders.csv', rows.map((b) => ({ number: b.number, date: b.order_date, supplier: b.suppliers?.name, title: b.title, customers: (b.supplier_bill_allocations || []).map((a) => a.clients?.name).join('; '), total: b.total, paid: b.amount_paid, balance: b.total - b.amount_paid, work: b.work_status })))}>Export</Button>
          <Button icon={Plus} onClick={() => setOrder({})}>New work order</Button>
        </>} />
      <div className="stats">
        <Stat label="Payable to suppliers" value={money(payable)} icon={Wallet} tone="orange" onClick={() => setStatus('open')} />
        <Stat label="Work not yet received" value={pending.length} sub={money(pending.reduce((a, b) => a + Number(b.total), 0))} icon={Truck} tone="violet" />
        <Stat label="Supplier cost this month" value={money(live.filter((b) => b.order_date >= todayISO().slice(0, 8) + '01').reduce((a, b) => a + Number(b.total), 0))} icon={Truck} tone="teal" />
      </div>
      <div className="filters">
        <SearchInput value={search} onChange={setSearch} />
        <ClientSelect value={client} onChange={(v) => setClient(v || '')} placeholder="All customers" includeInactive />
        <Select options={[{ id: 'open', label: 'Open (unpaid or not received)' }, ...BILL_PAY_STATUS]} value={status} onChange={(v) => setStatus(v || '')} placeholder="All" />
      </div>
      {loading ? <Loading /> : <div className="card"><BillTable rows={rows} showSupplier onOpen={(b) => setOrder({ open: b.id })} /></div>}
      {order && (order.open
        ? <WorkOrderView id={order.open} onClose={() => { setOrder(null); reload() }} />
        : <WorkOrderModal order={order} onClose={() => setOrder(null)} onSaved={(row) => { reload(); setOrder({ open: row.id }) }} />)}
    </>
  )
}

/* =========================================================== Create / edit work order */
export function WorkOrderModal({ order = {}, onClose, onSaved }) {
  const isNew = !order.id
  const { data: clients } = useClients()
  const [f, set, setF] = useForm({ supplier_id: '', title: '', order_date: todayISO(), due_date: addDays(todayISO(), 5), supplier_ref: '', notes: '',
    items: [{ description: '', qty: 1, rate: '' }], discount: 0, work_status: 'ordered', ...order })
  const [alloc, setAlloc] = useState(order.alloc || [{ client_id: '', invoice_id: '', amount: '' }])
  const [newSup, setNewSup] = useState(false)
  const sups = useData(() => q(supabase.from('suppliers').select('id,name,category').eq('active', true).order('name')), [newSup], [])
  const invs = useData(() => q(supabase.from('invoices').select('id,number,client_id,total,status').neq('status', 'cancelled').order('issue_date', { ascending: false })), [], [])
  const total = Math.max(0, (f.items || []).reduce((a, i) => a + Number(i.qty || 0) * Number(i.rate || 0), 0) - Number(f.discount || 0))
  const allocated = alloc.reduce((a, x) => a + Number(x.amount || 0), 0)
  const [busy, run] = useAction()
  const setItem = (i, k, v) => setF((s) => ({ ...s, items: s.items.map((it, j) => (j === i ? { ...it, [k]: v } : it)) }))
  const setA = (i, k, v) => setAlloc((s) => s.map((a, j) => (j === i ? { ...a, [k]: v, ...(k === 'client_id' ? { invoice_id: '' } : {}) } : a)))
  const splitEqually = () => { const n = alloc.filter((a) => a.client_id).length || 1; setAlloc((s) => s.map((a) => ({ ...a, amount: a.client_id ? Math.round((total / n) * 100) / 100 : a.amount }))) }
  useEffect(() => { if (alloc.length === 1 && !order.id) setAlloc((s) => [{ ...s[0], amount: total || '' }]) }, [total]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = (e) => { e.preventDefault(); run(async () => {
    const items = (f.items || []).filter((i) => i.description && Number(i.rate) > 0).map((i) => ({ description: i.description, qty: Number(i.qty || 1), rate: Number(i.rate) }))
    if (!f.supplier_id) throw new Error('Choose a supplier')
    if (!items.length) throw new Error('Add what you are paying the supplier for, with the amount')
    const rows = alloc.filter((a) => a.client_id)
    if (rows.length && Math.abs(rows.reduce((a, x) => a + Number(x.amount || 0), 0) - total) > 1) throw new Error(`Customer split (${money(allocated)}) must add up to the order total (${money(total)})`)
    const p = { supplier_id: f.supplier_id, title: f.title || items[0].description, order_date: f.order_date, due_date: f.due_date || null, supplier_ref: f.supplier_ref || null,
      notes: f.notes || null, items, discount: Number(f.discount || 0), work_status: f.work_status }
    const row = isNew ? await q(supabase.from('supplier_bills').insert(p).select().single()) : await q(supabase.from('supplier_bills').update(p).eq('id', order.id).select().single())
    await q(supabase.from('supplier_bill_allocations').delete().eq('bill_id', row.id))
    if (rows.length) await q(supabase.from('supplier_bill_allocations').insert(rows.map((a) => ({ bill_id: row.id, client_id: a.client_id, invoice_id: a.invoice_id || null, amount: Number(a.amount || 0) }))))
    onSaved(row)
  }, isNew ? 'Work order created' : 'Work order updated') }

  return (
    <Modal open size="lg" onClose={onClose} title={isNew ? 'New supplier work order' : `Edit ${order.number}`}
      subtitle="Record outsourced work and which customer(s) it is for."
      footer={<><span className="muted" style={{ marginRight: 'auto' }}>Total <b style={{ color: 'var(--ink)', fontSize: 17 }}>{money2(total)}</b></span>
        <Button variant="ghost" onClick={onClose}>Cancel</Button><Button form="wo" type="submit" loading={busy}>Save work order</Button></>}>
      <form id="wo" onSubmit={save}>
        <div className="form f3">
          <Field label="Supplier" required>
            <div className="row gap-xs"><Select options={sups.data.map((s) => ({ id: s.id, label: `${s.name} · ${s.category}` }))} value={f.supplier_id} onChange={set('supplier_id')} />
              <IconBtn icon={Plus} title="Add supplier" onClick={() => setNewSup(true)} /></div>
          </Field>
          <Field label="Work order title" span={2}><Input value={f.title} onChange={set('title')} placeholder="e.g. Logo design – Kappad Beach Resort" /></Field>
          <Field label="Order date"><Input type="date" value={f.order_date} onChange={set('order_date')} /></Field>
          <Field label="Expected delivery"><Input type="date" value={f.due_date} onChange={set('due_date')} /></Field>
          <Field label="Supplier's bill / quote no."><Input value={f.supplier_ref} onChange={set('supplier_ref')} /></Field>
        </div>

        <h3 className="mt-l mb">What you’re paying for</h3>
        <div className="card table-wrap"><table className="table items-editor">
          <thead><tr><th style={{ width: '58%' }}>Description</th><th className="num">Qty</th><th className="num">Rate (₹)</th><th className="num">Amount</th><th /></tr></thead>
          <tbody>{(f.items || []).map((it, i) => (
            <tr key={i}>
              <td><input className="input" value={it.description} onChange={(e) => setItem(i, 'description', e.target.value)} placeholder="Logo design – 3 concepts" /></td>
              <td><input className="input right" style={{ width: 70 }} type="number" step="any" min="0" value={it.qty} onChange={(e) => setItem(i, 'qty', e.target.value)} /></td>
              <td><input className="input right" style={{ width: 110 }} type="number" step="any" min="0" value={it.rate} onChange={(e) => setItem(i, 'rate', e.target.value)} /></td>
              <td className="num strong">{money2(Number(it.qty || 0) * Number(it.rate || 0))}</td>
              <td><IconBtn icon={Trash2} size={14} title="Remove" onClick={() => setF((s) => ({ ...s, items: s.items.filter((_, j) => j !== i) }))} /></td>
            </tr>))}</tbody>
        </table></div>
        <Button type="button" size="sm" variant="ghost" icon={Plus} className="mt" onClick={() => setF((s) => ({ ...s, items: [...s.items, { description: '', qty: 1, rate: '' }] }))}>Add line</Button>

        <div className="row between mt-l mb wrap gap-s">
          <h3>Which customer is this for?</h3>
          <div className="row gap-s">
            <Button type="button" size="sm" variant="outline" icon={Split} onClick={splitEqually}>Split equally</Button>
            <Button type="button" size="sm" variant="outline" icon={Plus} onClick={() => setAlloc((s) => [...s, { client_id: '', invoice_id: '', amount: '' }])}>Add customer</Button>
          </div>
        </div>
        <div className="card table-wrap"><table className="table items-editor">
          <thead><tr><th>Customer</th><th>Against invoice (optional)</th><th className="num">Cost share (₹)</th><th /></tr></thead>
          <tbody>{alloc.map((a, i) => (
            <tr key={i}>
              <td style={{ minWidth: 200 }}><Select options={(clients || []).map((c) => ({ id: c.id, label: c.name }))} value={a.client_id} onChange={(v) => setA(i, 'client_id', v || '')} placeholder="Select customer…" /></td>
              <td style={{ minWidth: 200 }}><Select options={invs.data.filter((x) => x.client_id === a.client_id).map((x) => ({ id: x.id, label: `${x.number} · ${money(x.total)}` }))} value={a.invoice_id} onChange={(v) => setA(i, 'invoice_id', v || '')} placeholder={a.client_id ? 'Not linked to an invoice' : '—'} disabled={!a.client_id} /></td>
              <td><input className="input right" style={{ width: 120, marginLeft: 'auto' }} type="number" step="any" min="0" value={a.amount} onChange={(e) => setA(i, 'amount', e.target.value)} /></td>
              <td>{alloc.length > 1 && <IconBtn icon={Trash2} size={14} title="Remove" onClick={() => setAlloc((s) => s.filter((_, j) => j !== i))} />}</td>
            </tr>))}</tbody>
          <tfoot><tr><td colSpan={2} className="right">Allocated</td><td className="num" style={{ color: Math.abs(allocated - total) > 1 && alloc.some((a) => a.client_id) ? 'var(--red)' : undefined }}>{money2(allocated)} / {money2(total)}</td><td /></tr></tfoot>
        </table></div>
        <p className="small faint mt">Split one supplier bill across several customers, e.g. one print run for three clients. Leave empty for internal work.</p>
        <Field label="Notes"><Textarea rows={2} value={f.notes} onChange={set('notes')} /></Field>
      </form>
      {newSup && <SupplierModal supplier={{}} onClose={() => setNewSup(false)} onSaved={(row) => { setNewSup(false); set('supplier_id')(row.id) }} />}
    </Modal>
  )
}

/* =========================================================== Work order detail */
export function WorkOrderView({ id, onClose }) {
  const { has } = useAuth()
  const { confirm } = useToast()
  const [editing, setEditing] = useState(false)
  const [paying, setPaying] = useState(null)
  const [busy, run] = useAction()
  const b = useData(() => q(supabase.from('supplier_bills').select('*, suppliers(*), supplier_bill_allocations(*, clients(name), invoices(number,total,amount_paid))').eq('id', id).single()), [id])
  const pays = useData(() => q(supabase.from('supplier_payments').select('*').eq('bill_id', id).order('paid_on')), [id], [])
  if (b.loading || !b.data) return <Modal open drawer size="lg" onClose={onClose} title="Work order"><Loading /></Modal>
  const x = b.data
  const balance = Number(x.total) - Number(x.amount_paid)
  const isFin = has('suppliers.pay')
  const setWork = (ws) => run(async () => { await q(supabase.from('supplier_bills').update({ work_status: ws }).eq('id', id)); b.reload() }, ws === 'received' ? 'Marked work received' : 'Updated')
  const del = async () => {
    if (!(await confirm(`Delete work order ${x.number}? Its supplier payments are removed too.`, { danger: true, okText: 'Delete' }))) return
    run(async () => { await q(supabase.from('supplier_bills').delete().eq('id', id)); onClose() }, 'Deleted')
  }
  const delPay = async (p) => { if (await confirm(`Remove payment of ${money2(p.amount)}?`, { danger: true, okText: 'Remove' })) run(async () => { await q(supabase.from('supplier_payments').delete().eq('id', p.id)); pays.reload(); b.reload() }, 'Removed') }
  return (
    <Modal open drawer size="lg" onClose={onClose} title={x.title} subtitle={<span className="row gap-s wrap"><Badge tone="slate">{x.number}</Badge><Pill list={WORK_STATUS} v={x.work_status} /><Pill list={BILL_PAY_STATUS} v={x.status} /></span>}
      footer={<>
        {has('suppliers.manage') && <IconBtn icon={Trash2} title="Delete" onClick={del} />}
        <div className="grow" />
        {x.work_status !== 'received' && x.work_status !== 'cancelled' && <Button variant="outline" icon={PackageCheck} loading={busy} onClick={() => setWork('received')}>Work received</Button>}
        <Button variant="outline" icon={Pencil} onClick={() => setEditing(true)}>Edit</Button>
        {isFin && balance > 0 && <Button icon={Wallet} onClick={() => setPaying({ kind: Number(x.amount_paid) > 0 ? 'final' : 'advance', amount: Number(x.amount_paid) > 0 ? balance : '' })}>Pay supplier</Button>}
      </>}>
      <div className="stats" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))' }}>
        <Stat label="Order total" value={money(x.total)} />
        <Stat label="Paid" value={money(x.amount_paid)} tone="teal" />
        <Stat label="Balance to pay" value={money(balance)} tone={balance > 0 ? 'orange' : 'green'} />
      </div>
      <dl className="kv mb">
        <dt>Supplier</dt><dd><Link to={`/finance/suppliers/${x.supplier_id}`} onClick={onClose}>{x.suppliers?.name}</Link> · {x.suppliers?.category}</dd>
        <dt>Ordered</dt><dd>{date(x.order_date)}{x.due_date && <> · expected {date(x.due_date)} {x.work_status !== 'received' && daysFrom(x.due_date) < 0 && <Badge tone="red">late</Badge>}</>}</dd>
        {x.received_on && <><dt>Received</dt><dd>{date(x.received_on)}</dd></>}
        {x.supplier_ref && <><dt>Supplier ref</dt><dd>{x.supplier_ref}</dd></>}
        {(x.suppliers?.upi_id || x.suppliers?.bank_details) && <><dt>Pay to</dt><dd className="pre small">{[x.suppliers.upi_id && `UPI: ${x.suppliers.upi_id}`, x.suppliers.bank_details].filter(Boolean).join('\n')}</dd></>}
        {x.notes && <><dt>Notes</dt><dd className="pre">{x.notes}</dd></>}
      </dl>
      <Card title="Items" pad={false}><div className="table-wrap"><table className="table"><tbody>
        {(x.items || []).map((it, i) => <tr key={i}><td>{it.description}</td><td className="num">{it.qty} × {money2(it.rate)}</td><td className="num strong">{money2(it.qty * it.rate)}</td></tr>)}
      </tbody></table></div></Card>
      <Card className="mt" title="Customer cost split" pad={false}>
        {(x.supplier_bill_allocations || []).length === 0 ? <p className="card-body faint small">Not assigned to a customer (internal cost).</p> : (
          <div className="table-wrap"><table className="table"><tbody>
            {x.supplier_bill_allocations.map((a) => (
              <tr key={a.id}>
                <td><Link to={`/clients/${a.client_id}`} onClick={onClose} className="strong">{a.clients?.name}</Link></td>
                <td>{a.invoice_id ? <Link to={`/finance/invoices/${a.invoice_id}`} onClick={onClose}>{a.invoices?.number}</Link> : <span className="faint">No invoice</span>}</td>
                <td className="num strong">{money2(a.amount)}</td>
              </tr>))}
          </tbody></table></div>
        )}
      </Card>
      <Card className="mt" title="Payments to supplier">
        {pays.data.length === 0 ? <p className="faint small">Nothing paid yet.</p> : (
          <div className="list">{pays.data.map((p) => (
            <div key={p.id} className="list-item">
              <div className="grow"><b>{money2(p.amount)}</b> <Badge tone={p.kind === 'final' ? 'green' : 'blue'}>{tone(PAY_KIND, p.kind).label}</Badge> <span className="small muted">{p.method}{p.reference && ` · ${p.reference}`}</span>{p.note && <div className="small faint">{p.note}</div>}</div>
              <span className="muted small">{date(p.paid_on)}</span>
              {isFin && <IconBtn icon={Trash2} size={14} title="Remove" onClick={() => delPay(p)} />}
            </div>))}</div>
        )}
        {!isFin && balance > 0 && <p className="small faint mt">Finance records supplier payments.</p>}
      </Card>
      {editing && <WorkOrderModal order={{ ...x, alloc: (x.supplier_bill_allocations || []).map((a) => ({ client_id: a.client_id, invoice_id: a.invoice_id || '', amount: a.amount })) }}
        onClose={() => setEditing(false)} onSaved={() => { setEditing(false); b.reload() }} />}
      {paying && <SupplierPaymentModal bill={x} preset={paying} onClose={() => setPaying(null)} onSaved={() => { setPaying(null); pays.reload(); b.reload() }} />}
    </Modal>
  )
}

export function SupplierPaymentModal({ bill, preset = {}, onClose, onSaved }) {
  const [f, set] = useForm({ paid_on: todayISO(), amount: '', kind: 'advance', method: 'UPI', reference: '', note: '', ...preset })
  const [busy, run] = useAction()
  const balance = Number(bill.total) - Number(bill.amount_paid)
  const save = (e) => { e.preventDefault(); run(async () => {
    const amount = Number(f.amount)
    if (!(amount > 0)) throw new Error('Enter the amount paid')
    if (amount > balance + 0.5) throw new Error(`That is more than the balance of ${money2(balance)}`)
    await q(supabase.from('supplier_payments').insert({ bill_id: bill.id, supplier_id: bill.supplier_id, paid_on: f.paid_on, amount, kind: f.kind, method: f.method, reference: f.reference || null, note: f.note || null }))
    onSaved()
  }, 'Supplier payment recorded') }
  return (
    <Modal open size="sm" onClose={onClose} title={`Pay ${bill.suppliers?.name || 'supplier'}`} subtitle={`${bill.number} · balance ${money2(balance)}`}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button form="spay" type="submit" loading={busy}>Save payment</Button></>}>
      <form id="spay" className="form f1" onSubmit={save}>
        <Field label="Payment type"><Select placeholder={false} options={PAY_KIND} value={f.kind} onChange={(v) => { set('kind')(v); if (v === 'final') set('amount')(balance) }} /></Field>
        <Field label="Amount (₹)" required><Input type="number" min="0" step="any" value={f.amount} onChange={set('amount')} /></Field>
        <Field label="Paid on"><Input type="date" value={f.paid_on} onChange={set('paid_on')} /></Field>
        <Field label="Method"><Select placeholder={false} options={PAYMENT_METHODS} value={f.method} onChange={set('method')} /></Field>
        <Field label="Reference"><Input value={f.reference} onChange={set('reference')} placeholder="UPI ref / cheque no." /></Field>
        <Field label="Note"><Input value={f.note} onChange={set('note')} placeholder="e.g. Advance before starting / balance after logo delivered" /></Field>
      </form>
    </Modal>
  )
}

/* =========================================================== Money flow for an invoice or a client */
export function MoneyFlow({ invoice, clientId }) {
  const { has } = useAuth()
  const [order, setOrder] = useState(null)
  const data = useData(async () => {
    const allocs = await q((invoice
      ? supabase.from('supplier_bill_allocations').select('*, supplier_bills(id,number,title,total,amount_paid,status,work_status, suppliers(name))').eq('invoice_id', invoice.id)
      : supabase.from('supplier_bill_allocations').select('*, supplier_bills(id,number,title,total,amount_paid,status,work_status, suppliers(name))').eq('client_id', clientId)))
    const billIds = [...new Set(allocs.map((a) => a.bill_id))]
    const spays = billIds.length ? await q(supabase.from('supplier_payments').select('*').in('bill_id', billIds)) : []
    const cpays = await q(invoice ? supabase.from('payments').select('*').eq('invoice_id', invoice.id) : supabase.from('payments').select('*').eq('client_id', clientId))
    const invs = invoice ? [invoice] : await q(supabase.from('invoices').select('id,total,amount_paid,status').eq('client_id', clientId).neq('status', 'cancelled'))
    return { allocs, spays, cpays, invs }
  }, [invoice?.id, invoice?.amount_paid, clientId], null)
  if (!data.data) return null
  const { allocs, spays, cpays, invs } = data.data
  const billed = invs.reduce((a, i) => a + Number(i.total), 0)
  const received = cpays.reduce((a, p) => a + Number(p.amount), 0)
  const cost = allocs.filter((a) => a.supplier_bills?.status !== 'cancelled').reduce((a, x) => a + Number(x.amount), 0)
  // share of each bill's payments that belongs to this allocation
  const paidShare = allocs.reduce((a, x) => {
    const b = x.supplier_bills; if (!b || !Number(b.total)) return a
    const paid = spays.filter((p) => p.bill_id === b.id).reduce((s, p) => s + Number(p.amount), 0)
    return a + (paid * Number(x.amount)) / Number(b.total)
  }, 0)
  const events = [
    ...cpays.map((p) => ({ d: p.paid_on, dir: 'in', label: 'Received from customer', amt: Number(p.amount), sub: [p.method, p.reference].filter(Boolean).join(' · ') })),
    ...spays.map((p) => {
      const a = allocs.find((x) => x.bill_id === p.bill_id); const b = a?.supplier_bills
      const share = b && Number(b.total) ? Number(a.amount) / Number(b.total) : 1
      return { d: p.paid_on, dir: 'out', label: `Paid ${b?.suppliers?.name || 'supplier'} (${p.kind})`, amt: Math.round(Number(p.amount) * share * 100) / 100, sub: `${b?.number}${share < 1 ? ` · your share ${Math.round(share * 100)}%` : ''}`, bill: b?.id }
    })
  ].sort((a, b) => a.d.localeCompare(b.d))
  let run = 0
  return (
    <Card className={invoice ? 'mt-l no-print' : ''} style={invoice ? { maxWidth: 820, margin: '20px auto 0' } : undefined} title={invoice ? 'Money flow for this job' : 'Money flow — customer receipts vs supplier costs'}
      actions={has('suppliers.manage') && <Button size="sm" variant="outline" icon={Truck} onClick={() => setOrder({ alloc: [{ client_id: invoice?.client_id || clientId, invoice_id: invoice?.id || '', amount: '' }] })}>Add supplier cost</Button>}>
      <div className="grid g4 mb small">
        <div><div className="muted">Billed to customer</div><b style={{ fontSize: 17 }}>{money(billed)}</b></div>
        <div><div className="muted">Received</div><b style={{ fontSize: 17, color: 'var(--green-d)' }}>{money(received)}</b><div className="faint">{money(billed - received)} pending</div></div>
        <div><div className="muted">Supplier cost</div><b style={{ fontSize: 17 }}>{money(cost)}</b><div className="faint">{money(paidShare)} paid · {money(cost - paidShare)} to pay</div></div>
        <div><div className="muted">Your margin</div><b style={{ fontSize: 17, color: billed - cost >= 0 ? 'var(--ink)' : 'var(--red)' }}>{money(billed - cost)}</b><div className="faint">{billed ? Math.round(((billed - cost) / billed) * 100) : 0}% · cash in hand {money(received - paidShare)}</div></div>
      </div>
      {allocs.length > 0 && (
        <div className="list mb">{allocs.map((a) => (
          <div key={a.id} className="list-item click small" onClick={() => setOrder({ open: a.bill_id })}>
            <Truck size={15} />
            <div className="grow"><b>{a.supplier_bills?.suppliers?.name}</b> · {a.supplier_bills?.title}<div className="tiny faint">{a.supplier_bills?.number}{Number(a.amount) !== Number(a.supplier_bills?.total) && ` · share ${money(a.amount)} of ${money(a.supplier_bills?.total)}`}</div></div>
            <Pill list={WORK_STATUS} v={a.supplier_bills?.work_status} /><Pill list={BILL_PAY_STATUS} v={a.supplier_bills?.status} /><b>{money(a.amount)}</b>
          </div>))}</div>
      )}
      {events.length > 0 ? (
        <div className="table-wrap"><table className="table small">
          <thead><tr><th>Date</th><th>Movement</th><th className="num">In</th><th className="num">Out</th><th className="num">Net cash</th></tr></thead>
          <tbody>{events.map((e, i) => { run += e.dir === 'in' ? e.amt : -e.amt; return (
            <tr key={i} className={e.bill ? 'click' : ''} onClick={() => e.bill && setOrder({ open: e.bill })}>
              <td className="nowrap">{date(e.d)}</td><td><div>{e.label}</div><div className="cell-sub">{e.sub}</div></td>
              <td className="num" style={{ color: 'var(--green-d)' }}>{e.dir === 'in' ? money(e.amt) : ''}</td>
              <td className="num" style={{ color: 'var(--red)' }}>{e.dir === 'out' ? money(e.amt) : ''}</td>
              <td className="num strong">{money(run)}</td>
            </tr>) })}</tbody>
        </table></div>
      ) : <p className="faint small">No money movements yet.</p>}
      {order && (order.open
        ? <WorkOrderView id={order.open} onClose={() => { setOrder(null); data.reload() }} />
        : <WorkOrderModal order={order} onClose={() => setOrder(null)} onSaved={(row) => { data.reload(); setOrder({ open: row.id }) }} />)}
    </Card>
  )
}
