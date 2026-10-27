import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Download, Wallet, ArrowDownLeft, ArrowUpRight, Scale } from 'lucide-react'
import { supabase, q } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useData, useLocal } from '../../lib/hooks'
import { PAYMENT_METHODS } from '../../lib/constants'
import { money, money2, date, monthStart, monthEnd, downloadCSV } from '../../lib/format'
import { PageHeader, Button, Stat, Select, ClientSelect, MemberSelect, Input, Loading, Empty, Badge, Tabs } from '../../components/ui'
import { PaymentModal } from './Invoices'
import { WorkOrderView } from './Suppliers'
import DateRange from '../../components/DateRange'

export default function Payments() {
  const [tab, setTab] = useLocal('payments.tab', 'ledger')
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(monthEnd())
  const [method, setMethod] = useState('')
  const [client, setClient] = useState('')
  const [by, setBy] = useState('')
  const [adding, setAdding] = useState(false)
  const [bill, setBill] = useState(null)
  const { member } = useAuth()
  const nav = useNavigate()
  const { data, loading, reload } = useData(async () => {
    const [inc, out, exp, reimb] = await Promise.all([
      q(supabase.from('payments').select('*, invoices(number), clients(name)').gte('paid_on', from).lte('paid_on', to).order('paid_on', { ascending: false })),
      q(supabase.from('supplier_payments').select('*, suppliers(name), supplier_bills(id,number,title, supplier_bill_allocations(client_id, amount, clients(name)))').gte('paid_on', from).lte('paid_on', to).order('paid_on', { ascending: false })),
      // costs paid from a founder's / staff member's own account are listed, but leave company cash only when repaid
      q(supabase.from('expenses').select('*, clients(name)').gte('spent_on', from).lte('spent_on', to).order('spent_on', { ascending: false })),
      q(supabase.from('reimbursements').select('*').gte('paid_on', from).lte('paid_on', to).order('paid_on', { ascending: false }))
    ])
    return { inc, out, exp, reimb }
  }, [from, to], { inc: [], out: [], exp: [], reimb: [] })

  const custOf = (p) => (p.supplier_bills?.supplier_bill_allocations || []).map((a) => a.clients?.name).filter(Boolean).join(', ')
  const inc = useMemo(() => data.inc.filter((p) => (!method || p.method === method) && (!client || p.client_id === client) && (!by || p.collected_by === by)), [data.inc, method, client, by])
  const out = useMemo(() => data.out.filter((p) => (!method || p.method === method) && (!client || (p.supplier_bills?.supplier_bill_allocations || []).some((a) => a.client_id === client))), [data.out, method, client])
  const exp = useMemo(() => data.exp.filter((e) => (!method || e.method === method) && (!client || e.client_id === client)), [data.exp, method, client])
  const tIn = inc.reduce((a, p) => a + Number(p.amount), 0)
  const outCo = out.filter((p) => !p.paid_by), outOwn = out.filter((p) => p.paid_by)
  const tSup = outCo.reduce((a, p) => a + Number(p.amount), 0)
  const reimb = useMemo(() => data.reimb.filter((r) => (!method || r.method === method) && !client), [data.reimb, method, client])
  const expCo = exp.filter((e) => !e.paid_by), expOwn = exp.filter((e) => e.paid_by)
  const tExp = expCo.reduce((a, e) => a + Number(e.amount), 0) + reimb.reduce((a, r) => a + Number(r.amount), 0)
  const own = [...outOwn, ...expOwn]
  const tOwn = own.reduce((a, x) => a + Number(x.amount), 0)
  const tOwnDue = own.filter((x) => !x.reimbursement_id).reduce((a, x) => a + Number(x.amount), 0)
  const ownTag = (x) => `Paid by ${(member(x.paid_by)?.full_name || 'team member').split(' ')[0]} · ${x.reimbursement_id ? 'repaid' : 'to repay'}`

  const ledger = useMemo(() => {
    const rows = [
      ...inc.map((p) => ({ id: p.id, d: p.paid_on, dir: 'in', kind: 'Customer payment', who: p.clients?.name, whoLink: p.client_id && `/clients/${p.client_id}`, ref: p.invoices?.number, refLink: p.invoice_id && `/finance/invoices/${p.invoice_id}`, method: p.method + (member(p.collected_by) ? ` · ${member(p.collected_by).full_name.split(' ')[0]}` : ''), note: p.reference, amt: Number(p.amount) })),
      ...out.map((p) => ({ id: p.id, d: p.paid_on, dir: p.paid_by ? 'own' : 'out', own: p.paid_by && ownTag(p), kind: `Supplier · ${p.kind}`, who: p.suppliers?.name, whoLink: `/finance/suppliers/${p.supplier_id}`, forWho: custOf(p), ref: p.supplier_bills?.number, bill: p.supplier_bills?.id, method: p.method, note: p.reference, amt: Number(p.amount) })),
      ...exp.map((e) => ({ id: e.id, d: e.spent_on, dir: e.paid_by ? 'own' : 'out', own: e.paid_by && ownTag(e), kind: `Expense · ${e.category}`, who: e.vendor, whoLink: e.supplier_id && `/finance/suppliers/${e.supplier_id}`, forWho: e.clients?.name, method: e.method, note: e.description, amt: Number(e.amount) })),
      ...reimb.map((r) => ({ id: r.id, d: r.paid_on, dir: 'out', kind: 'Repaid to founder / staff', who: member(r.person_id)?.full_name || 'Team member', whoLink: '/finance/expenses', method: r.method, note: r.reference || r.note, amt: Number(r.amount) }))
    ].sort((a, b) => a.d.localeCompare(b.d) || (a.dir === 'in' ? -1 : 1))
    let bal = 0
    return rows.map((r) => ({ ...r, bal: (bal += r.dir === 'in' ? r.amt : r.dir === 'out' ? -r.amt : 0) })).reverse()
  }, [inc, out, exp, reimb, member])

  const csv = () => downloadCSV(`cash-flow-${from}-to-${to}.csv`, [...ledger].reverse().map((r) => ({ date: r.d, type: r.kind, party: r.who, for_customer: r.forWho || '', reference: r.ref || '', method: r.method, money_in: r.dir === 'in' ? r.amt : '', money_out: r.dir === 'out' ? r.amt : '', paid_personally: r.dir === 'own' ? r.amt : '', note: r.own || '', running_balance: r.bal })))

  return (
    <>
      <PageHeader title="Payments & cash flow" subtitle="Money received from customers and paid to suppliers, side by side."
        actions={<>
          <Button variant="outline" icon={Download} onClick={csv}>Export</Button>
          <Link className="btn btn-outline" to="/finance/work-orders"><ArrowUpRight size={16} />Pay a supplier</Link>
          <Button icon={Plus} onClick={() => setAdding(true)}>Record customer payment</Button>
        </>} />
      <div className="filters">
        <DateRange from={from} to={to} onChange={(a, b) => { setFrom(a); setTo(b) }} />
        <ClientSelect value={client} onChange={(v) => setClient(v || '')} placeholder="All customers" includeInactive />
        <Select options={PAYMENT_METHODS} value={method} onChange={(v) => setMethod(v || '')} placeholder="All methods" />
        {tab === 'in' && <MemberSelect value={by} onChange={(v) => setBy(v || '')} placeholder="Received by anyone" />}
      </div>
      <div className="stats">
        <Stat label="Money in" value={money(tIn)} sub={`${inc.length} customer payments`} icon={ArrowDownLeft} onClick={() => setTab('in')} />
        <Stat label="Paid to suppliers" value={money(tSup)} sub={`${outCo.length} from company account`} icon={ArrowUpRight} tone="orange" onClick={() => setTab('out')} />
        <Stat label="Other expenses" value={money(tExp)} sub={`${expCo.length} entries${reimb.length ? ` · ${reimb.length} repayments` : ''}`} icon={Wallet} tone="red" />
        {own.length > 0 && <Stat label="Paid personally (founder / staff)" value={money(tOwn)} sub={tOwnDue ? `${money(tOwnDue)} still to repay · not in company cash` : 'All repaid'} icon={Wallet} tone="amber" onClick={() => nav('/finance/expenses')} />}
        <Stat label="Net cash flow" value={money(tIn - tSup - tExp)} icon={Scale} tone={tIn - tSup - tExp >= 0 ? 'teal' : 'red'} onClick={() => setTab('ledger')} />
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'ledger', label: 'All movements', count: ledger.length }, { id: 'in', label: 'Received from customers', count: inc.length }, { id: 'out', label: 'Paid to suppliers', count: out.length }]} />
      {loading ? <Loading /> : tab === 'ledger' ? (
        ledger.length === 0 ? <Empty icon={Wallet} title="No money movements in this period" /> : (
          <div className="card table-wrap"><table className="table">
            <thead><tr><th>Date</th><th>Movement</th><th>Party</th><th>For customer</th><th>Ref</th><th className="num">In</th><th className="num">Out</th><th className="num">Balance</th></tr></thead>
            <tbody>{ledger.map((r) => (
              <tr key={r.dir + r.id} className={r.bill ? 'click' : ''} onClick={() => r.bill && setBill(r.bill)}>
                <td className="nowrap">{date(r.d)}</td>
                <td><Badge tone={r.dir === 'in' ? 'green' : r.dir === 'own' ? 'amber' : r.kind.startsWith('Supplier') ? 'orange' : 'slate'}>{r.dir === 'in' ? '↓ In' : r.dir === 'own' ? '⟲ Personal' : '↑ Out'}</Badge> <span className="small">{r.kind}</span>{r.own && <div className="tiny" style={{ color: 'var(--amber, #b45309)' }}>{r.own} · not from company cash</div>}</td>
                <td className="cell-title">{r.whoLink ? <Link to={r.whoLink} onClick={(e) => e.stopPropagation()} title="Open account statement">{r.who}</Link> : r.who || '—'}</td>
                <td className="small">{r.dir === 'in' ? r.who : r.forWho || <span className="faint">—</span>}</td>
                <td className="small">{r.refLink ? <Link to={r.refLink} onClick={(e) => e.stopPropagation()}>{r.ref}</Link> : r.ref || r.note || '—'}</td>
                <td className="num" style={{ color: 'var(--green-d)' }}>{r.dir === 'in' ? money2(r.amt) : ''}</td>
                <td className="num" style={{ color: r.dir === 'own' ? 'var(--text-3)' : 'var(--red)' }}>{r.dir === 'out' ? money2(r.amt) : r.dir === 'own' ? <span title="Paid personally — counts when the company repays">({money2(r.amt)})</span> : ''}</td>
                <td className="num strong">{money2(r.bal)}</td>
              </tr>))}</tbody>
            <tfoot><tr><td colSpan={5}>Total</td><td className="num">{money2(tIn)}</td><td className="num">{money2(tSup + tExp)}</td><td className="num">{money2(tIn - tSup - tExp)}</td></tr></tfoot>
          </table></div>
        )
      ) : tab === 'in' ? (
        inc.length === 0 ? <Empty icon={Wallet} title="No customer payments in this period" /> : (
          <div className="card table-wrap"><table className="table">
            <thead><tr><th>Date</th><th>Customer</th><th>Invoice</th><th>Method</th><th>Received by</th><th>Reference</th><th className="num">Amount</th></tr></thead>
            <tbody>{inc.map((p) => (
              <tr key={p.id}>
                <td className="nowrap">{date(p.paid_on)}</td><td className="cell-title">{p.client_id ? <Link to={`/clients/${p.client_id}`}>{p.clients?.name}</Link> : '—'}</td>
                <td>{p.invoice_id ? <Link to={`/finance/invoices/${p.invoice_id}`}>{p.invoices?.number}</Link> : <Badge tone="amber">On account</Badge>}</td>
                <td>{p.method}</td><td className="small">{member(p.collected_by)?.full_name || '—'}</td><td className="small muted">{p.reference || p.note || '—'}</td><td className="num strong">{money2(p.amount)}</td>
              </tr>))}</tbody>
            <tfoot><tr><td colSpan={6}>Total</td><td className="num">{money2(tIn)}</td></tr></tfoot>
          </table></div>
        )
      ) : (
        out.length === 0 ? <Empty icon={Wallet} title="No supplier payments in this period">Open a supplier work order and press “Pay supplier”.</Empty> : (
          <div className="card table-wrap"><table className="table">
            <thead><tr><th>Date</th><th>Supplier</th><th>Work order</th><th>For customer</th><th>Type</th><th>Method</th><th className="num">Amount</th></tr></thead>
            <tbody>{out.map((p) => (
              <tr key={p.id} className="click" onClick={() => p.supplier_bills?.id && setBill(p.supplier_bills.id)}>
                <td className="nowrap">{date(p.paid_on)}</td><td className="cell-title"><Link to={`/finance/suppliers/${p.supplier_id}`} onClick={(e) => e.stopPropagation()}>{p.suppliers?.name}</Link></td>
                <td><div>{p.supplier_bills?.title}</div><div className="cell-sub">{p.supplier_bills?.number}</div>{p.paid_by && <Badge tone="amber">{ownTag(p)}</Badge>}</td>
                <td className="small">{custOf(p) || <span className="faint">Internal</span>}</td>
                <td><Badge tone={p.kind === 'final' ? 'green' : 'blue'}>{p.kind}</Badge></td><td>{p.method}{p.reference && <div className="cell-sub">{p.reference}</div>}</td>
                <td className="num strong">{money2(p.amount)}</td>
              </tr>))}</tbody>
            <tfoot><tr><td colSpan={6}>Total</td><td className="num">{money2(tSup)}</td></tr></tfoot>
          </table></div>
        )
      )}
      {adding && <PaymentModal onClose={() => setAdding(false)} onSaved={() => { setAdding(false); reload() }} />}
      {bill && <WorkOrderView id={bill} onClose={() => { setBill(null); reload() }} />}
    </>
  )
}
