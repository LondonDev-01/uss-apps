// Helpers for moving the access token between the hub, the API's OAuth
// callback, and child apps. See README.md "Mecanismo de token" for the
// full picture.

const RETURN_TO_KEY = 'hub:returnTo'

// The API's OAuth callback redirects to `AUTH_SUCCESS_REDIRECT` with the
// token as a bare `#access_token=<jwt>` fragment (services/api/src/modules
// /auth/auth.controller.ts). This must run BEFORE HashRouter's initial
// render reads `window.location.hash`, otherwise the router tries to match
// a nonexistent "access_token=..." route. Called synchronously in main.tsx.
export function consumeAccessTokenFromHash(): string | null {
  const { hash } = window.location
  if (!hash.includes('access_token=')) return null

  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  const params = new URLSearchParams(raw)
  const token = params.get('access_token')
  if (!token) return null

  // Strip the hash so HashRouter starts clean at "/" without a history entry.
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
  return token
}

// Builds the URL used to hand the access token off to a child app. Uses the
// same fragment-based convention the hub itself receives its token with
// (never a plain query string, so the token never appears in a server
// access log), but nested under the app's HashRouter root path so the
// child's own router can still resolve "/" normally: `#/?access_token=...`.
export function buildChildAppUrl(appUrl: string, accessToken: string): string {
  const base = appUrl.endsWith('/') ? appUrl.slice(0, -1) : appUrl
  return `${base}/#/?access_token=${encodeURIComponent(accessToken)}`
}

// Persists the "come back here after login" target across the full-page
// OAuth round trip (in-memory state does not survive `window.location.href`
// navigations to Microsoft and back). This is the one deliberate exception
// to "no localStorage": it is sessionStorage (cleared when the tab closes),
// and it never holds the JWT itself, only a redirect URL.
export function saveReturnTo(url: string): void {
  sessionStorage.setItem(RETURN_TO_KEY, url)
}

// Reads and clears the pending return-to target, if any.
export function consumeReturnTo(): string | null {
  const value = sessionStorage.getItem(RETURN_TO_KEY)
  if (value !== null) sessionStorage.removeItem(RETURN_TO_KEY)
  return value
}
