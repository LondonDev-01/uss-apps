import { motion } from 'framer-motion'
import { useEffect } from 'react'
import { Download, FileSpreadsheet } from '../icons'

interface ExcelFile {
  label: string
  description: string
  file: string
  sizeLabel: string
}

const EXCELS: ExcelFile[] = [
  {
    label: 'Horarios ICIF 2026-20',
    description: 'Archivo original del portal USS con todos los ramos, NRCs y horarios del semestre.',
    file: '/excels/horarios.xlsx',
    sizeLabel: '~33 KB',
  },
]

export default function ExcelsPage() {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

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
        className="text-center"
      >
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.15, type: 'spring', stiffness: 200, damping: 15 }}
          className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-surface border border-border text-fg-muted mb-4"
        >
          <Download className="w-10 h-10" />
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-3xl font-bold text-fg"
        >
          Descargar Excels
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mt-2 text-muted max-w-md mx-auto"
        >
          Archivos Excel del portal USS listos para usar con UniHorario
        </motion.p>
      </motion.div>

      <div className="space-y-3">
        {EXCELS.map((excel, i) => (
          <motion.div
            key={excel.file}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.1 }}
            className="card rounded-2xl border border-border p-5 flex items-center gap-4 hover:border-fg-muted transition-colors"
          >
            <div className="w-12 h-12 rounded-xl bg-bg-elevated border border-border flex items-center justify-center flex-shrink-0">
              <FileSpreadsheet className="w-6 h-6 text-fg-muted" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-fg">{excel.label}</p>
              <p className="text-xs text-muted mt-0.5">{excel.description}</p>
              <p className="text-xs text-muted mt-1 font-mono">{excel.sizeLabel}</p>
            </div>
            <motion.a
              href={excel.file}
              download
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="btn-primary flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold flex-shrink-0"
            >
              <Download className="w-4 h-4" />
              Descargar
            </motion.a>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-center text-xs text-muted pt-2"
      >
        <p>
          Estos archivos son los mismos que podés subir desde la pestaña{' '}
          <span className="font-semibold text-fg">Ramos</span> para generar tu horario optimizado.
        </p>
      </motion.div>
    </motion.div>
  )
}
