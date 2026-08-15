import type { CSSProperties } from 'react'
import type { MallaCurso } from '../lib/api'
import type { CourseState } from '../lib/estado'
import { colorForArea } from '../lib/areaColors'

interface CourseCardProps {
  curso: MallaCurso
  state: CourseState
  highlighted: boolean
  onMarkApproved: () => void
  onUnmarkApproved: () => void
}

export default function CourseCard({
  curso,
  state,
  highlighted,
  onMarkApproved,
  onUnmarkApproved,
}: CourseCardProps) {
  const area = colorForArea(curso.area)
  // 'no-dictado' is still markable: the malla page records academic history,
  // and "not offered this period" (PLAN_V2 S5 rule 3) only constrains the
  // schedule suggestion — it must never block approving a course whose
  // prereqs are met (otherwise atrasados cascade-block their dependents).
  const clickable =
    state.status === 'aprobado' ||
    state.status === 'prioridad' ||
    state.status === 'disponible' ||
    state.status === 'no-dictado'

  function handleClick() {
    if (state.status === 'aprobado') {
      onUnmarkApproved()
      return
    }
    if (state.status === 'prioridad' || state.status === 'disponible' || state.status === 'no-dictado') {
      onMarkApproved()
      return
    }
  }

  // Table-cell styling: area tinted bg, subtle border, 6px radius
  const cellStyle: CSSProperties = {
    backgroundColor: area.bg,
    borderColor:
      state.status === 'prioridad'
        ? area.border
        : state.status === 'no-disponible'
          ? 'rgba(255,255,255,0.04)'
          : 'rgba(255,255,255,0.06)',
  }

  const STATUS_CLASSES: Record<CourseState['status'], string> = {
    aprobado: 'opacity-50',
    equivalente: 'opacity-60',
    prioridad: 'border-2',
    disponible: '',
    'no-disponible': 'opacity-30 cursor-not-allowed',
    'no-dictado': 'opacity-50 border-dashed',
  }
  const statusClass = STATUS_CLASSES[state.status]

  const tooltipContent =
    state.status === 'no-disponible' && state.missingPrereqs.length > 0
      ? `Faltan: ${state.missingPrereqs.join(', ')}`
      : state.status === 'aprobado'
        ? 'Click para desmarcar'
        : state.status === 'no-disponible'
          ? 'Sin prerrequisitos'
          : state.status === 'no-dictado'
            ? 'No dictado este período — click para marcarlo aprobado de todos modos'
            : undefined

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        style={cellStyle}
        title={tooltipContent}
        className={`relative w-full text-left px-2.5 py-2 rounded-md border leading-tight font-sans ${statusClass} ${
          clickable ? 'cursor-pointer hover:brightness-125' : ''
        } ${highlighted ? 'ring-2 ring-primary ring-offset-1 ring-offset-bg' : ''}`}
      >
        {/* Course name */}
        <span
          className="text-[12.5px] font-medium whitespace-nowrap overflow-hidden text-ellipsis block"
          style={{
            textDecoration: state.status === 'aprobado' ? 'line-through' : 'none',
            textDecorationColor: 'rgba(255,255,255,0.4)',
            color: area.text,
          }}
        >
          {curso.nombre}
        </span>

        {/* Equivalente — small, below name */}
        {state.equivalente && (
          <span className="text-[10px] whitespace-nowrap overflow-hidden text-ellipsis block" style={{ color: 'rgba(255,255,255,0.4)' }}>
            ({state.equivalente})
          </span>
        )}
      </button>
    </div>
  )
}
