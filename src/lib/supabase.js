import { createClient } from '@supabase/supabase-js'
import { demoClient, demoApi, demoFileUrls } from './demo'

export const DEMO = import.meta.env.VITE_DEMO === '1'
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const configured = DEMO || Boolean(url && key && !url.includes('YOUR-PROJECT'))

export const supabase = DEMO
  ? demoClient
  : configured
    ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } })
    : null

/** Absolute link to a route inside the app (hash routing in demo builds). */
export const appLink = (path) => (DEMO ? `${window.location.href.split('#')[0]}#${path}` : `${window.location.origin}${path}`)

/** Signed URLs for proof files shown on the public client portal. */
export async function portalFileUrls(token, ids) {
  if (DEMO) return demoFileUrls(ids)
  const r = await fetch('/api/portal-file', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, proof_ids: ids }) })
  return (await r.json()).urls || {}
}

/** Throw on Supabase error, return data. */
export async function q(promise) {
  const { data, error, count } = await promise
  if (error) throw new Error(error.message)
  return count !== undefined && count !== null && data === null ? count : data
}

/** Call a Netlify function with the user's access token. */
export async function api(name, body) {
  if (DEMO) return demoApi(name, body)
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(`/api/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
    body: JSON.stringify(body || {})
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`)
  return json
}

export async function signedUrl(bucket, path, seconds = 3600) {
  if (!path) return null
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, seconds)
  if (error) return null
  return data.signedUrl
}

export async function uploadFile(bucket, file, prefix = '') {
  const ext = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : 'bin'
  const path = `${prefix ? prefix + '/' : ''}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw new Error(error.message)
  return path
}

export async function logActivity(entity, entity_id, action, details) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('activity_log').insert({ entity, entity_id, action, details, actor_id: user?.id })
  } catch { /* non-critical */ }
}
