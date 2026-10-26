import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { supabase, DEMO } from '../lib/supabase'
import { Button, Field, Input } from '../components/ui'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('login') // login | forgot
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setMsg(null)
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) setMsg({ type: 'error', text: error.message === 'Invalid login credentials' ? DEMO ? 'Wrong username or password.' : 'Wrong email or password.' : error.message })
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin })
      setMsg(error ? { type: 'error', text: error.message } : { type: 'ok', text: 'Password reset link sent. Check your email.' })
    }
    setBusy(false)
  }

  return (
    <div className="auth">
      <div className="auth-art">
        <div className="row gap"><img src="/logo-mark.png" alt="" style={{ width: 44 }} /><b style={{ fontFamily: 'var(--display)', fontSize: 20, letterSpacing: '.04em' }}>AQLYON ERP</b></div>
        <div>
          <h2>One workspace for clients, creatives and cash flow.</h2>
          <ul>
            <li><CheckCircle2 size={18} /> Leads, clients and every conversation in one place</li>
            <li><CheckCircle2 size={18} /> Design briefs, proofs, revisions and approvals</li>
            <li><CheckCircle2 size={18} /> Content calendars clients approve from their phone</li>
            <li><CheckCircle2 size={18} /> Quotations, invoices, payments and expenses</li>
          </ul>
        </div>
        <p className="small" style={{ color: '#bba9a9' }}>Aqlyon Brand Management · Koyilandy</p>
      </div>
      <div className="auth-form">
        <form className="auth-card" onSubmit={submit}>
          <img src="/logo-full.png" alt="Aqlyon Brand Management" />
          <div>
            <h2>{mode === 'login' ? 'Sign in' : 'Reset password'}</h2>
            <p className="muted small">{mode === 'login' ? 'Use the account your admin created for you.' : 'We’ll email you a reset link.'}</p>
          </div>
          {msg && <div className={`alert ${msg.type === 'error' ? 'alert-error' : 'alert-ok'}`}>{msg.text}</div>}
          <><Field label={DEMO ? 'Username' : 'Email'}><Input type={DEMO ? 'text' : 'email'} autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          {mode === 'login' && <Field label="Password"><Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>}
          <Button type="submit" size="lg" loading={busy}>{mode === 'login' ? 'Sign in' : 'Send reset link'}</Button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setMode(mode === 'login' ? 'forgot' : 'login'); setMsg(null) }}>
            {mode === 'login' ? 'Forgot password?' : '← Back to sign in'}
          </button></>
        </form>
      </div>
    </div>
  )
}

