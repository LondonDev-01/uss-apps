import { useState } from 'react'
import type { MallaCurso, PrioridadesResponse } from '../lib/api'
import { deriveCourseState } from '../lib/estado'
import CourseCard from './CourseCard'

interface MallaGridProps {
  cursos: MallaCurso[]
  aprobadosIds: Set<string>
  notaPorCurso: Map<string, string | null>
  prioridades: PrioridadesResponse | null
  searchTerm: string
  onMarkApproved: (cursoId: string) => void
  onUnmarkApproved: (cursoId: string) => void
  onMarkGroup: (cursoIds: string[]) => Promise<void>
  onSetNota: (cursoId: string, nota: number) => void
}

// 10-semester layout is a simplification: real curricula in this repo top
// out at 10 (see PLAN_V2 §0 seed data). A curriculum with more semesters
// would still render correctly (columns derive from actual course data),
// this constant only sets the minimum number of empty columns shown.
const MIN_SEMESTRES = 10

const ROMAN_DIGITS: [number, string][] = [
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
]

function toRoman(value: number): string {
  let remaining = value
  let result = ''
  for (const [amount, symbol] of ROMAN_DIGITS) {
    while (remaining >= amount) {
      result += symbol
      remaining -= amount
    }
  }
  return result
}

// Small hand-drawn checkmark, same criteria as apps/hub/src/components/icons.tsx
// (no icon library, no emoji).
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`animate-spin ${className ?? ''}`} aria-hidden="true">
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeDasharray="42 14"
      />
    </svg>
  )
}

export default function MallaGrid({
  cursos,
  aprobadosIds,
  notaPorCurso,
  prioridades,
  searchTerm,
  onMarkApproved,
  onUnmarkApproved,
  onMarkGroup,
  onSetNota,
}: MallaGridProps) {
  const [pendingGroupKey, setPendingGroupKey] = useState<string | null>(null)

  const maxSemestre = Math.max(MIN_SEMESTRES, ...cursos.map((c) => c.semestre))
  const maxYear = Math.ceil(maxSemestre / 2)
  const years = Array.from({ length: maxYear }, (_, i) => i + 1)

  const normalizedSearch = searchTerm.trim().toLowerCase()

  function cursosDeSemestre(semestre: number) {
    return cursos.filter((c) => c.semestre === semestre)
  }

  function idsPendientes(cursosGrupo: MallaCurso[]) {
    return cursosGrupo.filter((c) => !aprobadosIds.has(c.id)).map((c) => c.id)
  }

  async function handleMarkGroup(key: string, label: string, cursosGrupo: MallaCurso[]) {
    if (pendingGroupKey) return
    const ids = idsPendientes(cursosGrupo)
    if (ids.length === 0) return
    if (!confirm(`¿Marcar como aprobados todos los ramos de ${label}?`)) return
    setPendingGroupKey(key)
    try {
      await onMarkGroup(ids)
    } finally {
      setPendingGroupKey(null)
    }
  }

  // Year-blocks stay in a single row — Año 5 sits to the right of Año 4,
  // never wraps below it — same criteria as the reference layout. Wide
  // screens show every year with no scrollbar at all; narrower ones get a
  // horizontal scrollbar scoped to just this grid (not the whole page), so
  // the rest of the page (header, stats, legend) never scrolls sideways.
  return (
    <div className="overflow-x-auto pb-2 -mx-1 px-1">
      <div className="flex gap-6 w-max">
      {years.map((year) => {
        const semestresDelAnio = [year * 2 - 1, year * 2].filter((s) => s <= maxSemestre)
        const columnas = semestresDelAnio
          .map((semestre) => ({ semestre, cursosSemestre: cursosDeSemestre(semestre) }))
          .filter((c) => c.cursosSemestre.length > 0)
        if (columnas.length === 0) return null

        const cursosDelAnio = columnas.flatMap((c) => c.cursosSemestre)
        const yearKey = `year-${year}`
        const yearPendientes = idsPendientes(cursosDelAnio).length
        const yearDisabled = pendingGroupKey !== null || yearPendientes === 0

        return (
          <div key={year} className="flex flex-col">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-sm font-bold text-fg">Año {year}</p>
              <button
                type="button"
                onClick={() => handleMarkGroup(yearKey, `Año ${year}`, cursosDelAnio)}
                disabled={yearDisabled}
                title={`Marcar todos los ramos de Año ${year} como aprobados`}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-border text-[11px] font-medium text-muted hover:border-primary hover:text-primary hover:bg-primary-light disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:bg-transparent transition-colors"
              >
                {pendingGroupKey === yearKey ? (
                  <Spinner className="w-3 h-3" />
                ) : (
                  <CheckIcon className="w-3 h-3" />
                )}
                Marcar año
              </button>
            </div>

            <div className="flex gap-6">
              {columnas.map(({ semestre, cursosSemestre }) => {
                const semKey = `sem-${semestre}`
                const semPendientes = idsPendientes(cursosSemestre).length
                const semDisabled = pendingGroupKey !== null || semPendientes === 0
                const roman = toRoman(semestre)

                return (
                  <div key={semestre} className="flex flex-col gap-2 w-[210px] shrink-0">
                    {/* Header box: the number + the mark-button live inside
                        the SAME bordered card, so it's unambiguous which
                        semester the button acts on (per design feedback —
                        a floating text label next to the wrong column read
                        as ambiguous). */}
                    <div className="flex flex-col items-center gap-1.5 px-2 py-2.5 rounded-lg border border-border bg-bg-elevated">
                      <span className="text-lg font-bold text-fg leading-none">
                        {semestre.toString().padStart(2, '0')}
                      </span>
                      <span className="text-[10px] uppercase tracking-wide text-subtle">
                        Semestre {roman}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleMarkGroup(semKey, `el semestre ${roman}`, cursosSemestre)}
                        disabled={semDisabled}
                        title={`Marcar todos los ramos del semestre ${roman} como aprobados`}
                        className="w-7 h-7 flex items-center justify-center rounded-md border border-border text-subtle hover:border-primary hover:text-primary hover:bg-primary-light disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:bg-transparent transition-colors"
                      >
                        {pendingGroupKey === semKey ? (
                          <Spinner className="w-3.5 h-3.5" />
                        ) : (
                          <CheckIcon className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    <div className="flex flex-col gap-4">
                      {cursosSemestre.map((curso) => {
                        const state = deriveCourseState(curso, aprobadosIds, prioridades)
                        const highlighted =
                          normalizedSearch.length > 0 &&
                          curso.nombre.toLowerCase().includes(normalizedSearch)
                        const dimmed = normalizedSearch.length > 0 && !highlighted

                        return (
                          <div key={curso.id} className={dimmed ? 'opacity-30' : undefined}>
                            <CourseCard
                              curso={curso}
                              state={state}
                              highlighted={highlighted}
                              nota={notaPorCurso.get(curso.id) ?? null}
                              onMarkApproved={() => onMarkApproved(curso.id)}
                              onUnmarkApproved={() => onUnmarkApproved(curso.id)}
                              onSetNota={(nota) => onSetNota(curso.id, nota)}
                            />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
      </div>
    </div>
  )
}
