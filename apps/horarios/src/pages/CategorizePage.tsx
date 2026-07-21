import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import { useStore } from '../store'
import { useNavigate } from 'react-router-dom'
import { agruparPorNrc } from '../lib/parser'
import { ChevronDown, AlertTriangle, CheckCircle, Target, Flag, Star, Sparkles, X, HelpCircle, Trash2 } from '../icons'
import { SeleccionUsuario } from '../types'

const PRIORIDADES = [
  { value: 0, label: 'Prioridad', desc: 'Ramos obligatorios que DEBEN estar en el horario', icon: Target, color: 'var(--color-cat-0)', bg: 'var(--color-cat-0-light)' },
  { value: 1, label: 'Opcionales', desc: 'Ramos que quieres adelantar si hay espacio', icon: Flag, color: 'var(--color-cat-1)', bg: 'var(--color-cat-1-light)' },
  { value: 2, label: 'Electivos', desc: 'Ramos que quieres incluir (se intentara al menos 1)', icon: Star, color: 'var(--color-cat-2)', bg: 'var(--color-cat-2-light)' },
] as const

export default function CategorizePage() {
  const store = useStore()
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [showHelp, setShowHelp] = useState(false)

  if (store.horariosCrudos.length === 0) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
        <AlertTriangle className="w-12 h-12 mx-auto text-warning mb-4" />
        <h2 className="text-xl font-bold text-fg mb-2">No hay ramos cargados</h2>
        <p className="text-muted mb-6">Primero sube un archivo Excel en la pestaña "Ramos"</p>
        <button onClick={() => navigate('/')} className="btn-primary">
          Volver a subir archivo
        </button>
      </motion.div>
    )
  }

  const agrupados = agruparPorNrc(store.horariosCrudos)
  const nrcs = Object.keys(agrupados)

  const prioridadesPorNrc: Record<string, number> = {}
  for (const [nrc, horarios] of Object.entries(agrupados)) {
    prioridadesPorNrc[nrc] = horarios[0].prioridad
  }

  const electivoCount = new Set(
    nrcs.filter(n => prioridadesPorNrc[n] === 2)
        .map(n => agrupados[n][0].titulo)
  ).size

  const toggleExpand = (nrc: string) => {
    setExpanded((prev: Record<string, boolean>) => ({ ...prev, [nrc]: !prev[nrc] }))
  }

  const handlePriorityChange = (nrc: string, value: number) => {
    const target = agrupados[nrc]?.[0]
    if (!target) return
    const titulo = target.titulo
    store.setHorariosCrudos(
      store.horariosCrudos.map(h => h.titulo === titulo ? { ...h, prioridad: value } : h)
    )
  }

  const handleRemoveCourse = (nrc: string) => {
    const target = agrupados[nrc]?.[0]
    if (!target) return
    const titulo = target.titulo
    const totalNrcs = new Set(
      store.horariosCrudos.filter(h => h.titulo === titulo).map(h => h.nrc)
    ).size
    const msg = totalNrcs > 1
      ? `¿Quitar "${titulo}" y todos sus ${totalNrcs} NRCs?`
      : `¿Quitar "${titulo}"?`
    if (!confirm(msg)) return
    const nrcsAEliminar = new Set(
      store.horariosCrudos.filter(h => h.titulo === titulo).map(h => h.nrc)
    )
    store.setHorariosCrudos(store.horariosCrudos.filter(h => h.titulo !== titulo))
    const nuevasSel: Record<string, SeleccionUsuario> = {}
    for (const [k, v] of Object.entries(store.selecciones)) {
      if (!nrcsAEliminar.has(v.nrc_original)) nuevasSel[k] = v
    }
    store.setSelecciones(nuevasSel)
    store.showToast(`"${titulo}" eliminado`)
  }

  const handleProceed = async () => {
    navigate('/process')
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
          <h2 className="text-2xl sm:text-3xl font-extrabold text-fg">Categoriza tus ramos</h2>
          <p className="text-muted mt-1">
            Asigna cada ramo a una categoría.{' '}
            <span className="text-fg font-medium">Prioridad</span>,{' '}
            <span className="text-fg font-medium">Opcionales</span>, o{' '}
            <span className="text-fg font-medium">Electivos</span>.
          </p>
        </div>
        <button onClick={() => setShowHelp(true)} className="btn-ghost p-2 self-start">
          <HelpCircle className="w-5 h-5" />
        </button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="flex flex-wrap gap-3"
      >
        {PRIORIDADES.map(p => (
          <motion.div
            key={p.value}
            whileHover={{ scale: 1.02, y: -1 }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold cursor-default"
            style={{
              background: `color-mix(in srgb, ${p.color} 12%, transparent)`,
              color: p.color,
              border: `1px solid color-mix(in srgb, ${p.color} 30%, transparent)`,
            }}
          >
            <p.icon className="w-4 h-4" />
            {p.label}
          </motion.div>
        ))}
      </motion.div>

      {electivoCount > 1 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-4 rounded-xl"
          style={{
            background: 'rgba(59, 130, 246, 0.08)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            color: 'var(--color-primary)',
          }}
          role="alert"
        >
          <Sparkles className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">
            Tienes <strong>{electivoCount} electivos</strong> seleccionados. El sistema intentara incluir tantos como sea posible.
          </p>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-3"
      >
        {nrcs.map((nrc, idx) => {
          const horarios = agrupados[nrc]
          const h = horarios[0]
          const currentP = prioridadesPorNrc[nrc] ?? 0
          const isOpen = expanded[nrc]

          return (
            <motion.div
              key={nrc}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.03 * idx }}
              whileHover={{ y: -2 }}
              className="relative overflow-hidden rounded-2xl border bg-surface/60 backdrop-blur transition-all"
              style={{
                borderColor: `color-mix(in srgb, ${PRIORIDADES[currentP].color} 40%, transparent)`,
                boxShadow: `0 4px 20px -8px color-mix(in srgb, ${PRIORIDADES[currentP].color} 30%, transparent)`,
              }}
            >
              <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ background: PRIORIDADES[currentP].color }} />
              
              <button
                onClick={() => toggleExpand(nrc)}
                className="w-full p-4 flex items-center gap-4 hover:bg-surface-hover/40 transition-colors text-left"
                aria-expanded={isOpen}
              >
                <motion.div
                  animate={{ rotate: isOpen ? 180 : 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  className="flex-shrink-0 text-muted"
                >
                  <ChevronDown className="w-5 h-5" />
                </motion.div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-fg text-lg truncate">{h.titulo}</span>
                    <span className="text-xs px-2.5 py-1 rounded-full font-semibold tracking-wide" style={{
                      background: `color-mix(in srgb, ${PRIORIDADES[currentP].color} 15%, transparent)`,
                      color: PRIORIDADES[currentP].color,
                      border: `1px solid color-mix(in srgb, ${PRIORIDADES[currentP].color} 40%, transparent)`,
                    }}>
                      {PRIORIDADES[currentP].label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-sm text-muted flex-wrap">
                    <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-bg-elevated">NRC: {nrc}</span>
                    <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-bg-elevated">{h.seccion}</span>
                    <span className="text-xs">{h.tipo}</span>
                    <span className="text-xs">{h.hora_str}</span>
                    {h.dia_parseado && (
                      <span className="flex items-center gap-1 text-xs font-semibold text-success">
                        <CheckCircle className="w-3.5 h-3.5" />
                        {h.dia_parseado}
                      </span>
                    )}
                  </div>
                </div>
              </button>

              <motion.button
                onClick={(e) => { e.stopPropagation(); handleRemoveCourse(nrc) }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="absolute top-3 right-3 p-2 rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors z-10"
                aria-label={`Quitar ${h.titulo} de la lista`}
                title="Quitar este ramo"
              >
                <Trash2 className="w-4 h-4" />
              </motion.button>

              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="px-4 pb-4 border-t border-border/50"
                  >
                    <div className="pt-4">
                      <p className="text-xs text-muted mb-3 uppercase tracking-wider font-semibold">Cambiar categoría</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {PRIORIDADES.map(p => (
                          <motion.button
                            key={p.value}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handlePriorityChange(nrc, p.value)}
                            className={`relative p-4 rounded-xl border transition-all text-left ${
                              currentP === p.value
                                ? 'shadow-md'
                                : 'border-border bg-bg-elevated/30 hover:border-primary/30'
                            }`}
                            style={currentP === p.value ? {
                              borderColor: p.color,
                              background: `color-mix(in srgb, ${p.color} 10%, var(--color-bg-elevated))`,
                              boxShadow: `0 0 0 1px ${p.color}, 0 4px 20px -8px ${p.color}`,
                            } : undefined}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                                style={{ background: p.color, color: 'var(--color-bg)' }}
                              >
                                <p.icon className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="font-semibold text-fg">{p.label}</p>
                                <p className="text-xs text-muted mt-0.5">{p.desc}</p>
                              </div>
                            </div>
                            {currentP === p.value && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full flex items-center justify-center"
                                style={{ background: p.color, color: 'var(--color-bg)' }}
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                              </motion.div>
                            )}
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </motion.div>

        <motion.button
          onClick={handleProceed}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          className="btn-primary w-full py-4 text-lg font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Sparkles className="w-5 h-5 mr-2" />
        Continuar: Asignar días
      </motion.button>

      <AnimatePresence>
        {showHelp && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
            onClick={() => setShowHelp(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
              className="glow-card max-w-md w-full max-h-[80vh] overflow-auto"
            >
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 id="help-title" className="text-lg font-bold text-fg">Guía de categorías</h3>
                  <button onClick={() => setShowHelp(false)} className="p-1.5 rounded-lg hover:bg-accent/50 text-muted">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-3">
                  {PRIORIDADES.map(p => (
                    <div key={p.value} className="p-4 rounded-xl border" style={{
                      borderColor: `color-mix(in srgb, ${p.color} 40%, transparent)`,
                      background: `color-mix(in srgb, ${p.color} 8%, transparent)`,
                    }}>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: p.color, color: 'var(--color-bg)' }}>
                          <p.icon className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold text-fg">{p.label}</p>
                          <p className="text-sm text-muted mt-0.5">{p.desc}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={() => setShowHelp(false)} className="btn-primary w-full mt-2">
                  Entendido
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}