const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const inr2 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const num = new Intl.NumberFormat('en-IN')

// Amounts are hidden ("—") for people whose role lacks "See prices & money" (set at sign-in).
// rawMoney / rawMoney2 always show: used only where a person sees money they collect (walk-in sales, their receipts).
let SHOW_MONEY = true
export const setMoneyVisible = (v) => { SHOW_MONEY = !!v }
export const showMoney = () => SHOW_MONEY
export const rawMoney = (v) => inr.format(Number(v || 0))
export const rawMoney2 = (v) => inr2.format(Number(v || 0))
export const money = (v) => (SHOW_MONEY ? rawMoney(v) : '—')
export const money2 = (v) => (SHOW_MONEY ? rawMoney2(v) : '—')
export const n = (v) => num.format(Number(v || 0))
export const compact = (v) => {
  if (!SHOW_MONEY) return '—'
  const x = Number(v || 0)
  if (Math.abs(x) >= 1e7) return '₹' + (x / 1e7).toFixed(1).replace(/\.0$/, '') + ' Cr'
  if (Math.abs(x) >= 1e5) return '₹' + (x / 1e5).toFixed(1).replace(/\.0$/, '') + ' L'
  if (Math.abs(x) >= 1e3) return '₹' + (x / 1e3).toFixed(1).replace(/\.0$/, '') + 'k'
  return '₹' + x.toFixed(0)
}

// Dates are stored as yyyy-mm-dd (date) or ISO timestamps.
export const todayISO = () => toISO(new Date())
export function toISO(d) {
  const x = new Date(d)
  const y = x.getFullYear(), m = String(x.getMonth() + 1).padStart(2, '0'), day = String(x.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
export function parseDate(s) {
  if (!s) return null
  if (s instanceof Date) return s
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
  return new Date(s)
}
export const addDays = (s, k) => { const d = parseDate(s) || new Date(); d.setDate(d.getDate() + k); return toISO(d) }
export const monthStart = (d = new Date()) => toISO(new Date(d.getFullYear(), d.getMonth(), 1))
export const monthEnd = (d = new Date()) => toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0))

export function date(s, opts) {
  const d = parseDate(s); if (!d || isNaN(d)) return '—'
  return d.toLocaleDateString('en-IN', opts || { day: 'numeric', month: 'short', year: 'numeric' })
}
export const shortDate = (s) => date(s, { day: 'numeric', month: 'short' })
export function dateTime(s) {
  const d = parseDate(s); if (!d || isNaN(d)) return '—'
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}
export function ago(s) {
  const d = parseDate(s); if (!d) return ''
  const sec = (Date.now() - d.getTime()) / 1000
  if (sec < 60) return 'just now'
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`
  if (sec < 86400 * 7) return `${Math.floor(sec / 86400)}d ago`
  return date(s)
}
/** days from today (negative = past) */
export function daysFrom(s) {
  const d = parseDate(s); if (!d) return null
  const t = new Date(); t.setHours(0, 0, 0, 0); d.setHours(0, 0, 0, 0)
  return Math.round((d - t) / 86400000)
}
export function dueLabel(s) {
  const k = daysFrom(s)
  if (k === null) return { text: 'No due date', tone: 'slate' }
  if (k < 0) return { text: `${-k}d overdue`, tone: 'red' }
  if (k === 0) return { text: 'Due today', tone: 'orange' }
  if (k === 1) return { text: 'Due tomorrow', tone: 'amber' }
  return { text: `Due ${shortDate(s)}`, tone: 'slate' }
}
export const hours = (min) => `${(Number(min || 0) / 60).toFixed(1).replace(/\.0$/, '')}h`
export const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?'
export const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0)

export function downloadCSV(filename, rows) {
  if (!rows?.length) return
  const cols = Object.keys(rows[0])
  const esc = (v) => { const s = v === null || v === undefined ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
  a.download = filename
  a.click()
}

export const waLink = (phone, text = '') => {
  const p = String(phone || '').replace(/\D/g, '')
  const full = p.length === 10 ? '91' + p : p
  return `https://wa.me/${full}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}

// Indian number words for invoices
export function amountInWords(amount) {
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
  const two = (x) => (x < 20 ? a[x] : b[Math.floor(x / 10)] + (x % 10 ? ' ' + a[x % 10] : ''))
  const three = (x) => (x >= 100 ? a[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' ' + two(x % 100) : '') : two(x))
  let x = Math.floor(Number(amount || 0)); const paise = Math.round((Number(amount || 0) - x) * 100)
  if (x === 0 && !paise) return 'Zero Rupees Only'
  const parts = []
  const cr = Math.floor(x / 1e7); x %= 1e7
  const lk = Math.floor(x / 1e5); x %= 1e5
  const th = Math.floor(x / 1e3); x %= 1e3
  if (cr) parts.push(three(cr) + ' Crore')
  if (lk) parts.push(two(lk) + ' Lakh')
  if (th) parts.push(two(th) + ' Thousand')
  if (x) parts.push(three(x))
  let s = (parts.join(' ') || 'Zero') + ' Rupees'
  if (paise) s += ' and ' + two(paise) + ' Paise'
  return s + ' Only'
}
