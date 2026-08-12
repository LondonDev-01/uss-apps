import type { AuthenticatedUser } from '../lib/api'
import { buildChildAppUrl } from '../lib/token'
import { APPS } from '../registry'
import { DashboardIcon, LogoutIcon } from './icons'

interface SidebarProps {
  user: AuthenticatedUser
  accessToken: string
  onLogout: () => void
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrador',
  student: 'Estudiante',
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase() || '?'
}

// Desktop sidebar shell: branding, primary nav, app registry, account footer.
// Hidden below `md` — MobileTopBar covers small screens instead.
export default function Sidebar({ user, accessToken, onLogout }: SidebarProps) {
  return (
    <aside className="hidden md:flex md:w-64 md:shrink-0 md:flex-col border-r border-border bg-bg-elevated">
      <div className="px-6 py-8 border-b border-border">
        {/* The crest is navy/gold, drawn for light surfaces. `invert` flips
            it to a light tone that reads on the dark sidebar background —
            trades the official brand colors for contrast. Revisit if a
            light theme toggle ships (invert only in dark mode then). */}
        <img
          src="/uss-logo-horizontal.png"
          alt="Universidad San Sebastián"
          className="w-full max-w-[160px] invert"
        />
      </div>

      <nav className="flex-1 px-3 py-6 space-y-6 overflow-y-auto">
        <div>
          <p className="px-3 text-xs font-semibold uppercase tracking-wide text-subtle">
            Panel
          </p>
          <div className="mt-2">
            <span className="flex items-center gap-3 px-3 py-2 rounded-lg bg-primary-light text-fg font-medium text-sm">
              <DashboardIcon className="w-4 h-4 shrink-0" />
              Dashboard
            </span>
          </div>
        </div>

        <div>
          <p className="px-3 text-xs font-semibold uppercase tracking-wide text-subtle">
            Aplicaciones
          </p>
          <div className="mt-2 space-y-1">
            {APPS.map((app) => (
              <a
                key={app.id}
                href={buildChildAppUrl(app.url, accessToken)}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted hover:bg-surface-hover hover:text-fg transition-colors"
              >
                <span className="text-base leading-none" aria-hidden="true">
                  {app.icon}
                </span>
                {app.name}
              </a>
            ))}
          </div>
        </div>
      </nav>

      <div className="border-t border-border p-4">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-9 h-9 rounded-full bg-accent-light text-accent font-semibold text-sm flex items-center justify-center shrink-0"
            aria-hidden="true"
          >
            {getInitials(user.name)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-fg truncate">{user.name}</p>
            <p className="text-xs text-subtle truncate">
              {ROLE_LABEL[user.role] ?? user.role}
            </p>
          </div>
        </div>
        <button onClick={onLogout} className="btn-secondary w-full text-xs gap-2">
          <LogoutIcon className="w-3.5 h-3.5" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
