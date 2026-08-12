import { LogoutIcon } from './icons'

interface MobileTopBarProps {
  onLogout: () => void
}

// Simplified header for small screens — Sidebar (with the full nav and app
// registry) is hidden below `md`; this just keeps branding and a way to log
// out visible. Full mobile nav is a known simplification, see hub README.
export default function MobileTopBar({ onLogout }: MobileTopBarProps) {
  return (
    <div className="md:hidden flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-bg-elevated">
      {/* `invert` for legibility on dark — see Sidebar.tsx. */}
      <img src="/uss-logo-horizontal.png" alt="Universidad San Sebastián" className="h-6 invert" />
      <button onClick={onLogout} className="btn-secondary text-xs px-3 py-1.5 gap-2">
        <LogoutIcon className="w-3.5 h-3.5" />
        Salir
      </button>
    </div>
  )
}
