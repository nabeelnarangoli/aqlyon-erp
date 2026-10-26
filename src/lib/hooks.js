import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'

/**
 * useData(loader, deps) — runs an async loader, exposes {data, loading, error, reload, setData}
 */
export function useData(loader, deps = [], initial = null) {
  const [data, setData] = useState(initial)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const alive = useRef(true)
  const run = useCallback(async (silent) => {
    if (!silent) setLoading(true)
    setError(null)
    try {
      const d = await loader()
      if (alive.current) setData(d)
    } catch (e) {
      if (alive.current) setError(e.message || String(e))
    } finally {
      if (alive.current) setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  useEffect(() => { alive.current = true; run(); return () => { alive.current = false } }, [run])
  return { data, loading, error, reload: () => run(true), setData }
}

/** Live updates via Supabase Realtime: calls onChange when rows change. */
export function useRealtime(table, filter, onChange, enabled = true) {
  const cb = useRef(onChange); cb.current = onChange
  useEffect(() => {
    if (!enabled) return
    const ch = supabase
      .channel(`rt-${table}-${filter || 'all'}-${Math.random().toString(36).slice(2, 7)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) }, (p) => cb.current(p))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [table, filter, enabled])
}

export function useLocal(key, initial) {
  const [v, setV] = useState(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : initial } catch { return initial }
  })
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(v)) } catch { /* ignore */ } }, [key, v])
  return [v, setV]
}

export function useDebounced(value, ms = 250) {
  const [v, setV] = useState(value)
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t) }, [value, ms])
  return v
}
