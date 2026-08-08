import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import MobileTopBar from '../components/MobileTopBar'
import ProgressBar from '../components/ProgressBar'
import Sidebar from '../components/Sidebar'
import StatCard from '../components/StatCard'
import { buildChildAppUrl, consumeReturnTo } from '../lib/token'
import { MOCK_DASHBOARD } from '../mock/dashboardMock'

export default function DashboardPage() {
  const { user, accessToken, isLoading, logout } = useAuth()

  // The API's OAuth callback always lands here (AUTH_SUCCESS_REDIRECT points
  // at the hub root), never at "/login" — so a pending `returnTo` saved
  // before the full-page redirect to Microsoft (see LoginPage.tsx) must be
  // consumed on this page, not there, or the generic "app without a session
  // -> hub -> login -> app with JWT" flow never completes for real logins.
  const [pendingReturnTo] = useState<string | null>(() => consumeReturnTo())

  useEffect(() => {
    if (isLoading || !user || !accessToken || !pendingReturnTo) return
    window.location.href = buildChildAppUrl(pendingReturnTo, accessToken)
  }, [isLoading, user, accessToken, pendingReturnTo])

  if (isLoading || (user && accessToken && pendingReturnTo)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg text-muted">
        Cargando…
      </div>
    )
  }

  if (!user || !accessToken) {
    return <Navigate to="/login" replace />
  }

  const firstName = user.name.split(' ')[0]

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar user={user} accessToken={accessToken} onLogout={logout} />

      <div className="flex-1 flex flex-col min-w-0">
        <MobileTopBar onLogout={logout} />

        <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-10 py-8">
          <header className="mb-8">
            <h1 className="text-2xl font-bold text-fg">Hola, {firstName} 👋</h1>
            <p className="mt-1 text-sm text-muted">
              Resumen de tu carrera. Los datos de abajo son de ejemplo — se
              conectarán a la API cuando existan los endpoints de malla y
              períodos (Fase D/E de{' '}
              <code className="font-mono text-xs">PLAN_V3.md</code>).
            </p>
          </header>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <StatCard label="Progreso de la carrera" className="lg:col-span-2">
              <p className="text-3xl font-bold text-fg mb-3">
                {MOCK_DASHBOARD.carreraProgreso}%
              </p>
              <ProgressBar value={MOCK_DASHBOARD.carreraProgreso} />
            </StatCard>

            <StatCard label="Ramos aprobados">
              <p className="text-3xl font-bold text-fg">
                {MOCK_DASHBOARD.ramosAprobados}
                <span className="text-base font-medium text-muted">
                  {' '}
                  / {MOCK_DASHBOARD.ramosTotal}
                </span>
              </p>
            </StatCard>

            <StatCard label="Próximo período">
              <p className="text-3xl font-bold text-fg">{MOCK_DASHBOARD.proximoPeriodo}</p>
            </StatCard>
          </div>

          <StatCard label={`Ramos cursando (${MOCK_DASHBOARD.ramosCursando.length})`}>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {MOCK_DASHBOARD.ramosCursando.map((ramo) => (
                <li
                  key={ramo.codigo}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg text-sm text-fg"
                >
                  <span className="font-mono text-xs text-subtle shrink-0">
                    {ramo.codigo}
                  </span>
                  {ramo.nombre}
                </li>
              ))}
            </ul>
          </StatCard>
        </main>
      </div>
    </div>
  )
}
