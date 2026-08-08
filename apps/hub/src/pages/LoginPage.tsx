import { useEffect, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { buildChildAppUrl, consumeReturnTo, saveReturnTo } from '../lib/token'

export default function LoginPage() {
  const [searchParams] = useSearchParams()
  const { user, accessToken, isLoading, login } = useAuth()

  // Resolved once per mount: a `returnTo` query param takes priority and is
  // persisted (sessionStorage survives the full-page OAuth round trip);
  // otherwise fall back to a previously saved one, e.g. a page reload while
  // already authenticated.
  const [returnTo] = useState<string | null>(() => {
    const fromQuery = searchParams.get('returnTo')
    if (fromQuery) {
      saveReturnTo(fromQuery)
      return fromQuery
    }
    return consumeReturnTo()
  })

  useEffect(() => {
    if (isLoading || !user || !accessToken || !returnTo) return
    window.location.href = buildChildAppUrl(returnTo, accessToken)
  }, [isLoading, user, accessToken, returnTo])

  if (isLoading) {
    return <CenteredMessage>Cargando…</CenteredMessage>
  }

  // Already logged in and nowhere specific to go back to: dashboard.
  if (user && !returnTo) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="card w-full max-w-sm p-8 text-center">
        {/* `invert` for legibility on dark — see Sidebar.tsx. */}
        <img
          src="/uss-logo-horizontal.png"
          alt="Universidad San Sebastián"
          className="w-full max-w-[220px] mx-auto mb-6 invert"
        />
        <p className="text-sm text-muted mb-8">
          Portal de aplicaciones de la Universidad San Sebastián.
        </p>
        <button className="btn-primary w-full" onClick={login}>
          Iniciar sesión con Outlook
        </button>
        <p className="mt-4 text-xs text-subtle">
          Usa tu correo institucional (@uss.cl o @alu.uss.cl).
        </p>
      </div>
    </div>
  )
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg text-muted">
      {children}
    </div>
  )
}
