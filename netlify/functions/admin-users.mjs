// Admin-only user management. Runs on Netlify with the service-role key (never exposed to the browser).
import { createClient } from '@supabase/supabase-js'

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim().replace(/\/(rest|auth)\/v1\/?$/, '').replace(/\/+$/, '')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return json(500, { error: 'Server is missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY environment variables' })
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

  // verify caller is an active admin
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return json(401, { error: 'Not signed in' })
  const { data: who, error: whoErr } = await admin.auth.getUser(token)
  if (whoErr || !who?.user) return json(401, { error: 'Session expired — sign in again' })
  const { data: me } = await admin.from('profiles').select('active, roles(permissions)').eq('id', who.user.id).single()
  const perms = me?.roles?.permissions || []
  if (!me?.active || !(perms.includes('*') || perms.includes('team.manage'))) return json(403, { error: 'You do not have permission to manage users' })

  let body
  try { body = await req.json() } catch { return json(400, { error: 'Bad request' }) }

  if (body.action === 'create') {
    const { email, password, full_name, role_id, profile = {}, monthly_salary } = body
    if (!email || !password || password.length < 8) return json(400, { error: 'Email and an 8+ character password are required' })
    const { data: role } = await admin.from('roles').select('id, key').eq('id', role_id).maybeSingle()
    if (!role) return json(400, { error: 'Choose a role' })
    if (role.key === 'admin' && !perms.includes('*')) return json(403, { error: 'Only an Administrator can create another Administrator' })
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name } })
    if (error) return json(400, { error: error.message })
    const allowed = ['phone', 'designation', 'weekly_hours', 'work_days', 'work_start', 'work_end', 'joined_on']
    const extra = Object.fromEntries(Object.entries(profile).filter(([k]) => allowed.includes(k)))
    const { error: pErr } = await admin.from('profiles').upsert({ id: data.user.id, email, full_name, role_id: role.id, active: true, ...extra })
    if (pErr) return json(400, { error: pErr.message })
    if (Number(monthly_salary) > 0) await admin.from('staff_pay').upsert({ user_id: data.user.id, monthly_salary: Number(monthly_salary) })
    return json(200, { ok: true, id: data.user.id })
  }

  if (body.action === 'set_password') {
    if (!body.user_id || (body.password || '').length < 8) return json(400, { error: 'Password must be 8+ characters' })
    const { error } = await admin.auth.admin.updateUserById(body.user_id, { password: body.password })
    if (error) return json(400, { error: error.message })
    return json(200, { ok: true })
  }

  return json(400, { error: 'Unknown action' })
}
