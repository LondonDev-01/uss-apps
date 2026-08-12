import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext'
import MallaPage from './pages/MallaPage'
import SeleccionMallaPage from './pages/SeleccionMallaPage'

interface AppProps {
  initialAccessToken: string | null
}

export default function App({ initialAccessToken }: AppProps) {
  return (
    <AuthProvider initialAccessToken={initialAccessToken}>
      <HashRouter>
        <Routes>
          <Route path="/" element={<RootRoute />} />
          <Route path="/seleccionar-malla" element={<SeleccionMallaPage />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  )
}

// AuthProvider redirects to the hub on any auth failure (full-page
// navigation), so by the time isLoading is false here we always have a
// valid user — the only branch left to resolve is whether they picked a
// malla yet (PLAN_V2 §4.2).
function RootRoute() {
  const { user, mallaId, isLoading } = useAuth()

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg text-muted">
        Cargando…
      </div>
    )
  }

  if (!mallaId) {
    return <Navigate to="/seleccionar-malla" replace />
  }

  return <MallaPage />
}
