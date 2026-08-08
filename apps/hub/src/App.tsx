import { HashRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'

interface AppProps {
  initialAccessToken: string | null
}

export default function App({ initialAccessToken }: AppProps) {
  return (
    <AuthProvider initialAccessToken={initialAccessToken}>
      <HashRouter>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  )
}
