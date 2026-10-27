import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Repeat, Download, FileText, AlertTriangle, Wallet, TrendingUp } from 'lucide-react'
import { supabase, q } from '../../lib/supabase'
import { useData } from '../../lib/hooks'
import { useAuth } from '../../lib/auth'
import { INVOICE_STATUS, PAYMENT_METHODS } from '../../lib/constants'
import { money, money2, date, monthStart, monthEnd, todayISO, downloadCSV } from '../../lib/format'
import {
  PageHeader, Button, Badge, StatusBadge, Stat, Modal, Field, Input, Select, Textarea, ClientSelect, MemberSelect, SearchInput, Loading, Empty, DocActions,
  useAction, useForm, useToast
} from '../../components/ui'
import DocEditor from './DocEditor'
import DateRange, { presetRange } from '../../components/DateRange'

export default function Invoices() {
  const { has } = useAuth()
  const nav = useNavigate()
  const { confirm, toast } = useToast()
  const [params, setParams] = useSearchParams()
  const [status, setStatus] = useState('')
  const [client, setClient] = useState('')
  const [search, setSearch] = useState('')
  const [[from, to], setRange] = useState(() => presetRange('all'))
  const [editing, setEditing] = useState(null)
  const [paying, setPaying] = useState(null)
  const [busy, run] = useAction()
  const { data, loading, reload } = useData(() => q(supabase.from('v_invoice_status').select('*').order('issue_date', { ascending: false }).limit(2000)), [], [])
  const isFin = has('invoices.manage')

  useEffect(() => {
    if (params.get('new')) { setEditing({ client_id: params.get('client') || '' }); setParams({}, { replace: true }) }
  }, [params, setParams])

  const rows = useMemo(() => data.filter((i) => {
    if (i.issue_date < from || i.issue_date > to) return false
    if (client && i.client_id !== client) return false
    if (status === 'overdue') { if (!i.overdue) return false } else if (status === 'unpaid') { if (!['sent', 'partial'].includes(i.status)) return false } else if (status && i.status !== status) return false
    if (search && ![i.number, i.client_name].some((v) => v?.toLowerCase().includes(search.toLowerCase()))) return false
    return true
  }), [data, client, status, search, from, to])

  const ms = monthStart(), me = monthEnd()
  const live = data.filter((i) => i.status !== 'cancelled')
  const outstanding = live.filter((i) => i.status !== 'draft').reduce((a, i) => a + Number(i.balance), 0)
  const overdue = live.filter((i) => i.overdue)
  const thisMonth = live.filter((i) => i.issue_date >= ms && i.issue_date <= me).reduce((a, i) => a + Number(i.total), 0)
  const drafts = live.filter((i) => i.status === 'draft').length

  const generate = async () => {
    const label = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    if (!(await confirm(`Create draft invoices for every active retainer package for ${label}? Packages already invoiced this month are skipped.`, { okText: 'Generate' }))) return
    const n = await run(() => q(supabase.rpc('generate_retainer_invoices', { p_month: ms })))
    if (n === false) return
    reload()
    toast(n ? `${n} retainer invoice(s) created as drafts — review and mark as sent` : 'All retainers are already invoiced for this month', n ? 'success' : 'info')
  }

  return (
    <>
      <PageHeader title="Invoices" subtitle="Bill clients, track what’s due and record payments."
        actions={<>
          <Button variant="outline" icon={Download} onClick={() => downloadCSV('invoices.csv', rows.map((i) => ({ number: i.number, client: i.client_name, date: i.issue_date, due: i.due_date, status: i.status, total: i.total, paid: i.amount_paid, balance: i.balance })))}>Export</Button>
          {isFin && <Button variant="dark" icon={Repeat} loading={busy} onClick={generate}>Generate retainer invoices</Button>}
          {isFin && <Button icon={Plus} onClick={() => setEditing({})}>New invoice</Button>}
        </>} />
      <div className="stats">
        <Stat label="Outstanding" value={money(outstanding)} sub={`${live.filter((i) => ['sent', 'partial'].includes(i.status)).length} unpaid invoices`} icon={Wallet} tone="amber" onClick={() => setStatus('unpaid')} />
        <Stat label="Overdue" value={money(overdue.reduce((a, i) => a + Number(i.balance), 0))} sub={`${overdue.length} invoices past due`} icon={AlertTriangle} tone={overdue.length ? 'red' : 'green'} onClick={() => setStatus('overdue')} />
        <Stat label="Invoiced this month" value={money(thisMonth)} icon={TrendingUp} tone="teal" />
        <Stat label="Drafts to send" value={drafts} icon={FileText} tone="blue" onClick={() => setStatus('draft')} />
      </div>
      <div className="filters">
        <SearchInput value={search} onChange={setSearch} placeholder="Invoice no. or client…" />
        <DateRange from={from} to={to} onChange={(a, b) => setRange([a, b])} />
        <ClientSelect value={client} onChange={(v) => setClient(v || '')} placeholder="All clients" includeInactive />
        <Select options={[{ id: 'unpaid', label: 'Unpaid (sent + partial)' }, { id: 'overdue', label: 'Overdue' }, ...INVOICE_STATUS]} value={status} onChange={(v) => setStatus(v || '')} placeholder="All statuses" />
      </div>
      {loading ? <Loading /> : rows.length === 0 ? <Empty icon={FileText} title="No invoices">Create one, or generate this month’s retainer invoices from client packages.</Empty> : (
        <div className="card table-wrap"><table className="table">
          <thead><tr><th>Invoice</th><th>Client</th><th>Date</th><th>Due</th><th>Status</th><th className="num">Total</th><th className="num">Paid</th><th className="num">Balance</th><th />{isFin && <th />}</tr></thead>
          <tbody>{rows.map((i) => (
            <tr key={i.id} className="click" onClick={() => nav(`/finance/invoices/${i.id}`)}>
              <td className="cell-title nowrap">{i.number}</td>
              <td>{i.client_name}</td>
              <td className="nowrap">{date(i.issue_date)}</td>
              <td className="nowrap">{i.overdue ? <Badge tone="red">{i.days_overdue}d overdue</Badge> : date(i.due_date)}</td>
              <td><StatusBadge list={INVOICE_STATUS} value={i.status} /></td>
              <td className="num">{money(i.total)}</td><td className="num">{money(i.amount_paid)}</td><td className="num strong">{money(i.balance)}</td>
              <td><DocActions to={`/finance/invoices/${i.id}`} /></td>
              {isFin && <td onClick={(e) => e.stopPropagation()}>{['sent', 'partial', 'draft'].includes(i.status) && <Button size="sm" variant="soft" onClick={() => setPaying(i)}>Record payment</Button>}</td>}
            </tr>))}</tbody>
          <tfoot><tr><td colSpan={5}>{rows.length} invoices</td><td className="num">{money(rows.reduce((a, i) => a + Number(i.total), 0))}</td><td className="num">{money(rows.reduce((a, i) => a + Number(i.amount_paid), 0))}</td><td className="num">{money(rows.reduce((a, i) => a + Number(i.balance), 0))}</td><td />{isFin && <td />}</tr></tfoot>
          </table></div>
      )}
      {editing && <DocEditor kind="invoice" doc={editing} onClose={() => setEditing(null)} onSaved={(row) => { setEditing(null); nav(`/finance/invoices/${row.id}`) }} />}
      {paying && <PaymentModal invoice={paying} onClose={() => setPaying(null)} onSaved={() => { setPaying(null); reload() }} />}
    </>
  )
}

export function PaymentModal({ invoice, payment, onClose, onSaved }) {
  const isNew = !payment?.id
  const { user } = useAuth()
  const balance = invoice ? Number(invoice.total) - Number(invoice.amount_paid) : 0
  const [f, set] = useForm({ invoice_id: invoice?.id || '', client_id: invoice?.client_id || '', paid_on: todayISO(), amount: balance > 0 ? balance : '', method: 'UPI', reference: '', note: '', collected_by: '', ...payment })
  const invs = useData(() => (invoice ? [] : q(supabase.from('v_invoice_status').select('id,number,client_id,client_name,balance').in('status', ['sent', 'partial', 'draft']).order('issue_date'))), [], [])
  const [busy, run] = useAction()
  const save = (e) => { e.preventDefault(); run(async () => {
    const p = { invoice_id: f.invoice_id || null, client_id: f.client_id || null, paid_on: f.paid_on, amount: Number(f.amount), method: f.method, reference: f.reference || null, note: f.note || null, collected_by: f.collected_by || null }
    if (!(p.amount > 0)) throw new Error('Enter an amount')
    if (invoice && invoice.status === 'draft') await q(supabase.from('invoices').update({ status: 'sent' }).eq('id', invoice.id))
    isNew ? await q(supabase.from('payments').insert(p)) : await q(supabase.from('payments').update(p).eq('id', payment.id))
    onSaved()
  }, 'Payment recorded') }
  const pick = (id) => { const i = invs.data.find((x) => x.id === id); set('invoice_id')(id); if (i) { set('client_id')(i.client_id); set('amount')(i.balance) } }
  return (
    <Modal open size="sm" onClose={onClose} title={isNew ? 'Record payment' : 'Edit payment'} subtitle={invoice && `${invoice.number} · balance ${money2(balance)}`}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button form="pay" type="submit" loading={busy}>Save payment</Button></>}>
      <form id="pay" className="form f1" onSubmit={save}>
        {!invoice && <Field label="Against invoice"><Select options={invs.data.map((i) => ({ id: i.id, label: `${i.number} · ${i.client_name} · ${money(i.balance)} due` }))} value={f.invoice_id} onChange={pick} placeholder="No invoice (advance / on account)" /></Field>}
        {!invoice && !f.invoice_id && <Field label="Client"><ClientSelect allowCreate value={f.client_id} onChange={set('client_id')} /></Field>}
        <Field label="Amount (₹)" required><Input type="number" min="0" step="any" required value={f.amount} onChange={set('amount')} /></Field>
        <Field label="Received on"><Input type="date" value={f.paid_on} onChange={set('paid_on')} /></Field>
        <Field label="Method"><Select placeholder={false} options={PAYMENT_METHODS} value={f.method} onChange={set('method')} /></Field>
        <Field label="Money received by" hint="Company account, or the team member holding the cash / whose account it came into"><MemberSelect value={f.collected_by} onChange={set('collected_by')} placeholder="Company account" /></Field>
        <Field label="Reference" hint="UPI ref / cheque no. / transaction ID"><Input value={f.reference} onChange={set('reference')} /></Field>
        <Field label="Note"><Textarea rows={2} value={f.note} onChange={set('note')} /></Field>
      </form>
    </Modal>
  )
}
