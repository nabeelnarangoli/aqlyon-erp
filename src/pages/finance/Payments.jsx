import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Download, Wallet } from 'lucide-react'
import { supabase, q } from '../../lib/supabase'
import { useData } from '../../lib/hooks'
import { PAYMENT_METHODS } from '../../lib/constants'
import { money, money2, date, monthStart, monthEnd, downloadCSV } from '../../lib/format'
import { PageHeader, Button, Stat, Select, ClientSelect, Input, Loading, Empty, Badge } from '../../components/ui'
import { PaymentModal } from './Invoices'

export default function Payments() {
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(monthEnd())
  const [method, setMethod] = useState('')
  const [client, setClient] = useState('')
  const [adding, setAdding] = useState(false)
  const { data, loading, reload } = useData(() => q(supabase.from('payments').select('*, invoices(number), clients(name)').gte('paid_on', from).lte('paid_on', to).order('paid_on', { ascending: false })), [from, to], [])
  const rows = useMemo(() => data.filter((p) => (!method || p.method === method) && (!client || p.client_id === client)), [data, method, client])
  const total = rows.reduce((a, p) => a + Number(p.amount), 0)
  const byMethod = PAYMENT_METHODS.map((m) => ({ m, v: rows.filter((p) => p.method === m).reduce((a, p) => a + Number(p.amount), 0) })).filter((x) => x.v)
  return (
    <>
      <PageHeader title="Payments received" subtitle="Every rupee collected, by client and method."
        actions={<>
          <Button variant="outline" icon={Download} onClick={() => downloadCSV(`payments-${from}-to-${to}.csv`, rows.map((p) => ({ date: p.paid_on, client: p.clients?.name, invoice: p.invoices?.number, amount: p.amount, method: p.method, reference: p.reference, note: p.note })))}>Export</Button>
          <Button icon={Plus} onClick={() => setAdding(true)}>Record payment</Button>
        </>} />
      <div className="filters">
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ width: 160 }} />
        <span className="muted">to</span>
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ width: 160 }} />
        <ClientSelect value={client} onChange={(v) => setClient(v || '')} placeholder="All clients" includeInactive />
        <Select options={PAYMENT_METHODS} value={method} onChange={(v) => setMethod(v || '')} placeholder="All methods" />
      </div>
      <div className="stats">
        <Stat label="Collected in period" value={money(total)} sub={`${rows.length} payments`} icon={Wallet} />
        {byMethod.slice(0, 3).map((x) => <Stat key={x.m} label={x.m} value={money(x.v)} icon={Wallet} tone="teal" />)}
      </div>
      {loading ? <Loading /> : rows.length === 0 ? <Empty icon={Wallet} title="No payments in this period" /> : (
        <div className="card table-wrap"><table className="table">
          <thead><tr><th>Date</th><th>Client</th><th>Invoice</th><th>Method</th><th>Reference</th><th className="num">Amount</th></tr></thead>
          <tbody>{rows.map((p) => (
            <tr key={p.id}>
              <td className="nowrap">{date(p.paid_on)}</td><td className="cell-title">{p.clients?.name || '—'}</td>
              <td>{p.invoice_id ? <Link to={`/finance/invoices/${p.invoice_id}`}>{p.invoices?.number}</Link> : <Badge tone="amber">On account</Badge>}</td>
              <td>{p.method}</td><td className="small muted">{p.reference || p.note || '—'}</td><td className="num strong">{money2(p.amount)}</td>
            </tr>))}</tbody>
          <tfoot><tr><td colSpan={5}>Total</td><td className="num">{money2(total)}</td></tr></tfoot>
        </table></div>
      )}
      {adding && <PaymentModal onClose={() => setAdding(false)} onSaved={() => { setAdding(false); reload() }} />}
    </>
  )
}
