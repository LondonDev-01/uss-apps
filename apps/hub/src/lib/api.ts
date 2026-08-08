// Minimal hand-written API client. No OpenAPI codegen exists in the repo yet
// (PLAN_V3 §5 describes the future openapi-typescript pipeline) — this talks
// to the API with plain `fetch` against `VITE_API_URL`.

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api/v1'

export type UserRole = 'student' | 'admin'

// Mirrors `AuthenticatedUser` in services/api/src/modules/auth/jwt.strategy.ts
export interface AuthenticatedUser {
  id: string
  email: string
  role: UserRole
  name: string
  mallaId?: string | null
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, init)
  if (!res.ok) {
    throw new ApiError(res.status, `${init.method ?? 'GET'} ${path} failed with ${res.status}`)
  }
  return (await res.json()) as T
}

// GET /auth/me — current authenticated user for the given access token.
export function fetchMe(accessToken: string): Promise<AuthenticatedUser> {
  return request<AuthenticatedUser>('/auth/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
}

// POST /auth/refresh — rotates the access token using the httpOnly refresh
// cookie. Requires `credentials: 'include'` since it is a cross-origin call
// in dev (hub on :3002, API on :3001).
export function refreshAccessToken(): Promise<{ accessToken: string }> {
  return request<{ accessToken: string }>('/auth/refresh', {
    method: 'POST',
    credentials: 'include',
  })
}

// GET /auth/microsoft/login — full-page navigation target, not a fetch call.
export function microsoftLoginUrl(): string {
  return `${API_URL}/auth/microsoft/login`
}

// POST /auth/logout — revokes the refresh token behind the httpOnly cookie
// and clears it server-side. Best-effort: the caller clears local state
// regardless of whether this succeeds (see AuthContext#logout).
export function logoutRequest(): Promise<void> {
  return request<{ ok: boolean }>('/auth/logout', {
    method: 'POST',
    credentials: 'include',
  }).then(() => undefined)
}
