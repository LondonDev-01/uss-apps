import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { AuthenticatedUser, fetchMe, refreshAccessToken } from '../lib/api'
import { buildHubLoginUrl } from '../lib/token'

// Where the hub lives in dev. No env var for this yet — the hub's own port
// is hardcoded the same way across the ecosystem (see apps/hub/vite.config.ts).
const HUB_URL = 'http://localhost:3002'

interface AuthContextValue {
  user: AuthenticatedUser | null
  accessToken: string | null
  isLoading: boolean
  // Locally-tracked malla selection, kept in sync with the DB via
  // PATCH /users/me. See src/lib/api.ts#setMalla for why this can't just
  // rely on `user.mallaId` staying fresh after that call.
  mallaId: string | null
  setMallaId: (mallaId: string) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

interface AuthProviderProps {
  children: ReactNode
  // Token extracted from the hub hand-off URL hash before this component
  // ever mounted (see src/lib/token.ts + main.tsx). null on a normal visit.
  initialAccessToken: string | null
}

export function AuthProvider({ children, initialAccessToken }: AuthProviderProps) {
  const [accessToken, setAccessToken] = useState<string | null>(initialAccessToken)
  const [user, setUser] = useState<AuthenticatedUser | null>(null)
  const [mallaId, setMallaId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Guards against React 18 StrictMode's dev-only double-invocation of this
  // effect. Without it, two concurrent `POST /auth/refresh` calls go out on
  // first mount; the API rotates the refresh token and revokes the previous
  // one on every use (auth.service.ts), so the second call always fails and
  // logs the user out even though the session was still valid.
  //
  // No "ignore stale result" cleanup here on purpose: with the guard, only
  // one hydrate() ever runs, so there is nothing to race against — and a
  // setState after a real unmount is a silent no-op in React 18, not an
  // error. Production builds (no StrictMode double-invoke) never hit the
  // race this guards against, but the guard is a no-op there too.
  const hasHydrated = useRef(false)

  useEffect(() => {
    if (hasHydrated.current) return
    hasHydrated.current = true

    async function hydrate() {
      try {
        let token = initialAccessToken
        if (!token) {
          // No token in the URL: try to rehydrate the session from the
          // httpOnly refresh cookie (e.g. the user reloaded the page).
          const refreshed = await refreshAccessToken()
          token = refreshed.accessToken
        }
        const me = await fetchMe(token)
        setAccessToken(token)
        setUser(me)
        setMallaId(me.mallaId ?? null)
      } catch {
        // No valid session (no cookie, expired, or revoked, or the token
        // in the URL was bad). Unlike the hub, this app never shows its own
        // login screen — it delegates entirely to the hub (ADR-4).
        const returnTo = window.location.href
        window.location.href = buildHubLoginUrl(HUB_URL, returnTo)
      } finally {
        setIsLoading(false)
      }
    }

    void hydrate()
    // Runs once: initialAccessToken is a value captured before first render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <AuthContext.Provider value={{ user, accessToken, isLoading, mallaId, setMallaId }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
