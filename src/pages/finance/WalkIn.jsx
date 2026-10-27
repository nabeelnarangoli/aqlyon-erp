import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Trash2, ShoppingBag, UserRound, Repeat2, Wallet, CheckCircle2, Banknote } from 'lucide-react'
import { supabase, q } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useData, useDebounced } from '../../lib/hooks'
import { PAYMENT_METHODS, INVOICE_STATUS } from '../../lib/constants'
import { money, money2, date, todayISO } from '../../lib/format'
import {
  PageHeader, Button, Card, Field, Input, Select, ClientSelect, Badge, StatusBadge, IconBtn, Empty, Loading, Stat, Modal,
  useAction, useForm
} from '../../components/ui'

const blankItem = () => ({ description: '', qty: 1, rate: '' })

export default function WalkIn() {
  const nav = useNavigate()
  const { has, user } = useAuth()
  const canPickClient = has('clients.view', 'clients.manage', 'invoices.manage')
  const [mode, setMode] = useState('walkin')            // walkin | client
  const [cust, setCust] = useState({ id: null, name: '', phone: '' })
  const [clientId, setClientId] = useState('')
  const [items, setItems] = useState([blankItem()])
  const [discount, setDiscount] = useState('')
  const [pay, set] = useForm({ amount: '', method: 'Cash', reference: '', notes: '' })
  const [paidTouched, setPaidTouched] = useState(false)
  const [done, setDone] = useState(null)
  const [busy, run] = useAction()

  const services = useData(() => q(supabase.from('services').select('name,rate,unit').eq('active', true).order('name')), [], [])
  const term = useDebounced(cust.id ? '' : (cust.phone.replace(/\D/g, '').length >= 3 ? cust.phone : cust.name).trim(), 300)
  const matches = useData(() => term.length >= 3 ? q(supabase.rpc('walkin_find', { p_q: term })) : [], [term], [])

  const subtotal = items.reduce((a, it) => a + (Number(it.qty) || 0) * (Number(it.rate) || 0), 0)
  const total = Math.max(Math.round((subtotal - (Number(discount) || 0)) * 100) / 100, 0)
  const received = paidTouched ? Number(pay.amount) || 0 : total
  const balance = Math.round((total - received) * 100) / 100

  const setItem = (i, k, v) => setItems((xs) => xs.map((x, j) => {
    if (j !== i) return x
    const n = { ...x, [k]: v }
    if (k === 'description') { const s = services.data.find((s) => s.name.toLowerCase() === String(v).toLowerCase()); if (s && !x.rate) n.rate = s.rate }
    return n
  }))
  const reset = () => { setCust({ id: null, name: '', phone: '' }); setClientId(''); setItems([blankItem()]); setDiscount(''); set('amount')(''); set('reference')(''); set('notes')(''); setPaidTouched(false) }

  const submit = (e) => { e.preventDefault(); run(async () => {
    const lines = items.filter((it) => it.description.trim() || Number(it.rate))
      .map((it) => ({ description: it.description.trim(), qty: Number(it.qty) || 0, rate: Number(it.rate) || 0 }))
    if (!lines.length) throw new Error('Add at least one item')
    if (lines.some((l) => !l.description || l.qty <= 0)) throw new Error('Each item needs a description and quantity')
    if (mode === 'walkin' && !cust.id && !cust.name.trim()) throw new Error('Enter the customer name')
    if (mode === 'client' && !clientId) throw new Error('Choose the client')
    if (received < 0 || received > total + 0.01) throw new Error(`Amount received must be between ₹0 and ${money2(total)}`)
    const r = await q(supabase.rpc('walkin_sale', {
      p_client_id: mode === 'client' ? clientId : cust.id, p_name: cust.name, p_phone: cust.phone, p_items: lines,
      p_discount: Number(discount) || 0, p_paid: received, p_method: pay.method, p_reference: pay.reference || null, p_notes: pay.notes || null
    }))
    setDone(r); reset(); mine.reload()
  }) }

  const mine = useData(async () => {
    const from = new Date(); from.setDate(from.getDate() - 30)
    const [inv, pays] = await Promise.all([
      q(supabase.from('invoices').select('id,number,total,amount_paid,status,issue_date, clients(name,phone)').eq('sale_channel', 'walkin').eq('created_by', user.id).gte('issue_date', from.toISOString().slice(0, 10)).order('created_at', { ascending: false }).limit(30)),
      q(supabase.from('payments').select('amount,method').eq('collected_by', user.id).eq('paid_on', todayISO()))
    ])
    return { inv, pays }
  }, [], { inv: [], pays: [] })
  const today = useMemo(() => mine.data.pays.reduce((a, p) => ({ ...a, total: a.total + Number(p.amount), [p.method]: (a[p.method] || 0) + Number(p.amount) }), { total: 0 }), [mine.data.pays])
  const [collect, setCollect] = useState(null)

  return (
    <>
      <PageHeader title="Walk-in sale" subtitle="Bill a walk-in customer, collect the money and hand over a receipt." />
      <div className="grid g-2-1">
        <form className="grid" style={{ alignContent: 'start' }} onSubmit={submit}>
          <Card title="Customer" actions={canPickClient && (
            <div className="row gap-xs">
              <Button type="button" size="sm" variant={mode === 'walkin' ? 'primary' : 'ghost'} icon={UserRound} onClick={() => setMode('walkin')}>Walk-in</Button>
              <Button type="button" size="sm" variant={mode === 'client' ? 'primary' : 'ghost'} onClick={() => setMode('client')}>Existing client</Button>
            </div>)}>
            {mode === 'client' ? (
              <div className="form f1"><Field label="Client"><ClientSelect allowCreate value={clientId} onChange={(v) => setClientId(v || '')} /></Field></div>
            ) : cust.id ? (
              <div className="row between wrap gap-s" style={{ padding: '10px 12px', background: 'var(--green-50)', borderRadius: 10 }}>
                <div><Badge tone="green"><Repeat2 size={12} /> Returning customer</Badge> <b>{cust.name}</b> <span className="muted small">{cust.phone}</span></div>
                <Button type="button" size="sm" variant="ghost" onClick={() => setCust({ id: null, name: '', phone: '' })}>Change</Button>
              </div>
            ) : (
              <>
                <div className="form">
                  <Field label="Mobile number"><Input type="tel" inputMode="tel" value={cust.phone} onChange={(e) => setCust({ ...cust, phone: e.target.value })} placeholder="98470 12345" autoFocus /></Field>
                  <Field label="Name" required><Input value={cust.name} onChange={(e) => setCust({ ...cust, name: e.target.value })} placeholder="Customer / shop name" /></Field>
                </div>
                {matches.data.length > 0 && (
                  <div className="mt">
                    <div className="tiny faint mb">Been here before? Tap to use their details:</div>
                    <div className="row wrap gap-xs">{matches.data.map((m) => (
                      <button type="button" key={m.id} className="btn btn-outline btn-sm" onClick={() => setCust({ id: m.id, name: m.name, phone: m.phone || '' })}>
                        <Repeat2 size={13} />{m.name}<span className="faint">{m.phone ? ` · ${m.phone}` : ''} · {m.visits} visit{m.visits === 1 ? '' : 's'}{Number(m.balance) > 0 ? ` · owes ${money(m.balance)}` : ''}</span>
                      </button>))}</div>
                  </div>
                )}
                <p className="tiny faint mt">A customer with the same mobile number is recognised automatically next time.</p>
              </>
            )}
          </Card>

          <Card title="Items" pad={false}>
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Description</th><th className="num" style={{ width: 80 }}>Qty</th><th className="num" style={{ width: 120 }}>Rate (₹)</th><th className="num" style={{ width: 110 }}>Amount</th><th style={{ width: 36 }} /></tr></thead>
              <tbody>{items.map((it, i) => (
                <tr key={i}>
                  <td><input className="input" list="walkin-services" value={it.description} onChange={(e) => setItem(i, 'description', e.target.value)} placeholder="e.g. Visiting card design" /></td>
                  <td><input className="input right" type="number" min="0" step="any" value={it.qty} onChange={(e) => setItem(i, 'qty', e.target.value)} /></td>
                  <td><input className="input right" type="number" min="0" step="any" value={it.rate} onChange={(e) => setItem(i, 'rate', e.target.value)} /></td>
                  <td className="num strong">{money2((Number(it.qty) || 0) * (Number(it.rate) || 0))}</td>
                  <td>{items.length > 1 && <IconBtn icon={Trash2} size={14} title="Remove" onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))} />}</td>
                </tr>))}</tbody>
            </table></div>
            <datalist id="walkin-services">{services.data.map((s) => <option key={s.name} value={s.name}>{money2(s.rate)} {s.unit}</option>)}</datalist>
            <div className="row between wrap gap-s card-body">
              <Button type="button" variant="ghost" size="sm" icon={Plus} onClick={() => setItems((xs) => [...xs, blankItem()])}>Add item</Button>
              <div className="row gap-s"><span className="small muted">Discount ₹</span><input className="input right" style={{ width: 110 }} type="number" min="0" step="any" value={discount} onChange={(e) => setDiscount(e.target.value)} /></div>
            </div>
            <div className="row between card-body" style={{ borderTop: '1px solid var(--line)', fontSize: 18 }}><b>Total</b><b>{money2(total)}</b></div>
          </Card>

          <Card title="Collect payment">
            <div className="form">
              <Field label="Amount received (₹)" hint={balance > 0 ? `Balance ${money2(balance)} stays due on the invoice` : 'Paid in full'}>
                <Input type="number" min="0" step="any" value={paidTouched ? pay.amount : total || ''} onChange={(e) => { setPaidTouched(true); set('amount')(e.target.value) }} />
              </Field>
              <Field label="Method"><Select placeholder={false} options={PAYMENT_METHODS} value={pay.method} onChange={set('method')} /></Field>
              <Field label="UPI / card reference"><Input value={pay.reference} onChange={set('reference')} placeholder="Optional" /></Field>
              <Field label="Note on invoice"><Input value={pay.notes} onChange={set('notes')} placeholder="Optional" /></Field>
            </div>
            <div className="row mt" style={{ justifyContent: 'flex-end' }}>
              <Button type="submit" icon={CheckCircle2} loading={busy} disabled={!total}>{received > 0 ? `Create invoice & collect ${money2(received)}` : 'Create invoice (unpaid)'}</Button>
            </div>
          </Card>
        </form>

        <div className="grid" style={{ alignContent: 'start' }}>
          <Stat label="You collected today" value={money(today.total)} sub={PAYMENT_METHODS.filter((m) => today[m]).map((m) => `${m} ${money(today[m])}`).join(' · ') || 'Nothing yet'} icon={Banknote} tone="teal" />
          <Card title="Your walk-in sales · last 30 days" pad={false}>
            {mine.loading ? <Loading /> : mine.data.inv.length === 0 ? <Empty icon={ShoppingBag} title="No walk-in sales yet" /> : (
              <div className="list">{mine.data.inv.map((i) => {
                const bal = Number(i.total) - Number(i.amount_paid)
                return (
                  <div key={i.id} className="list-item">
                    <div className="grow">
                      <Link to={`/finance/invoices/${i.id}`} className="strong">{i.clients?.name || '—'}</Link>
                      <div className="tiny faint">{i.number} · {date(i.issue_date)}</div>
                    </div>
                    <div className="right"><div className="strong">{money2(i.total)}</div>{bal > 0.001 ? <Badge tone="orange">due {money(bal)}</Badge> : <StatusBadge list={INVOICE_STATUS} value={i.status} />}</div>
                    {bal > 0.001 && i.status !== 'cancelled' && <IconBtn icon={Wallet} size={15} title="Collect balance" onClick={() => setCollect({ ...i, balance: bal })} />}
                  </div>)
              })}</div>
            )}
          </Card>
        </div>
      </div>

      {done && (
        <Modal open size="sm" onClose={() => setDone(null)} title="Invoice created" subtitle={done.number}
          footer={<><Button variant="ghost" onClick={() => setDone(null)}>New sale</Button><Button onClick={() => nav(`/finance/invoices/${done.invoice_id}`)}>Open receipt · Print / WhatsApp</Button></>}>
          <div className="center" style={{ padding: '6px 0 4px' }}>
            <CheckCircle2 size={40} color="var(--green)" />
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{money2(done.total)}</div>
            <div className="muted">{Number(done.paid) >= Number(done.total) ? `Paid in full · collected by you` : Number(done.paid) > 0 ? `Received ${money2(done.paid)} · balance ${money2(done.total - done.paid)}` : 'Not paid yet'}</div>
          </div>
        </Modal>
      )}
      {collect && <CollectModal inv={collect} onClose={() => setCollect(null)} onDone={() => { setCollect(null); mine.reload() }} />}
    </>
  )
}

// collect the balance of a walk-in invoice (any team member)
export function CollectModal({ inv, onClose, onDone }) {
  const bal = inv.balance ?? Number(inv.total) - Number(inv.amount_paid)
  const [f, set] = useForm({ amount: bal, method: 'Cash', reference: '' })
  const [busy, run] = useAction()
  const save = (e) => { e.preventDefault(); run(async () => {
    await q(supabase.rpc('walkin_collect', { p_invoice: inv.id, p_amount: Number(f.amount), p_method: f.method, p_reference: f.reference || null }))
    onDone()
  }, 'Payment collected') }
  return (
    <Modal open size="sm" onClose={onClose} title="Collect balance" subtitle={`${inv.number} · balance ${money2(bal)}`}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button form="wcol" type="submit" loading={busy}>Collect</Button></>}>
      <form id="wcol" className="form f1" onSubmit={save}>
        <Field label="Amount (₹)" required><Input type="number" min="0" step="any" value={f.amount} onChange={set('amount')} /></Field>
        <Field label="Method"><Select placeholder={false} options={PAYMENT_METHODS} value={f.method} onChange={set('method')} /></Field>
        <Field label="Reference"><Input value={f.reference} onChange={set('reference')} placeholder="Optional" /></Field>
      </form>
    </Modal>
  )
}
