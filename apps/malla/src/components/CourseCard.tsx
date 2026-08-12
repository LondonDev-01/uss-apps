import { useState, type CSSProperties, type FormEvent } from 'react'
import type { MallaCurso } from '../lib/api'
import type { CourseState } from '../lib/estado'
import { colorForArea } from '../lib/areaColors'

interface CourseCardProps {
  curso: MallaCurso
  state: CourseState
  highlighted: boolean
  nota: string | null
  onMarkApproved: () => void
  onUnmarkApproved: () => void
  onSetNota: (nota: number) => void
}

// Small hand-drawn trash icon — same criteria as apps/hub/src/components/icons.tsx
// (no icon library, no emoji). Unmark affordance, separate from the card's
// own click target so tapping the card body opens the nota editor instead.
function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}

export default function CourseCard({
  curso,
  state,
  highlighted,
  nota,
  onMarkApproved,
  onUnmarkApproved,
  onSetNota,
}: CourseCardProps) {
  const [showPopover, setShowPopover] = useState(false)
  const [editingNota, setEditingNota] = useState(false)
  const [notaDraft, setNotaDraft] = useState(nota ?? '')

  const area = colorForArea(curso.area)
  const clickable = state.status === 'aprobado' || state.status === 'prioridad' || state.status === 'disponible'

  function handleClick() {
    // No confirm() dialogs — marking/unmarking is a single click, per
    // design feedback (an alert on every click was too heavy for something
    // this frequent). The trash icon is the one deliberate "are you sure"
    // moment: it's a separate, smaller target than the whole card.
    if (state.status === 'aprobado') {
      setEditingNota(true)
      return
    }
    if (state.status === 'prioridad' || state.status === 'disponible') {
      onMarkApproved()
      return
    }
    if (state.status === 'no-disponible') {
      setShowPopover((prev) => !prev)
    }
  }

  function handleTrashClick(e: React.MouseEvent) {
    e.stopPropagation()
    onUnmarkApproved()
  }

  function handleNotaSubmit(e: FormEvent) {
    e.preventDefault()
    const parsed = Number(notaDraft.replace(',', '.'))
    if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= 7) {
      onSetNota(parsed)
    }
    setEditingNota(false)
  }

  // Base: dark surface (#191b23), 1px subtle border, area accent as a 4px
  // left bar. Status overlays this without hiding the area identity:
  //  - aprobado: 60% opacity + a subtle line-through on the name.
  //  - prioridad: a bright 2px border in the area's OWN hue (not a
  //    separate red — urgency reads as "this area, turned up", not as a
  //    disconnected alert color).
  //  - equivalente: same idea as aprobado (already covered) but dimmer,
  //    since the student didn't take *this* course.
  //  - no-disponible: grayscale + blur, per the explicit ask for a
  //    "locked" look distinct from merely not-yet-taken.
  //  - no-dictado: only dimmed, no filter — a different kind of "not now".
  const cardStyle: CSSProperties = {
    backgroundColor: '#191b23',
    borderColor: state.status === 'prioridad' ? area.border : 'rgba(255,255,255,0.08)',
    borderLeftColor: area.border,
    color: area.text,
  }

  const STATUS_CLASSES: Record<CourseState['status'], string> = {
    aprobado: 'opacity-60',
    equivalente: 'opacity-70',
    prioridad: 'border-2',
    disponible: 'border',
    'no-disponible':
      'border filter grayscale-[85%] blur-[0.5px] opacity-55 hover:blur-0 hover:opacity-90 focus-visible:blur-0 focus-visible:opacity-90 transition-[filter,opacity] duration-200',
    'no-dictado': 'border opacity-70',
  }
  const statusClass = STATUS_CLASSES[state.status]

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        style={cardStyle}
        className={`relative w-full text-left px-2.5 py-2 rounded-lg border-l-4 leading-tight flex flex-col gap-0.5 font-sans ${statusClass} ${
          clickable || state.status === 'no-disponible' ? 'cursor-pointer hover:brightness-125' : 'cursor-default'
        } ${highlighted ? 'ring-2 ring-primary ring-offset-1 ring-offset-bg' : ''}`}
        title={state.status === 'no-disponible' && state.missingPrereqs.length > 0
          ? `Prerrequisitos faltantes: ${state.missingPrereqs.join(', ')}`
          : state.status === 'aprobado'
            ? 'Click para poner/editar la nota'
            : undefined}
      >
        <span
          className="text-[13px] font-medium whitespace-nowrap overflow-hidden text-ellipsis"
          style={{ textDecoration: state.status === 'aprobado' ? 'line-through' : 'none', textDecorationColor: 'rgba(255,255,255,0.5)' }}
        >
          {curso.nombre}
        </span>
        {state.equivalente && (
          <span className="text-[10.5px] text-subtle whitespace-nowrap overflow-hidden text-ellipsis">
            ({state.equivalente})
          </span>
        )}
        {state.status === 'aprobado' && nota && (
          <span className="text-[10.5px] text-subtle">Nota: {nota}</span>
        )}

        {state.status === 'aprobado' && (
          <span
            role="button"
            tabIndex={0}
            onClick={handleTrashClick}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onUnmarkApproved()
              }
            }}
            title={`Desmarcar "${curso.nombre}"`}
            className="absolute top-1 right-1 p-1 rounded text-danger/70 hover:text-danger hover:bg-danger-light cursor-pointer"
          >
            <TrashIcon className="w-3.5 h-3.5" />
          </span>
        )}
      </button>

      {editingNota && state.status === 'aprobado' && (
        <form
          onSubmit={handleNotaSubmit}
          className="absolute z-10 top-full left-0 mt-1 w-40 card p-2 flex items-center gap-2"
        >
          <input
            type="text"
            inputMode="decimal"
            autoFocus
            placeholder="1.0 – 7.0"
            value={notaDraft}
            onChange={(e) => setNotaDraft(e.target.value)}
            onBlur={() => setEditingNota(false)}
            className="w-16 px-1.5 py-1 rounded border border-border bg-bg text-fg text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="submit"
            onMouseDown={(e) => e.preventDefault()}
            className="text-xs font-medium text-primary hover:text-primary-hover"
          >
            Guardar
          </button>
        </form>
      )}

      {showPopover && state.status === 'no-disponible' && (
        <div className="absolute z-10 top-full left-0 mt-1 w-56 card p-3 text-xs">
          <p className="font-semibold text-fg mb-1">Prerrequisitos faltantes</p>
          {state.missingPrereqs.length > 0 ? (
            <ul className="list-disc list-inside text-muted space-y-0.5">
              {state.missingPrereqs.map((nombre) => (
                <li key={nombre}>{nombre}</li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">Sin prerrequisitos definidos.</p>
          )}
          <button
            type="button"
            onClick={() => setShowPopover(false)}
            className="mt-2 text-subtle hover:text-fg"
          >
            Cerrar
          </button>
        </div>
      )}
    </div>
  )
}
