import { createClient } from '@supabase/supabase-js'
import { demoClient, demoApi, demoFileUrls } from './demo'

export const DEMO = import.meta.env.VITE_DEMO === '1'

// "Remember me": ticked → sign-in kept in localStorage (stays after closing the browser);
// not ticked → kept in sessionStorage (gone when the browser is closed).
const REMEMBER_KEY = 'aqlyon-remember'
const safe = (fn, fb) => { try { return fn() } catch { return fb } }
export const getRemember = () => safe(() => localStorage.getItem(REMEMBER_KEY) !== '0', true)
export const setRemember = (v) => safe(() => {
  localStorage.setItem(REMEMBER_KEY, v ? '1' : '0')
  if (!v) Object.keys(localStorage).filter((k) => k.startsWith('sb-')).forEach((k) => localStorage.removeItem(k))
})
const store = () => (getRemember() ? localStorage : sessionStorage)
const authStorage = {
  getItem: (k) => safe(() => store().getItem(k) ?? sessionStorage.getItem(k) ?? localStorage.getItem(k), null),
  setItem: (k, v) => safe(() => { store().setItem(k, v); (store() === localStorage ? sessionStorage : localStorage).removeItem(k) }),
  removeItem: (k) => safe(() => { localStorage.removeItem(k); sessionStorage.removeItem(k) })
}
export const rememberedLogin = () => safe(() => localStorage.getItem('aqlyon-last-login') || '', '')
export const saveLogin = (v) => safe(() => (v ? localStorage.setItem('aqlyon-last-login', v) : localStorage.removeItem('aqlyon-last-login')))
// accept the URL however it was pasted ("…supabase.co/rest/v1/", trailing slash, spaces)
const url = (import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/(rest|auth)\/v1\/?$/, '').replace(/\/+$/, '')
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const configured = DEMO || Boolean(url && key && !url.includes('YOUR-PROJECT'))

export const supabase = DEMO
  ? demoClient
  : configured
    ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, storage: authStorage } })
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
