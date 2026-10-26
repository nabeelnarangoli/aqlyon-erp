import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [team, setTeam] = useState([])
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (uid) => {
    if (!uid) { setProfile(null); setTeam([]); return }
    const [{ data: p }, { data: t }, { data: s }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
      supabase.from('profiles').select('id, full_name, email, role, designation, avatar_url, active, cost_per_hour, weekly_hours').order('full_name'),
      supabase.from('settings').select('*').eq('id', 1).maybeSingle()
    ])
    setProfile(p || null); setTeam(t || []); setSettings(s || null)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      await loadProfile(data.session?.user?.id)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      // defer to avoid deadlock inside the auth callback
      setTimeout(() => loadProfile(s?.user?.id), 0)
    })
    return () => sub.subscription.unsubscribe()
  }, [loadProfile])

  const role = profile?.role
  const can = useCallback((...roles) => !!role && (role === 'admin' || roles.includes(role)), [role])

  const value = {
    session, user: session?.user, profile, role, team, settings, loading, can,
    isAdmin: role === 'admin',
    refresh: () => loadProfile(session?.user?.id),
    signOut: () => supabase.auth.signOut(),
    member: (id) => team.find((m) => m.id === id),
    designers: team.filter((m) => m.active && (m.role === 'designer' || m.role === 'admin')),
    marketers: team.filter((m) => m.active && (m.role === 'marketer' || m.role === 'admin'))
  }
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export const useAuth = () => useContext(AuthCtx)
