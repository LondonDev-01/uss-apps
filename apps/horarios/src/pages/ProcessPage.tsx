import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect, useMemo } from 'react'
import { useStore } from '../store'
import { agruparPorNrc } from '../lib/parser'
import { procesarSeleccionesUsuario, generarTopHorarios, horarioCrudoToClase, verificarConflictos } from '../lib/optimizer'
import { normTipo } from '../lib/colors'
import ScheduleGrid from '../components/ScheduleGrid'
import { ChevronRight, Trash2, AlertTriangle, Loader2, Sparkles, Sun, Moon, Clock, CheckCircle, Zap, Settings, AlertCircle } from '../icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { CRITERIO_LABELS, CRITERIO_ORDER, CriterioHorario, HorarioCrudo, ClaseConDia } from '../types'

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
  const location = useLocation()

  const editIndice = typeof location.state === 'object' && location.state !== null
    ? (location.state as { editIndice?: number }).editIndice ?? null
    : null

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const [optimizing, setOptimizing] = useState(false)

  const modo = store.modoManual ? 'manual' as const : 'auto' as const
  const setModo = (m: 'auto' | 'manual') => store.setModoManual(m === 'manual')

  // --- Manual mode computed values ---
  const cursosPorTitulo = useMemo(() => {
    const byTitulo: Record<string, Record<string, HorarioCrudo[]>> = {}
    for (const h of store.horariosCrudos) {
      if (!byTitulo[h.titulo]) byTitulo[h.titulo] = {}
      if (!byTitulo[h.titulo][h.nrc]) byTitulo[h.titulo][h.nrc] = []
      byTitulo[h.titulo][h.nrc].push(h)
    }
    return byTitulo
  }, [store.horariosCrudos])

  const manualSchedule = useMemo(() => {
    const selected = new Set(store.manualNrcs)
    return store.horariosCrudos
      .filter(h => selected.has(h.nrc))
      .map(horarioCrudoToClase)
  }, [store.manualNrcs, store.horariosCrudos])

  const [conflictoValido, conflictoMsg] = useMemo(() => {
    if (manualSchedule.length < 2) return [true, '']
    return verificarConflictos(manualSchedule)
  }, [manualSchedule])

  const nrcsSeleccionados = new Set(store.manualNrcs)

  // Find the NRC linked via liga/conector for a given NRC within the same titulo.
  // Uses the same matching logic as the optimizer's consolidarOpciones.
  const findLinkedNrc = (nrc: string, titulo: string, targetTipo: 'TEO' | 'LAB'): string | null => {
    const nrcBlocks = cursosPorTitulo[titulo]?.[nrc]
    if (!nrcBlocks || nrcBlocks.length === 0) return null
    const base = nrcBlocks[0]
    const bLiga = base.liga?.trim() ?? ''
    const bConn = base.conector?.trim() ?? ''

    const candidates = Object.entries(cursosPorTitulo[titulo] ?? {})
      .filter(([candNrc, blocks]) => candNrc !== nrc && normTipo(blocks[0].tipo) === targetTipo)

    for (const [candNrc, candBlocks] of candidates) {
      const cBase = candBlocks[0]
      const cLiga = cBase.liga?.trim() ?? ''
      const cConn = cBase.conector?.trim() ?? ''
      if (!bLiga && !bConn && !cLiga && !cConn) return candNrc
      if (bLiga === cConn && bConn === cLiga) return candNrc
    }
    return null
  }

  // Check whether two NRCs of the same titulo are compatible as a TEO/LAB pair.
  // Same liga/conector semantics as the optimizer's consolidarOpciones.
  const areLinked = (nrcA: string, nrcB: string, titulo: string): boolean => {
    const a = cursosPorTitulo[titulo]?.[nrcA]?.[0]
    const b = cursosPorTitulo[titulo]?.[nrcB]?.[0]
    if (!a || !b) return false
    const aLiga = a.liga?.trim() ?? ''
    const aConn = a.conector?.trim() ?? ''
    const bLiga = b.liga?.trim() ?? ''
    const bConn = b.conector?.trim() ?? ''
    if (!aLiga && !aConn && !bLiga && !bConn) return true
    return aLiga === bConn && aConn === bLiga
  }

  const tipoOfNrc = (titulo: string, nrc: string): 'TEO' | 'LAB' | 'OTRO' | null => {
    const blocks = cursosPorTitulo[titulo]?.[nrc]
    return blocks && blocks.length > 0 ? normTipo(blocks[0].tipo) : null
  }

  const toggleNrcManual = (nrc: string, titulo: string, tipo: string) => {
    const normT = normTipo(tipo)
    const prev = new Set(store.manualNrcs)
    const partnerTipo = normT === 'TEO' ? 'LAB' : normT === 'LAB' ? 'TEO' : null

    // Invariant: at most one NRC per titulo+tipo is ever selected, so the paired
    // partner is simply whichever NRC of the partner type is currently selected.
    // Never re-derive it via findLinkedNrc: liga/conector only answers
    // compatibility, not identity of the current selection.
    const selectedOfTitulo = [...prev].filter(n => tipoOfNrc(titulo, n) !== null)
    const selectedPartner = partnerTipo
      ? selectedOfTitulo.find(n => tipoOfNrc(titulo, n) === partnerTipo) ?? null
      : null

    if (prev.has(nrc)) {
      // Deselect: the pair stands together, so drop the selected partner too
      prev.delete(nrc)
      if (selectedPartner) prev.delete(selectedPartner)
    } else {
      // Only one section per titulo+tipo: drop the previous one of the same type
      for (const n of selectedOfTitulo) {
        if (tipoOfNrc(titulo, n) === normT) prev.delete(n)
      }
      prev.add(nrc)
      if (partnerTipo) {
        if (selectedPartner && areLinked(nrc, selectedPartner, titulo)) {
          // Keep the existing partner: it is compatible with the new section
        } else {
          if (selectedPartner) prev.delete(selectedPartner)
          const linked = findLinkedNrc(nrc, titulo, partnerTipo)
          if (linked) prev.add(linked)
        }
      }
    }
    store.setManualNrcs([...prev])
  }

  // Check for incomplete TEO/LAB pairs
  const incompletos = useMemo(() => {
    const result: string[] = []
    for (const [titulo, nrcsMap] of Object.entries(cursosPorTitulo)) {
      const nrcEntries = Object.entries(nrcsMap)
      const hasTeo = nrcEntries.some(([, b]) => normTipo(b[0].tipo) === 'TEO')
      const hasLab = nrcEntries.some(([, b]) => normTipo(b[0].tipo) === 'LAB')
      if (!hasTeo || !hasLab) continue // No constraint if only one type exists

      const selectedTeo = nrcEntries.some(([nrc, b]) => normTipo(b[0].tipo) === 'TEO' && nrcsSeleccionados.has(nrc))
      const selectedLab = nrcEntries.some(([nrc, b]) => normTipo(b[0].tipo) === 'LAB' && nrcsSeleccionados.has(nrc))

      if (selectedTeo && !selectedLab) result.push(`${titulo}: falta seleccionar el LAB`)
      else if (!selectedTeo && selectedLab) result.push(`${titulo}: falta seleccionar el TEO`)
    }
    return result
  }, [cursosPorTitulo, store.manualNrcs])

  const guardarManual = () => {
    if (manualSchedule.length === 0) {
      store.showToast('Selecciona al menos un NRC')
      return
    }
    if (incompletos.length > 0) {
      store.showToast('Hay ramos con TEO/LAB incompletos')
      return
    }
    if (!conflictoValido) {
      store.showToast('Hay conflictos en el horario: ' + conflictoMsg)
      return
    }
    if (editIndice !== null && editIndice >= 0 && editIndice < store.mejoresHorarios.length) {
      const horarios = [...store.mejoresHorarios]
      horarios[editIndice] = manualSchedule
      store.setMejoresHorarios(horarios)
      store.setIndiceHorario(editIndice)
      store.showToast('¡Horario actualizado!')
    } else {
      store.setMejoresHorarios([manualSchedule])
      store.setIndiceHorario(0)
      store.showToast('¡Horario manual guardado!')
    }
    store.setExcluidosDetallados([])
    window.scrollTo({ top: 0, behavior: 'instant' })
    navigate('/schedule')
  }
  // --- End manual mode ---

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
      store.setExcluidosDetallados(resultado.excluidosDetallados)
      store.showToast('¡Horarios generados!')
      window.scrollTo({ top: 0, behavior: 'instant' })
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
          <h2 className="text-2xl font-bold text-fg">
            {modo === 'auto' ? 'Asigna días a cada bloque' : 'Arma tu horario manualmente'}
          </h2>
          <p className="text-muted mt-1">
            {modo === 'auto'
              ? 'El optimizador elegirá la mejor combinación automáticamente según tus preferencias.'
              : 'Selecciona los NRCs que quieres cursar. El sistema valida conflictos en tiempo real.'}
          </p>
        </div>
        <div className="flex items-center gap-1 p-1 rounded-xl border border-border bg-surface">
          <button
            onClick={() => setModo('auto')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              modo === 'auto'
                ? 'bg-primary text-bg shadow-sm'
                : 'text-muted hover:text-fg'
            }`}
          >
            <Zap className="w-4 h-4" />
            Automático
          </button>
          <button
            onClick={() => setModo('manual')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              modo === 'manual'
                ? 'bg-primary text-bg shadow-sm'
                : 'text-muted hover:text-fg'
            }`}
          >
            <Settings className="w-4 h-4" />
            Manual
          </button>
        </div>
      </motion.div>

      {modo === 'auto' && (
      <>
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
      </>
      )}

      {modo === 'manual' && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          {/* Course NRC selection cards */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.13 }}
            className="space-y-4 min-w-0 xl:max-h-[calc(100vh-14rem)] xl:overflow-y-auto xl:rounded-2xl xl:border xl:border-border xl:p-3"
          >
          {Object.entries(cursosPorTitulo).map(([titulo, nrcsMap], idx) => {
            const nrcEntries = Object.entries(nrcsMap)
            const teoNrcs = nrcEntries.filter(([, blocks]) => normTipo(blocks[0].tipo) === 'TEO')
            const labNrcs = nrcEntries.filter(([, blocks]) => normTipo(blocks[0].tipo) === 'LAB')
            const otroNrcs = nrcEntries.filter(([, blocks]) => normTipo(blocks[0].tipo) === 'OTRO')
            const groups: [string, [string, HorarioCrudo[]][]][] = []
            if (teoNrcs.length > 0) groups.push(['TEO', teoNrcs])
            if (labNrcs.length > 0) groups.push(['LAB', labNrcs])
            if (otroNrcs.length > 0) groups.push(['OTRO', otroNrcs])
            const p = nrcEntries[0]?.[1]?.[0]?.prioridad ?? 0
            const catColors = CAT_COLORS[p as 0 | 1 | 2]

            return (
              <motion.div
                key={titulo}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * idx }}
                className="relative overflow-hidden rounded-2xl border bg-surface"
                style={{ borderColor: catColors.border }}
              >
                <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: catColors.border }} />
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className="font-semibold text-fg text-lg">{titulo}</span>
                    <span className="badge text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: catColors.bg, color: catColors.text }}>
                      {CAT_LABELS[p as 0 | 1 | 2]}
                    </span>
                  </div>

                  {groups.map(([tipoLabel, entries]) => (
                    <div key={tipoLabel} className="mb-3 last:mb-0">
                      <p className="text-xs text-muted uppercase tracking-wider font-semibold mb-2">{tipoLabel}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {entries.map(([nrc, blocks]) => {
                          const isSelected = nrcsSeleccionados.has(nrc)
                          const tipo = normTipo(blocks[0].tipo)
                          const tipoColor = tipo === 'TEO' ? 'var(--color-primary)' : tipo === 'LAB' ? 'var(--color-success)' : 'var(--color-muted)'
                          const diasUnicos: string[] = []
                          for (const b of blocks) {
                            if (b.dia_parseado && !diasUnicos.includes(b.dia_parseado)) diasUnicos.push(b.dia_parseado)
                          }
                          return (
                            <motion.button
                              key={nrc}
                              onClick={() => toggleNrcManual(nrc, titulo, blocks[0].tipo)}
                              whileHover={{ scale: 1.01 }}
                              whileTap={{ scale: 0.99 }}
                              className={`relative p-3 rounded-xl border text-left transition-all ${
                                isSelected
                                  ? 'shadow-md'
                                  : 'border-border bg-bg-elevated/30 hover:border-primary/30'
                              }`}
                              style={isSelected ? {
                                borderColor: 'var(--color-primary)',
                                background: 'color-mix(in srgb, var(--color-primary) 8%, var(--color-bg-elevated))',
                                boxShadow: '0 0 0 1px var(--color-primary), 0 4px 16px -6px var(--color-primary)',
                              } : undefined}
                              aria-pressed={isSelected}
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="font-mono text-sm font-bold text-fg">NRC {nrc}</span>
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                                    style={{ background: tipoColor, color: 'var(--color-bg)' }}
                                  >
                                    {blocks[0].tipo}
                                  </span>
                                  <span className="text-xs text-muted font-mono">{blocks[0].seccion}</span>
                                </div>
                              </div>
                              <div className="space-y-0.5">
                                {blocks.map((b, bi) => (
                                  <p key={bi} className="text-xs text-fg/80">
                                    <span className="font-medium">{b.dia_parseado ?? '-'}</span>
                                    <span className="text-muted mx-1">·</span>
                                    <span className="font-mono">{b.hora_str}</span>
                                  </p>
                                ))}
                              </div>
                              {blocks[0].ubicacion && blocks[0].ubicacion !== 'S/I' && (
                                <p className="text-[10px] text-muted mt-1 truncate">{blocks[0].ubicacion}</p>
                              )}
                              {isSelected && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full flex items-center justify-center"
                                  style={{ background: 'var(--color-primary)', color: 'var(--color-bg)' }}
                                >
                                  <CheckCircle className="w-3.5 h-3.5" />
                                </motion.div>
                              )}
                            </motion.button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )
          })}
        </motion.div>

        <div className="space-y-4 min-w-0 xl:sticky xl:top-6 self-start">
          {/* Incomplete TEO/LAB warning */}
        <AnimatePresence>
          {incompletos.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-start gap-3 p-4 rounded-2xl"
              style={{
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
              }}
              role="alert"
            >
              <AlertTriangle className="w-5 h-5 flex-shrink-0 text-warning mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-fg mb-1">Ramos con TEO/LAB incompletos</p>
                <ul className="text-xs text-muted space-y-0.5">
                  {incompletos.map((msg, i) => (
                    <li key={i}>• {msg}</li>
                  ))}
                </ul>
                <p className="text-xs text-muted mt-2">
                  Si un ramo tiene TEO y LAB, debes seleccionar ambos (o ninguno).
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Conflict warning */}
        <AnimatePresence>
          {!conflictoValido && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-start gap-3 p-4 rounded-2xl"
              style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
              }}
              role="alert"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-danger mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-fg mb-1">Conflicto de horario</p>
                <p className="text-xs text-muted">{conflictoMsg}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Schedule preview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="card rounded-2xl overflow-hidden"
        >
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold text-fg flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Vista previa ({manualSchedule.length} {manualSchedule.length === 1 ? 'bloque' : 'bloques'})
            </h3>
          </div>
          <ScheduleGrid horario={manualSchedule} />
          {manualSchedule.length === 0 && (
            <div className="p-6 text-center text-sm text-muted">
              Seleccioná NRCs para armar tu horario
            </div>
          )}
        </motion.div>

        {/* Save button */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center justify-between p-4 bg-surface rounded-2xl border border-border"
        >
          <div className="text-sm">
            <span className="font-medium text-fg">{nrcsSeleccionados.size}</span>{' '}
            {nrcsSeleccionados.size === 1 ? 'NRC seleccionado' : 'NRCs seleccionados'}
            {manualSchedule.length > 0 && (
              <span className="text-muted ml-2">
                ({manualSchedule.length} {manualSchedule.length === 1 ? 'bloque' : 'bloques'})
              </span>
            )}
          </div>
          <button
            onClick={guardarManual}
            disabled={manualSchedule.length === 0 || !conflictoValido || incompletos.length > 0}
            className="btn-primary px-6 py-3 text-lg font-semibold rounded-xl disabled:opacity-50"
          >
            <CheckCircle className="w-5 h-5 mr-2" />
            Guardar horario manual
          </button>
        </motion.div>
      </div>
      </div>
      )}
    </motion.div>
  )
}