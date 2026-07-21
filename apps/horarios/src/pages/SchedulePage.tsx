import { motion } from 'framer-motion'
import { useStore } from '../store'
import ScheduleGrid, { getNrcColors, normTipo } from '../components/ScheduleGrid'
import { ChevronLeft, ChevronRight, RotateCcw, Download, Sparkles, Calendar, Info, AlertCircle } from '../icons'
import { useNavigate } from 'react-router-dom'

export default function SchedulePage() {
  const store = useStore()
  const navigate = useNavigate()

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

  const ramosVistos: Record<string, { titulo: string; tipo: string }> = {}
  for (const h of horarioActual) {
    if (!(h.nrc in ramosVistos)) ramosVistos[h.nrc] = { titulo: h.titulo, tipo: h.tipo }
  }

  const titulosEnHorario = new Set(Object.values(ramosVistos).map(r => r.titulo))
  const excluidos = new Set<string>()
  for (const h of store.horariosCrudos) {
    if (h.prioridad > 0 && !titulosEnHorario.has(h.titulo)) {
      excluidos.add(h.titulo)
    }
  }
  const excluidosList = [...excluidos]

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
          <p className="text-muted mt-1">
            Opción <strong className="text-fg">{store.indiceHorario + 1}</strong> de{' '}
            <strong className="text-fg">{store.mejoresHorarios.length}</strong> alternativas
          </p>
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
                return (
                  <motion.div
                    key={nrc}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 * i }}
                    className="flex items-start gap-3"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30, delay: 0.05 * i }}
                      className="w-3.5 h-3.5 rounded flex-shrink-0 mt-1"
                      style={{ background: color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-fg truncate">{info.titulo}</div>
                      <div className="text-xs text-muted flex items-center gap-1">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-border/50">{t}</span>
                        <span>NRC: {nrc}</span>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </motion.div>

          <motion.button
            onClick={() => navigate('/export')}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="btn-primary w-full py-3 rounded-xl flex items-center justify-center gap-2"
          >
            <Download className="w-5 h-5" />
            Exportar horario
          </motion.button>
        </motion.div>
      </motion.div>

      {excluidosList.length > 0 && (
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
              {excluidosList.length === 1 ? 'Ramo no incluido' : `${excluidosList.length} ramos no incluidos`}
            </p>
            <p className="text-xs text-muted mb-2">
              Estos ramos no pudieron incluirse en ninguna combinacion sin conflictos:
            </p>
            <ul className="text-sm text-fg space-y-1">
              {excluidosList.map((titulo, i) => (
                <motion.li
                  key={titulo}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + 0.05 * i }}
                  className="flex items-center gap-2"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-warning flex-shrink-0" />
                  <span className="truncate">{titulo}</span>
                </motion.li>
              ))}
            </ul>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}