import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Printer, Pencil, Send, Wallet, MessageCircle, Ban, Copy, FileCheck2, Trash2, CheckCircle2, XCircle } from 'lucide-react'
import { supabase, q, DEMO } from '../../lib/supabase'
import { useData } from '../../lib/hooks'
import { useAuth } from '../../lib/auth'
import { INVOICE_STATUS, QUOTE_STATUS } from '../../lib/constants'
import { money2, date, amountInWords, waLink, todayISO, addDays } from '../../lib/format'
import { Button, StatusBadge, Card, Loading, ErrorBox, IconBtn, useAction, useToast } from '../../components/ui'
import DocEditor from './DocEditor'
import { PaymentModal } from './Invoices'
import { MoneyFlow } from './Suppliers'

export default function InvoiceView({ kind }) {
  const { id } = useParams()
  const nav = useNavigate()
  const { settings, can } = useAuth()
  const { confirm } = useToast()
  const [editing, setEditing] = useState(false)
  const [paying, setPaying] = useState(null)
  const [busy, run] = useAction()
  const table = kind === 'invoice' ? 'invoices' : 'quotations'
  const doc = useData(() => q(supabase.from(table).select('*, clients(*)').eq('id', id).single()), [id, table])
  const pays = useData(() => (kind === 'invoice' ? q(supabase.from('payments').select('*').eq('invoice_id', id).order('paid_on')) : []), [id], [])
  if (doc.loading) return <Loading />
  if (doc.error) return <ErrorBox error={doc.error} />
  const d = doc.data
  const c = d.clients
  const st = settings || {}
  const isFin = can('finance')
  const canEdit = kind === 'invoice' ? isFin : can('finance', 'marketer')
  const balance = Number(d.total) - Number(d.amount_paid || 0)
  const title = kind === 'invoice' ? 'INVOICE' : 'QUOTATION'
  const billTo = c ? [c.name, c.contact_person, c.address || c.city, c.phone, c.email].filter(Boolean) : (d.bill_to || '').split('\n')

  const setStatus = (status, msg) => run(async () => { await q(supabase.from(table).update({ status }).eq('id', id)); doc.reload() }, msg)
  const share = () => {
    const phone = c?.whatsapp || c?.phone
    const text = kind === 'invoice'
      ? `Hello ${c?.contact_person || c?.name || ''},\n\nPlease find invoice ${d.number} from ${st.company_name} for ${money2(d.total)}${balance < d.total ? ` (balance ${money2(balance)})` : ''}, due on ${date(d.due_date)}.${st.upi_id ? `\n\nUPI: ${st.upi_id}` : ''}${st.bank_details ? `\n\nBank details:\n${st.bank_details}` : ''}\n\nThank you!`
      : `Hello ${c?.contact_person || ''},\n\nSharing our quotation ${d.number} for ${money2(d.total)}, valid until ${date(d.valid_until)}. Happy to discuss any changes.\n\n— ${st.company_name}`
    window.open(waLink(phone, text), '_blank')
    if (d.status === 'draft') setStatus('sent')
  }
  const duplicate = () => run(async () => {
    const p = { client_id: d.client_id, items: d.items, discount: d.discount, notes: d.notes, terms: d.terms, issue_date: todayISO(), status: 'draft',
      ...(kind === 'invoice' ? { due_date: addDays(todayISO(), 7) } : { valid_until: addDays(todayISO(), 15), lead_id: d.lead_id, bill_to: d.bill_to }) }
    const row = await q(supabase.from(table).insert(p).select().single())
    nav(`/finance/${kind === 'invoice' ? 'invoices' : 'quotations'}/${row.id}`)
  }, 'Duplicated as new draft')
  const toInvoice = async () => {
    let clientId = d.client_id
    if (!clientId && d.lead_id) {
      if (!(await confirm('This quote is for a lead. Convert the lead to a client and create the invoice?', { okText: 'Convert & invoice' }))) return
      clientId = await run(() => q(supabase.rpc('convert_lead', { p_lead: d.lead_id })))
      if (!clientId) return
    }
    if (!clientId) { await confirm('Link this quotation to a client first (Edit → Client).', { okText: 'OK' }); return }
    run(async () => {
      await q(supabase.from('quotations').update({ status: 'accepted', client_id: clientId }).eq('id', id))
      const row = await q(supabase.from('invoices').insert({ client_id: clientId, quotation_id: id, items: d.items, discount: d.discount, notes: d.notes, terms: st.invoice_terms, status: 'draft' }).select().single())
      nav(`/finance/invoices/${row.id}`)
    }, 'Invoice created from quotation')
  }
  const del = async () => {
    if (!(await confirm(`Delete ${d.number}? ${kind === 'invoice' ? 'Its payments are deleted too.' : ''}`, { danger: true, okText: 'Delete' }))) return
    run(async () => { await q(supabase.from(table).delete().eq('id', id)); nav(-1) }, 'Deleted')
  }
  const delPay = async (p) => {
    if (!(await confirm(`Remove payment of ${money2(p.amount)}?`, { danger: true, okText: 'Remove' }))) return
    run(async () => { await q(supabase.from('payments').delete().eq('id', p.id)); pays.reload(); doc.reload() }, 'Payment removed')
  }

  return (
    <>
      <div className="row between wrap gap-s mb no-print">
        <button className="btn btn-ghost btn-sm" onClick={() => nav(-1)}><ArrowLeft size={14} />Back</button>
        <div className="row gap-s wrap">
          <StatusBadge list={kind === 'invoice' ? INVOICE_STATUS : QUOTE_STATUS} value={d.status} />
          {!DEMO && <Button variant="outline" icon={Printer} onClick={() => window.print()}>Print / PDF</Button>}
          {(c?.whatsapp || c?.phone) && <Button variant="outline" icon={MessageCircle} onClick={share}>WhatsApp</Button>}
          {canEdit && <Button variant="outline" icon={Copy} onClick={duplicate}>Duplicate</Button>}
          {canEdit && d.status === 'draft' && <Button variant="outline" icon={Send} onClick={() => setStatus('sent', 'Marked as sent')}>Mark sent</Button>}
          {kind === 'quote' && canEdit && !['accepted', 'rejected'].includes(d.status) && <Button variant="outline" icon={XCircle} onClick={() => setStatus('rejected', 'Marked rejected')}>Rejected</Button>}
          {kind === 'quote' && can('finance') && d.status !== 'rejected' && <Button icon={FileCheck2} onClick={toInvoice} loading={busy}>Accept → Invoice</Button>}
          {kind === 'quote' && !can('finance') && canEdit && d.status !== 'accepted' && <Button icon={CheckCircle2} onClick={() => setStatus('accepted', 'Marked accepted — finance can invoice it')}>Accepted</Button>}
          {kind === 'invoice' && isFin && !['paid', 'cancelled'].includes(d.status) && <Button icon={Wallet} onClick={() => setPaying({})}>Record payment</Button>}
          {canEdit && !['paid', 'cancelled'].includes(d.status) && <Button variant="dark" icon={Pencil} onClick={() => setEditing(true)}>Edit</Button>}
          {kind === 'invoice' && isFin && !['cancelled', 'paid'].includes(d.status) && Number(d.amount_paid) === 0 && <IconBtn icon={Ban} title="Cancel invoice" onClick={() => setStatus('cancelled', 'Invoice cancelled')} />}
          {canEdit && (d.status === 'draft' || d.status === 'cancelled' || kind === 'quote') && <IconBtn icon={Trash2} title="Delete" onClick={del} />}
        </div>
      </div>

      <div className="doc">
        <div className="doc-head">
          <div>
            <img src="/logo-full.png" alt={st.company_name} />
            <div className="small" style={{ marginTop: 8, maxWidth: 320, color: '#555' }}>{st.address}<br />{[st.phone, st.email, st.website].filter(Boolean).join(' · ')}</div>
          </div>
          <div className="right">
            <h1>{title}</h1>
            <div className="strong" style={{ fontSize: 15, marginTop: 4 }}>{d.number}</div>
            <div className="small" style={{ marginTop: 8, lineHeight: 1.7 }}>
              Date: <b>{date(d.issue_date)}</b><br />
              {kind === 'invoice' ? <>Due: <b>{date(d.due_date)}</b></> : <>Valid until: <b>{date(d.valid_until)}</b></>}
              {d.period_month && <><br />Period: <b>{new Date(d.period_month).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</b></>}
            </div>
          </div>
        </div>
        <div className="row between" style={{ marginTop: 22, alignItems: 'flex-start', gap: 20 }}>
          <div>
            <div className="tiny" style={{ textTransform: 'uppercase', letterSpacing: '.1em', color: '#888', fontWeight: 700 }}>Bill to</div>
            {billTo.map((l, i) => <div key={i} className={i === 0 ? 'strong' : 'small'} style={i === 0 ? { fontSize: 15 } : undefined}>{l}</div>)}
          </div>
          {kind === 'invoice' && d.status === 'paid' && <span className="paid-stamp">PAID</span>}
        </div>
        <table>
          <thead><tr><th style={{ width: 40 }}>#</th><th>Description</th><th className="right">Qty</th><th className="right">Rate</th><th className="right">Amount</th></tr></thead>
          <tbody>
            {(d.items || []).map((it, i) => (
              <tr key={i}><td>{i + 1}</td><td>{it.description}</td><td className="right">{it.qty}</td><td className="right">{money2(it.rate)}</td><td className="right strong">{money2(Number(it.qty) * Number(it.rate))}</td></tr>
            ))}
          </tbody>
        </table>
        <div className="totals">
          <div><span>Subtotal</span><span>{money2(d.subtotal)}</span></div>
          {Number(d.discount) > 0 && <div><span>Discount</span><span>− {money2(d.discount)}</span></div>}
          <div className="grand"><span>Total</span><span>{money2(d.total)}</span></div>
          {kind === 'invoice' && Number(d.amount_paid) > 0 && <><div><span>Paid</span><span>{money2(d.amount_paid)}</span></div><div className="strong"><span>Balance due</span><span>{money2(balance)}</span></div></>}
        </div>
        <p className="small" style={{ marginTop: 10 }}><b>Amount in words:</b> {amountInWords(d.total)}</p>
        {d.notes && <p className="small pre" style={{ marginTop: 14 }}>{d.notes}</p>}
        <div className="grid g2" style={{ marginTop: 26, gap: 24 }}>
          {kind === 'invoice' && (st.bank_details || st.upi_id) && <div className="small"><b>Payment details</b><div className="pre" style={{ marginTop: 4, color: '#444' }}>{st.bank_details}{st.upi_id && `\nUPI: ${st.upi_id}`}</div></div>}
          {d.terms && <div className="small"><b>Terms</b><div className="pre" style={{ marginTop: 4, color: '#444' }}>{d.terms}</div></div>}
        </div>
        <div className="center tiny" style={{ marginTop: 36, color: '#999', borderTop: '1px solid #eee', paddingTop: 12 }}>Thank you for choosing {st.company_name}. This is a computer-generated document.</div>
      </div>

      {kind === 'invoice' && pays.data.length > 0 && (
        <Card className="mt-l no-print" title="Payments received" style={{ maxWidth: 820, margin: '20px auto 0' }}>
          <div className="list">{pays.data.map((p) => (
            <div key={p.id} className="list-item">
              <div className="grow"><b>{money2(p.amount)}</b> <span className="muted">via {p.method}{p.reference && ` · ${p.reference}`}</span>{p.note && <div className="small faint">{p.note}</div>}</div>
              <span className="muted">{date(p.paid_on)}</span>
              {isFin && <IconBtn icon={Pencil} size={14} title="Edit" onClick={() => setPaying(p)} />}
              {isFin && <IconBtn icon={Trash2} size={14} title="Remove" onClick={() => delPay(p)} />}
            </div>))}
          </div>
        </Card>
      )}
      {kind === 'invoice' && can('finance', 'marketer') && <MoneyFlow invoice={d} />}
      {editing && <DocEditor kind={kind} doc={d} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); doc.reload() }} />}
      {paying && <PaymentModal invoice={d} payment={paying.id ? paying : null} onClose={() => setPaying(null)} onSaved={() => { setPaying(null); pays.reload(); doc.reload() }} />}
    </>
  )
}

