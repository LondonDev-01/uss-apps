import { useState } from 'react'
import type { MallaCurso, PrioridadesResponse } from '../lib/api'
import { deriveCourseState } from '../lib/estado'
import CourseCard from './CourseCard'

interface MallaGridProps {
  cursos: MallaCurso[]
  aprobadosIds: Set<string>
  prioridades: PrioridadesResponse | null
  searchTerm: string
  onMarkApproved: (cursoId: string) => void
  onUnmarkApproved: (cursoId: string) => void
  onMarkGroup: (cursoIds: string[]) => Promise<void>
}

const MIN_SEMESTRES = 10

const ROMAN: Record<number, string> = {
  1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V',
  6: 'VI', 7: 'VII', 8: 'VIII', 9: 'IX', 10: 'X',
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`animate-spin ${className ?? ''}`} aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth={2.5} strokeDasharray="42 14" />
    </svg>
  )
}

export default function MallaGrid({
  cursos,
  aprobadosIds,
  prioridades,
  searchTerm,
  onMarkApproved,
  onUnmarkApproved,
  onMarkGroup,
}: MallaGridProps) {
  const [pendingGroupKey, setPendingGroupKey] = useState<string | null>(null)

  const maxSemestre = Math.max(MIN_SEMESTRES, ...cursos.map((c) => c.semestre))
  const semestres = Array.from({ length: maxSemestre }, (_, i) => i + 1)
  const years = Array.from({ length: Math.ceil(maxSemestre / 2) }, (_, i) => i + 1)

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

  // Find the max number of courses in any semester to size the grid rows
  const maxCursosPorSemestre = Math.max(...semestres.map((s) => cursosDeSemestre(s).length))

  return (
    <div className="overflow-x-auto pb-2">
      <div className="min-w-[900px]">
        {/* Semester column headers — sticky */}
        <div
          className="grid gap-[2px] sticky top-0 z-10 bg-bg"
          style={{ gridTemplateColumns: `repeat(${maxSemestre}, minmax(130px, 1fr))` }}
        >
          {semestres.map((semestre) => {
            const cursosSem = cursosDeSemestre(semestre)
            const semKey = `sem-${semestre}`
            const semPendientes = idsPendientes(cursosSem).length
            const semDisabled = pendingGroupKey !== null || semPendientes === 0
            const roman = ROMAN[semestre] ?? String(semestre)
            const year = Math.ceil(semestre / 2)
            const isOdd = semestre % 2 === 1

            return (
              <div
                key={semestre}
                className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-md border border-border ${isOdd ? 'bg-bg-elevated' : 'bg-surface'}`}
              >
                <span className="text-[10px] uppercase tracking-wider text-subtle font-medium">
                  Sem {roman}
                </span>
                <span className="text-sm font-bold text-fg leading-none">
                  {semestre.toString().padStart(2, '0')}
                </span>
                <span className="text-[9px] text-subtle">Año {year}</span>
                <button
                  type="button"
                  onClick={() => handleMarkGroup(semKey, `semestre ${roman}`, cursosSem)}
                  disabled={semDisabled}
                  title={`Marcar todos los ramos del semestre ${roman}`}
                  className="mt-0.5 flex items-center justify-center w-6 h-6 rounded border border-border text-subtle hover:border-primary hover:text-primary hover:bg-primary-light disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:bg-transparent transition-colors"
                >
                  {pendingGroupKey === semKey ? (
                    <Spinner className="w-3 h-3" />
                  ) : (
                    <CheckIcon className="w-3 h-3" />
                  )}
                </button>
              </div>
            )
          })}
        </div>

        {/* Course grid — one row per possible slot */}
        <div className="mt-[2px]">
          {Array.from({ length: maxCursosPorSemestre }, (_, rowIndex) => (
            <div
              key={rowIndex}
              className="grid gap-[2px] mb-[2px]"
              style={{ gridTemplateColumns: `repeat(${maxSemestre}, minmax(130px, 1fr))` }}
            >
              {semestres.map((semestre) => {
                const cursosSem = cursosDeSemestre(semestre)
                const curso = cursosSem[rowIndex]
                if (!curso) return <div key={semestre} />

                const state = deriveCourseState(curso, aprobadosIds, prioridades)
                const highlighted =
                  normalizedSearch.length > 0 &&
                  curso.nombre.toLowerCase().includes(normalizedSearch)
                const dimmed = normalizedSearch.length > 0 && !highlighted

                return (
                  <div key={semestre} className={dimmed ? 'opacity-30' : undefined}>
                    <CourseCard
                      curso={curso}
                      state={state}
                      highlighted={highlighted}
                      onMarkApproved={() => onMarkApproved(curso.id)}
                      onUnmarkApproved={() => onUnmarkApproved(curso.id)}
                    />
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* Year-level mark-all buttons — below the grid */}
        <div className="flex gap-[2px] mt-3">
          {years.map((year) => {
            const semestreImpar = year * 2 - 1
            const semestrePar = year * 2
            const cursosAnio = [
              ...cursosDeSemestre(semestreImpar),
              ...(semestrePar <= maxSemestre ? cursosDeSemestre(semestrePar) : []),
            ]
            const yearKey = `year-${year}`
            const yearPendientes = idsPendientes(cursosAnio).length
            const yearDisabled = pendingGroupKey !== null || yearPendientes === 0

            return (
              <div key={year} className="flex-1 flex justify-center">
                <button
                  type="button"
                  onClick={() => handleMarkGroup(yearKey, `Año ${year}`, cursosAnio)}
                  disabled={yearDisabled}
                  title={`Marcar todos los ramos de Año ${year}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-[11px] font-medium text-muted hover:border-primary hover:text-primary hover:bg-primary-light disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:bg-transparent transition-colors"
                >
                  {pendingGroupKey === yearKey ? (
                    <Spinner className="w-3 h-3" />
                  ) : (
                    <CheckIcon className="w-3 h-3" />
                  )}
                  Año {year}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
