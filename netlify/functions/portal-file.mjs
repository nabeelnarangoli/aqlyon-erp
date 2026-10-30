// Gives a client (holding a valid approval link) a short-lived URL to view a proof file.
import { createClient } from '@supabase/supabase-js'

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim().replace(/\/(rest|auth)\/v1\/?$/, '').replace(/\/+$/, '')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return json(500, { error: 'Server not configured' })
  const db = createClient(url, key, { auth: { persistSession: false } })
  let body
  try { body = await req.json() } catch { return json(400, { error: 'Bad request' }) }
  const { token, proof_ids } = body
  if (!token || !Array.isArray(proof_ids) || !proof_ids.length) return json(400, { error: 'Bad request' })

  const { data: link } = await db.from('approval_links').select('client_id, revoked, expires_at').eq('token', token).maybeSingle()
  if (!link || link.revoked || new Date(link.expires_at) < new Date()) return json(403, { error: 'Link invalid or expired' })

  const { data: proofs } = await db.from('task_proofs').select('id, file_path, file_name, file_type, files, design_tasks!inner(client_id)')
    .in('id', proof_ids.slice(0, 60)).eq('design_tasks.client_id', link.client_id)
  const out = {}, all = {}
  for (const p of proofs || []) {
    // every file of the version (a task can have many posters); older proofs only have file_path
    const list = Array.isArray(p.files) && p.files.length ? p.files.slice(0, 60) : p.file_path ? [{ path: p.file_path, name: p.file_name, type: p.file_type }] : []
    const paths = list.map((f) => f.path).filter(Boolean)
    if (!paths.length) continue
    const { data } = await db.storage.from('proofs').createSignedUrls(paths, 60 * 60)
    const byPath = Object.fromEntries((data || []).filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]))
    all[p.id] = list.map((f) => ({ url: byPath[f.path] || null, name: f.name || null, type: f.type || null })).filter((f) => f.url)
    if (all[p.id][0]) out[p.id] = all[p.id][0].url
  }
  return json(200, { urls: out, files: all })
}
