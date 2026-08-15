// Derives each course's visual state from the raw API responses. This is
// pure presentation logic — the actual priority algorithm lives in the
// backend (services/api/src/modules/optimizer), see PLAN_V2 §5 and §6 for
// the spec this file implements without duplicating the algorithm itself.

import type { MallaCurso, PrioridadesResponse } from './api'

export type CourseStatus =
  | 'aprobado'
  | 'equivalente' // satisfied via a cross-malla equivalent course, not itself
  | 'prioridad'
  | 'disponible'
  | 'no-disponible'
  | 'no-dictado'

export interface CourseState {
  status: CourseStatus
  // Names of prerequisites still missing, only set for 'no-disponible'.
  missingPrereqs: string[]
  // Course offerings this period, only meaningful for 'prioridad'/'disponible'.
  opciones: { nrc: string; titulo: string }[]
  // Name of the course this one is convalidated against, if any (e.g. a
  // discontinued malla-2021 course covered by its malla-2024 replacement).
  // Set regardless of status — shown as "Mecánica (Física)" so a student on
  // the old malla knows what to actually go take, even before it's covered.
  equivalente: string | null
}

export function deriveCourseState(
  curso: MallaCurso,
  aprobadosIds: Set<string>,
  prioridades: PrioridadesResponse | null,
): CourseState {
  // Only ever one equivalencia per curso in the seed data today; take the
  // first if that ever changes.
  const equivalente = curso.equivalenciasOrigen[0]?.cursoDestino.nombre ?? null

  if (aprobadosIds.has(curso.id)) {
    return { status: 'aprobado', missingPrereqs: [], opciones: [], equivalente }
  }

  // Cross-malla equivalencia: the course itself was never taken, but its
  // replacement in the other malla was — treat it as satisfied. This
  // mirrors the backend's own `tieneEquivalenteAprobado` check in
  // optimizer.service.ts (which is why such a course never shows up in
  // `prioridades.cursosDisponibles` either — it's already covered).
  const equivalenciaAprobada = curso.equivalenciasOrigen.find((eq) => aprobadosIds.has(eq.cursoDestinoId))
  if (equivalenciaAprobada) {
    return {
      status: 'equivalente',
      missingPrereqs: [],
      opciones: [],
      equivalente: equivalenciaAprobada.cursoDestino.nombre,
    }
  }

  // Computed independently of `prioridades` on purpose: prerequisite
  // satisfaction must stay accurate even when the priority calc failed to
  // load (400 with no malla selected yet, endpoint down, etc.) — this was
  // a real bug found in review. Deriving "unavailable" from
  // `!cursosDisponibles.find(...)` alone meant EVERY course looked
  // "no-disponible" (gray, blocked) whenever `prioridades` was null, even
  // ones whose prerequisites were fully met, with an empty (and
  // misleading) missing-prereqs list to boot.
  const missingPrereqs = curso.prerrequisitos
    .filter((p) => !aprobadosIds.has(p.prerequisitoId))
    .map((p) => p.prerequisito.nombre)

  if (missingPrereqs.length > 0) {
    return { status: 'no-disponible', missingPrereqs, opciones: [], equivalente }
  }

  // Prereqs satisfied. Use `prioridades` only to refine the distinction
  // between prioridad/disponible/no-dictado; without it (or if this course
  // isn't in `cursosDisponibles` for some other reason), degrade to a
  // generic "disponible" — never "no-disponible" for a course whose
  // prerequisites are actually met.
  const disponible = prioridades?.cursosDisponibles.find((c) => c.cursoId === curso.id)
  if (!disponible) {
    // When prioridades loaded successfully but this course isn't in
    // cursosDisponibles, the backend explicitly excluded it — respect that
    // by returning 'no-dictado' (visually distinct, not clickable).
    // When prioridades is null (endpoint failed), we can't verify server-side
    // availability, so default to 'disponible' for courses with met prereqs.
    if (prioridades !== null) {
      return { status: 'no-dictado', missingPrereqs: [], opciones: [], equivalente }
    }
    return { status: 'disponible', missingPrereqs: [], opciones: [], equivalente }
  }

  if (disponible.prioridad === 0) {
    if (disponible.opciones.length === 0) {
      // Empty `opciones` has two very different causes (PLAN_V2 S5 rule 3):
      // a) the period Excel was uploaded and this course isn't in it → truly
      //    "no dictado" this period;
      // b) the period has NO schedules loaded at all (horarios_disponibles
      //    empty) → we know nothing about the offering, so labeling an
      //    atrasado "no dictado" is wrong (and it used to dim half the malla
      //    the moment any course was approved, since semestreActual advances).
      // Distinguish by checking whether ANY available course has opciones.
      const hayOfertaCargada = (prioridades?.cursosDisponibles ?? []).some((c) => c.opciones.length > 0)
      if (!hayOfertaCargada) {
        return { status: 'prioridad', missingPrereqs: [], opciones: [], equivalente }
      }
      return { status: 'no-dictado', missingPrereqs: [], opciones: [], equivalente }
    }
    return { status: 'prioridad', missingPrereqs: [], opciones: disponible.opciones, equivalente }
  }

  // prioridad 1 (opcional) or 2 (electivo)
  return { status: 'disponible', missingPrereqs: [], opciones: disponible.opciones, equivalente }
}
