import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, FileSignature } from 'lucide-react'
import { supabase, q } from '../../lib/supabase'
import { useData } from '../../lib/hooks'
import { QUOTE_STATUS } from '../../lib/constants'
import { money, date, daysFrom } from '../../lib/format'
import { PageHeader, Button, Badge, StatusBadge, Stat, Select, SearchInput, Loading, Empty, Member, DocActions } from '../../components/ui'
import DocEditor from './DocEditor'

export default function Quotations() {
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const { data, loading } = useData(() => q(supabase.from('quotations').select('*, clients(name), leads(name, company)').order('issue_date', { ascending: false })), [], [])
  useEffect(() => {
    if (params.get('new')) { setEditing({ lead_id: params.get('lead') || null, client_id: params.get('client') || '' }); setParams({}, { replace: true }) }
  }, [params, setParams])
  const who = (x) => x.clients?.name || x.leads?.company || x.leads?.name || (x.bill_to || '').split('\n')[0] || '—'
  const rows = useMemo(() => data.filter((x) => (!status || x.status === status) && (!search || [x.number, who(x)].some((v) => v?.toLowerCase().includes(search.toLowerCase())))), [data, status, search])
  const open = data.filter((x) => x.status === 'sent')
  const decided = data.filter((x) => ['accepted', 'rejected'].includes(x.status))
  const accepted = data.filter((x) => x.status === 'accepted')
  return (
    <>
      <PageHeader title="Quotations" subtitle="Proposals and estimates for prospects and clients." actions={<Button icon={Plus} onClick={() => setEditing({})}>New quotation</Button>} />
      <div className="stats">
        <Stat label="Awaiting response" value={open.length} sub={money(open.reduce((a, x) => a + Number(x.total), 0))} icon={FileSignature} tone="blue" onClick={() => setStatus('sent')} />
        <Stat label="Accepted" value={accepted.length} sub={money(accepted.reduce((a, x) => a + Number(x.total), 0))} icon={FileSignature} tone="green" onClick={() => setStatus('accepted')} />
        <Stat label="Acceptance rate" value={`${decided.length ? Math.round((accepted.length / decided.length) * 100) : 0}%`} sub={`${decided.length} decided`} icon={FileSignature} tone="teal" />
      </div>
      <div className="filters">
        <SearchInput value={search} onChange={setSearch} />
        <Select options={QUOTE_STATUS} value={status} onChange={(v) => setStatus(v || '')} placeholder="All statuses" />
      </div>
      {loading ? <Loading /> : rows.length === 0 ? <Empty icon={FileSignature} title="No quotations yet" /> : (
        <div className="card table-wrap"><table className="table">
          <thead><tr><th>Quote</th><th>For</th><th>Date</th><th>Valid until</th><th>Status</th><th>By</th><th className="num">Total</th><th /></tr></thead>
          <tbody>{rows.map((x) => {
            const exp = x.status === 'sent' && x.valid_until && daysFrom(x.valid_until) < 0
            return (
              <tr key={x.id} className="click" onClick={() => nav(`/finance/quotations/${x.id}`)}>
                <td className="cell-title">{x.number}</td>
                <td>{who(x)}{!x.client_id && x.lead_id && <Badge tone="blue" className="">Lead</Badge>}</td>
                <td>{date(x.issue_date)}</td>
                <td>{exp ? <Badge tone="amber">Expired {date(x.valid_until)}</Badge> : date(x.valid_until)}</td>
                <td><StatusBadge list={QUOTE_STATUS} value={x.status} /></td>
                <td><Member id={x.created_by} size={22} showName={false} /></td>
                <td className="num strong">{money(x.total)}</td>
                <td><DocActions to={`/finance/quotations/${x.id}`} /></td>
              </tr>)
          })}</tbody></table></div>
      )}
      {editing && <DocEditor kind="quote" doc={editing} onClose={() => setEditing(null)} onSaved={(row) => { setEditing(null); nav(`/finance/quotations/${row.id}`) }} />}
    </>
  )
}
