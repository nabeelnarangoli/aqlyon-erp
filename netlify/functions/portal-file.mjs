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

  const { data: proofs } = await db.from('task_proofs').select('id, file_path, design_tasks!inner(client_id)')
    .in('id', proof_ids.slice(0, 60)).eq('design_tasks.client_id', link.client_id)
  const out = {}
  for (const p of proofs || []) {
    if (!p.file_path) continue
    const { data } = await db.storage.from('proofs').createSignedUrl(p.file_path, 60 * 60)
    if (data?.signedUrl) out[p.id] = data.signedUrl
  }
  return json(200, { urls: out })
}
