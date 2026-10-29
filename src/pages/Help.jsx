import { Fragment, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, BookOpen, Lightbulb, AlertTriangle, Search, ExternalLink, Rocket, BadgeCheck, Target, Palette, FileText, Wallet, BarChart3, Settings, LifeBuoy } from 'lucide-react'

const Icons = { Rocket, BadgeCheck, Target, Palette, FileText, Wallet, BarChart3, Settings, LifeBuoy }
import { useAuth } from '../lib/auth'
import { HELP_CATEGORIES, HELP_ARTICLES, helpById, helpForPath, helpText } from '../lib/help'
import { PageHeader, Card, Empty, Modal, Button, cx } from '../components/ui'

/* ---------------- shared helpers ---------------- */

/** articles this person may read (filtered by role permissions) */
export function useHelpArticles() {
  const { has } = useAuth()
  return useMemo(() => HELP_ARTICLES.filter((a) => !a.perm?.length || has(...a.perm)), [has])
}

function searchArticles(list, term) {
  const words = term.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return []
  return list
    .map((a) => {
      const text = helpText(a), title = a.title.toLowerCase()
      if (!words.every((w) => text.includes(w))) return null
      return [a, words.reduce((s, w) => s + (title.includes(w) ? 5 : 0) + (a.summary.toLowerCase().includes(w) ? 2 : 0) + 1, 0)]
    })
    .filter(Boolean).sort((x, y) => y[1] - x[1]).map(([a]) => a)
}

// inline formatting: **bold**, `UI label`, [[article-id]] / [[article-id|text]]
function Inline({ text, onLink }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[\[[^\]]+\]\])/g)
  return parts.map((p, i) => {
    if (p.startsWith('**')) return <b key={i}>{p.slice(2, -2)}</b>
    if (p.startsWith('`')) return <span key={i} className="help-ui">{p.slice(1, -1)}</span>
    if (p.startsWith('[[')) {
      const [id, label] = p.slice(2, -2).split('|')
      const a = helpById(id)
      return <a key={i} className="help-link" onClick={(e) => { e.preventDefault(); onLink(id) }} href={`#/help/${id}`}>{label || a?.title || id}</a>
    }
    return <Fragment key={i}>{p}</Fragment>
  })
}

/** renders an article body (the small markdown-like format described in lib/help.js) */
export function HelpBody({ body, onLink }) {
  const blocks = []
  let list = null
  const flush = () => { if (list) { blocks.push(list); list = null } }
  body.trim().split('\n').forEach((raw) => {
    const line = raw.trimEnd()
    const t = line.trim()
    if (!t) { flush(); const l = blocks[blocks.length - 1]; if (l) l.closed = true; return }
    let m
    if ((m = t.match(/^- (.*)/)) || (m = t.match(/^\d+\. (.*)/))) {
      const kind = t.startsWith('- ') ? 'ul' : 'ol'
      const nested = /^\s{2,}/.test(line)
      if (!list || list.kind !== kind && !nested) { flush(); list = { kind, items: [] } }
      if (nested && list.items.length) (list.items[list.items.length - 1].sub ||= []).push(m[1])
      else list.items.push({ text: m[1] })
      return
    }
    flush()
    if (t.startsWith('### ')) blocks.push({ kind: 'h4', text: t.slice(4) })
    else if (t.startsWith('## ')) blocks.push({ kind: 'h3', text: t.slice(3) })
    else if (t.startsWith('>! ')) blocks.push({ kind: 'warn', text: t.slice(3) })
    else if (t.startsWith('> ')) blocks.push({ kind: 'tip', text: t.slice(2) })
    else {
      const last = blocks[blocks.length - 1]
      if (last?.kind === 'p' && !last.closed) last.text += ' ' + t
      else blocks.push({ kind: 'p', text: t })
    }
  })
  flush()
  const I = (t) => <Inline text={t} onLink={onLink} />
  return (
    <div className="help-body">
      {blocks.map((b, i) => {
        if (b.kind === 'h3') return <h3 key={i}>{I(b.text)}</h3>
        if (b.kind === 'h4') return <h4 key={i}>{I(b.text)}</h4>
        if (b.kind === 'tip') return <div key={i} className="help-callout tip"><Lightbulb size={16} /><div>{I(b.text)}</div></div>
        if (b.kind === 'warn') return <div key={i} className="help-callout warn"><AlertTriangle size={16} /><div>{I(b.text)}</div></div>
        if (b.kind === 'ul' || b.kind === 'ol') {
          const L = b.kind
          return <L key={i}>{b.items.map((it, k) => <li key={k}>{I(it.text)}{it.sub && <ul>{it.sub.map((s, j) => <li key={j}>{I(s)}</li>)}</ul>}</li>)}</L>
        }
        return <p key={i}>{I(b.text)}</p>
      })}
    </div>
  )
}

const catIcon = (c) => Icons[c?.icon] || BookOpen
const catOf = (a) => HELP_CATEGORIES.find((c) => c.id === a.cat)

function ArticleRow({ a, onOpen, active }) {
  return (
    <button type="button" className={cx('help-row', active && 'on')} onClick={() => onOpen(a.id)}>
      <div className="grow"><div className="strong">{a.title}</div><div className="tiny faint">{a.summary}</div></div>
      <ArrowRight size={15} className="faint" />
    </button>
  )
}

function Article({ a, articles, onOpen, onBack, backLabel = 'All topics' }) {
  const cat = catOf(a)
  const inCat = articles.filter((x) => x.cat === a.cat)
  const idx = inCat.findIndex((x) => x.id === a.id)
  const linked = [...a.body.matchAll(/\[\[([\w-]+)/g)].map((m) => m[1])
  const related = [...new Set(linked)].map((id) => articles.find((x) => x.id === id)).filter((x) => x && x.id !== a.id).slice(0, 5)
  return (
    <article className="help-article">
      {onBack && <button type="button" className="btn btn-ghost btn-sm mb" onClick={onBack}><ArrowLeft size={14} />{backLabel}</button>}
      <div className="tiny faint help-crumb">{cat?.label}</div>
      <h2 className="help-title">{a.title}</h2>
      <p className="muted help-summary">{a.summary}</p>
      <HelpBody body={a.body} onLink={onOpen} />
      {related.length > 0 && (
        <div className="help-related">
          <div className="small strong">Related guides</div>
          {related.map((r) => <a key={r.id} className="help-link" href={`#/help/${r.id}`} onClick={(e) => { e.preventDefault(); onOpen(r.id) }}>{r.title}</a>)}
        </div>
      )}
      <div className="help-pager">
        {idx > 0 ? <button type="button" className="btn btn-outline btn-sm" onClick={() => onOpen(inCat[idx - 1].id)}><ArrowLeft size={14} />{inCat[idx - 1].title}</button> : <span />}
        {idx < inCat.length - 1 && <button type="button" className="btn btn-outline btn-sm" onClick={() => onOpen(inCat[idx + 1].id)}>{inCat[idx + 1].title}<ArrowRight size={14} /></button>}
      </div>
    </article>
  )
}

function SearchBox({ value, onChange, autoFocus }) {
  return (
    <label className="search help-search">
      <Search size={15} />
      <input autoFocus={autoFocus} value={value} onChange={(e) => onChange(e.target.value)} placeholder="Search the guide — e.g. invoice period, repay founder" />
    </label>
  )
}

/* ---------------- full help centre page (/help, /help/:id) ---------------- */
export default function Help() {
  const { id } = useParams()
  const nav = useNavigate()
  const articles = useHelpArticles()
  const [term, setTerm] = useState('')
  const open = (aid) => { setTerm(''); nav(`/help/${aid}`); document.querySelector('.content')?.scrollTo?.(0, 0); window.scrollTo(0, 0) }
  const a = id && articles.find((x) => x.id === id)
  const results = searchArticles(articles, term)
  const cats = HELP_CATEGORIES.map((c) => ({ ...c, items: articles.filter((x) => x.cat === c.id) })).filter((c) => c.items.length)

  return (
    <>
      <PageHeader title="Help & guide" subtitle="How to use Aqlyon ERP — step-by-step guides for every page. Press the ? button on any page to open the guide for that page." />
      <div className="help-layout">
        <aside className="help-side">
          <SearchBox value={term} onChange={setTerm} />
          <nav className="help-nav">
            {cats.map((c) => {
              const Icon = catIcon(c)
              return (
                <div key={c.id}>
                  <div className="help-nav-group"><Icon size={14} />{c.label}</div>
                  {c.items.map((x) => <Link key={x.id} to={`/help/${x.id}`} onClick={() => setTerm('')} className={cx(x.id === id && 'on')}>{x.title}</Link>)}
                </div>
              )
            })}
          </nav>
        </aside>
        <div className="help-main">
          {term.trim() ? (
            <Card title={`${results.length} result${results.length === 1 ? '' : 's'} for “${term.trim()}”`} pad={false}>
              {results.length ? <div className="list">{results.map((r) => <ArticleRow key={r.id} a={r} onOpen={open} />)}</div>
                : <Empty icon={Search} title="No guide matches">Try fewer or simpler words, or ask a colleague in Team Queries.</Empty>}
            </Card>
          ) : a ? (
            <Card><Article a={a} articles={articles} onOpen={open} onBack={() => nav('/help')} /></Card>
          ) : (
            <div className="help-cats">
              {cats.map((c) => {
                const Icon = catIcon(c)
                return (
                  <Card key={c.id} className="help-cat">
                    <div className="row gap-s" style={{ marginBottom: 8 }}><span className="stat-icon tone-green" style={{ width: 32, height: 32 }}><Icon size={16} /></span><h3 style={{ margin: 0 }}>{c.label}</h3></div>
                    {c.items.map((x) => <a key={x.id} className="help-cat-link" href={`#/help/${x.id}`} onClick={(e) => { e.preventDefault(); open(x.id) }}>{x.title}</a>)}
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

/* ---------------- the "?" drawer opened from any page ---------------- */
export function HelpDrawer({ open, onClose, path }) {
  const articles = useHelpArticles()
  const nav = useNavigate()
  const [term, setTerm] = useState('')
  const [cur, setCur] = useState(null)
  const here = useMemo(() => helpForPath(path, articles), [path, articles])
  const a = cur && articles.find((x) => x.id === cur)
  const results = searchArticles(articles, term)
  const go = (id) => { setTerm(''); setCur(id); document.querySelector('.drawer .modal-body')?.scrollTo(0, 0) }
  const close = () => { setCur(null); setTerm(''); onClose() }
  const full = () => { const to = a ? `/help/${a.id}` : '/help'; close(); nav(to) }
  const starters = ['welcome', 'navigation', 'roles-visibility', 'notifications'].map((id) => articles.find((x) => x.id === id)).filter(Boolean)

  return (
    <Modal open={open} onClose={close} drawer size="lg" title="Help & guide" subtitle={a ? catOf(a)?.label : 'Guides for this page, or search for anything'}
      footer={<><span className="tiny faint grow">Still stuck? Ask in Team Queries.</span><Button variant="outline" icon={ExternalLink} onClick={full}>Open full help centre</Button></>}>
      {!a && <SearchBox value={term} onChange={setTerm} autoFocus />}
      {term.trim() ? (
        <div className="list mt">{results.length ? results.map((r) => <ArticleRow key={r.id} a={r} onOpen={go} />) : <Empty icon={Search} title="No guide matches">Try simpler words.</Empty>}</div>
      ) : a ? (
        <Article a={a} articles={articles} onOpen={go} onBack={() => setCur(null)} backLabel="Back" />
      ) : (
        <>
          {here.length > 0 && <><div className="help-nav-group mt">On this page</div><div className="list">{here.map((r) => <ArticleRow key={r.id} a={r} onOpen={go} />)}</div></>}
          <div className="help-nav-group mt">Getting started</div>
          <div className="list">{starters.filter((s) => !here.includes(s)).map((r) => <ArticleRow key={r.id} a={r} onOpen={go} />)}</div>
        </>
      )}
    </Modal>
  )
}
