import { useEffect, useRef, useState } from 'react'
import { CalendarRange, ChevronDown } from 'lucide-react'
import { toISO } from '../lib/format'

// Quick periods (Indian financial year runs April–March)
export function rangePresets(now = new Date()) {
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate()
  const D = (yy, mm, dd) => toISO(new Date(yy, mm, dd))
  const monday = new Date(y, m, d - ((now.getDay() + 6) % 7))
  const fy = m >= 3 ? y : y - 1
  return [
    { id: 'today', label: 'Today', from: D(y, m, d), to: D(y, m, d) },
    { id: 'yesterday', label: 'Yesterday', from: D(y, m, d - 1), to: D(y, m, d - 1) },
    { id: 'this_week', label: 'This week', from: toISO(monday), to: D(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6) },
    { id: 'last_week', label: 'Last week', from: D(monday.getFullYear(), monday.getMonth(), monday.getDate() - 7), to: D(monday.getFullYear(), monday.getMonth(), monday.getDate() - 1) },
    { id: 'last_7', label: 'Last 7 days', from: D(y, m, d - 6), to: D(y, m, d) },
    { id: 'last_30', label: 'Last 30 days', from: D(y, m, d - 29), to: D(y, m, d) },
    { id: 'this_month', label: 'This month', from: D(y, m, 1), to: D(y, m + 1, 0) },
    { id: 'last_month', label: 'Last month', from: D(y, m - 1, 1), to: D(y, m, 0) },
    { id: 'last_3', label: 'Last 3 months', from: D(y, m - 2, 1), to: D(y, m + 1, 0) },
    { id: 'last_6', label: 'Last 6 months', from: D(y, m - 5, 1), to: D(y, m + 1, 0) },
    { id: 'this_quarter', label: 'This quarter', from: D(y, m - (m % 3), 1), to: D(y, m - (m % 3) + 3, 0) },
    { id: 'this_fy', label: `This financial year (${fy}–${String(fy + 1).slice(2)})`, from: D(fy, 3, 1), to: D(fy + 1, 2, 31) },
    { id: 'last_fy', label: `Last financial year (${fy - 1}–${String(fy).slice(2)})`, from: D(fy - 1, 3, 1), to: D(fy, 2, 31) },
    { id: 'this_year', label: `This year (${y})`, from: D(y, 0, 1), to: D(y, 11, 31) },
    { id: 'last_year', label: `Last year (${y - 1})`, from: D(y - 1, 0, 1), to: D(y - 1, 11, 31) },
    { id: 'all', label: 'All time', from: '2000-01-01', to: D(y + 5, 11, 31) }
  ]
}
export const presetRange = (id) => { const p = rangePresets().find((x) => x.id === id); return [p.from, p.to] }

const fmt = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

/** Period picker: quick ranges + custom dates. onChange(from, to). */
export default function DateRange({ from, to, onChange }) {
  const [open, setOpen] = useState(false)
  const [cf, setCf] = useState(from), [ct, setCt] = useState(to)
  const ref = useRef()
  useEffect(() => { setCf(from); setCt(to) }, [from, to])
  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])
  const presets = rangePresets()
  const cur = presets.find((p) => p.from === from && p.to === to)
  const pick = (a, b) => { onChange(a, b); setOpen(false) }
  return (
    <div ref={ref} className="daterange">
      <button type="button" className="input daterange-btn" onClick={() => setOpen((v) => !v)}>
        <CalendarRange size={15} />
        <span className="grow ellipsis">{cur ? cur.label : `${fmt(from)} – ${fmt(to)}`}</span>
        {cur && cur.id !== 'all' && <span className="tiny faint nowrap">{fmt(from)} – {fmt(to)}</span>}
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="daterange-pop">
          <div className="daterange-list">
            {presets.map((p) => (
              <button type="button" key={p.id} className={p.id === cur?.id ? 'on' : ''} onClick={() => pick(p.from, p.to)}>{p.label}</button>
            ))}
          </div>
          <div className="daterange-custom">
            <div className="small strong">Custom period</div>
            <label className="field"><span className="field-label">From</span><input className="input" type="date" value={cf} onChange={(e) => setCf(e.target.value)} /></label>
            <label className="field"><span className="field-label">To</span><input className="input" type="date" value={ct} onChange={(e) => setCt(e.target.value)} /></label>
            <button type="button" className="btn btn-primary btn-sm" disabled={!cf || !ct || cf > ct} onClick={() => pick(cf, ct)}>Apply</button>
          </div>
        </div>
      )}
    </div>
  )
}
