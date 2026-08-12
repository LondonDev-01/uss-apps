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

export interface Malla {
  id: string
  nombre: string
  year: string
  activa: boolean
}

export interface CursoPrerrequisito {
  cursoId: string
  prerequisitoId: string
  prerequisito: {
    id: string
    nombre: string
    semestre: number
  }
}

export interface CursoEquivalencia {
  cursoOrigenId: string
  cursoDestinoId: string
  cursoDestino: {
    id: string
    nombre: string
    mallaId: string
  }
}

export interface MallaCurso {
  id: string
  mallaId: string
  nombre: string
  semestre: number
  esElectivo: boolean
  electivoCategoria: string | null
  area: string | null
  ordenDentroSemestre: number
  prerrequisitos: CursoPrerrequisito[]
  // Cross-malla equivalencies where THIS course is the origin (e.g. a
  // discontinued course from an older malla whose credits are now covered
  // by a course in a newer one). See estado.ts + CourseCard for how this
  // surfaces as "Mecánica (Física)" in the UI.
  equivalenciasOrigen: CursoEquivalencia[]
}

export interface MallaDetalle extends Malla {
  cursos: MallaCurso[]
}

export interface Aprobado {
  userId: string
  mallaCursoId: string
  aprobadoEn: string
  // Prisma's Decimal serializes to a JSON string (e.g. "6.5"), not a number.
  nota: string | null
  mallaCurso: MallaCurso
}

export type Prioridad = 0 | 1 | 2

export interface CursoDisponible {
  cursoId: string
  nombre: string
  semestre: number
  area: string | null
  esElectivo: boolean
  prioridad: Prioridad
  opciones: { nrc: string; titulo: string }[]
}

export interface PrioridadesResponse {
  prioridades: Record<string, Prioridad>
  metadatos: {
    semestreActual: number
    ramosAprobados: number
    ramosDisponibles: number
    ramosPrioridad: number
    ramosOpcionales: number
    electivos: number
  }
  cursosDisponibles: CursoDisponible[]
}

export interface Periodo {
  id: string
  nombre: string
  activo: boolean
  subidoPor: string | null
  createdAt: string
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
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

function authHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` }
}

// GET /auth/me — current authenticated user for the given access token.
export function fetchMe(accessToken: string): Promise<AuthenticatedUser> {
  return request<AuthenticatedUser>('/auth/me', { headers: authHeaders(accessToken) })
}

// POST /auth/refresh — rotates the access token using the httpOnly refresh
// cookie. Requires `credentials: 'include'` since it is a cross-origin call
// in dev (malla on :3003, API on :3001).
export function refreshAccessToken(): Promise<{ accessToken: string }> {
  return request<{ accessToken: string }>('/auth/refresh', {
    method: 'POST',
    credentials: 'include',
  })
}

// GET /mallas — list of available curricula (e.g. '2021', '2024').
export function fetchMallas(accessToken: string): Promise<Malla[]> {
  return request<Malla[]>('/mallas', { headers: authHeaders(accessToken) })
}

// GET /mallas/:mallaId — full curriculum detail, courses ordered by
// semestre asc, ordenDentroSemestre asc.
export function fetchMallaDetalle(accessToken: string, mallaId: string): Promise<MallaDetalle> {
  return request<MallaDetalle>(`/mallas/${mallaId}`, { headers: authHeaders(accessToken) })
}

// GET /aprobados/me — courses the current user has passed.
export function fetchAprobados(accessToken: string): Promise<Aprobado[]> {
  return request<Aprobado[]>('/aprobados/me', { headers: authHeaders(accessToken) })
}

// POST /aprobados/me — marks a course as passed. Idempotent upsert.
export function upsertAprobado(accessToken: string, mallaCursoId: string): Promise<Aprobado> {
  return request<Aprobado>('/aprobados/me', {
    method: 'POST',
    headers: { ...authHeaders(accessToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ mallaCursoId }),
  })
}

// DELETE /aprobados/me/:mallaCursoId — unmarks a passed course. 404 if it
// was not marked.
export function removeAprobado(accessToken: string, mallaCursoId: string): Promise<void> {
  return request<void>(`/aprobados/me/${mallaCursoId}`, {
    method: 'DELETE',
    headers: authHeaders(accessToken),
  })
}

// PATCH /aprobados/me/:mallaCursoId/nota — records/edits the grade (1.0-7.0)
// for an already-approved course, feeding the average shown in MallaPage.
// 404 if the course isn't approved yet.
export function setNota(accessToken: string, mallaCursoId: string, nota: number): Promise<Aprobado> {
  return request<Aprobado>(`/aprobados/me/${mallaCursoId}/nota`, {
    method: 'PATCH',
    headers: { ...authHeaders(accessToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ nota }),
  })
}

// PATCH /users/me — selects the user's malla (PLAN_V2 §4.2, first-time
// selection). Returns the updated DB user, but does NOT reissue the JWT:
// the caller must keep the returned mallaId in local state, since the
// in-memory access token's `mallaId` claim stays stale until next login.
export function setMalla(accessToken: string, mallaId: string): Promise<AuthenticatedUser> {
  return request<AuthenticatedUser>('/users/me', {
    method: 'PATCH',
    headers: { ...authHeaders(accessToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ mallaId }),
  })
}

// GET /optimizer/prioridades — priority engine result for the current user.
// `periodoId` is optional; omitting it uses the latest active period if any.
export function fetchPrioridades(
  accessToken: string,
  periodoId?: string,
): Promise<PrioridadesResponse> {
  const query = periodoId ? `?periodoId=${encodeURIComponent(periodoId)}` : ''
  return request<PrioridadesResponse>(`/optimizer/prioridades${query}`, {
    headers: authHeaders(accessToken),
  })
}

// GET /periodos — list of upload periods (optional: which one is active).
export function fetchPeriodos(accessToken: string): Promise<Periodo[]> {
  return request<Periodo[]>('/periodos', { headers: authHeaders(accessToken) })
}
