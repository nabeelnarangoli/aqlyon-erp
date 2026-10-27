import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Printer, Download, Save, CalendarDays, TrendingUp, TrendingDown, Minus, ExternalLink, Check, BarChart3, Plus, Trash2 } from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, LineChart, Line } from 'recharts'
import { supabase, q } from '../../lib/supabase'
import { downloadPdf } from '../../lib/pdf'
import { useAuth } from '../../lib/auth'
import { useData } from '../../lib/hooks'
import { DELIVERY_KINDS, kindOf, DONE_POST, KPI_FIELDS, KPI_PLATFORMS, POST_STATUSES } from '../../lib/constants'
import { date } from '../../lib/format'
import { RESULT_FIELDS, engagement } from '../tasks/Calendar'
import { PageHeader, Button, Card, Badge, StatusBadge, Stat, Loading, Empty, Input, Progress, Tabs, IconBtn, useAction, cx } from '../../components/ui'

/* ----------------------------- helpers ----------------------------- */
const pad = (n) => String(n).padStart(2, '0')
const thisMonth = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}` }
const first = (ym) => `${ym}-01`
const shiftMonth = (ym, k) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + k, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}` }
const lastDay = (ym) => { const [y, m] = ym.split('-').map(Number); return `${ym}-${pad(new Date(y, m, 0).getDate())}` }
const monthLabel = (ym, short) => new Date(first(ym)).toLocaleDateString('en-IN', { month: short ? 'short' : 'long', year: 'numeric' })
const weekOf = (iso) => Math.min(5, Math.ceil(Number(iso.slice(8, 10)) / 7))
const weeksIn = (ym) => (Number(lastDay(ym).slice(8)) > 28 ? 5 : 4)
const weekRange = (ym, w) => { const end = Math.min(w * 7, Number(lastDay(ym).slice(8))); return `${(w - 1) * 7 + 1}–${end}` }
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
// "1.2k" / "2.3K" / "1,250" / "45%" → number (what the team types today)
export const parseNum = (v) => {
  if (v === '' || v === null || v === undefined) return null
  const s = String(v).trim().toLowerCase().replace(/,/g, '').replace('%', '')
  if (!s || s === 'na' || s === '-') return null
  const m = s.match(/^(-?\d*\.?\d+)\s*([km]?)$/)
  if (!m) return NaN
  return Math.round(Number(m[1]) * (m[2] === 'k' ? 1000 : m[2] === 'm' ? 1e6 : 1) * 100) / 100
}
const fmt = (n) => (n === null || n === undefined || n === '' ? '—' : Number(n) >= 10000 ? `${(Number(n) / 1000).toFixed(1)}k` : Number(n).toLocaleString('en-IN'))
const sumF = (rows, f) => rows.reduce((a, r) => a + (Number(r[f]) || 0), 0)
const avgF = (rows, f) => { const v = rows.filter((r) => r[f] !== null && r[f] !== undefined); return v.length ? sumF(v, f) / v.length : null }
const total = (rows, f) => (KPI_FIELDS.find((x) => x.id === f)?.pct ? avgF(rows, f) : sumF(rows, f))

function Delta({ now, prev }) {
  if (!prev) return now ? <span className="tiny faint">new</span> : null
  const d = Math.round(((now - prev) / prev) * 100)
  const Icon = d > 0 ? TrendingUp : d < 0 ? TrendingDown : Minus
  return <span className="tiny" style={{ color: d > 0 ? 'var(--green-d)' : d < 0 ? 'var(--red)' : 'var(--text-3)', whiteSpace: 'nowrap' }}><Icon size={11} style={{ verticalAlign: -1 }} /> {d > 0 ? '+' : ''}{d}%</span>
}

function MonthPicker({ ym, onChange }) {
  return (
    <div className="row gap-xs">
      <Button variant="ghost" size="sm" onClick={() => onChange(shiftMonth(ym, -1))}>‹</Button>
      <Input type="month" value={ym} onChange={(e) => e.target.value && onChange(e.target.value)} style={{ width: 170 }} />
      <Button variant="ghost" size="sm" onClick={() => onChange(shiftMonth(ym, 1))}>›</Button>
    </div>
  )
}

export default function SocialReports() {
  const { id } = useParams()
  const [sp, setSp] = useSearchParams()
  const ym = sp.get('m') || thisMonth()
  const setYm = (v) => setSp((p) => { const n = new URLSearchParams(p); n.set('m', v); return n }, { replace: true })
  return id ? <ClientReport id={id} ym={ym} setYm={setYm} /> : <Overview ym={ym} setYm={setYm} />
}

/* ============================ all clients ============================ */
function Overview({ ym, setYm }) {
  const nav = useNavigate()
  const prevYm = shiftMonth(ym, -1)
  const { data, loading } = useData(async () => {
    const [clients, pk, posts, kpi] = await Promise.all([
      q(supabase.from('clients').select('id,name,code,status,customer_type').neq('status', 'churned').order('name')),
      q(supabase.from('packages').select('client_id,name,posts_per_month,reels_per_month,stories_per_month,carousels_per_month,platforms,status').eq('status', 'active')),
      q(supabase.from('content_posts').select('client_id,post_type,status,publish_date').gte('publish_date', first(ym)).lte('publish_date', lastDay(ym))),
      q(supabase.from('social_kpis').select('*').in('month', [first(ym), first(prevYm)]))
    ])
    return { clients, pk, posts, kpi }
  }, [ym], null)

  const rows = useMemo(() => {
    if (!data) return []
    return data.clients.map((c) => {
      const pk = data.pk.filter((p) => p.client_id === c.id)
      const posts = data.posts.filter((p) => p.client_id === c.id && p.status !== 'cancelled')
      const k = data.kpi.filter((x) => x.client_id === c.id)
      const now = k.filter((x) => x.month === first(ym)), prev = k.filter((x) => x.month === first(prevYm))
      const kinds = Object.fromEntries(DELIVERY_KINDS.map((d) => [d.id, {
        done: posts.filter((p) => kindOf(p.post_type) === d.id && DONE_POST.includes(p.status)).length,
        planned: posts.filter((p) => kindOf(p.post_type) === d.id).length,
        quota: pk.reduce((a, p) => a + d.quota(p), 0)
      }]))
      return {
        c, pk, kinds, posts, now, prev, hasData: pk.length || posts.length || now.length,
        pending: posts.filter((p) => !DONE_POST.includes(p.status)).length,
        waiting: posts.filter((p) => p.status === 'client_approval').length,
        reach: sumF(now, 'reach'), reachPrev: sumF(prev, 'reach'),
        foll: sumF(now, 'new_followers'), follPrev: sumF(prev, 'new_followers'),
        inter: sumF(now, 'interactions'), interPrev: sumF(prev, 'interactions'),
        views: sumF(now, 'post_views'), viewsPrev: sumF(prev, 'post_views')
      }
    }).filter((r) => r.hasData).sort((a, b) => (b.pk.length - a.pk.length) || a.c.name.localeCompare(b.c.name))
  }, [data, ym, prevYm])

  const totals = rows.reduce((a, r) => ({ done: a.done + DELIVERY_KINDS.reduce((x, d) => x + r.kinds[d.id].done, 0), quota: a.quota + DELIVERY_KINDS.reduce((x, d) => x + r.kinds[d.id].quota, 0), pending: a.pending + r.pending, waiting: a.waiting + r.waiting, noKpi: a.noKpi + (r.pk.length && !r.now.length ? 1 : 0) }), { done: 0, quota: 0, pending: 0, waiting: 0, noKpi: 0 })

  return (
    <>
      <PageHeader title="Client social reports" subtitle="Monthly content delivered against each package, and weekly account KPIs — the marketer's sheets, built in."
        actions={<MonthPicker ym={ym} onChange={setYm} />} />
      <div className="stats">
        <Stat label={`Delivered in ${monthLabel(ym, true)}`} value={`${totals.done}${totals.quota ? ` / ${totals.quota}` : ''}`} sub="Approved, scheduled or posted vs package" icon={Check} />
        <Stat label="Still in progress" value={totals.pending} sub="Idea → client approval" icon={CalendarDays} tone="amber" />
        <Stat label="Waiting on clients" value={totals.waiting} sub="Sent for client approval" icon={CalendarDays} tone="violet" />
        <Stat label="KPIs not entered" value={totals.noKpi} sub="Package clients with no numbers this month" icon={BarChart3} tone={totals.noKpi ? 'orange' : 'green'} />
      </div>
      {loading || !data ? <Loading /> : rows.length === 0 ? <Empty icon={BarChart3} title="Nothing for this month">Add posts to the content calendar, or a package to a client.</Empty> : (
        <div className="card table-wrap"><table className="table">
          <thead><tr>
            <th>Client</th>
            {DELIVERY_KINDS.slice(0, 4).map((d) => <th key={d.id} className="num">{d.label}</th>)}
            <th className="num">In progress</th>
            <th className="num">Reach</th><th className="num">Post views</th><th className="num">New followers</th><th className="num">Interactions</th>
          </tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.c.id} className="click" onClick={() => nav(`/social/${r.c.id}?m=${ym}`)}>
              <td><div className="cell-title">{r.c.name}</div><div className="cell-sub">{r.pk.map((p) => p.name).join(', ') || (r.c.customer_type === 'walkin' ? 'Walk-in' : 'No active package')}</div></td>
              {DELIVERY_KINDS.slice(0, 4).map((d) => {
                const k = r.kinds[d.id]
                return <td key={d.id} className="num">{k.quota || k.planned ? <><b style={{ color: k.quota && k.done >= k.quota ? 'var(--green-d)' : undefined }}>{k.done}</b><span className="faint">{k.quota ? ` / ${k.quota}` : ''}</span>{k.planned > k.done && <div className="tiny faint">{k.planned - k.done} planned</div>}</> : <span className="faint">—</span>}</td>
              })}
              <td className="num">{r.pending ? <>{r.pending}{r.waiting ? <div className="tiny" style={{ color: 'var(--violet, #7c3aed)' }}>{r.waiting} with client</div> : null}</> : <span className="faint">0</span>}</td>
              {r.now.length ? <>
                <td className="num"><b>{fmt(r.reach)}</b><div><Delta now={r.reach} prev={r.reachPrev} /></div></td>
                <td className="num"><b>{fmt(r.views)}</b><div><Delta now={r.views} prev={r.viewsPrev} /></div></td>
                <td className="num"><b>{fmt(r.foll)}</b><div><Delta now={r.foll} prev={r.follPrev} /></div></td>
                <td className="num"><b>{fmt(r.inter)}</b><div><Delta now={r.inter} prev={r.interPrev} /></div></td>
              </> : <td colSpan={4} className="center small">{r.pk.length ? <Badge tone="orange">KPIs not entered</Badge> : <span className="faint">—</span>}</td>}
            </tr>))}</tbody>
        </table></div>
      )}
      <p className="small faint mt">Delivered = approved, scheduled or posted in the content calendar. Numbers after “/” are what the client's package includes per month. KPIs are totals of the weekly figures across platforms, compared with {monthLabel(prevYm)}.</p>
    </>
  )
}

/* ============================ one client ============================ */
function ClientReport({ id, ym, setYm }) {
  const { has, member, settings } = useAuth()
  const canEdit = has('calendar.manage', 'clients.manage')
  const from6 = shiftMonth(ym, -5)
  const { data, loading, reload } = useData(async () => {
    const [client, pk, posts, kpi] = await Promise.all([
      q(supabase.from('clients').select('*').eq('id', id).single()),
      q(supabase.from('packages').select('*').eq('client_id', id).eq('status', 'active')),
      q(supabase.from('content_posts').select('*, design_tasks(id,code,assignee_id,status)').eq('client_id', id).gte('publish_date', first(ym)).lte('publish_date', lastDay(ym)).order('publish_date')),
      q(supabase.from('social_kpis').select('*').eq('client_id', id).gte('month', first(from6)).lte('month', first(ym)))
    ])
    return { client, pk, posts, kpi }
  }, [id, ym], null)

  const [platform, setPlatform] = useState('Instagram')
  const [pdfBusy, setPdfBusy] = useState(false)
  const [addedPlatforms, setAddedPlatforms] = useState([])
  const [addingPlatform, setAddingPlatform] = useState(null)
  const platforms = useMemo(() => {
    const fromPkg = (data?.pk || []).flatMap((p) => p.platforms || []).filter((p) => KPI_PLATFORMS.includes(p))
    const fromKpi = (data?.kpi || []).map((k) => k.platform)
    const list = [...new Set([...fromPkg, ...fromKpi, ...addedPlatforms, 'Instagram', 'Facebook'])]
    return [...KPI_PLATFORMS.filter((p) => list.includes(p)), ...list.filter((p) => !KPI_PLATFORMS.includes(p))]
  }, [data, addedPlatforms])
  const addPlatform = () => { const v = (addingPlatform || '').trim(); if (v) { setAddedPlatforms((x) => [...new Set([...x, v])]); setPlatform(v) } setAddingPlatform(null) }

  if (loading || !data) return <Loading />
  const c = data.client
  const posts = data.posts.filter((p) => p.status !== 'cancelled')
  const quota = (d) => data.pk.reduce((a, p) => a + d.quota(p), 0)
  const weeks = Array.from({ length: weeksIn(ym) }, (_, i) => i + 1)
  const prevYm = shiftMonth(ym, -1)
  const kNow = data.kpi.filter((k) => k.month === first(ym)), kPrev = data.kpi.filter((k) => k.month === first(prevYm))

  return (
    <>
      <div className="row between wrap gap-s mb no-print">
        <Link className="btn btn-ghost btn-sm" to={`/social?m=${ym}`}><ArrowLeft size={14} />All clients</Link>
        <div className="row gap-s wrap">
          <MonthPicker ym={ym} onChange={setYm} />
          <Link className="btn btn-outline" to={`/clients/${id}`}>Client page</Link>
          <Link className="btn btn-outline" to="/calendar"><CalendarDays size={15} />Content calendar</Link>
          <Button variant="outline" icon={Printer} onClick={() => window.print()}>Print</Button>
          <Button icon={Download} loading={pdfBusy} onClick={async () => { setPdfBusy(true); try { await downloadPdf(document.querySelector('.social-report'), `${c.name} social report ${ym}`) } finally { setPdfBusy(false) } }}>Download PDF</Button>
        </div>
      </div>

      <div className="social-report">
        <div className="row between wrap" style={{ alignItems: 'flex-end', marginBottom: 16 }}>
          <div>
            <div className="tiny" style={{ textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--text-3)', fontWeight: 700 }}>Social media report · {monthLabel(ym)}</div>
            <h1 style={{ margin: '4px 0 2px' }}>{c.name}</h1>
            <div className="small muted">{data.pk.map((p) => p.name).join(' · ') || 'No active package'}{c.instagram && ` · ${c.instagram}`}</div>
          </div>
          <img src="/logo-full.png" alt={settings?.company_name || ''} style={{ height: 38 }} className="print-only" />
        </div>

        {/* ---- deliverables vs package ---- */}
        <div className="stats" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          {DELIVERY_KINDS.map((d) => {
            const done = posts.filter((p) => kindOf(p.post_type) === d.id && DONE_POST.includes(p.status)).length
            const planned = posts.filter((p) => kindOf(p.post_type) === d.id).length
            const qt = quota(d)
            if (!qt && !planned) return null
            return (
              <div key={d.id} className="stat">
                <div className="grow">
                  <div className="stat-label">{d.label}</div>
                  <div className="stat-value">{done}{qt ? <span className="faint" style={{ fontSize: '0.6em' }}> / {qt}</span> : null}</div>
                  {qt ? <Progress value={done} max={qt} /> : null}
                  <div className="stat-sub">{planned - done > 0 ? `${planned - done} more planned` : qt && done >= qt ? 'Package delivered' : 'Delivered'}</div>
                </div>
              </div>
            )
          })}
        </div>

        {/* ---- content log, grouped by week like the sheet ---- */}
        <Card title={`Content log · ${posts.length} item${posts.length === 1 ? '' : 's'}`} pad={false} className="mt">
          {posts.length === 0 ? <Empty icon={CalendarDays} title="No content planned this month">{canEdit && <Link to="/calendar">Plan posts in the content calendar →</Link>}</Empty> : (
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Date</th><th>Platform</th><th>Type</th><th>Topic / idea</th><th>Assigned</th><th>Status</th><th className="center">Internal</th><th className="center">Client</th><th>Post</th></tr></thead>
              {weeks.map((w) => {
                const list = posts.filter((p) => weekOf(p.publish_date) === w)
                if (!list.length) return null
                return (
                  <tbody key={w}>
                    <tr><td colSpan={9} style={{ background: 'var(--surface-2)', fontWeight: 700, fontSize: 12, letterSpacing: '.06em' }}>WEEK {w} <span className="faint" style={{ fontWeight: 500 }}>· {weekRange(ym, w)} {monthLabel(ym, true).split(' ')[0]}</span></td></tr>
                    {list.map((p) => {
                      const st = POST_STATUSES.findIndex((s) => s.id === p.status)
                      const internal = st >= POST_STATUSES.findIndex((s) => s.id === 'client_approval')
                      const client = DONE_POST.includes(p.status)
                      const who = member(p.assignee_id || p.design_tasks?.assignee_id)
                      return (
                        <tr key={p.id}>
                          <td className="nowrap">{date(p.publish_date)} <span className="faint tiny">{DAY[new Date(p.publish_date).getDay()]}</span></td>
                          <td className="small">{(p.platforms || []).join(', ')}</td>
                          <td><Badge tone="slate">{p.post_type === 'Post' ? 'Poster' : p.post_type}</Badge></td>
                          <td><div className="cell-title">{p.title}</div>{p.pillar && <div className="cell-sub">{p.pillar}</div>}</td>
                          <td className="small">{who?.full_name || <span className="faint">—</span>}</td>
                          <td><StatusBadge list={POST_STATUSES} value={p.status} />{p.design_tasks?.status === 'revision' && <div><Badge tone="orange">Re-work</Badge></div>}</td>
                          <td className="center">{internal ? <Check size={15} color="var(--green-d)" /> : <span className="faint">·</span>}</td>
                          <td className="center">{client ? <Check size={15} color="var(--green-d)" /> : p.status === 'client_approval' ? <span className="tiny" style={{ color: 'var(--amber, #b45309)' }}>waiting</span> : <span className="faint">·</span>}</td>
                          <td><PostLinks p={p} /></td>
                        </tr>
                      )
                    })}
                  </tbody>
                )
              })}
            </table></div>
          )}
        </Card>

        <PostPerformance posts={posts} />

        {/* ---- KPIs ---- */}
        <Card className="mt" title="Account performance" actions={<div className="row gap-xs no-print wrap">{platforms.map((p) => <Button key={p} size="sm" variant={platform === p ? 'primary' : 'ghost'} onClick={() => setPlatform(p)}>{p}</Button>)}
            {canEdit && (addingPlatform === null
              ? <IconBtn icon={Plus} title="Add another platform / channel" onClick={() => setAddingPlatform('')} />
              : <span className="row gap-xs">
                  <input className="input" list="kpi-platforms" autoFocus style={{ width: 160, padding: '5px 8px' }} value={addingPlatform} placeholder="e.g. YouTube, Website" onChange={(e) => setAddingPlatform(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPlatform() } if (e.key === 'Escape') setAddingPlatform(null) }} />
                  <datalist id="kpi-platforms">{['YouTube', 'LinkedIn', 'Google Business', 'WhatsApp Channel', 'X / Twitter', 'Threads', 'Pinterest', 'Website', 'Snapchat'].filter((x) => !platforms.includes(x)).map((x) => <option key={x} value={x} />)}</datalist>
                  <Button size="sm" onClick={addPlatform} disabled={!(addingPlatform || '').trim()}>Add</Button>
                </span>)}
          </div>}>
          <KpiSummary rows={kNow.filter((k) => k.platform === platform)} prev={kPrev.filter((k) => k.platform === platform)} prevLabel={monthLabel(prevYm, true)} />
          <KpiGrid key={platform + ym} client={id} ym={ym} platform={platform} rows={kNow.filter((k) => k.platform === platform)}
            posts={posts} canEdit={canEdit} onSaved={reload} />
          <KpiCharts ym={ym} from6={from6} kpi={data.kpi.filter((k) => k.platform === platform)} />
        </Card>
        <div className="center tiny print-only" style={{ marginTop: 24, color: '#999' }}>Prepared by {settings?.company_name || 'Aqlyon Brand Management'}</div>
      </div>
    </>
  )
}

function KpiSummary({ rows, prev, prevLabel }) {
  if (!rows.length) return null
  return (
    <div className="stats" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', marginBottom: 14 }}>
      {KPI_FIELDS.map((f) => {
        const now = total(rows, f.id), was = total(prev, f.id)
        return (
          <div key={f.id} className="stat">
            <div className="grow">
              <div className="stat-label">{f.label}{f.pct ? ' (avg)' : ''}</div>
              <div className="stat-value">{f.pct ? (now === null ? '—' : `${Math.round(now)}%`) : fmt(now)}</div>
              <div className="stat-sub">{prev.length ? <><Delta now={now || 0} prev={was || 0} /> vs {prevLabel}</> : ' '}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// KPI entry: one row per period (any From–To dates, like the marketer's sheet), standard metrics + custom ones
const addDaysISO = (iso, n) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
const shortRange = (a, b) => { const f = (x) => new Date(x + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); return `${f(a)} – ${f(b)}` }
const periodOf = (k) => ({ start: k.period_start || addDaysISO(k.month, ((k.week_no || 1) - 1) * 7), end: k.period_end || addDaysISO(k.month, (k.week_no || 1) * 7 - 1) })

function KpiGrid({ client, ym, platform, rows, posts, canEdit, onSaved }) {
  const toRow = (r) => ({ id: r.id, start: periodOf(r).start, end: periodOf(r).end,
    v: Object.fromEntries(KPI_FIELDS.map((f) => [f.id, r[f.id] ?? ''])), x: { ...(r.extra || {}) } })
  const init = () => {
    const list = [...rows].map(toRow).sort((a, b) => a.start.localeCompare(b.start))
    return list.length ? list : [{ id: null, start: first(ym), end: addDaysISO(first(ym), 6), v: {}, x: {} }]
  }
  const [g, setG] = useState(init)
  const [extraCols, setExtraCols] = useState(() => [...new Set(rows.flatMap((r) => Object.keys(r.extra || {})))])
  const [newCol, setNewCol] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [removed, setRemoved] = useState([])
  const [busy, run] = useAction()
  useEffect(() => { setG(init()); setDirty(false); setRemoved([]); setExtraCols((c) => [...new Set([...c, ...rows.flatMap((r) => Object.keys(r.extra || {}))])]) }, [rows]) // eslint-disable-line react-hooks/exhaustive-deps
  const upd = (i, fn) => { setG((s) => s.map((r, j) => (j === i ? fn({ ...r, v: { ...r.v }, x: { ...r.x } }) : r))); setDirty(true) }
  const addRow = () => {
    const last = g[g.length - 1]
    const start = last ? addDaysISO(last.end, 1) : first(ym)
    setG((s) => [...s, { id: null, start, end: addDaysISO(start, 6), v: {}, x: {} }]); setDirty(true)
  }
  const delRow = (i) => { const r = g[i]; if (r.id) setRemoved((x) => [...x, r.id]); setG((s) => s.filter((_, j) => j !== i)); setDirty(true) }
  const shared = (r) => posts.filter((p) => p.publish_date >= r.start && p.publish_date <= r.end && DONE_POST.includes(p.status) && (p.platforms || []).includes(platform)).length
  const bad = g.flatMap((r, i) => [
    ...(r.end < r.start ? [`row ${i + 1} dates`] : []),
    ...KPI_FIELDS.filter((f) => Number.isNaN(parseNum(r.v[f.id])) || (f.pct && parseNum(r.v[f.id]) > 100)).map((f) => `${shortRange(r.start, r.end)} ${f.label}`),
    ...extraCols.filter((c) => Number.isNaN(parseNum(r.x[c]))).map((c) => `${shortRange(r.start, r.end)} ${c}`)
  ])
  const dupStart = g.find((r, i) => g.findIndex((o) => o.start === r.start) !== i)
  const save = () => run(async () => {
    if (bad.length) throw new Error(`Check: ${bad.slice(0, 3).join(', ')}`)
    if (dupStart) throw new Error(`Two rows start on ${shortRange(dupStart.start, dupStart.end)} — change one`)
    if (removed.length) await q(supabase.from('social_kpis').delete().in('id', removed))
    for (const r of g) {
      const extra = Object.fromEntries(extraCols.map((c) => [c, parseNum(r.x[c])]).filter(([, v]) => v !== null))
      const p = { client_id: client, platform, period_start: r.start, period_end: r.end, month: r.start.slice(0, 8) + '01', week_no: null, extra,
        ...Object.fromEntries(KPI_FIELDS.map((f) => [f.id, parseNum(r.v[f.id])])) }
      const empty = KPI_FIELDS.every((f) => p[f.id] === null) && !Object.keys(extra).length
      if (r.id) await q(empty ? supabase.from('social_kpis').delete().eq('id', r.id) : supabase.from('social_kpis').update(p).eq('id', r.id))
      else if (!empty) await q(supabase.from('social_kpis').upsert(p, { onConflict: 'client_id,platform,period_start' }))
    }
    setDirty(false); onSaved()
  }, `${platform} numbers saved`)
  const colTotal = (get, pct) => { const vals = g.map(get).map(parseNum).filter((v) => v !== null && !Number.isNaN(v)); if (!vals.length) return '—'; const t = vals.reduce((a, v) => a + v, 0); return pct ? `${Math.round(t / vals.length)}%` : fmt(t) }
  const cell = (val, onCh, ph) => canEdit
    ? <input className={cx('input right', Number.isNaN(parseNum(val)) && 'invalid')} style={{ width: 80, padding: '6px 8px' }} value={val ?? ''} placeholder={ph || ''} inputMode="decimal" onChange={(e) => onCh(e.target.value)} />
    : fmt(val)
  return (
    <>
      <div className="table-wrap kpi-grid"><table className="table">
        <thead><tr>
          <th>{platform} · period</th>
          {KPI_FIELDS.map((f) => <th key={f.id} className="num">{f.label}</th>)}
          <th className="num">Non-followers %</th>
          {extraCols.map((c) => <th key={c} className="num">{c}</th>)}
          {canEdit && <th className="no-print">{newCol === null
            ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => setNewCol('')}><Plus size={13} />Add metric</button>
            : <span className="row gap-xs"><input className="input" autoFocus style={{ width: 120, padding: '5px 8px' }} value={newCol} placeholder="e.g. Saves" onChange={(e) => setNewCol(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && newCol.trim()) { e.preventDefault(); setExtraCols((c) => [...new Set([...c, newCol.trim()])]); setNewCol(null); setDirty(true) } if (e.key === 'Escape') setNewCol(null) }} />
              <button type="button" className="btn btn-primary btn-sm" disabled={!newCol.trim()} onClick={() => { setExtraCols((c) => [...new Set([...c, newCol.trim()])]); setNewCol(null); setDirty(true) }}>Add</button></span>}
          </th>}
        </tr></thead>
        <tbody>{g.map((r, i) => (
          <tr key={r.id || 'n' + i}>
            <td className="nowrap">
              {canEdit ? (
                <div className="row gap-xs">
                  <input type="date" className="input" style={{ width: 138, padding: '5px 6px' }} value={r.start} onChange={(e) => e.target.value && upd(i, (x) => ({ ...x, start: e.target.value, end: x.end < e.target.value ? addDaysISO(e.target.value, 6) : x.end }))} />
                  <span className="faint">–</span>
                  <input type="date" className={cx('input', r.end < r.start && 'invalid')} style={{ width: 138, padding: '5px 6px' }} value={r.end} min={r.start} onChange={(e) => e.target.value && upd(i, (x) => ({ ...x, end: e.target.value }))} />
                </div>
              ) : <b>{shortRange(r.start, r.end)}</b>}
            </td>
            {KPI_FIELDS.map((f) => (
              <td key={f.id} className="num">{f.pct && !canEdit ? (r.v[f.id] !== '' && r.v[f.id] != null ? `${r.v[f.id]}%` : '—')
                : cell(r.v[f.id], (val) => upd(i, (x) => { x.v[f.id] = val; return x }), f.id === 'content_shared' && shared(r) ? String(shared(r)) : '')}</td>
            ))}
            <td className="num faint">{parseNum(r.v.followers_pct) !== null && !Number.isNaN(parseNum(r.v.followers_pct)) ? `${Math.round(100 - parseNum(r.v.followers_pct))}%` : '—'}</td>
            {extraCols.map((c) => <td key={c} className="num">{cell(r.x[c], (val) => upd(i, (x) => { x.x[c] = val; return x }))}</td>)}
            {canEdit && <td className="no-print"><IconBtn icon={Trash2} size={14} title="Remove this period" onClick={() => delRow(i)} /></td>}
          </tr>))}</tbody>
        <tfoot><tr>
          <td>Total</td>
          {KPI_FIELDS.map((f) => <td key={f.id} className="num">{colTotal((r) => r.v[f.id], f.pct)}</td>)}
          <td />
          {extraCols.map((c) => <td key={c} className="num">{colTotal((r) => r.x[c])}</td>)}
          {canEdit && <td />}
        </tr></tfoot>
      </table></div>
      {canEdit && (
        <div className="row between wrap gap-s mt no-print">
          <div className="row gap-s wrap">
            <Button variant="outline" size="sm" icon={Plus} onClick={addRow}>Add period</Button>
            <span className="tiny faint">Pick the From–To dates you're reporting (any length), then copy the numbers from Instagram / Meta insights. 1.2k and 45% work. Grey hints in “Content shared” are posts approved/posted in that period.</span>
          </div>
          <Button icon={Save} loading={busy} disabled={!dirty} onClick={save}>Save {platform} numbers</Button>
        </div>
      )}
    </>
  )
}

function KpiCharts({ ym, from6, kpi }) {
  const weekly = kpi.filter((k) => k.month === first(ym)).map((k) => ({ ...k, ...periodOf(k) })).sort((a, b) => a.start.localeCompare(b.start))
    .map((k) => ({ w: shortRange(k.start, k.end), Reach: k.reach || 0, 'Post views': k.post_views || 0, Interactions: k.interactions || 0 }))
  const months = Array.from({ length: 6 }, (_, i) => shiftMonth(from6, i))
  const trend = months.map((m) => { const rs = kpi.filter((k) => k.month === first(m)); return rs.length ? { m: monthLabel(m, true), Reach: sumF(rs, 'reach'), 'New followers': sumF(rs, 'new_followers'), Interactions: sumF(rs, 'interactions') } : { m: monthLabel(m, true) } })
  if (!kpi.length) return <p className="small faint mt">Charts appear once numbers are saved.</p>
  return (
    <div className="grid g2 mt">
      <div><div className="small strong mb">This month by period</div><div style={{ height: 220 }}><ResponsiveContainer>
        <BarChart data={weekly}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="w" fontSize={11} /><YAxis fontSize={11} width={40} /><Tooltip /><Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="Reach" fill="#1f9d63" radius={[4, 4, 0, 0]} /><Bar dataKey="Post views" fill="#7c5cff" radius={[4, 4, 0, 0]} /><Bar dataKey="Interactions" fill="#f59e0b" radius={[4, 4, 0, 0]} /></BarChart>
      </ResponsiveContainer></div></div>
      <div><div className="small strong mb">Last 6 months</div><div style={{ height: 220 }}><ResponsiveContainer>
        <LineChart data={trend}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="m" fontSize={12} /><YAxis fontSize={11} width={40} /><Tooltip /><Legend wrapperStyle={{ fontSize: 12 }} />
          <Line dataKey="Reach" stroke="#1f9d63" strokeWidth={2} dot connectNulls /><Line dataKey="New followers" stroke="#7c5cff" strokeWidth={2} dot connectNulls /><Line dataKey="Interactions" stroke="#f59e0b" strokeWidth={2} dot connectNulls /></LineChart>
      </ResponsiveContainer></div></div>
    </div>
  )
}

export function SocialReportLink({ clientId }) {
  return <Link className="btn btn-outline" to={`/social/${clientId}`}><BarChart3 size={15} />Social report</Link>
}

const SHORT = { Instagram: 'IG', Facebook: 'FB', YouTube: 'YT', LinkedIn: 'LI', WhatsApp: 'WA', 'X / Twitter': 'X', 'Google Business': 'GBP', Website: 'Web' }
const resultsOf = (p) => (p.results || []).length ? p.results : p.published_url ? [{ platform: (p.platforms || [])[0] || 'Post', url: p.published_url, reach: p.reach, likes: p.likes, comments: p.comments, shares: p.shares, saves: p.saves }] : []
function PostLinks({ p }) {
  const rs = resultsOf(p).filter((r) => r.url)
  if (!rs.length) return <span className="faint">—</span>
  return <span>{rs.map((r, i) => <a key={i} className="plat-link" href={r.url} target="_blank" rel="noreferrer" title={r.platform}>{SHORT[r.platform] || r.platform} <ExternalLink size={10} /></a>)}</span>
}

// every posted item with its numbers on each platform, plus platform totals and the best post
function PostPerformance({ posts }) {
  const lines = posts.flatMap((p) => resultsOf(p).map((r) => ({ p, r })))
  const measured = lines.filter(({ r }) => RESULT_FIELDS.some(([k]) => Number(r[k])))
  if (!lines.length) return null
  const plats = [...new Set(lines.map(({ r }) => r.platform))]
  const tot = (rows, k) => rows.reduce((a, { r }) => a + (Number(r[k]) || 0), 0)
  const best = [...measured].sort((a, b) => (Number(b.r.reach) || Number(b.r.views) || 0) - (Number(a.r.reach) || Number(a.r.views) || 0))[0]
  return (
    <Card className="mt" title={`Post performance · ${lines.filter(({ r }) => r.url).length} link${lines.filter(({ r }) => r.url).length === 1 ? '' : 's'}`} pad={false}>
      <div className="stats card-body" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(170px, 1fr))`, marginBottom: 0 }}>
        {plats.map((pl) => {
          const rows = lines.filter(({ r }) => r.platform === pl)
          const er = engagement(Object.fromEntries(RESULT_FIELDS.map(([k]) => [k, tot(rows, k)])))
          return (
            <div key={pl} className="stat"><div className="grow">
              <div className="stat-label">{pl} · {rows.length} post{rows.length === 1 ? '' : 's'}</div>
              <div className="stat-value">{fmt(tot(rows, 'reach') || tot(rows, 'views'))}<span className="faint" style={{ fontSize: '0.5em' }}> {tot(rows, 'reach') ? 'reach' : 'views'}</span></div>
              <div className="stat-sub">{fmt(tot(rows, 'likes'))} likes · {fmt(tot(rows, 'comments'))} comments · {fmt(tot(rows, 'shares'))} shares{er !== null ? ` · ${er.toFixed(1)}% eng.` : ''}</div>
            </div></div>
          )
        })}
        {best && <div className="stat"><div className="grow">
          <div className="stat-label">Best post</div>
          <div className="strong" style={{ marginTop: 4 }}>{best.p.title}</div>
          <div className="stat-sub">{best.r.platform} · {fmt(Number(best.r.reach) || Number(best.r.views))} {Number(best.r.reach) ? 'reach' : 'views'} · {date(best.p.publish_date)}</div>
        </div></div>}
      </div>
      <div className="table-wrap"><table className="table">
        <thead><tr><th>Date</th><th>Post</th><th>Platform</th>{RESULT_FIELDS.map(([k, l]) => <th key={k} className="num">{l}</th>)}<th className="num">Eng.</th></tr></thead>
        <tbody>{lines.map(({ p, r }, i) => {
          const er = engagement(r)
          return (
            <tr key={i}>
              <td className="nowrap">{date(p.publish_date)}</td>
              <td><div className="cell-title">{p.title}</div><div className="cell-sub">{p.post_type === 'Post' ? 'Poster' : p.post_type}</div></td>
              <td className="nowrap">{r.url ? <a href={r.url} target="_blank" rel="noreferrer">{r.platform} <ExternalLink size={11} /></a> : r.platform}</td>
              {RESULT_FIELDS.map(([k]) => <td key={k} className="num">{r[k] === null || r[k] === undefined || r[k] === '' ? <span className="faint">—</span> : fmt(r[k])}</td>)}
              <td className="num">{er === null ? <span className="faint">—</span> : `${er.toFixed(1)}%`}</td>
            </tr>)
        })}</tbody>
        <tfoot><tr><td colSpan={3}>Total</td>{RESULT_FIELDS.map(([k]) => <td key={k} className="num">{fmt(tot(lines, k))}</td>)}<td className="num">{(() => { const e = engagement(Object.fromEntries(RESULT_FIELDS.map(([k]) => [k, tot(lines, k)]))); return e === null ? '—' : `${e.toFixed(1)}%` })()}</td></tr></tfoot>
      </table></div>
      {lines.length > measured.length && <p className="tiny faint card-body" style={{ paddingTop: 0 }}>{lines.length - measured.length} link{lines.length - measured.length === 1 ? '' : 's'} still without numbers — open the post in the content calendar to add them.</p>}
    </Card>
  )
}
