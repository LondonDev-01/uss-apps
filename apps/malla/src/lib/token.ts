// Extracts the access token the hub hands off to this app. See
// apps/hub/src/lib/token.ts#buildChildAppUrl for the producing side: the
// hub navigates here with `#/?access_token=<jwt>` (token nested under the
// HashRouter root path so this app's own router still resolves "/").

export function consumeAccessTokenFromHash(): string | null {
  const { hash } = window.location
  if (!hash.includes('access_token=')) return null

  // hash looks like "#/?access_token=...", strip the leading "#/" so
  // URLSearchParams can parse the query part.
  const queryIndex = hash.indexOf('?')
  if (queryIndex === -1) return null

  const params = new URLSearchParams(hash.slice(queryIndex + 1))
  const token = params.get('access_token')
  if (!token) return null

  // Strip the hash so HashRouter starts clean at "/" without a history entry.
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
  return token
}

// Builds the hub login URL this app redirects to when there is no valid
// session (ADR-4: the hub is the only place login happens).
export function buildHubLoginUrl(hubUrl: string, returnTo: string): string {
  const base = hubUrl.endsWith('/') ? hubUrl.slice(0, -1) : hubUrl
  return `${base}/#/login?returnTo=${encodeURIComponent(returnTo)}`
}
