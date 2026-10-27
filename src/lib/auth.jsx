import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from './supabase'
import { grants } from './permissions'
import { setMoneyVisible } from './format'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [team, setTeam] = useState([])
  const [roles, setRoles] = useState([])
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (uid) => {
    if (!uid) { setProfile(null); setTeam([]); setRoles([]); return }
    const [{ data: p }, { data: t }, { data: r }, { data: s }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
      supabase.from('profiles').select('id, full_name, email, phone, role_id, designation, avatar_url, active, weekly_hours, work_days, work_start, work_end, joined_on').order('full_name'),
      supabase.from('roles').select('*').order('name'),
      supabase.from('settings').select('*').eq('id', 1).maybeSingle()
    ])
    setProfile(p || null); setTeam(t || []); setRoles(r || []); setSettings(s || null)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      await loadProfile(data.session?.user?.id)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      setTimeout(() => loadProfile(s?.user?.id), 0)
    })
    return () => sub.subscription.unsubscribe()
  }, [loadProfile])

  const roleOf = useCallback((roleId) => roles.find((r) => r.id === roleId), [roles])
  const myRole = profile ? roleOf(profile.role_id) : null
  const perms = useMemo(() => myRole?.permissions || [], [myRole])
  /** has('a', 'b') → true if the user has ANY of the permissions */
  const has = useCallback((...want) => grants(perms, ...want), [perms])
  const seeMoney = grants(perms, 'money.view')
  setMoneyVisible(seeMoney)   // every money()/money2() in the app shows "—" without it
  const memberHas = useCallback((m, ...want) => !!m && m.active && grants(roleOf(m.role_id)?.permissions, ...want), [roleOf])

  const value = {
    session, user: session?.user, profile, team, roles, settings, loading,
    role: myRole, perms, has, roleOf, memberHas, seeMoney,
    isAdmin: perms.includes('*'),
    refresh: () => loadProfile(session?.user?.id),
    signOut: () => supabase.auth.signOut(),
    member: (id) => team.find((m) => m.id === id),
    /** active people who can do design work */
    workers: team.filter((m) => memberHas(m, 'tasks.work')),
    /** active people who manage leads / clients */
    managers: team.filter((m) => memberHas(m, 'leads.manage', 'clients.manage'))
  }
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export const useAuth = () => useContext(AuthCtx)
