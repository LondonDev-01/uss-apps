import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import MallaGrid from '../components/MallaGrid'
import ProgressBar from '../components/ProgressBar'
import StatCard from '../components/StatCard'
import {
  ApiError,
  fetchAprobados,
  fetchMallaDetalle,
  fetchPrioridades,
  removeAprobado,
  upsertAprobado,
  type Aprobado,
  type MallaDetalle,
  type PrioridadesResponse,
} from '../lib/api'
import { legendFor } from '../lib/areaColors'

export default function MallaPage() {
  const { accessToken, mallaId } = useAuth()
  const [malla, setMalla] = useState<MallaDetalle | null>(null)
  const [aprobados, setAprobados] = useState<Aprobado[] | null>(null)
  const [prioridades, setPrioridades] = useState<PrioridadesResponse | null>(null)
  const [prioridadesFailed, setPrioridadesFailed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [pendingId, setPendingId] = useState<string | null>(null)

  const loadAprobadosYPrioridades = useCallback(async () => {
    if (!accessToken) return
    const [aprobadosResult] = await Promise.all([fetchAprobados(accessToken)])
    setAprobados(aprobadosResult)
    try {
      const prioridadesResult = await fetchPrioridades(accessToken)
      setPrioridades(prioridadesResult)
      setPrioridadesFailed(false)
    } catch {
      // Retry once after a short delay — the backend may have been busy
      // recalculating priorities after the previous approval.
      try {
        await new Promise((r) => setTimeout(r, 500))
        const prioridadesResult = await fetchPrioridades(accessToken)
        setPrioridades(prioridadesResult)
        setPrioridadesFailed(false)
        return
      } catch {
        // Second attempt also failed — degrade gracefully.
      }
      setPrioridades(null)
      setPrioridadesFailed(true)
    }
  }, [accessToken])

  useEffect(() => {
    if (!accessToken || !mallaId) return
    let active = true
    setError(null)
    Promise.all([fetchMallaDetalle(accessToken, mallaId), loadAprobadosYPrioridades()])
      .then(([mallaResult]) => {
        if (active) setMalla(mallaResult)
      })
      .catch(() => {
        if (active) setError('No se pudo cargar la malla curricular.')
      })
    return () => {
      active = false
    }
  }, [accessToken, mallaId, loadAprobadosYPrioridades])

  async function handleMarkApproved(cursoId: string) {
    if (!accessToken || pendingId) return
    setPendingId(cursoId)
    try {
      await upsertAprobado(accessToken, cursoId)
      // Refetch to sync state. The retry logic inside
      // loadAprobadosYPrioridades handles transient prioridades failures.
      await loadAprobadosYPrioridades()
    } catch {
      // Approval failed — refetch to restore consistent state, then notify.
      // Do NOT await loadAprobadosYPrioridades again here to avoid retry loops;
      // the previous call already attempted the sync.
      setError('No se pudo marcar el ramo como aprobado.')
    } finally {
      setPendingId(null)
    }
  }

  async function handleUnmarkApproved(cursoId: string) {
    if (!accessToken || pendingId) return
    setPendingId(cursoId)
    try {
      await removeAprobado(accessToken, cursoId)
      await loadAprobadosYPrioridades()
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 404)) {
        setError('No se pudo desmarcar el ramo.')
      }
      await loadAprobadosYPrioridades()
    } finally {
      setPendingId(null)
    }
  }

  // Bulk mark (semester/year). MallaGrid resolves which courses to send and
  // owns its own per-button pending/confirm UI; this just does the network
  // work and refetches once at the end.
  async function handleMarkGroup(cursoIds: string[]) {
    if (!accessToken || cursoIds.length === 0) return
    try {
      await Promise.all(cursoIds.map((cursoId) => upsertAprobado(accessToken, cursoId)))
      await loadAprobadosYPrioridades()
    } catch {
      setError('No se pudo marcar el grupo de ramos como aprobado.')
    }
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg text-danger px-4 text-center">
        {error}
      </div>
    )
  }

  if (!malla || !aprobados) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg text-muted">
        Cargando…
      </div>
    )
  }

  const aprobadosIds = new Set(aprobados.map((a) => a.mallaCursoId))
  const totalCursos = malla.cursos.length
  const totalAprobados = aprobadosIds.size
  const porcentaje = totalCursos > 0 ? Math.round((totalAprobados / totalCursos) * 100) : 0
  const metadatos = prioridades?.metadatos

  return (
    <div className="min-h-screen bg-bg">
      <main className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-10 py-8">
        <header className="mb-6">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl font-bold text-fg">{malla.nombre}</h1>
            {/* Temporary while there's no real "cambiar de malla" product
                decision — needed to test both curricula, and for the real
                case where a student repeating courses ends up needing to
                check the other malla's structure (see the equivalencia
                note near the legend below). */}
            <Link
              to="/seleccionar-malla"
              className="text-xs font-medium text-subtle hover:text-fg border border-border rounded-md px-2.5 py-1.5 transition-colors shrink-0"
            >
              Cambiar malla
            </Link>
          </div>
          <div className="mt-4 max-w-md">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-muted">Avance total</span>
              <span className="font-semibold text-fg">{porcentaje}%</span>
            </div>
            <div className="mt-1.5">
              <ProgressBar value={porcentaje} />
            </div>
            <p className="mt-1.5 text-xs text-subtle">
              {totalAprobados}/{totalCursos} ramos aprobados
            </p>
          </div>
        </header>

        {prioridadesFailed && (
          <p className="mb-4 text-xs text-warning">
            No se pudo calcular la prioridad de ramos para este período — se
            muestran los ramos disponibles sin distinguir prioridad.
          </p>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
          <StatCard label="Semestre actual">
            <p className="text-2xl font-bold text-fg">{metadatos?.semestreActual ?? '—'}</p>
          </StatCard>
          <StatCard label="Aprobados">
            <p className="text-2xl font-bold text-fg">{metadatos?.ramosAprobados ?? totalAprobados}</p>
          </StatCard>
          <StatCard label="Prioridad este período">
            <p className="text-2xl font-bold text-danger">{metadatos?.ramosPrioridad ?? '—'}</p>
          </StatCard>
          <StatCard label="Opcionales">
            <p className="text-2xl font-bold text-fg">{metadatos?.ramosOpcionales ?? '—'}</p>
          </StatCard>
          <StatCard label="Electivos">
            <p className="text-2xl font-bold text-fg">{metadatos?.electivos ?? '—'}</p>
          </StatCard>
        </div>

        <div className="mb-4">
          <input
            type="search"
            placeholder="Buscar ramo…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-sm px-3 py-2 rounded-lg bg-surface border border-border text-sm text-fg placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <MallaGrid
          cursos={malla.cursos}
          aprobadosIds={aprobadosIds}
          prioridades={prioridades}
          searchTerm={search}
          onMarkApproved={handleMarkApproved}
          onUnmarkApproved={handleUnmarkApproved}
          onMarkGroup={handleMarkGroup}
        />

        <div className="flex flex-wrap gap-4 text-xs text-muted">
          <Legend color="bg-bg-elevated border-border opacity-60" label="Aprobado (tachado)" />
          <Legend color="bg-bg-elevated border-primary opacity-70" label="Cubierto por equivalencia" />
          <Legend color="bg-bg-elevated border-primary border-2" label="Prioridad (borde del área, más grueso)" />
          <Legend color="bg-bg-elevated border-border" label="Disponible" />
          <Legend color="bg-bg-elevated border-border grayscale blur-[0.5px] opacity-55" label="No disponible" />
          <Legend color="bg-bg-elevated border-border opacity-70" label="No dictado" />
        </div>
        <p className="mt-2 text-xs text-subtle">
          El color de fondo de cada ramo indica su área curricular; el borde y la opacidad indican su estado. Si
          un ramo ya no se dicta pero tiene un reemplazo en la otra malla, aparece con el nombre del reemplazo
          entre paréntesis debajo — aprobar ese reemplazo cubre este ramo igual. Click en un ramo lo marca como
          aprobado (sin confirmación) y click de nuevo lo desmarca; también podés marcar uno "no dictado" este
          período, ya que la malla registra tu historial académico.
        </p>

        <div className="mt-4 pt-4 border-t border-border flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted">
          {legendFor(malla.cursos.map((c) => c.area)).map(({ area, color }) => (
            <span key={area} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="inline-block w-3 h-3 rounded border"
                style={{ backgroundColor: color.bg, borderColor: color.border }}
              />
              {area}
            </span>
          ))}
        </div>
      </main>
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block w-3 h-3 rounded border ${color}`} />
      {label}
    </span>
  )
}
