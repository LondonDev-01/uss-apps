import { motion, AnimatePresence } from 'framer-motion'
import { useState, useRef, useEffect, useMemo } from 'react'
import { useStore } from '../store'
import { useNavigate } from 'react-router-dom'
import { parseExcelFile, parseExcelSheet, SheetInfo } from '../lib/excelParser'
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, ArrowRight, Trash2, HelpCircle, Loader2, X, ChevronDown, ChevronUp } from '../icons'
import type { HorarioCrudo } from '../types'

const LOADING_MESSAGES = [
  { msg: 'Cargando el terreno XD así no era', sub: 'excavando celdas' },
  { msg: 'Renderizando contenido', sub: 'pintando pixeles' },
  { msg: 'R0b4nd0 D4t0s', sub: 'matrix mode' },
  { msg: 'Convenciendo a los LABs de juntarse con sus TEOs', sub: 'liga conector' },
  { msg: 'Contando NRCs duplicados', sub: 'modo detective' },
  { msg: 'Calculando horas de fin automáticas', sub: '+80 min cada una' },
  { msg: 'Descifrando los días de la semana', sub: 'lun, mar, mie...' },
  { msg: 'Organizando las secciones', sub: 'T01, T02, T50...' },
  { msg: 'Aplanando matrices en el navegador', sub: 'numpy.js vibes' },
  { msg: 'Casi listo, no te vayas', sub: 'aguanta un poquito' },
  { msg: 'Compilando TypeScript en tiempo real', sub: 'vite está sudando' },
  { msg: 'Asignando prioridades', sub: 'categorizando ramos' },
]

const PROGRESS_STEPS = [
  { threshold: 0, label: 'Iniciando' },
  { threshold: 15, label: 'Leyendo bytes' },
  { threshold: 35, label: 'Parseando filas' },
  { threshold: 55, label: 'Detectando días' },
  { threshold: 75, label: 'Calculando horas' },
  { threshold: 90, label: 'Limpiando duplicados' },
  { threshold: 100, label: 'Listo' },
]

function LoadingModal({ open, fileName }: { open: boolean; fileName: string | null }) {
  const [messageIndex, setMessageIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [stepIndex, setStepIndex] = useState(0)

  useEffect(() => {
    if (!open) {
      setMessageIndex(0)
      setProgress(0)
      setStepIndex(0)
      return
    }

    const msgInterval = setInterval(() => {
      setMessageIndex(i => (i + 1) % LOADING_MESSAGES.length)
    }, 900)

    const progressInterval = setInterval(() => {
      setProgress(p => {
        if (p < 20) return p + 5
        if (p < 50) return p + 3
        if (p < 80) return p + 1.5
        if (p < 92) return p + 0.3
        return p
      })
    }, 100)

    return () => {
      clearInterval(msgInterval)
      clearInterval(progressInterval)
    }
  }, [open])

  useEffect(() => {
    const step = PROGRESS_STEPS.findIndex((s, i) => {
      const next = PROGRESS_STEPS[i + 1]
      return progress >= s.threshold && (!next || progress < next.threshold)
    })
    if (step >= 0) setStepIndex(step)
  }, [progress])

  const currentStep = PROGRESS_STEPS[stepIndex]

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-labelledby="loading-title"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="card max-w-md w-full p-8 text-center relative overflow-hidden"
          >
            <div className="absolute inset-0 opacity-5 pointer-events-none">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%]"
                style={{
                  background: 'conic-gradient(from 0deg, var(--color-fg-muted), transparent, var(--color-fg-muted))',
                }}
              />
            </div>

            <div className="relative w-24 h-24 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full border-4 border-border" />
              <motion.div
                className="absolute inset-0 rounded-full border-4 border-transparent"
                style={{ borderTopColor: 'var(--color-fg)' }}
                animate={{ rotate: 360 }}
                transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
              />
              <motion.div
                className="absolute inset-2 rounded-full border-2 border-transparent"
                style={{ borderTopColor: 'var(--color-fg-muted)' }}
                animate={{ rotate: -360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <FileSpreadsheet className="w-8 h-8 text-fg-muted" />
                </motion.div>
              </div>
            </div>

            <h3 id="loading-title" className="text-xl font-bold text-fg mb-1 relative">
              Procesando archivo
            </h3>
            {fileName && (
              <p className="text-sm text-muted mb-6 truncate font-mono relative">{fileName}</p>
            )}
            {!fileName && <div className="mb-6" />}

            <div className="mb-5 relative">
              <div className="h-2 w-full bg-border rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full relative"
                  style={{
                    width: `${progress}%`,
                    background: 'linear-gradient(90deg, var(--color-fg-muted), var(--color-fg))',
                  }}
                  transition={{ duration: 0.1 }}
                >
                  <motion.div
                    className="absolute inset-0 opacity-50"
                    style={{ background: 'linear-gradient(90deg, transparent, white, transparent)' }}
                    animate={{ x: ['-100%', '200%'] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                  />
                </motion.div>
              </div>
              <div className="flex items-center justify-between mt-2 text-xs">
                <span className="text-fg font-medium">{currentStep.label}</span>
                <span className="text-fg-muted font-mono tabular-nums">{Math.floor(progress)}%</span>
              </div>
            </div>

            <div className="h-20 flex items-center justify-center relative">
              <AnimatePresence mode="wait">
                <motion.div
                  key={messageIndex}
                  initial={{ opacity: 0, y: 15, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -15, filter: 'blur(4px)' }}
                  transition={{ duration: 0.25 }}
                  className="text-center w-full"
                >
                  <p className="text-fg font-semibold">{LOADING_MESSAGES[messageIndex].msg}</p>
                  <p className="text-fg-subtle text-xs font-mono mt-1.5">// {LOADING_MESSAGES[messageIndex].sub}</p>
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="flex items-center justify-center gap-1.5 mt-2">
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-fg-muted"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

interface SectionInfo {
  seccion: string
  clases: { dia: string; hora: string }[]
}

interface CourseInfo {
  titulo: string
  teoSections: SectionInfo[]
  labSections: SectionInfo[]
  clasesPorSemana: number
  hasTeo: boolean
  hasLab: boolean
}

interface Stats {
  uniqueCourses: number
  teoCourses: number
  labCourses: number
  totalClasesPorSemana: number
  breakdown: CourseInfo[]
}

function computeStats(horarios: HorarioCrudo[]): Stats {
  const byCourse = new Map<string, HorarioCrudo[]>()
  for (const h of horarios) {
    if (!byCourse.has(h.titulo)) byCourse.set(h.titulo, [])
    byCourse.get(h.titulo)!.push(h)
  }

  let teoCourses = 0
  let labCourses = 0
  let totalClasesPorSemana = 0
  const breakdown: CourseInfo[] = []

  for (const [titulo, rows] of byCourse) {
    const teoRows = rows.filter(r => r.tipo === 'TEO')
    const labRows = rows.filter(r => r.tipo === 'LAB')
    const hasTeo = teoRows.length > 0
    const hasLab = labRows.length > 0

    if (hasTeo) teoCourses++
    if (hasLab) labCourses++

    const groupBySection = (items: HorarioCrudo[]): SectionInfo[] => {
      const map = new Map<string, { dia: string; hora: string }[]>()
      for (const r of items) {
        if (!map.has(r.seccion)) map.set(r.seccion, [])
        map.get(r.seccion)!.push({ dia: r.dia_parseado ?? '-', hora: r.hora_str })
      }
      return Array.from(map.entries()).map(([seccion, clases]) => ({ seccion, clases }))
    }

    const teoSections = groupBySection(teoRows)
    const labSections = groupBySection(labRows)

    const teoCount = teoSections.length > 0 ? teoSections[0].clases.length : 0
    const labCount = labSections.length > 0 ? labSections[0].clases.length : 0
    const porSemana = teoCount + labCount
    totalClasesPorSemana += porSemana

    breakdown.push({
      titulo,
      teoSections,
      labSections,
      clasesPorSemana: porSemana,
      hasTeo,
      hasLab,
    })
  }

  return { uniqueCourses: byCourse.size, teoCourses, labCourses, totalClasesPorSemana, breakdown }
}

function CourseBreakdownCard({ course }: { course: CourseInfo }) {
  const teoText = course.hasTeo
    ? 'Teoria: ' + course.teoSections.map((sec, i) => {
        const label = course.teoSections.length > 1 ? 'Opcion ' + String.fromCharCode(65 + i) + ': ' : ''
        return label + sec.clases.map(c => c.dia + ' ' + c.hora).join(', ')
      }).join(' | ')
    : null

  const labText = course.hasLab
    ? 'Laboratorio: ' + course.labSections.map((sec, i) => {
        const label = course.labSections.length > 1 ? 'Opcion ' + String.fromCharCode(65 + i) + ': ' : ''
        return label + sec.clases.map(c => c.dia + ' ' + c.hora).join(', ')
      }).join(' | ')
    : null

  const cargaText = 'Carga semanal: ' + course.clasesPorSemana + ' clase' + (course.clasesPorSemana !== 1 ? 's' : '')

  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-4 space-y-1.5 text-xs">
      <p className="text-sm font-bold text-fg">{course.titulo}</p>
      {teoText && <p className="text-fg/80">{teoText}</p>}
      {labText && <p className="text-fg/80">{labText}</p>}
      <p className="text-fg/60 pt-1">{cargaText}</p>
    </div>
  )
}

function SheetPickerModal({ open, sheets, onSelect, onCancel }: {
  open: boolean
  sheets: SheetInfo[] | null
  onSelect: (name: string) => void
  onCancel: () => void
}) {
  return (
    <AnimatePresence>
      {open && sheets && sheets.length > 1 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          onClick={onCancel}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="card max-w-md w-full"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-5 border-b border-border">
              <h3 className="text-lg font-bold text-fg">Selecciona la hoja</h3>
              <p className="text-xs text-muted mt-0.5">
                El archivo tiene {sheets.length} hojas. Elige la que contiene tu horario.
              </p>
            </div>
            <div className="p-5 space-y-2">
              {sheets.map((sheet) => (
                <button
                  key={sheet.name}
                  onClick={() => onSelect(sheet.name)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-border hover:border-fg-muted hover:bg-surface-hover transition-colors text-left group"
                >
                  <div>
                    <p className="text-sm font-semibold text-fg">{sheet.name}</p>
                    <p className="text-xs text-muted mt-0.5">{sheet.rowCount} filas detectadas</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted group-hover:text-fg transition-colors" />
                </button>
              ))}
            </div>
            <div className="p-5 border-t border-border">
              <button onClick={onCancel} className="w-full btn-ghost text-sm">
                Cancelar
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function BreakdownModal({ open, onClose, stats }: { open: boolean; onClose: () => void; stats: Stats }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="card max-w-2xl w-full max-h-[80vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div>
                <h3 className="text-lg font-bold text-fg">Desglose de Asignaturas</h3>
                <p className="text-xs text-muted mt-0.5">
                  {stats.uniqueCourses} asignaturas · {stats.totalClasesPorSemana} clases/semana ({stats.teoCourses} de Teoria + {stats.labCourses} de Laboratorio)
                </p>
              </div>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface-hover transition-colors">
                <X className="w-5 h-5 text-fg-muted" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {stats.breakdown.map(course => (
                <CourseBreakdownCard key={course.titulo} course={course} />
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default function UploadPage() {
  const store = useStore()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [preview, setPreview] = useState<{ rows: string[][]; parsedCount: number; numberShown: number } | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [showBreakdownModal, setShowBreakdownModal] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentFileName, setCurrentFileName] = useState<string | null>(null)
  const [availableSheets, setAvailableSheets] = useState<SheetInfo[] | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [showSheetPicker, setShowSheetPicker] = useState(false)

  const stats = useMemo(() => computeStats(store.horariosCrudos), [store.horariosCrudos])

  const openFileDialog = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    fileInputRef.current?.click()
  }

  const applyParsed = (parsed: HorarioCrudo[]) => {
    const previewRows = parsed.map(h => [
      h.nrc, h.titulo, h.seccion, h.tipo, h.hora_str, h.dia_parseado ?? '-', h.liga || '-', h.conector || '-'
    ])
    setPreview({
      rows: [['NRC', 'Nombre', 'Seccion', 'Tipo', 'Horario', 'Dia', 'Liga', 'Conector'], ...previewRows],
      parsedCount: parsed.length,
      numberShown: 10
    })
    store.setHorariosCrudos(parsed)
  }

  const handleFile = async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      setError('Solo archivos .xlsx o .xls')
      return
    }
    setError(null)
    setCurrentFileName(file.name)
    setProcessing(true)
    try {
      const result = await parseExcelFile(file)

      if (result.sheets.length > 1) {
        setAvailableSheets(result.sheets)
        setPendingFile(file)
        setProcessing(false)
        setCurrentFileName(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
        setShowSheetPicker(true)
        return
      }

      applyParsed(result.parsed)
    } catch (e) {
      setError('Error leyendo el archivo. Verifica el formato.')
      console.error(e)
    } finally {
      setProcessing(false)
      setCurrentFileName(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleSheetSelect = async (sheetName: string) => {
    if (!pendingFile) return
    setShowSheetPicker(false)
    setProcessing(true)
    setCurrentFileName(pendingFile.name)
    try {
      const parsed = await parseExcelSheet(pendingFile, sheetName)
      applyParsed(parsed)
    } catch (e) {
      setError('Error leyendo la hoja seleccionada.')
      console.error(e)
    } finally {
      setProcessing(false)
      setCurrentFileName(null)
      setPendingFile(null)
      setAvailableSheets(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (!processing) setDragging(true)
  }

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
  }

  const clearFile = () => {
    setPreview(null)
    setShowAll(false)
    setShowBreakdownModal(false)
    setError(null)
    store.setHorariosCrudos([])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const continueToCategorize = () => {
    if (store.horariosCrudos.length === 0) {
      setError('Sube un archivo primero')
      return
    }
    store.setActiveTab(1)
    navigate('/categorize')
  }

  const dataRows = preview ? preview.rows.slice(1) : []
  const visibleRows = showAll ? dataRows : dataRows.slice(0, preview?.numberShown ?? 10)
  const hasMoreRows = dataRows.length > (preview?.numberShown ?? 10)
  const remainingRows = Math.max(0, dataRows.length - (preview?.numberShown ?? 10))

  return (
    <>
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
            <Upload className="w-10 h-10" />
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-3xl font-bold text-fg"
          >
            Sube tu horario
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="mt-2 text-muted max-w-md mx-auto"
          >
            Arrastra tu archivo <code className="px-1.5 py-0.5 rounded bg-surface text-fg font-mono text-sm">.xlsx</code> del portal USS o haz clic para seleccionarlo
          </motion.p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className={`drop-zone relative rounded-2xl border-2 border-dashed transition-all ${
            dragging
              ? 'dragging border-fg-muted'
              : 'border-border hover:border-fg-muted'
          } ${processing ? 'pointer-events-none opacity-60' : ''} ${preview ? 'pointer-events-none opacity-90' : ''}`}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={preview ? undefined : openFileDialog}
          role={preview ? undefined : 'button'}
          tabIndex={preview ? -1 : 0}
          onKeyDown={e => { if (!preview && (e.key === 'Enter' || e.key === ' ')) openFileDialog() }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={e => {
              if (preview) return
              const file = e.target.files?.[0]
              if (file) handleFile(file)
              e.target.value = ''
            }}
            className="absolute inset-0 opacity-0 cursor-pointer"
            aria-label="Seleccionar archivo Excel"
            disabled={!!preview}
          />
          <div className="p-10 sm:p-14 text-center relative">
            <motion.div
              animate={dragging ? { scale: 1.15, rotate: 5 } : { scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 15 }}
              className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-bg-elevated text-fg-muted mb-4 border border-border"
            >
              <FileSpreadsheet className="w-10 h-10" />
            </motion.div>
            {processing ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 text-fg-muted animate-spin" />
                <p className="text-fg font-medium">Procesando...</p>
              </div>
            ) : preview ? (
              <>
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-3" style={{ background: 'var(--color-success-light)' }}>
                  <CheckCircle className="w-7 h-7" style={{ color: 'var(--color-success)' }} />
                </div>
                <p className="text-fg font-medium text-lg">
                  <span className="text-fg font-bold">{preview.parsedCount}</span> filas cargadas
                </p>
                <p className="text-muted text-sm mt-2 max-w-md mx-auto">
                  Los datos persisten al cambiar de pestaña. Para subir otro archivo, presiona <span className="font-semibold text-fg">Quitar</span>.
                </p>
              </>
            ) : (
              <>
                <p className="text-fg font-medium text-lg mb-1">Arrastra tu archivo aqui</p>
                <p className="text-sm text-muted">o haz clic para seleccionar</p>
                <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted">
                  <span className="px-2 py-1 rounded bg-surface border border-border font-mono">.xlsx</span>
                  <span className="px-2 py-1 rounded bg-surface border border-border font-mono">.xls</span>
                </div>
              </>
            )}
          </div>
        </motion.div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 p-4 rounded-xl"
            style={{
              background: 'var(--color-danger-light)',
              border: '1px solid var(--color-danger)',
              color: 'var(--color-danger)',
            }}
            role="alert"
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-medium flex-1">{error}</p>
            <button onClick={() => setError(null)} className="p-1 rounded hover:bg-danger/20">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        {preview && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-fg flex items-center gap-2">
                Vista previa
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-bg-elevated border border-border cursor-help relative group"
                  onClick={() => setShowBreakdownModal(true)}
                >
                  {stats.uniqueCourses} Asignaturas
                  <HelpCircle className="w-3.5 h-3.5 text-fg-muted" />
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg bg-bg-elevated border border-border text-xs text-fg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 shadow-lg">
                    <div className="text-left space-y-0.5">
                      <p>Debes tomar <span className="font-semibold">{stats.totalClasesPorSemana} clases/semana</span></p>
                      <p>({stats.teoCourses} de Teoria + {stats.labCourses} de Laboratorio)</p>
                    </div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-bg-elevated" />
                  </div>
                </span>
              </h3>
              <motion.button
                onClick={clearFile}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="btn-ghost text-sm flex items-center gap-1"
                style={{ color: 'var(--color-danger)' }}
              >
                <Trash2 className="w-4 h-4" /> Quitar
              </motion.button>
            </div>

            <div className="rounded-xl border border-border overflow-hidden bg-surface">
              <div className={`overflow-x-auto ${showAll ? 'max-h-[600px] overflow-y-auto' : ''}`}>
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-bg-elevated border-b border-border z-10">
                    <tr>
                      {preview.rows[0]?.map((h, i) => (
                        <th key={i} className="px-3 py-2.5 text-left font-semibold text-muted text-xs uppercase tracking-wider">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
                        {row.map((cell, j) => (
                          <td key={j} className="px-3 py-2 text-fg/90 font-mono text-xs">{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {hasMoreRows && (
                <div className="border-t border-border bg-bg-elevated p-2 flex items-center justify-center">
                  <button
                    onClick={() => setShowAll(s => !s)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-fg-muted hover:text-fg hover:bg-surface transition-colors"
                  >
                    {showAll ? (
                      <>
                        <ChevronUp className="w-4 h-4" />
                        Mostrar menos
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4" />
                        Ver todos ({remainingRows} mas)
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {showAll && stats.breakdown.length > 0 && (
              <div className="p-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted">
                    {stats.uniqueCourses} asignaturas · {stats.totalClasesPorSemana} clases/semana ({stats.teoCourses} Teoria + {stats.labCourses} Laboratorio)
                  </p>
                  <button
                    onClick={() => setShowBreakdownModal(true)}
                    className="text-xs font-medium text-fg-muted hover:text-fg transition-colors underline underline-offset-2"
                  >
                    Ver detalle completo
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}

        <motion.button
          onClick={continueToCategorize}
          disabled={store.horariosCrudos.length === 0 || processing}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          className="btn-primary w-full py-4 text-lg font-bold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ArrowRight className="w-5 h-5 mr-2" />
          Continuar: Categorizar ramos
        </motion.button>

        <motion.details
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="group"
        >
          <summary className="flex items-center gap-2 text-sm text-muted cursor-pointer list-none hover:text-fg transition-colors p-2 rounded-lg hover:bg-surface-hover">
            <HelpCircle className="w-4 h-4" />
            Que formato de Excel necesito?
          </summary>
          <div className="mt-3 p-5 rounded-xl text-sm text-muted space-y-4 border border-border bg-bg-elevated">
            <div>
              <p className="font-semibold text-fg mb-2 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-fg-muted" />
                Columnas requeridas
              </p>
              <p className="text-xs leading-relaxed">
                <code className="bg-bg px-1.5 py-0.5 rounded font-mono text-fg">NRC, NOMBRE, SECCION, COMPONENTE, LIGA, CONECTOR, N_CURSO, HR_INICIO, NOMBRE_, APELLIDO, LUNES, MARTES, MIERCOLES, JUEVES, VIERNES, SABADO</code>
              </p>
            </div>
            <div>
              <p className="font-semibold text-fg mb-2 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-fg-muted" />
                Dias (letra en la columna del dia)
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-surface border border-border"><code className="bg-bg px-1.5 py-0.5 rounded font-mono text-fg">M</code> Lunes</div>
                <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-surface border border-border"><code className="bg-bg px-1.5 py-0.5 rounded font-mono text-fg">T</code> Martes</div>
                <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-surface border border-border"><code className="bg-bg px-1.5 py-0.5 rounded font-mono text-fg">W</code> Miercoles</div>
                <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-surface border border-border"><code className="bg-bg px-1.5 py-0.5 rounded font-mono text-fg">R</code> Jueves</div>
                <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-surface border border-border"><code className="bg-bg px-1.5 py-0.5 rounded font-mono text-fg">F</code> Viernes</div>
                <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-surface border border-border"><code className="bg-bg px-1.5 py-0.5 rounded font-mono text-fg">S</code> Sabado</div>
              </div>
            </div>
            <div>
              <p className="font-semibold text-fg mb-2 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-fg-muted" />
                Formato de hora
              </p>
              <p className="text-xs space-x-2">
                <code className="bg-bg px-1.5 py-0.5 rounded font-mono text-fg">1311</code>
                <span>= 13:11</span>
                <code className="bg-bg px-1.5 py-0.5 rounded font-mono text-fg">0930</code>
                <span>= 09:30</span>
              </p>
              <p className="text-xs mt-1 text-muted">Si HR_FIN no existe, se calcula automaticamente (HR_INICIO + 80 min).</p>
            </div>
            <div>
              <p className="font-semibold text-fg mb-2 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-fg-muted" />
                Ligas y Conectores
              </p>
              <p className="text-xs">TEO y LAB del mismo ramo se vinculan automaticamente. Si comparten codigo cruzado (TEO.Liga=LAB.Conector), se toman juntos como pack.</p>
            </div>
          </div>
        </motion.details>
      </motion.div>

      <LoadingModal open={processing} fileName={currentFileName} />
      <BreakdownModal
        open={showBreakdownModal}
        onClose={() => setShowBreakdownModal(false)}
        stats={stats}
      />
      <SheetPickerModal
        open={showSheetPicker}
        sheets={availableSheets}
        onSelect={handleSheetSelect}
        onCancel={() => {
          setShowSheetPicker(false)
          setPendingFile(null)
          setAvailableSheets(null)
          if (fileInputRef.current) fileInputRef.current.value = ''
        }}
      />
    </>
  )
}
