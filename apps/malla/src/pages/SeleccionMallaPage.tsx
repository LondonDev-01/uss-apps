import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { fetchMallas, setMalla, type Malla } from '../lib/api'

// First-time malla selection (PLAN_V2 §4.2). Shown when the authenticated
// user has no mallaId yet, either from /auth/me or from a previous
// PATCH /users/me saved in local state.
export default function SeleccionMallaPage() {
  const { accessToken, setMallaId } = useAuth()
  const navigate = useNavigate()
  const [mallas, setMallas] = useState<Malla[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken) return
    fetchMallas(accessToken)
      .then(setMallas)
      .catch(() => setError('No se pudieron cargar las mallas disponibles.'))
  }, [accessToken])

  async function handleSelect(malla: Malla) {
    if (!accessToken || saving) return
    setSaving(malla.id)
    setError(null)
    try {
      const updated = await setMalla(accessToken, malla.id)
      setMallaId(updated.mallaId ?? malla.id)
      navigate('/', { replace: true })
    } catch {
      setError('No se pudo guardar tu selección. Intenta de nuevo.')
      setSaving(null)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-2xl">
        <header className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-fg">Elige tu malla curricular</h1>
          <p className="mt-1 text-sm text-muted">
            Esto define qué ramos y prerrequisitos vas a ver. Se puede pedir
            un cambio más adelante si es necesario.
          </p>
        </header>

        {error && (
          <p className="mb-4 text-sm text-danger text-center">{error}</p>
        )}

        {!mallas ? (
          <p className="text-center text-muted">Cargando…</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {mallas.map((malla) => (
              <button
                key={malla.id}
                type="button"
                disabled={saving !== null}
                onClick={() => handleSelect(malla)}
                className="card p-6 text-left hover:border-border-strong transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <p className="text-lg font-semibold text-fg">{malla.nombre}</p>
                <p className="mt-1 text-sm text-muted">Año {malla.year}</p>
                {saving === malla.id && (
                  <p className="mt-3 text-xs text-subtle">Guardando…</p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
