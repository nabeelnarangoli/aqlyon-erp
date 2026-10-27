import { Link } from 'react-router-dom'
import { useMemo, useState } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, PieChart, Pie, Cell
} from 'recharts'
import { Download, Printer } from 'lucide-react'
import { supabase, q, DEMO } from '../../lib/supabase'
import { useData } from '../../lib/hooks'
import { useAuth } from '../../lib/auth'
import { LEAD_STAGES, LEAD_SOURCES } from '../../lib/constants'
import { money, compact, n, pct, hours, toISO, daysFrom, downloadCSV, monthStart } from '../../lib/format'
import { PageHeader, Tabs, Card, Stat, Loading, Empty, Button, Input, Badge, Progress, Avatar } from '../../components/ui'
import { monthly } from '../crm/Clients'

const COLORS = ['#1ba76a', '#2b1416', '#2fb383', '#c98a0c', '#2f6fd6', '#7a4fd1', '#e5732b', '#0f9a9a', '#d64545', '#8f8787']
const monthsBetween = (from, to) => {
  const out = []; const d = new Date(from.slice(0, 7) + '-01T00:00:00'); const end = new Date(to.slice(0, 7) + '-01T00:00:00')
  while (d <= end && out.length < 36) { out.push(toISO(d).slice(0, 7)); d.setMonth(d.getMonth() + 1) }
  return out
}
const mLabel = (k) => new Date(k + '-01T00:00:00').toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })

export default function Reports() {
  const { has } = useAuth()
  const tabs = [
    has('reports.finance') && { id: 'finance', label: 'Profit & Loss' },
    has('reports.finance') && { id: 'receivables', label: 'Receivables' },
    has('reports.clients') && { id: 'clients', label: 'Client profitability' },
    has('reports.sales') && { id: 'sales', label: 'Sales & leads' },
    has('reports.team', 'tasks.work') && { id: 'team', label: has('reports.team') ? 'Team productivity' : 'My productivity' },
    has('reports.content') && { id: 'content', label: 'Content delivery' }
  ].filter(Boolean)
  const [tab, setTab] = useState(tabs[0]?.id)
  const y = new Date()
  const [from, setFrom] = useState(toISO(new Date(y.getFullYear(), y.getMonth() - 5, 1)))
  const [to, setTo] = useState(toISO(new Date(y.getFullYear(), y.getMonth() + 1, 0)))
  const presets = [
    ['This month', monthStart(), toISO(new Date(y.getFullYear(), y.getMonth() + 1, 0))],
    ['Last 6 months', toISO(new Date(y.getFullYear(), y.getMonth() - 5, 1)), toISO(new Date(y.getFullYear(), y.getMonth() + 1, 0))],
    ['Financial year', toISO(new Date(y.getMonth() >= 3 ? y.getFullYear() : y.getFullYear() - 1, 3, 1)), toISO(new Date(y.getMonth() >= 3 ? y.getFullYear() + 1 : y.getFullYear(), 2, 31))]
  ]
  return (
    <>
      <PageHeader title="Reports" subtitle="Know which clients, services and people make the agency money."
        actions={!DEMO && <Button variant="outline" icon={Printer} onClick={() => window.print()}>Print</Button>} />
      {tab !== 'receivables' && (
        <div className="filters no-print">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ width: 160 }} />
          <span className="muted">to</span>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ width: 160 }} />
          {presets.map(([l, a, b]) => <Button key={l} size="sm" variant={from === a && to === b ? 'soft' : 'ghost'} onClick={() => { setFrom(a); setTo(b) }}>{l}</Button>)}
        </div>
      )}
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === 'finance' && <PnL from={from} to={to} />}
      {tab === 'receivables' && <Receivables />}
      {tab === 'clients' && <ClientProfit from={from} to={to} />}
      {tab === 'sales' && <Sales from={from} to={to} />}
      {tab === 'team' && <Team from={from} to={to} />}
      {tab === 'content' && <Content from={from} to={to} />}
    </>
  )
}

function ChartCard({ title, children, h = 280 }) {
  return <Card title={title}><div style={{ height: h }}><ResponsiveContainer>{children}</ResponsiveContainer></div></Card>
}

/* ---------------- P&L ---------------- */
function PnL({ from, to }) {
  const { data, loading } = useData(async () => {
    const [inv, pay, exp, sb, sp, rb] = await Promise.all([
      q(supabase.from('invoices').select('issue_date,total,status').neq('status', 'cancelled').neq('status', 'draft').gte('issue_date', from).lte('issue_date', to)),
      q(supabase.from('payments').select('paid_on,amount').gte('paid_on', from).lte('paid_on', to)),
      q(supabase.from('expenses').select('spent_on,amount,category,rebillable,supplier_id,vendor,paid_by').gte('spent_on', from).lte('spent_on', to)),
      q(supabase.from('supplier_bills').select('order_date,total,status,supplier_id, suppliers(name)').neq('status', 'cancelled').gte('order_date', from).lte('order_date', to)),
      q(supabase.from('supplier_payments').select('paid_on,amount,paid_by').gte('paid_on', from).lte('paid_on', to)),
      q(supabase.from('reimbursements').select('paid_on,amount').gte('paid_on', from).lte('paid_on', to)).catch(() => [])
    ])
    return { inv, pay, exp, sb, sp, rb }
  }, [from, to], null)
  if (loading || !data) return <Loading />
  const months = monthsBetween(from, to)
  const rows = months.map((k) => {
    const r = {
      k, m: mLabel(k),
      Invoiced: data.inv.filter((x) => x.issue_date.startsWith(k)).reduce((a, x) => a + Number(x.total), 0),
      Collected: data.pay.filter((x) => x.paid_on.startsWith(k)).reduce((a, x) => a + Number(x.amount), 0),
      Expenses: data.exp.filter((x) => x.spent_on.startsWith(k)).reduce((a, x) => a + Number(x.amount), 0),
      Suppliers: data.sb.filter((x) => x.order_date.startsWith(k)).reduce((a, x) => a + Number(x.total), 0),
      SupPaid: data.sp.filter((x) => !x.paid_by && x.paid_on.startsWith(k)).reduce((a, x) => a + Number(x.amount), 0),
      // cash actually paid for expenses: company-account expenses + repayments to founders / staff
      ExpPaid: data.exp.filter((x) => !x.paid_by && x.spent_on.startsWith(k)).reduce((a, x) => a + Number(x.amount), 0) + data.rb.filter((x) => x.paid_on.startsWith(k)).reduce((a, x) => a + Number(x.amount), 0)
    }
    r.Costs = r.Expenses + r.Suppliers
    r.Profit = r.Invoiced - r.Costs; r.Cash = r.Collected - r.ExpPaid - r.SupPaid
    return r
  })
  const T = rows.reduce((a, r) => ({ Invoiced: a.Invoiced + r.Invoiced, Collected: a.Collected + r.Collected, Expenses: a.Expenses + r.Expenses, Suppliers: a.Suppliers + r.Suppliers, SupPaid: a.SupPaid + r.SupPaid, ExpPaid: a.ExpPaid + r.ExpPaid }), { Invoiced: 0, Collected: 0, Expenses: 0, Suppliers: 0, SupPaid: 0, ExpPaid: 0 })
  const profit = T.Invoiced - T.Expenses - T.Suppliers, cash = T.Collected - T.ExpPaid - T.SupPaid
  const byPayee = Object.values([...data.exp.filter((e) => e.supplier_id).map((e) => ({ id: e.supplier_id, name: e.vendor, amt: Number(e.amount), kind: 'exp' })),
    ...data.sb.filter((b) => b.supplier_id).map((b) => ({ id: b.supplier_id, name: b.suppliers?.name, amt: Number(b.total), kind: 'sup' }))]
    .reduce((a, x) => { a[x.id] ||= { id: x.id, name: x.name, exp: 0, sup: 0 }; a[x.id][x.kind] += x.amt; return a }, {})).map((x) => ({ ...x, total: x.exp + x.sup })).sort((a, b) => b.total - a.total)
  const byCat = Object.entries(data.exp.reduce((a, e) => ({ ...a, [e.category]: (a[e.category] || 0) + Number(e.amount) }), {})).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  return (
    <>
      <div className="stats">
        <Stat label="Revenue (invoiced)" value={money(T.Invoiced)} />
        <Stat label="Cash collected" value={money(T.Collected)} tone="teal" />
        <Stat label="Supplier costs" value={money(T.Suppliers)} sub={`${money(T.SupPaid)} paid out`} tone="orange" />
        <Stat label="Expenses" value={money(T.Expenses)} sub={T.Expenses !== T.ExpPaid ? `${money(T.ExpPaid)} paid out in cash` : undefined} tone="red" />
        <Stat label="Profit (accrual)" value={money(profit)} sub={`${pct(profit, T.Invoiced)}% margin`} tone={profit >= 0 ? 'green' : 'red'} />
        <Stat label="Net cash flow" value={money(cash)} sub="In − expenses − supplier payments" tone="violet" />
      </div>
      <div className="grid g-2-1">
        <ChartCard title="Monthly revenue, expenses and profit">
          <BarChart data={rows}>
            <CartesianGrid vertical={false} stroke="#eee" /><XAxis dataKey="m" fontSize={12} tickLine={false} axisLine={false} /><YAxis tickFormatter={compact} fontSize={12} width={56} tickLine={false} axisLine={false} />
            <Tooltip formatter={(v) => money(v)} /><Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Invoiced" fill="#1ba76a" radius={[4, 4, 0, 0]} /><Bar dataKey="Costs" name="Expenses + suppliers" fill="#2b1416" radius={[4, 4, 0, 0]} /><Bar dataKey="Profit" fill="#c98a0c" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartCard>
        <ChartCard title="Expenses by category">
          <PieChart>
            <Pie data={byCat} dataKey="value" nameKey="name" innerRadius={50} outerRadius={88} cx="38%" paddingAngle={2}>{byCat.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie>
            <Tooltip formatter={(v) => money(v)} />
            <Legend layout="vertical" align="right" verticalAlign="middle" iconType="circle" wrapperStyle={{ fontSize: 11, maxWidth: 150 }} />
          </PieChart>
        </ChartCard>
      </div>
      <Card className="mt" title="Monthly statement" actions={<Button size="sm" variant="ghost" icon={Download} onClick={() => downloadCSV('pnl.csv', rows.map(({ k, m, Costs, ...r }) => ({ month: k, ...r })))}>CSV</Button>} pad={false}>
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Month</th><th className="num">Invoiced</th><th className="num">Collected</th><th className="num">Supplier costs</th><th className="num">Expenses</th><th className="num">Profit</th><th className="num">Net cash</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.k}><td>{r.m}</td><td className="num">{money(r.Invoiced)}</td><td className="num">{money(r.Collected)}</td><td className="num">{money(r.Suppliers)}</td><td className="num">{money(r.Expenses)}</td><td className="num strong" style={{ color: r.Profit < 0 ? 'var(--red)' : undefined }}>{money(r.Profit)}</td><td className="num">{money(r.Cash)}</td></tr>)}</tbody>
          <tfoot><tr><td>Total</td><td className="num">{money(T.Invoiced)}</td><td className="num">{money(T.Collected)}</td><td className="num">{money(T.Suppliers)}</td><td className="num">{money(T.Expenses)}</td><td className="num">{money(profit)}</td><td className="num">{money(cash)}</td></tr></tfoot>
        </table></div>
      </Card>
      <Card className="mt" title="Spend by payee" pad={false} actions={<Link className="btn btn-ghost btn-sm" to="/finance/suppliers">All payees</Link>}>
        {byPayee.length === 0 ? <p className="card-body faint small">No payee spend in this period.</p> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Payee</th><th className="num">Expenses</th><th className="num">Supplier work</th><th className="num">Total</th><th style={{ width: '28%' }} /></tr></thead>
            <tbody>{byPayee.map((x) => (
              <tr key={x.id}><td><Link to={`/finance/suppliers/${x.id}`} className="strong" title="Open account statement">{x.name}</Link></td>
                <td className="num">{x.exp ? money(x.exp) : '—'}</td><td className="num">{x.sup ? money(x.sup) : '—'}</td><td className="num strong">{money(x.total)}</td>
                <td><Progress value={x.total} max={byPayee[0].total} /></td></tr>))}</tbody>
          </table></div>)}
      </Card>
      <Card className="mt" title="Expense breakdown" pad={false}>
        <div className="table-wrap"><table className="table"><tbody>
          {byCat.map((c) => <tr key={c.name}><td>{c.name}</td><td style={{ width: '45%' }}><Progress value={c.value} max={byCat[0].value} /></td><td className="num">{money(c.value)}</td><td className="num faint">{pct(c.value, T.Expenses)}%</td></tr>)}
        </tbody></table></div>
      </Card>
    </>
  )
}

/* ---------------- Receivables aging ---------------- */
function Receivables() {
  const { data, loading } = useData(() => q(supabase.from('v_invoice_status').select('*').in('status', ['sent', 'partial'])), [], [])
  if (loading) return <Loading />
  const buckets = [['Not due', (d) => d <= 0], ['1–30 days', (d) => d > 0 && d <= 30], ['31–60 days', (d) => d > 30 && d <= 60], ['61–90 days', (d) => d > 60 && d <= 90], ['90+ days', (d) => d > 90]]
  const age = (i) => -daysFrom(i.due_date)
  const byClient = Object.values(data.reduce((a, i) => {
    const c = (a[i.client_id] ||= { name: i.client_name, total: 0, b: [0, 0, 0, 0, 0] })
    const idx = buckets.findIndex(([, f]) => f(age(i))); c.b[idx] += Number(i.balance); c.total += Number(i.balance); return a
  }, {})).sort((x, y) => y.total - x.total)
  const tot = buckets.map((_, k) => byClient.reduce((a, c) => a + c.b[k], 0))
  return (
    <>
      <div className="stats">{buckets.map(([l], k) => <Stat key={l} label={l} value={money(tot[k])} tone={k === 0 ? 'green' : k < 2 ? 'amber' : 'red'} />)}</div>
      {byClient.length === 0 ? <Empty title="Nothing outstanding 🎉" /> : (
        <Card title="Aging by client" pad={false} actions={<Button size="sm" variant="ghost" icon={Download} onClick={() => downloadCSV('receivables-aging.csv', byClient.map((c) => ({ client: c.name, ...Object.fromEntries(buckets.map(([l], k) => [l, c.b[k]])), total: c.total })))}>CSV</Button>}>
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Client</th>{buckets.map(([l]) => <th key={l} className="num">{l}</th>)}<th className="num">Total</th></tr></thead>
            <tbody>{byClient.map((c) => <tr key={c.name}><td className="cell-title">{c.name}</td>{c.b.map((v, k) => <td key={k} className="num" style={{ color: v && k >= 2 ? 'var(--red)' : undefined }}>{v ? money(v) : '—'}</td>)}<td className="num strong">{money(c.total)}</td></tr>)}</tbody>
            <tfoot><tr><td>Total</td>{tot.map((v, k) => <td key={k} className="num">{money(v)}</td>)}<td className="num">{money(tot.reduce((a, b) => a + b, 0))}</td></tr></tfoot>
          </table></div>
        </Card>
      )}
    </>
  )
}

/* ---------------- Client profitability ---------------- */
function ClientProfit({ from, to }) {
  const { team, has } = useAuth()
  const showMoney = has('reports.finance', 'invoices.view', 'invoices.manage')
  const { data, loading } = useData(async () => {
    const [clients, inv, logs, tasks, exp, packs, alloc] = await Promise.all([
      q(supabase.from('clients').select('id,name,status')),
      has('invoices.view', 'invoices.manage') ? q(supabase.from('invoices').select('client_id,total,status,issue_date').neq('status', 'cancelled').neq('status', 'draft').gte('issue_date', from).lte('issue_date', to)) : [],
      q(supabase.from('time_logs').select('client_id,user_id,minutes,billable').gte('log_date', from).lte('log_date', to)),
      has('tasks.view', 'tasks.manage') ? q(supabase.from('design_tasks').select('client_id,status,revision_count,delivered_at').gte('created_at', from).lte('created_at', to + 'T23:59:59')) : [],
      has('expenses.manage', 'reports.finance', 'reports.clients') ? q(supabase.from('expenses').select('client_id,amount,rebillable').not('client_id', 'is', null).gte('spent_on', from).lte('spent_on', to)) : [],
      q(supabase.from('packages').select('client_id,fee,billing_type,status').eq('status', 'active')),
      has('suppliers.view', 'reports.clients') ? q(supabase.from('supplier_bill_allocations').select('client_id,amount, supplier_bills(order_date,status)')) : []
    ])
    const rates = await q(supabase.rpc('staff_cost_rates')).catch(() => [])
    return { rates: rates || [], clients, inv, logs, tasks, exp, packs, alloc: alloc.filter((a) => a.supplier_bills && a.supplier_bills.status !== 'cancelled' && a.supplier_bills.order_date >= from && a.supplier_bills.order_date <= to) }
  }, [from, to], null)
  const rate = (uid) => Number((data?.rates || []).find((r) => r.user_id === uid)?.cost_per_hour || 0)
  const rows = useMemo(() => !data ? [] : data.clients.map((c) => {
    const revenue = data.inv.filter((i) => i.client_id === c.id).reduce((a, i) => a + Number(i.total), 0)
    const logs = data.logs.filter((l) => l.client_id === c.id)
    const mins = logs.reduce((a, l) => a + l.minutes, 0)
    const labour = logs.reduce((a, l) => a + (l.minutes / 60) * rate(l.user_id), 0)
    const direct = data.exp.filter((e) => e.client_id === c.id && !e.rebillable).reduce((a, e) => a + Number(e.amount), 0)
      + data.alloc.filter((a) => a.client_id === c.id).reduce((s, a) => s + Number(a.amount), 0)
    const t = data.tasks.filter((x) => x.client_id === c.id)
    const profit = revenue - labour - direct
    return { ...c, revenue, mins, labour, direct, profit, margin: pct(profit, revenue), tasks: t.length, revs: t.length ? (t.reduce((a, x) => a + x.revision_count, 0) / t.length) : 0,
      mrr: data.packs.filter((p) => p.client_id === c.id).reduce((a, p) => a + monthly(p), 0), effRate: mins ? revenue / (mins / 60) : 0 }
  }).filter((r) => r.revenue || r.mins || r.tasks || r.direct).sort((a, b) => b.revenue - a.revenue || b.mins - a.mins), [data, team])
  if (loading || !data) return <Loading />
  const noRates = !(data.rates || []).some((r) => Number(r.cost_per_hour))
  return (
    <>
      {noRates && <div className="alert alert-info">Add each team member’s monthly salary in Team & Access to see true labour cost and margin per client.</div>}
      {rows.length === 0 ? <Empty title="No client activity in this period" /> : (
        <>
          {showMoney && <ChartCard title="Revenue vs delivery cost by client (top 10)" h={300}>
            <BarChart data={rows.slice(0, 10)} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid horizontal={false} stroke="#eee" /><XAxis type="number" step="any" tickFormatter={compact} fontSize={12} /><YAxis type="category" dataKey="name" width={130} fontSize={12} />
              <Tooltip formatter={(v) => money(v)} /><Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="revenue" name="Revenue" fill="#1ba76a" radius={[0, 4, 4, 0]} /><Bar dataKey="labour" name="Labour cost" fill="#2b1416" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ChartCard>}
          <Card className="mt" title="Client scorecard" pad={false} actions={<Button size="sm" variant="ghost" icon={Download} onClick={() => downloadCSV('client-profitability.csv', rows.map((r) => ({ client: r.name, revenue: r.revenue, hours: (r.mins / 60).toFixed(1), labour_cost: Math.round(r.labour), direct_cost: r.direct, profit: Math.round(r.profit), margin_pct: r.margin, tasks: r.tasks, avg_revisions: r.revs.toFixed(1) })))}>CSV</Button>}>
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Client</th>{showMoney && <th className="num">Revenue</th>}<th className="num">Monthly fee</th><th className="num">Hours</th>{showMoney && <><th className="num">Labour cost</th><th className="num">Supplier & direct cost</th><th className="num">Profit</th><th className="num">Margin</th><th className="num">₹ / hour</th></>}<th className="num">Tasks</th><th className="num">Avg revisions</th></tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.id}>
                  <td className="cell-title">{r.name}</td>
                  {showMoney && <td className="num">{money(r.revenue)}</td>}
                  <td className="num">{r.mrr ? money(r.mrr) : '—'}</td>
                  <td className="num">{hours(r.mins)}</td>
                  {showMoney && <><td className="num">{money(r.labour)}</td><td className="num">{money(r.direct)}</td>
                    <td className="num strong" style={{ color: r.profit < 0 ? 'var(--red)' : undefined }}>{money(r.profit)}</td>
                    <td className="num"><Badge tone={r.margin >= 50 ? 'green' : r.margin >= 25 ? 'amber' : 'red'}>{r.revenue ? `${r.margin}%` : '—'}</Badge></td>
                    <td className="num">{r.effRate ? money(r.effRate) : '—'}</td></>}
                  <td className="num">{r.tasks}</td>
                  <td className="num" style={{ color: r.revs > 2 ? 'var(--orange)' : undefined }}>{r.revs.toFixed(1)}</td>
                </tr>))}</tbody>
            </table></div>
          </Card>
        </>
      )}
    </>
  )
}

/* ---------------- Sales ---------------- */
function Sales({ from, to }) {
  const { managers } = useAuth()
  const { data, loading } = useData(() => q(supabase.from('leads').select('*').gte('created_at', from).lte('created_at', to + 'T23:59:59')), [from, to], null)
  if (loading || !data) return <Loading />
  const won = data.filter((l) => l.stage === 'won'), lost = data.filter((l) => l.stage === 'lost')
  const sources = LEAD_SOURCES.map((s) => { const x = data.filter((l) => l.source === s); const w = x.filter((l) => l.stage === 'won'); return { s, n: x.length, w: w.length, v: w.reduce((a, l) => a + Number(l.estimated_value || 0), 0) } }).filter((r) => r.n).sort((a, b) => b.n - a.n)
  const reasons = Object.entries(lost.reduce((a, l) => ({ ...a, [l.lost_reason || 'Not specified']: (a[l.lost_reason || 'Not specified'] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1])
  const owners = managers.map((m) => { const x = data.filter((l) => l.owner_id === m.id); const w = x.filter((l) => l.stage === 'won'); return { m, n: x.length, w: w.length, v: w.reduce((a, l) => a + Number(l.estimated_value || 0), 0) } }).filter((r) => r.n)
  const funnel = LEAD_STAGES.filter((s) => s.id !== 'lost').map((s, i, arr) => ({ ...s, n: data.filter((l) => arr.slice(i).some((x) => x.id === l.stage)).length }))
  return (
    <>
      <div className="stats">
        <Stat label="New leads" value={data.length} />
        <Stat label="Won" value={won.length} sub={money(won.reduce((a, l) => a + Number(l.estimated_value || 0), 0))} tone="green" />
        <Stat label="Lost" value={lost.length} tone="red" />
        <Stat label="Win rate" value={`${pct(won.length, won.length + lost.length)}%`} sub="of decided leads" tone="teal" />
        <Stat label="Avg won deal" value={money(won.length ? won.reduce((a, l) => a + Number(l.estimated_value || 0), 0) / won.length : 0)} tone="violet" />
      </div>
      <div className="grid g2">
        <Card title="Conversion funnel">
          <div className="funnel">{funnel.map((s) => <div key={s.id} className="funnel-row"><span>{s.label}</span><div className="funnel-bar" style={{ width: `${pct(s.n, funnel[0].n || 1)}%` }} /><span className="right small"><b>{s.n}</b> · {pct(s.n, funnel[0].n)}%</span></div>)}</div>
        </Card>
        <Card title="Leads by source" pad={false}>
          <div className="table-wrap"><table className="table"><thead><tr><th>Source</th><th className="num">Leads</th><th className="num">Won</th><th className="num">Conv.</th><th className="num">Won value</th></tr></thead>
            <tbody>{sources.map((r) => <tr key={r.s}><td>{r.s}</td><td className="num">{r.n}</td><td className="num">{r.w}</td><td className="num">{pct(r.w, r.n)}%</td><td className="num">{money(r.v)}</td></tr>)}</tbody></table></div>
        </Card>
      </div>
      <div className="grid g2 mt">
        <Card title="By marketer" pad={false}>
          <div className="table-wrap"><table className="table"><thead><tr><th>Owner</th><th className="num">Leads</th><th className="num">Won</th><th className="num">Conv.</th><th className="num">Value won</th></tr></thead>
            <tbody>{owners.map((r) => <tr key={r.m.id}><td><span className="row gap-s"><Avatar name={r.m.full_name} size={22} />{r.m.full_name}</span></td><td className="num">{r.n}</td><td className="num">{r.w}</td><td className="num">{pct(r.w, r.n)}%</td><td className="num">{money(r.v)}</td></tr>)}</tbody></table></div>
        </Card>
        <Card title="Why we lose">
          {reasons.length === 0 ? <p className="faint small">No lost leads in this period.</p> : reasons.map(([k, v]) => <div key={k} style={{ marginBottom: 10 }}><div className="row between small"><span>{k}</span><b>{v}</b></div><Progress value={v} max={reasons[0][1]} tone="red" /></div>)}
        </Card>
      </div>
    </>
  )
}

/* ---------------- Team productivity ---------------- */
function Team({ from, to }) {
  const { team, user, has, memberHas, roleOf } = useAuth()
  const { data, loading } = useData(async () => {
    const [tasks, logs] = await Promise.all([
      q(supabase.from('design_tasks').select('assignee_id,status,due_date,approved_at,delivered_at,revision_count,max_revisions,quantity,created_at').not('assignee_id', 'is', null).gte('created_at', from).lte('created_at', to + 'T23:59:59')),
      q(supabase.from('time_logs').select('user_id,minutes,billable,log_date').gte('log_date', from).lte('log_date', to))
    ])
    return { tasks, logs }
  }, [from, to], null)
  if (loading || !data) return <Loading />
  const weeks = Math.max(1, Math.round((new Date(to) - new Date(from)) / (7 * 86400000)))
  const people = team.filter((m) => m.active && (has('reports.team') ? memberHas(m, 'tasks.work', 'tasks.manage', 'leads.manage') : m.id === user.id))
  const rows = people.map((m) => {
    const t = data.tasks.filter((x) => x.assignee_id === m.id)
    const done = t.filter((x) => ['approved', 'delivered'].includes(x.status))
    const onTime = done.filter((x) => !x.due_date || (x.approved_at || x.delivered_at || '').slice(0, 10) <= x.due_date)
    const logs = data.logs.filter((l) => l.user_id === m.id)
    const mins = logs.reduce((a, l) => a + l.minutes, 0), bill = logs.filter((l) => l.billable).reduce((a, l) => a + l.minutes, 0)
    return { m, assigned: t.length, done: done.length, pieces: done.reduce((a, x) => a + (x.quantity || 1), 0), onTime: pct(onTime.length, done.length),
      revs: t.length ? t.reduce((a, x) => a + x.revision_count, 0) / t.length : 0, firstPass: pct(done.filter((x) => x.revision_count === 0).length, done.length),
      mins, util: pct(bill, (m.weekly_hours || 48) * 60 * weeks) }
  }).filter((r) => r.assigned || r.mins)
  if (!rows.length) return <Empty title="No assigned tasks or time logs in this period" />
  return (
    <>
      <ChartCard title="Delivered vs assigned" h={260}>
        <BarChart data={rows.map((r) => ({ name: r.m.full_name.split(' ')[0], Assigned: r.assigned, Delivered: r.done }))}>
          <CartesianGrid vertical={false} stroke="#eee" /><XAxis dataKey="name" fontSize={12} /><YAxis fontSize={12} allowDecimals={false} /><Tooltip /><Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="Assigned" fill="#b9e6d0" radius={[4, 4, 0, 0]} /><Bar dataKey="Delivered" fill="#1ba76a" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartCard>
      <Card className="mt" title="Scorecard" pad={false} actions={<Button size="sm" variant="ghost" icon={Download} onClick={() => downloadCSV('team-productivity.csv', rows.map((r) => ({ name: r.m.full_name, assigned: r.assigned, approved: r.done, pieces: r.pieces, on_time_pct: r.onTime, first_pass_pct: r.firstPass, avg_revisions: r.revs.toFixed(1), hours: (r.mins / 60).toFixed(1), utilisation_pct: r.util })))}>CSV</Button>}>
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Person</th><th className="num">Assigned</th><th className="num">Approved</th><th className="num">Pieces</th><th className="num">On time</th><th className="num">First-pass approval</th><th className="num">Avg revisions</th><th className="num">Hours logged</th><th className="num">Utilisation</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.m.id}>
              <td><span className="row gap-s"><Avatar name={r.m.full_name} size={24} /><span><b>{r.m.full_name}</b><div className="cell-sub">{r.m.designation || roleOf(r.m.role_id)?.name}</div></span></span></td>
              <td className="num">{r.assigned}</td><td className="num">{r.done}</td><td className="num">{r.pieces}</td>
              <td className="num"><Badge tone={r.onTime >= 85 ? 'green' : r.onTime >= 65 ? 'amber' : 'red'}>{r.done ? `${r.onTime}%` : '—'}</Badge></td>
              <td className="num">{r.done ? `${r.firstPass}%` : '—'}</td>
              <td className="num">{r.revs.toFixed(1)}</td><td className="num">{hours(r.mins)}</td>
              <td className="num"><Badge tone={r.util >= 65 ? 'green' : r.util >= 45 ? 'amber' : 'slate'}>{r.util}%</Badge></td>
            </tr>))}</tbody>
        </table></div>
      </Card>
      <p className="small faint mt">On time = approved on or before due date. Utilisation = billable hours ÷ weekly capacity (set per person in Team & Access). Healthy creative teams run at 65–75%.</p>
    </>
  )
}

/* ---------------- Content delivery ---------------- */
function Content({ from, to }) {
  const { data, loading } = useData(async () => {
    const [posts, packs, clients] = await Promise.all([
      q(supabase.from('content_posts').select('client_id,status,post_type,publish_date,reach,likes,comments,shares,saves').gte('publish_date', from).lte('publish_date', to)),
      q(supabase.from('packages').select('*').eq('status', 'active')),
      q(supabase.from('clients').select('id,name').eq('status', 'active'))
    ])
    return { posts, packs, clients }
  }, [from, to], null)
  if (loading || !data) return <Loading />
  const months = Math.max(1, monthsBetween(from, to).length)
  const rows = data.clients.map((c) => {
    const p = data.posts.filter((x) => x.client_id === c.id && x.status !== 'cancelled')
    const pk = data.packs.filter((x) => x.client_id === c.id)
    const committed = pk.reduce((a, x) => a + (x.posts_per_month + x.carousels_per_month + x.reels_per_month + x.stories_per_month) * months, 0)
    const pub = p.filter((x) => x.status === 'published')
    const reach = pub.reduce((a, x) => a + Number(x.reach || 0), 0)
    const eng = pub.reduce((a, x) => a + Number(x.likes || 0) + Number(x.comments || 0) + Number(x.shares || 0) + Number(x.saves || 0), 0)
    return { c, planned: p.length, published: pub.length, committed, reach, eng, er: reach ? ((eng / reach) * 100).toFixed(2) : null }
  }).filter((r) => r.planned || r.committed).sort((a, b) => b.committed - a.committed)
  const T = rows.reduce((a, r) => ({ planned: a.planned + r.planned, published: a.published + r.published, committed: a.committed + r.committed }), { planned: 0, published: 0, committed: 0 })
  return (
    <>
      <div className="stats">
        <Stat label="Committed in packages" value={n(T.committed)} />
        <Stat label="Planned" value={n(T.planned)} sub={`${pct(T.planned, T.committed)}% of commitment`} tone="violet" />
        <Stat label="Published" value={n(T.published)} sub={`${pct(T.published, T.committed)}% delivered`} tone="teal" />
      </div>
      {rows.length === 0 ? <Empty title="No content in this period" /> : (
        <Card title="Delivery vs commitment by client" pad={false}>
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Client</th><th className="num">Committed</th><th className="num">Planned</th><th className="num">Published</th><th style={{ width: '22%' }}>Delivery</th><th className="num">Reach</th><th className="num">Engagement rate</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.c.id}>
                <td className="cell-title">{r.c.name}</td><td className="num">{r.committed || '—'}</td><td className="num">{r.planned}</td><td className="num">{r.published}</td>
                <td>{r.committed ? <div className="row gap-s"><Progress value={r.published} max={r.committed} tone={r.published < r.committed * 0.8 ? 'amber' : 'green'} /><span className="tiny">{pct(r.published, r.committed)}%</span></div> : '—'}</td>
                <td className="num">{r.reach ? n(r.reach) : '—'}</td><td className="num">{r.er ? `${r.er}%` : '—'}</td>
              </tr>))}</tbody>
          </table></div>
        </Card>
      )}
    </>
  )
}

