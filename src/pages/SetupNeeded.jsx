export default function SetupNeeded() {
  return (
    <div className="auth-form" style={{ minHeight: '100vh' }}>
      <div className="auth-card" style={{ maxWidth: 560 }}>
        <img src="/logo-full.png" alt="Aqlyon Brand Management" />
        <h2>Connect the database</h2>
        <p className="muted">The ERP is installed but not connected to Supabase yet. Add these environment variables in Netlify (Site configuration → Environment variables) and redeploy:</p>
        <pre className="card card-body small" style={{ overflowX: 'auto' }}>{`VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...`}</pre>
        <p className="muted small">Full steps are in SETUP.md in the project repository.</p>
      </div>
    </div>
  )
}
