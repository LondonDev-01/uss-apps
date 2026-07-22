import { motion } from 'framer-motion'
import { useEffect, useMemo } from 'react'
import { useStore } from '../store'
import ScheduleGrid, { getNrcColors } from '../components/ScheduleGrid'
import { getCourseColors, normTipo } from '../lib/colors'
import { cumplePreferencias } from '../lib/optimizer'
import { ChevronLeft, ChevronRight, RotateCcw, Download, Sparkles, Calendar, AlertCircle, CheckCircle, Info } from '../icons'
import { useNavigate } from 'react-router-dom'
import { ClaseConDia, ExcluidoInfo } from '../types'

export default function SchedulePage() {
  const store = useStore()
  const navigate = useNavigate()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  if (store.mejoresHorarios.length === 0) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
        <Calendar className="w-12 h-12 mx-auto text-muted mb-4" />
        <h2 className="text-xl font-bold text-fg mb-2">No hay horario generado</h2>
        <p className="text-muted mb-6">Completa el paso anterior para ver tu horario optimizado</p>
        <button onClick={() => store.setActiveTab(2)} className="btn-primary">
          Ir a procesar
        </button>
      </motion.div>
    )
  }

  const horarioActual = store.mejoresHorarios[store.indiceHorario]
  const nrcColors = getNrcColors(horarioActual)
  const courseColors = getCourseColors(horarioActual)
  const tienePreferencias = store.preferencias.criterios.length > 0 || store.preferencias.sin_sabados
  const cumplePrefs = tienePreferencias ? cumplePreferencias(horarioActual, store.preferencias) : true

  const electivosEnHorario = [...new Set(
    horarioActual.filter(c => c.prioridad === 2).map(c => c.titulo)
  )]

  const ramosVistos: Record<string, { titulo: string; tipo: string; clases: ClaseConDia[] }> = {}
  for (const h of horarioActual) {
    if (!(h.nrc in ramosVistos)) ramosVistos[h.nrc] = { titulo: h.titulo, tipo: h.tipo, clases: [] }
    ramosVistos[h.nrc].clases.push(h)
  }

  const titulosEnHorario = new Set(horarioActual.map(c => c.titulo))

  const excluidosDetallados = useMemo(() => {
    const titulosVistos = new Set<string>()
    const excluidos: ExcluidoInfo[] = []
    for (const h of store.horariosCrudos) {
      if (h.prioridad <= 0 || titulosEnHorario.has(h.titulo) || titulosVistos.has(h.titulo)) continue
      titulosVistos.add(h.titulo)
      const conflictos: string[] = []
      const mmToHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
      const parseHHMM = (s: string) => { const [hh,mm] = s.split(':').map(Number); return hh*60+mm }
      const [hIni, hFin] = h.hora_str.split(' - ')
      const dia = h.dia_parseado
      if (!dia) continue
      const mIni = parseHHMM(hIni)
      const mFin = parseHHMM(hFin)
      for (const clase of horarioActual) {
        if (clase.dia !== dia) continue
        if (clase.minutos_inicio < mFin && clase.minutos_fin > mIni) {
          const msg = `${clase.titulo} (${clase.dia} ${clase.hora_inicio}-${clase.hora_fin})`
          if (!conflictos.includes(msg)) conflictos.push(msg)
        }
      }
      if (conflictos.length === 0) {
        conflictos.push('Sin cupos disponibles o sin combinación válida')
      }
      excluidos.push({ titulo: h.titulo, conflictos })
    }
    return excluidos
  }, [horarioActual, store.horariosCrudos, titulosEnHorario])

  const reiniciar = () => {
    if (confirm('¿Reiniciar todo y perder los datos?')) {
      store.resetAll()
      navigate('/')
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
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h2 className="text-2xl font-bold text-fg">Tu Horario Optimizado</h2>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <p className="text-muted">
              Opción <strong className="text-fg">{store.indiceHorario + 1}</strong> de{' '}
              <strong className="text-fg">{store.mejoresHorarios.length}</strong> alternativas
              <span className="ml-2 text-muted">
                ({horarioActual.length} {horarioActual.length === 1 ? 'bloque' : 'bloques'} · {titulosEnHorario.size} {titulosEnHorario.size === 1 ? 'curso' : 'cursos'})
              </span>
            </p>
            {electivosEnHorario.length > 0 ? (
              <span
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-success/10 text-success border border-success/20"
                title={electivosEnHorario.join(', ')}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Incluye: {electivosEnHorario.length === 1
                  ? electivosEnHorario[0]
                  : electivosEnHorario.slice(0, 2).join(', ') + (electivosEnHorario.length > 2 ? '…' : '')}
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-muted/10 text-muted border border-muted/20"
                title="Esta opción no incluye electivos"
              >
                <Info className="w-3.5 h-3.5" />
                Sin electivos
              </span>
            )}
            {tienePreferencias && (
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
                  cumplePrefs
                    ? 'bg-success/10 text-success border border-success/20'
                    : 'bg-muted/10 text-muted border border-muted/20'
                }`}
                title={cumplePrefs
                  ? 'Este horario cumple con todas tus preferencias'
                  : 'Ya no hay más variaciones que cumplan con todas las preferencias solicitadas'}
              >
                {cumplePrefs ? (
                  <><CheckCircle className="w-3.5 h-3.5" /> Toma en cuenta preferencia</>
                ) : (
                  <><Info className="w-3.5 h-3.5" /> No toma en cuenta preferencia</>
                )}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => store.setIndiceHorario((store.indiceHorario - 1 + store.mejoresHorarios.length) % store.mejoresHorarios.length)}
            className="btn-secondary flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Anterior</span>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => store.setIndiceHorario((store.indiceHorario + 1) % store.mejoresHorarios.length)}
            className="btn-secondary flex items-center gap-2"
          >
            <span className="hidden sm:inline">Siguiente</span>
            <ChevronRight className="w-4 h-4" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={reiniciar}
            className="btn-ghost text-danger flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="hidden sm:inline">Reiniciar</span>
          </motion.button>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid lg:grid-cols-[1fr_280px] gap-6"
      >
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.25 }}
          className="card rounded-2xl overflow-hidden"
        >
          <ScheduleGrid horario={horarioActual} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-4"
        >
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="card rounded-2xl p-4"
          >
            <h3 className="font-semibold text-fg mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Leyenda de Ramos
            </h3>
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {Object.entries(ramosVistos).map(([nrc, info], i) => {
                const color = nrcColors[nrc] ?? '#CBD5E1'
                const t = normTipo(info.tipo)
                const ordenadas = [...info.clases].sort((a, b) => {
                  const ordenDia = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
                  return ordenDia.indexOf(a.dia) - ordenDia.indexOf(b.dia)
                })
                const diasUnicos: string[] = []
                for (const c of ordenadas) {
                  if (!diasUnicos.includes(c.dia)) diasUnicos.push(c.dia)
                }
                const diasTexto = diasUnicos.join('/').toUpperCase()
                const tooltipTexto = [
                  info.titulo,
                  ...ordenadas.map(c => `${c.dia}: ${c.hora_inicio}-${c.hora_fin}`)
                ].join('\n')
                return (
                  <motion.div
                    key={nrc}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 * i }}
                    className="flex items-start gap-3 p-2 -m-2 rounded-lg hover:bg-accent/30 transition-colors cursor-help"
                    title={tooltipTexto}
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30, delay: 0.05 * i }}
                      className="w-4 h-4 rounded flex-shrink-0 mt-0.5 border border-black/10"
                      style={{ background: color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-fg leading-tight" title={info.titulo}>
                        {info.titulo}
                      </div>
                      <div className="text-xs text-muted mt-0.5">
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px] font-bold mr-1.5"
                          style={{ background: color, color: '#1E293B' }}
                        >
                          {t}
                        </span>
                        <span className="font-mono">NRC {nrc}</span>
                      </div>
                      <div className="text-[11px] text-fg mt-1 font-medium">
                        {info.clases.length} {info.clases.length === 1 ? 'clase' : 'clases'}{' '}
                        <span className="text-muted">·</span>{' '}
                        <span className="text-muted font-normal">{diasTexto}</span>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </motion.div>

          <motion.button
            onClick={() => {
              window.scrollTo({ top: 0, behavior: 'instant' })
              navigate('/export')
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="btn-primary w-full py-3 rounded-xl flex items-center justify-center gap-2"
          >
            <Download className="w-5 h-5" />
            Exportar horario
          </motion.button>
        </motion.div>
      </motion.div>

      {excluidosDetallados.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="flex items-start gap-3 p-4 rounded-2xl"
          style={{
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
          }}
          role="alert"
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-warning mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-fg mb-1">
              {excluidosDetallados.length === 1 ? 'Ramo no incluido' : `${excluidosDetallados.length} ramos no incluidos`}
            </p>
            <p className="text-xs text-muted mb-3">
              Estos ramos no pudieron incluirse en esta combinación:
            </p>
            <div className="space-y-3">
              {excluidosDetallados.map((excl, i) => (
                <motion.div
                  key={excl.titulo}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + 0.05 * i }}
                  className="pl-3 border-l-2 border-warning/50"
                >
                  <span className="text-sm font-semibold text-fg block truncate">{excl.titulo}</span>
                  {excl.conflictos.length > 0 && (
                    <ul className="text-xs text-muted mt-1 space-y-0.5">
                      {excl.conflictos.map((c, j) => (
                        <li key={j} className="flex items-start gap-1.5">
                          <span className="text-warning mt-px">↳</span>
                          <span>Choca con: {c}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}