import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'
import { HashRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { StoreProvider } from './store'
import UploadPage from './pages/UploadPage'
import CategorizePage from './pages/CategorizePage'
import ProcessPage from './pages/ProcessPage'
import SchedulePage from './pages/SchedulePage'
import ExportPage from './pages/ExportPage'
import { Calendar, ClipboardList, Layers, Download, Check, X, Sun, Moon } from './icons'

const TABS = [
  { path: '/', label: 'Ramos', icon: ClipboardList },
  { path: '/categorize', label: 'Categorizar', icon: Layers },
  { path: '/process', label: 'Procesar', icon: Calendar },
  { path: '/schedule', label: 'Horario', icon: Calendar },
  { path: '/export', label: 'Exportar', icon: Download },
] as const

function TabButton({ tab, isActive }: { tab: typeof TABS[number]; isActive: boolean }) {
  return (
    <motion.button
      whileHover={{ scale: isActive ? 1 : 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`tab-btn flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
        isActive
          ? 'active text-primary'
          : 'text-muted hover:text-fg hover:bg-accent/30'
      }`}
    >
      <tab.icon className="w-4 h-4" />
      <span>{tab.label}</span>
    </motion.button>
  )
}

function Tabs() {
  const location = useLocation()
  return (
    <nav className="tabs-bar flex items-center gap-1 p-1 rounded-2xl" role="tablist">
      {TABS.map(tab => {
        const isActive = tab.path === '/' ? location.pathname === '/' : location.pathname.startsWith(tab.path)
        return (
          <NavLink key={tab.path} to={tab.path} end={tab.path === '/'} className="flex-1">
            <TabButton tab={tab} isActive={isActive} />
          </NavLink>
        )
      })}
    </nav>
  )
}

function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window === 'undefined') return 'dark'
    return (localStorage.getItem('theme') as 'dark' | 'light') ?? 'dark'
  })

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'light') {
      root.classList.add('theme-light')
    } else {
      root.classList.remove('theme-light')
    }
    localStorage.setItem('theme', theme)
  }, [theme])

  return (
    <motion.button
      onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
      whileHover={{ scale: 1.05, rotate: 15 }}
      whileTap={{ scale: 0.95 }}
      className="theme-toggle"
      aria-label={`Cambiar a tema ${theme === 'dark' ? 'claro' : 'oscuro'}`}
    >
      <AnimatePresence mode="wait">
        {theme === 'dark' ? (
          <motion.div key="sun" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
            <Sun className="w-4 h-4" />
          </motion.div>
        ) : (
          <motion.div key="moon" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}>
            <Moon className="w-4 h-4" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  )
}

function Layout() {
  const location = useLocation()

  return (
    <div className="app min-h-screen bg-bg relative">
      <div className="bg-atmosphere" aria-hidden="true" />
      
      <main className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 relative">
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-6 sm:mb-8 flex items-start justify-between gap-4"
        >
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
          >
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-fg">
              UniHorario <span className="text-muted font-normal">USS</span>
            </h1>
            <p className="mt-1 text-sm text-muted">
              Optimizador inteligente de horarios · Universidad San Sebastián
            </p>
          </motion.div>
          <ThemeToggle />
        </motion.header>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-6"
        >
          <Tabs />
        </motion.div>

        <AnimatePresence mode="wait">
          <Routes>
            <Route path="/" element={<UploadPage />} />
            <Route path="/categorize" element={<CategorizePage />} />
            <Route path="/process" element={<ProcessPage />} />
            <Route path="/schedule" element={<SchedulePage />} />
            <Route path="/export" element={<ExportPage />} />
          </Routes>
        </AnimatePresence>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <HashRouter>
        <Layout />
      </HashRouter>
    </StoreProvider>
  )
}