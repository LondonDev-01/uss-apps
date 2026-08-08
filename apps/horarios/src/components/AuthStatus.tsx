import { useEffect, useState } from 'react'

// Minimal, non-invasive demonstration of receiving a session from the hub
// (PLAN_V3 §7 Fase C). Does NOT gate or alter any existing horarios
// behavior: with no token present this renders nothing and changes nothing.
//
// The hub hands off the token as `#/?access_token=<jwt>` (see
// apps/hub/src/lib/token.ts#buildChildAppUrl), which lands here as a query
// string nested inside HashRouter's fragment. A plain `?access_token=` on
// the real query string is also accepted, in case a future caller links
// here without going through HashRouter.

interface Session {
  email?: string
  name?: string
}

function readAccessTokenFromLocation(): string | null {
  const queryParams = new URLSearchParams(window.location.search)
  const fromQuery = queryParams.get('access_token')
  if (fromQuery) return fromQuery

  const { hash } = window.location
  const hashQueryIndex = hash.indexOf('?')
  if (hashQueryIndex === -1) return null
  const hashParams = new URLSearchParams(hash.slice(hashQueryIndex + 1))
  return hashParams.get('access_token')
}

// JWTs are base64url(header).base64url(payload).signature — not encrypted,
// so the payload can be read client-side purely for display purposes. This
// is not a verification: horarios does not (yet) call the API to validate
// the token, it just shows who appears to be logged in.
function decodeJwtPayload(token: string): Session | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
    return JSON.parse(atob(padded)) as Session
  } catch {
    return null
  }
}

function cleanTokenFromUrl() {
  const url = new URL(window.location.href)
  url.search = ''
  const hashQueryIndex = url.hash.indexOf('?')
  if (hashQueryIndex !== -1) {
    url.hash = url.hash.slice(0, hashQueryIndex)
  }
  window.history.replaceState(null, '', url.toString())
}

export default function AuthStatus() {
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    const token = readAccessTokenFromLocation()
    if (!token) return

    setSession(decodeJwtPayload(token) ?? {})
    cleanTokenFromUrl()
  }, [])

  if (!session) return null

  const label = session.name ?? session.email ?? 'usuario'

  return (
    <div
      className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface border border-border text-xs font-medium text-muted"
      title={session.email}
    >
      Sesión: {label}
    </div>
  )
}
