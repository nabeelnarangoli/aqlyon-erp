import { useMemo } from 'react'
import { Plus, Trash2, Check } from 'lucide-react'
import { supabase, q } from '../../lib/supabase'
import { useData } from '../../lib/hooks'
import { useAuth } from '../../lib/auth'
import { INVOICE_STATUS, QUOTE_STATUS } from '../../lib/constants'
import { money2, todayISO, addDays } from '../../lib/format'
import { Modal, Field, Input, Select, Textarea, ClientSelect, Button, IconBtn, Badge, useAction, useForm } from '../../components/ui'

const BILL_LABEL = { monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly', one_time: 'One time' }

/** kind: 'invoice' | 'quote' */
export default function DocEditor({ kind, doc = {}, onClose, onSaved }) {
  const { settings } = useAuth()
  const isNew = !doc.id
  const table = kind === 'invoice' ? 'invoices' : 'quotations'
  const [f, set, setF] = useForm({
    client_id: '', lead_id: null, bill_to: '', issue_date: todayISO(),
    ...(kind === 'invoice' ? { due_date: addDays(todayISO(), 7), status: 'draft' } : { valid_until: addDays(todayISO(), 15), status: 'draft' }),
    items: [{ description: '', qty: 1, rate: 0 }], discount: 0, notes: '', terms: settings?.invoice_terms || '', ...doc
  })
  const services = useData(() => q(supabase.from('services').select('*').eq('active', true).order('category').order('name')), [], [])
  const packs = useData(async () => {
    if (!f.client_id) return { list: [], billed: [] }
    const list = await q(supabase.from('packages').select('*').eq('client_id', f.client_id).neq('status', 'ended').order('start_date', { ascending: false }))
    const billed = list.length ? await q(supabase.from('invoices').select('id,number,package_id,period_month').in('package_id', list.map((x) => x.id)).neq('status', 'cancelled')) : []
    return { list, billed }
  }, [f.client_id], { list: [], billed: [] })
  const lead = useData(() => (f.lead_id ? q(supabase.from('leads').select('name,company,phone,city').eq('id', f.lead_id).maybeSingle()) : null), [f.lead_id])
  const items = f.items || []
  const subtotal = useMemo(() => items.reduce((a, i) => a + Number(i.qty || 0) * Number(i.rate || 0), 0), [items])
  const total = Math.max(0, subtotal - Number(f.discount || 0))
  const setItem = (idx, k, v) => setF((s) => ({ ...s, items: s.items.map((it, i) => (i === idx ? { ...it, [k]: v } : it)) }))
  const addItem = (svc) => setF((s) => ({ ...s, items: [...s.items.filter((i) => i.description || Number(i.rate)), svc ? { description: svc.name, qty: 1, rate: Number(svc.rate) } : { description: '', qty: 1, rate: 0 }] }))
  const removeItem = (idx) => setF((s) => ({ ...s, items: s.items.filter((_, i) => i !== idx) }))
  const [busy, run] = useAction()

  const save = (e) => { e.preventDefault(); run(async () => {
    const clean = items.filter((i) => i.description && Number(i.qty) > 0).map((i) => ({ description: i.description, qty: Number(i.qty), rate: Number(i.rate || 0), ...(i.package_id ? { package_id: i.package_id } : {}) }))
    if (!clean.length) throw new Error('Add at least one line item')
    if (kind === 'invoice' && !f.client_id) throw new Error('Choose a client')
    if (kind === 'invoice' && f.package_id && !clean.some((i) => i.package_id === f.package_id)) { f.package_id = null; f.period_month = null }
    const p = { ...f, items: clean, discount: Number(f.discount || 0), client_id: f.client_id || null }
    ;['id', 'number', 'subtotal', 'total', 'amount_paid', 'created_at', 'created_by', 'clients', 'balance', 'overdue', 'days_overdue', 'client_name', 'leads'].forEach((k) => delete p[k])
    if (kind === 'invoice') ['lead_id', 'bill_to', 'valid_until'].forEach((k) => delete p[k])
    else ['due_date', 'package_id', 'period_month', 'project_id', 'quotation_id'].forEach((k) => delete p[k])
    if (kind === 'quote' && !p.bill_to && lead.data) p.bill_to = [lead.data.company || lead.data.name, lead.data.city, lead.data.phone].filter(Boolean).join('\n')
    const row = isNew ? await q(supabase.from(table).insert(p).select().single()) : await q(supabase.from(table).update(p).eq('id', doc.id).select().single())
    onSaved(row)
  }, `${kind === 'invoice' ? 'Invoice' : 'Quotation'} saved`) }

  const month = String(f.issue_date || todayISO()).slice(0, 7) + '-01'
  const monthLabel = new Date(month + 'T00:00:00').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
  const PERIOD = { monthly: monthLabel, quarterly: `quarter from ${monthLabel}`, yearly: `year from ${monthLabel}`, one_time: '' }
  const pkgLine = (p) => {
    const inc = [p.posts_per_month && `${p.posts_per_month} posts`, p.carousels_per_month && `${p.carousels_per_month} carousels`, p.reels_per_month && `${p.reels_per_month} reels`, p.stories_per_month && `${p.stories_per_month} stories`].filter(Boolean).join(', ')
    return `${p.name}${PERIOD[p.billing_type] ? ' — ' + PERIOD[p.billing_type] : ''}${inc ? ` (${inc})` : ''}`
  }
  const billedFor = (p) => packs.data.billed.find((i) => i.package_id === p.id && i.period_month === month && i.id !== doc.id)
  const inInvoice = (p) => items.some((i) => i.package_id === p.id)
  const addPackage = (p) => setF((s) => ({
    ...s,
    items: [...s.items.filter((i) => i.description || Number(i.rate)), { description: pkgLine(p), qty: 1, rate: Number(p.fee), package_id: p.id }],
    ...(kind === 'invoice' && !s.package_id && !billedFor(p) ? { package_id: p.id, period_month: p.billing_type === 'one_time' ? null : month } : {})
  }))
  const grouped = services.data.reduce((a, s) => { (a[s.category] ||= []).push(s); return a }, {})
  return (
    <Modal open size="xl" onClose={onClose} title={`${isNew ? 'New' : 'Edit'} ${kind === 'invoice' ? 'invoice' : 'quotation'}${doc.number ? ' · ' + doc.number : ''}`}
      footer={<><span className="muted" style={{ marginRight: 'auto' }}>Total <b style={{ color: 'var(--ink)', fontSize: 18 }}>{money2(total)}</b></span>
        <Button variant="ghost" onClick={onClose}>Cancel</Button><Button form="doc" type="submit" loading={busy}>Save</Button></>}>
      <form id="doc" onSubmit={save}>
        <div className="form f3">
          <Field label="Client" required={kind === 'invoice'}><ClientSelect value={f.client_id} onChange={set('client_id')} placeholder={kind === 'quote' ? 'Existing client (optional)' : 'Select client…'} /></Field>
          <Field label={kind === 'invoice' ? 'Invoice date' : 'Quote date'}><Input type="date" value={f.issue_date} onChange={set('issue_date')} /></Field>
          {kind === 'invoice'
            ? <Field label="Due date"><Input type="date" value={f.due_date} onChange={set('due_date')} /></Field>
            : <Field label="Valid until"><Input type="date" value={f.valid_until} onChange={set('valid_until')} /></Field>}
          {kind === 'quote' && !f.client_id && <Field label="Bill to (prospect)" span={2} hint={lead.data ? `From lead: ${lead.data.company || lead.data.name}` : 'Name, address, phone'}><Textarea rows={2} value={f.bill_to || (lead.data ? [lead.data.company || lead.data.name, lead.data.city, lead.data.phone].filter(Boolean).join('\n') : '')} onChange={set('bill_to')} /></Field>}
          <Field label="Status"><Select placeholder={false} options={kind === 'invoice' ? INVOICE_STATUS.filter((s) => ['draft', 'sent', 'cancelled'].includes(s.id) || s.id === f.status) : QUOTE_STATUS} value={f.status} onChange={set('status')} /></Field>
        </div>

        {f.client_id && packs.data.list.length > 0 && (
          <div className="mt-l">
            <h3 className="mb">Customer packages</h3>
            <div className="grid g2" style={{ gap: 10 }}>
              {packs.data.list.map((p) => {
                const prev = billedFor(p), added = inInvoice(p)
                return (
                  <div key={p.id} className="card card-body row gap" style={{ padding: 12, borderColor: added ? 'var(--green)' : undefined }}>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="row gap-s wrap"><b>{p.name}</b><Badge tone={p.status === 'active' ? 'green' : 'amber'}>{p.status}</Badge><span className="small muted">{BILL_LABEL[p.billing_type]}</span></div>
                      <div className="small muted">{[p.posts_per_month && `${p.posts_per_month} posts`, p.carousels_per_month && `${p.carousels_per_month} carousels`, p.reels_per_month && `${p.reels_per_month} reels`, p.stories_per_month && `${p.stories_per_month} stories`].filter(Boolean).join(' · ') || p.scope_notes || '—'}</div>
                      {prev && kind === 'invoice' && <div className="small" style={{ color: 'var(--orange)' }}>Already billed for {monthLabel} on {prev.number}</div>}
                    </div>
                    <div className="right"><div className="strong">{money2(p.fee)}</div>
                      <Button type="button" size="sm" variant={added ? 'ghost' : 'soft'} icon={added ? Check : Plus} disabled={added} onClick={() => addPackage(p)}>{added ? 'Added' : 'Add'}</Button></div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
        {f.client_id && packs.data.list.length === 0 && !packs.loading && <p className="small faint mt">This customer has no packages yet. Add one on the customer’s Packages tab.</p>}

        <div className="row between mt-l mb"><h3>Line items</h3>
          <div className="row gap-s">
            <select className="input input-sm" style={{ width: 280 }} value="" onChange={(e) => { const s = services.data.find((x) => x.id === e.target.value); if (s) addItem(s) }}>
              <option value="">+ Add from service catalogue…</option>
              {Object.entries(grouped).map(([g, list]) => <optgroup key={g} label={g}>{list.map((s) => <option key={s.id} value={s.id}>{s.name} — ₹{Number(s.rate).toLocaleString('en-IN')}</option>)}</optgroup>)}
            </select>
            <Button type="button" size="sm" variant="outline" icon={Plus} onClick={() => addItem()}>Blank line</Button>
          </div>
        </div>
        <div className="card table-wrap">
          <table className="table items-editor">
            <thead><tr><th style={{ width: '55%' }}>Description</th><th className="num">Qty</th><th className="num">Rate (₹)</th><th className="num">Amount</th><th /></tr></thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i}>
                  <td><input className="input" value={it.description} onChange={(e) => setItem(i, 'description', e.target.value)} placeholder="Service / deliverable" /></td>
                  <td><input className="input right" style={{ width: 80 }} type="number" min="0" step="any" value={it.qty} onChange={(e) => setItem(i, 'qty', e.target.value)} /></td>
                  <td><input className="input right" style={{ width: 120 }} type="number" min="0" step="any" value={it.rate} onChange={(e) => setItem(i, 'rate', e.target.value)} /></td>
                  <td className="num strong">{money2(Number(it.qty || 0) * Number(it.rate || 0))}</td>
                  <td><IconBtn icon={Trash2} size={14} title="Remove" onClick={() => removeItem(i)} /></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><td colSpan={3} className="right">Subtotal</td><td className="num">{money2(subtotal)}</td><td /></tr>
              <tr><td colSpan={3} className="right">Discount (₹)</td><td className="num"><input className="input right" style={{ width: 120, marginLeft: 'auto' }} type="number" min="0" value={f.discount} onChange={set('discount')} /></td><td /></tr>
              <tr><td colSpan={3} className="right">Total</td><td className="num" style={{ fontSize: 16 }}>{money2(total)}</td><td /></tr>
            </tfoot>
          </table>
        </div>
        <div className="form mt">
          <Field label="Notes (shown on document)"><Textarea value={f.notes} onChange={set('notes')} /></Field>
          <Field label="Terms"><Textarea value={f.terms} onChange={set('terms')} /></Field>
        </div>
      </form>
    </Modal>
  )
}
