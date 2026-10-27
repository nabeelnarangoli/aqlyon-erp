import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Loader2, AlertTriangle, CheckCircle2, Info, Search, Inbox, Plus } from 'lucide-react'
import { initials } from '../lib/format'
import { useAuth } from '../lib/auth'
import { useData } from '../lib/hooks'
import { supabase, q } from '../lib/supabase'

export const cx = (...a) => a.filter(Boolean).join(' ')

/* ---------- Buttons ---------- */
export function Button({ variant = 'primary', size, icon: Icon, loading, children, className, ...p }) {
  return (
    <button className={cx('btn', `btn-${variant}`, size && `btn-${size}`, className)} disabled={loading || p.disabled} {...p}>
      {loading ? <Loader2 size={16} className="spin" /> : Icon ? <Icon size={16} /> : null}
      {children && <span>{children}</span>}
    </button>
  )
}
export function IconBtn({ icon: Icon, title, className, size = 16, ...p }) {
  return <button type="button" className={cx('icon-btn', className)} title={title} aria-label={title} {...p}><Icon size={size} /></button>
}

/* ---------- Badges / avatar ---------- */
export function Badge({ tone = 'slate', children, dot, className }) {
  return <span className={cx('badge', `tone-${tone}`, className)}>{dot && <i className="dot" />}{children}</span>
}
export function StatusBadge({ list, value }) {
  const s = list.find((x) => x.id === value) || { label: value || '—', tone: 'slate' }
  return <Badge tone={s.tone} dot>{s.label}</Badge>
}
export function Avatar({ name, url, size = 28, title }) {
  const hue = [...(name || '?')].reduce((a, c) => a + c.charCodeAt(0), 0) % 360
  return url
    ? <img className="avatar" src={url} alt={name} title={title || name} style={{ width: size, height: size }} />
    : <span className="avatar" title={title || name} style={{ width: size, height: size, fontSize: size * 0.38, background: `hsl(${hue} 45% 92%)`, color: `hsl(${hue} 45% 30%)` }}>{initials(name)}</span>
}
export function Member({ id, size = 24, showName = true, fallback = 'Unassigned' }) {
  const { member } = useAuth()
  const m = member(id)
  if (!m) return <span className="muted small">{fallback}</span>
  return <span className="member"><Avatar name={m.full_name} url={m.avatar_url} size={size} />{showName && <span>{m.full_name}</span>}</span>
}

/* ---------- Layout bits ---------- */
export function PageHeader({ title, subtitle, actions, children }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      <div className="page-actions">{actions}</div>
      {children}
    </div>
  )
}
export function Card({ title, actions, children, className, pad = true, ...p }) {
  return (
    <section className={cx('card', className)} {...p}>
      {(title || actions) && <header className="card-head"><h3>{title}</h3><div className="row gap-s">{actions}</div></header>}
      <div className={pad ? 'card-body' : ''}>{children}</div>
    </section>
  )
}
export function Stat({ label, value, sub, icon: Icon, tone = 'green', onClick }) {
  return (
    <div className={cx('stat', onClick && 'clickable')} onClick={onClick}>
      {Icon && <span className={cx('stat-icon', `tone-${tone}`)}><Icon size={18} /></span>}
      <div>
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        {sub && <div className="stat-sub">{sub}</div>}
      </div>
    </div>
  )
}
export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} className={cx('tab', value === t.id && 'active')} onClick={() => onChange(t.id)}>
          {t.icon && <t.icon size={15} />}{t.label}{t.count !== undefined && <span className="tab-count">{t.count}</span>}
        </button>
      ))}
    </div>
  )
}
export function Loading({ label = 'Loading…' }) {
  return <div className="loading"><Loader2 className="spin" size={20} /> {label}</div>
}
export function ErrorBox({ error, onRetry }) {
  if (!error) return null
  return <div className="alert alert-error"><AlertTriangle size={16} /><span>{error}</span>{onRetry && <Button variant="ghost" size="sm" onClick={onRetry}>Retry</Button>}</div>
}
export function Empty({ icon: Icon = Inbox, title = 'Nothing here yet', children, action }) {
  return (
    <div className="empty">
      <Icon size={28} />
      <strong>{title}</strong>
      {children && <p className="muted">{children}</p>}
      {action}
    </div>
  )
}
export function SearchInput({ value, onChange, placeholder = 'Search…', className }) {
  return (
    <label className={cx('search', className)}>
      <Search size={15} />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      {value && <button type="button" onClick={() => onChange('')} aria-label="Clear"><X size={14} /></button>}
    </label>
  )
}
export function Progress({ value, max = 100, tone = 'green' }) {
  const p = max ? Math.min(100, Math.round((value / max) * 100)) : 0
  return <div className={cx('progress', `tone-${tone}`)}><i style={{ width: `${p}%` }} /></div>
}

/* ---------- Forms ---------- */
export function Field({ label, hint, children, span, required }) {
  return (
    <label className={cx('field', span && `span-${span}`)}>
      {label && <span className="field-label">{label}{required && <em> *</em>}</span>}
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}
export function Input(p) { return <input className="input" {...(p.type === 'number' && !p.step ? { step: 'any' } : {})} {...p} value={p.value ?? ''} /> }
export function Textarea(p) { return <textarea className="input" rows={3} {...p} value={p.value ?? ''} /> }
export function Select({ options, placeholder, value, onChange, ...p }) {
  return (
    <select className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} {...p}>
      {placeholder !== false && <option value="">{placeholder || 'Select…'}</option>}
      {options.map((o) => typeof o === 'string'
        ? <option key={o} value={o}>{o}</option>
        : <option key={o.id} value={o.id}>{o.label}</option>)}
    </select>
  )
}
export function Chips({ options, value = [], onChange }) {
  const toggle = (o) => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o])
  return (
    <div className="chips">
      {options.map((o) => <button type="button" key={o} className={cx('chip', value.includes(o) && 'on')} onClick={() => toggle(o)}>{o}</button>)}
    </div>
  )
}
export function MemberSelect({ value, onChange, perm, placeholder = 'Unassigned' }) {
  const { team, memberHas } = useAuth()
  const opts = team.filter((m) => m.active && (!perm || memberHas(m, ...perm) || m.id === value)).map((m) => ({ id: m.id, label: m.full_name }))
  return <Select options={opts} value={value} onChange={onChange} placeholder={placeholder} />
}

let clientCache = null
export function useClients() {
  return useData(async () => {
    if (clientCache && Date.now() - clientCache.t < 30000) return clientCache.d
    const d = await q(supabase.from('clients').select('id, name, code, status, account_manager_id, phone, contact_person, customer_type').order('name'))
    clientCache = { t: Date.now(), d }
    return d
  }, [], [])
}
export const invalidateClients = () => { clientCache = null }
export function ClientSelect({ value, onChange, placeholder = 'Select client…', includeInactive, allowCreate }) {
  const { data, reload } = useClients()
  const [adding, setAdding] = useState(false)
  const list = (data || []).filter((c) => includeInactive || c.status !== 'churned' || c.id === value)
  const label = (c) => c.customer_type === 'walkin' ? `${c.name} · Walk-in${c.phone ? ` · ${c.phone}` : ''}` : c.name
  const opts = [...list.filter((c) => c.customer_type !== 'walkin'), ...list.filter((c) => c.customer_type === 'walkin')].map((c) => ({ id: c.id, label: label(c) }))
  const sel = <Select options={opts} value={value} onChange={onChange} placeholder={placeholder} />
  if (!allowCreate) return sel
  return (
    <>
      <div className="row gap-xs">{sel}<IconBtn icon={Plus} title="New customer" onClick={() => setAdding(true)} /></div>
      {adding && <NewCustomerModal onClose={() => setAdding(false)} onSaved={(id) => { setAdding(false); invalidateClients(); reload(); onChange(id) }} />}
    </>
  )
}

// quick-create a customer from any client picker: walk-in (any team member) or regular client (client managers)
export function NewCustomerModal({ onClose, onSaved }) {
  const { has } = useAuth()
  const canRegular = has('clients.manage', 'leads.manage')
  const [f, set] = useForm({ type: 'walkin', name: '', phone: '', contact_person: '' })
  const [busy, run] = useAction()
  const save = (e) => { e.preventDefault(); e.stopPropagation(); run(async () => {   // stop: this form sits inside other forms (React events bubble through portals)
    if (!f.name.trim()) throw new Error('Enter the customer name')
    const id = f.type === 'walkin'
      ? await q(supabase.rpc('walkin_customer', { p_name: f.name.trim(), p_phone: f.phone || null }))
      : (await q(supabase.from('clients').insert({ name: f.name.trim(), contact_person: f.contact_person || f.name.trim(), phone: f.phone || null, whatsapp: f.phone || null, status: 'active', customer_type: 'regular' }).select('id').single())).id
    onSaved(id)
  }, 'Customer added') }
  return (
    <Modal open size="sm" onClose={onClose} title="New customer"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button form="newcust" type="submit" loading={busy}>Add customer</Button></>}>
      <form id="newcust" className="form f1" onSubmit={save}>
        <Field label="Customer type">
          <Select placeholder={false} value={f.type} onChange={set('type')}
            options={[{ id: 'walkin', label: 'Walk-in customer' }, ...(canRegular ? [{ id: 'regular', label: 'Regular client (business account)' }] : [])]} />
        </Field>
        <Field label={f.type === 'walkin' ? 'Name' : 'Business / brand name'} required><Input value={f.name} onChange={set('name')} autoFocus /></Field>
        {f.type === 'regular' && <Field label="Contact person"><Input value={f.contact_person} onChange={set('contact_person')} /></Field>}
        <Field label="Mobile number" hint={f.type === 'walkin' ? 'If this number is already saved, that customer is used instead of a duplicate' : undefined}><Input type="tel" value={f.phone} onChange={set('phone')} /></Field>
      </form>
    </Modal>
  )
}

/** small form state helper */
export function useForm(initial) {
  const [f, setF] = useState(initial)
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v && v.target ? (v.target.type === 'checkbox' ? v.target.checked : v.target.value) : v }))
  return [f, set, setF]
}

/* ---------- Modal / drawer ---------- */
export function Modal({ open, onClose, title, subtitle, children, footer, size = 'md', drawer }) {
  useEffect(() => {
    if (!open) return
    const k = (e) => e.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', k)
    document.body.classList.add('no-scroll')
    return () => { document.removeEventListener('keydown', k); document.body.classList.remove('no-scroll') }
  }, [open, onClose])
  if (!open) return null
  return createPortal(
    <div className={cx('overlay', drawer && 'overlay-drawer')} onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={cx('modal', `modal-${size}`, drawer && 'drawer')} role="dialog" aria-modal="true">
        <header className="modal-head">
          <div><h2>{title}</h2>{subtitle && <p className="muted small">{subtitle}</p>}</div>
          <IconBtn icon={X} title="Close" onClick={onClose} />
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>,
    document.body
  )
}

/* ---------- Toasts & confirm ---------- */
const ToastCtx = createContext(null)
export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const [confirmState, setConfirm] = useState(null)
  const push = useCallback((msg, type = 'success') => {
    const id = Math.random()
    setItems((s) => [...s, { id, msg, type }])
    setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), type === 'error' ? 6000 : 3200)
  }, [])
  const confirm = useCallback((message, { title = 'Are you sure?', okText = 'Confirm', danger } = {}) =>
    new Promise((resolve) => setConfirm({ message, title, okText, danger, resolve })), [])
  const close = (v) => { confirmState?.resolve(v); setConfirm(null) }
  return (
    <ToastCtx.Provider value={{ toast: push, confirm }}>
      {children}
      {createPortal(
        <div className="toasts">
          {items.map((t) => (
            <div key={t.id} className={cx('toast', `toast-${t.type}`)}>
              {t.type === 'error' ? <AlertTriangle size={16} /> : t.type === 'info' ? <Info size={16} /> : <CheckCircle2 size={16} />}
              <span>{t.msg}</span>
            </div>
          ))}
        </div>, document.body)}
      <Modal open={!!confirmState} onClose={() => close(false)} title={confirmState?.title} size="sm"
        footer={<><Button variant="ghost" onClick={() => close(false)}>Cancel</Button>
          <Button variant={confirmState?.danger ? 'danger' : 'primary'} onClick={() => close(true)}>{confirmState?.okText}</Button></>}>
        <p>{confirmState?.message}</p>
      </Modal>
    </ToastCtx.Provider>
  )
}
export const useToast = () => useContext(ToastCtx)

/** wraps an async action with loading + toast on error */
export function useAction() {
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)
  const run = useCallback(async (fn, okMsg) => {
    setBusy(true)
    try { const r = await fn(); if (okMsg) toast(okMsg); return r ?? true }
    catch (e) { toast(e.message || String(e), 'error'); return false }
    finally { setBusy(false) }
  }, [toast])
  return [busy, run]
}
