import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import { useStore } from '../store'
import { agruparPorNrc } from '../lib/parser'
import { procesarSeleccionesUsuario, generarTopHorarios } from '../lib/optimizer'
import { ChevronRight, Trash2, AlertTriangle, Loader2, Sparkles, Sun, Moon, Clock } from '../icons'
import { useNavigate } from 'react-router-dom'
import { CRITERIO_LABELS, CRITERIO_ORDER, CriterioHorario } from '../types'

const DIAS_OPCIONES = ['Seleccionar', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

const CAT_COLORS = {
  0: { bg: 'var(--color-cat-0-light)', border: 'var(--color-cat-0)', text: 'var(--color-cat-0)' },
  1: { bg: 'var(--color-cat-1-light)', border: 'var(--color-cat-1)', text: 'var(--color-cat-1)' },
  2: { bg: 'var(--color-cat-2-light)', border: 'var(--color-cat-2)', text: 'var(--color-cat-2)' },
}

const CAT_LABELS = { 0: 'Prioridad', 1: 'Opcionales', 2: 'Electivos' }

const BADGE_CLASSES = {
  success: 'bg-success/10 text-success border-success/20',
  warning: 'bg-warning/10 text-warning border-warning/20',
}

export default function ProcessPage() {
  const store = useStore()
  const navigate = useNavigate()
  const [optimizing, setOptimizing] = useState(false)

  if (store.horariosCrudos.length === 0) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
        <AlertTriangle className="w-12 h-12 mx-auto text-warning mb-4" />
        <h2 className="text-xl font-bold text-fg mb-2">No hay ramos cargados</h2>
        <p className="text-muted mb-6">Primero sube un archivo Excel en la pestaña "Ramos"</p>
        <button onClick={() => store.setActiveTab(0)} className="btn-primary">
          Volver a subir archivo
        </button>
      </motion.div>
    )
  }

  const agrupados = agruparPorNrc(store.horariosCrudos)

  useEffect(() => {
    for (const [nrc, horarios] of Object.entries(agrupados)) {
      horarios.forEach((h, i) => {
        const key = `${nrc}_${i}`
        if (h.dia_parseado && !store.selecciones[key]) {
          store.setSeleccion(key, { dia: h.dia_parseado, horario: h, nrc_original: nrc })
        }
      })
    }
  }, [])

  const eliminarRamo = (nrc: string) => {
    const restantes = store.horariosCrudos.filter(h => h.nrc !== nrc)
    store.setHorariosCrudos(restantes)
    const nuevasSel: any = {}
    for (const [k, v] of Object.entries(store.selecciones)) {
      if (!k.startsWith(`${nrc}_`)) nuevasSel[k] = v
    }
    store.setSelecciones(nuevasSel)
    store.showToast(`NRC ${nrc} eliminado`)
  }

  const optimizar = async () => {
    const totalBloques = store.horariosCrudos.length
    const configurados = Object.keys(store.selecciones).length
    if (configurados < totalBloques) {
      store.showToast('Asigna día a todos los bloques antes de optimizar')
      return
    }

    setOptimizing(true)
    try {
      const prioridadesPorNrc: Record<string, number> = {}
      for (const h of store.horariosCrudos) {
        prioridadesPorNrc[h.nrc] = h.prioridad
      }
      const candidatos = procesarSeleccionesUsuario(store.selecciones, prioridadesPorNrc)
      const resultado = generarTopHorarios(candidatos, 10, store.preferencias)
      if (resultado.horarios.length === 0) {
        alert(resultado.mensaje)
        return
      }
      store.setMejoresHorarios(resultado.horarios)
      store.setIndiceHorario(0)
      store.showToast('¡Horarios generados!')
      navigate('/schedule')
    } catch (e) {
      console.error(e)
      store.showToast('Error al optimizar')
    } finally {
      setOptimizing(false)
    }
  }

  const toggleCriterio = (c: CriterioHorario) => {
    const current = store.preferencias.criterios
    if (current.includes(c)) {
      store.setCriterios(current.filter(x => x !== c))
    } else {
      if (current.length >= 2) {
        store.showToast('Máximo 2 criterios. Quita uno para añadir otro.')
        return
      }
      store.setCriterios([...current, c])
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col sm:flex-row sm:items-end justify-between gap-4"
      >
        <div>
          <h2 className="text-2xl font-bold text-fg">Asigna días a cada bloque</h2>
          <p className="text-muted mt-1">
            El optimizador elegirá la mejor combinación automáticamente según tus preferencias.
          </p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.13 }}
        className="card rounded-2xl p-5 border border-border"
      >
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-fg">¿Cómo quieres tu horario ideal?</h3>
          </div>
          <span className="text-xs text-muted">
            Elige hasta 2 criterios ({store.preferencias.criterios.length}/2)
          </span>
        </div>
        <p className="text-xs text-muted mb-4">
          El primer criterio que marques tendra mayor peso. Si eliges los 2, ambos tendran el mismo peso.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {CRITERIO_ORDER.map((key, idx) => {
            const meta = CRITERIO_LABELS[key]
            const selected = store.preferencias.criterios.includes(key)
            const orden = store.preferencias.criterios.indexOf(key)
            const Icon = key === 'entrar_tarde' ? Sun : key === 'salir_temprano' ? Moon : Clock
            return (
              <motion.button
                key={key}
                onClick={() => toggleCriterio(key)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`relative p-4 rounded-xl border text-left transition-all ${
                  selected
                    ? 'shadow-md'
                    : 'border-border bg-bg-elevated/30 hover:border-primary/30'
                }`}
                style={selected ? {
                  borderColor: 'var(--color-primary)',
                  background: 'color-mix(in srgb, var(--color-primary) 10%, var(--color-bg-elevated))',
                  boxShadow: '0 0 0 1px var(--color-primary), 0 4px 20px -8px var(--color-primary)',
                } : undefined}
                aria-pressed={selected}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      background: selected ? 'var(--color-primary)' : 'var(--color-bg-elevated)',
                      color: selected ? 'var(--color-bg)' : 'var(--color-muted)'
                    }}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-fg text-sm">{meta.label}</p>
                    <p className="text-xs text-muted mt-0.5">{meta.desc}</p>
                  </div>
                </div>
                {selected && orden >= 0 && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                    style={{ background: 'var(--color-primary)', color: 'var(--color-bg)' }}
                  >
                    {orden === 0 ? '1°' : '2°'}
                  </motion.div>
                )}
              </motion.button>
            )
          })}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="space-y-3"
      >
        {Object.entries(agrupados).map(([nrc, horarios], idx) => {
          const h = horarios[0]
          const p = h.prioridad as 0 | 1 | 2
          const catColors = CAT_COLORS[p]
          const configurado = horarios.every((_, i) => `${nrc}_${i}` in store.selecciones)
          const statusText = configurado ? 'Listo' : 'Pendiente'
          const statusClass = configurado ? 'badge-success' : 'badge-warning'

          return (
            <motion.div
              key={nrc}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * idx }}
              className="nrc-card relative overflow-hidden rounded-2xl border bg-surface"
              style={{ borderColor: catColors.border }}
            >
              <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: catColors.border }} />
              
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-fg truncate">{h.titulo}</span>
                    <span className="badge text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: catColors.bg, color: catColors.text }}>
                      {CAT_LABELS[p]}
                    </span>
                    <span className="text-xs text-muted font-mono bg-bg px-2 py-0.5 rounded">NRC: {nrc}</span>
                    <span className="text-xs text-muted font-mono bg-bg px-2 py-0.5 rounded">{h.seccion}</span>
                    <span className={`badge text-xs px-2 py-0.5 rounded-full font-medium ${BADGE_CLASSES[configurado ? 'success' : 'warning']}`}>
                      {statusText}
                    </span>
                  </div>
                  <button
                    onClick={() => eliminarRamo(nrc)}
                    className="btn-danger text-sm p-2 rounded-xl hover:bg-danger/10 transition-colors"
                    aria-label={`Eliminar ${h.titulo}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {horarios.map((h, i) => {
                    const key = `${nrc}_${i}`
                    const current = store.selecciones[key]?.dia ?? 'Seleccionar'
                    return (
                      <div key={key} className="min-w-0">
                        <label className="block text-xs text-muted mb-1">{h.hora_str} — {h.ubicacion || 'Sin sala'}</label>
                        <select
                          className="input w-full text-sm"
                          value={current}
                          onChange={e => {
                            const v = e.target.value
                            if (v === 'Seleccionar') store.updateSeleccion(key, null)
                            else store.updateSeleccion(key, { dia: v, horario: h, nrc_original: nrc })
                          }}
                        >
                          {DIAS_OPCIONES.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          )
        })}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex items-center justify-between p-4 bg-surface rounded-2xl border border-border"
      >
        <div className="text-sm">
          <span className="font-medium text-fg">{Object.keys(store.selecciones).length}</span> de{' '}
          <span className="font-medium text-fg">{store.horariosCrudos.length}</span> bloques configurados
        </div>
        <button
          onClick={optimizar}
          disabled={optimizing}
          className="btn-primary px-6 py-3 text-lg font-semibold rounded-xl disabled:opacity-50"
        >
          {optimizing ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Optimizando...
            </>
          ) : (
            <>
              <ChevronRight className="w-5 h-5 mr-2" />
              Optimizar horario →
            </>
          )}
        </button>
      </motion.div>
    </motion.div>
  )
}