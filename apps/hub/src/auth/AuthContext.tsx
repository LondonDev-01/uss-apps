import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { AuthenticatedUser, fetchMe, logoutRequest, microsoftLoginUrl, refreshAccessToken } from '../lib/api'

interface AuthContextValue {
  user: AuthenticatedUser | null
  accessToken: string | null
  isLoading: boolean
  login: () => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

interface AuthProviderProps {
  children: ReactNode
  // Token extracted from the OAuth callback's URL hash before this component
  // ever mounted (see src/lib/token.ts + main.tsx). null on a normal visit.
  initialAccessToken: string | null
}

export function AuthProvider({ children, initialAccessToken }: AuthProviderProps) {
  const [accessToken, setAccessToken] = useState<string | null>(initialAccessToken)
  const [user, setUser] = useState<AuthenticatedUser | null>(null)
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
        if (initialAccessToken) {
          // Just came back from the OAuth callback: use the token as-is.
          const me = await fetchMe(initialAccessToken)
          setUser(me)
        } else {
          // No token in the URL: try to rehydrate the session from the
          // httpOnly refresh cookie (e.g. the user reloaded the page).
          const { accessToken: refreshed } = await refreshAccessToken()
          const me = await fetchMe(refreshed)
          setAccessToken(refreshed)
          setUser(me)
        }
      } catch {
        // No valid session (no cookie, expired, or revoked). Stay logged
        // out silently — this is the expected state for a first-time visit.
        setAccessToken(null)
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }

    void hydrate()
    // Runs once: initialAccessToken is a value captured before first render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const login = useCallback(() => {
    window.location.href = microsoftLoginUrl()
  }, [])

  const logout = useCallback(() => {
    // Clear local state immediately (optimistic) regardless of the network
    // call's outcome — a failed revoke request shouldn't leave the UI stuck
    // showing a logged-in state. The server-side revoke is still fired so
    // the httpOnly cookie can't silently log the user back in on reload.
    setAccessToken(null)
    setUser(null)
    void logoutRequest()
  }, [])

  return (
    <AuthContext.Provider value={{ user, accessToken, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
