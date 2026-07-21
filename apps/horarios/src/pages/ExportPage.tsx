import { motion } from 'framer-motion'
import { useState } from 'react'
import { useStore } from '../store'
import { ClaseConDia } from '../types'
import { Download, FileSpreadsheet, FileCode, CalendarClock, ChevronDown, Loader2, Sparkles, RotateCcw } from '../icons'

function generarCSV(horario: ClaseConDia[]): string {
  const grouped: Record<string, { nrc: string; titulo: string; tipo: string; bloques: string[] }> = {}
  for (const c of horario) {
    const key = `${c.nrc}|${c.titulo}|${c.tipo}`
    const lugar = `${c.edificio ?? ''} ${c.salon ?? ''}`.trim()
    const lugarFinal = ['n/a', 'na', '-', 's/i'].includes(lugar.toLowerCase()) ? '' : lugar
    const bloque = `${c.dia} ${c.hora_inicio}-${c.hora_fin}${lugarFinal ? ' ' + lugarFinal : ''}`
    if (!grouped[key]) grouped[key] = { nrc: c.nrc, titulo: c.titulo, tipo: c.tipo, bloques: [] }
    grouped[key].bloques.push(bloque)
  }

  const lines: string[] = []
  lines.push('NRC,Titulo,Tipo,Bloque 1,Bloque 2,Bloque 3')
  for (const g of Object.values(grouped)) {
    const row = [g.nrc, g.titulo, g.tipo, ...[0, 1, 2].map(i => g.bloques[i] ?? '')]
    lines.push(row.map(v => `"${v.replace(/"/g, '""')}"`).join(','))
  }

  lines.push('')
  lines.push('ARMADO DEL HORARIO:')
  const byDay: Record<string, { hora: string; line: string }[]> = {}
  for (const c of horario) {
    if (!c.dia) continue
    const lugar = `${c.edificio ?? ''} ${c.salon ?? ''}`.trim()
    const lugarFinal = ['n/a', 'na', '-', 's/i'].includes(lugar.toLowerCase()) ? '' : lugar
    const horaRange = `${c.hora_inicio}-${c.hora_fin}`
    const line = lugarFinal
      ? `${c.dia} ${horaRange} ${lugarFinal} — ${c.titulo} (${c.nrc})`
      : `${c.dia} ${horaRange} — ${c.titulo} (${c.nrc})`
    ;(byDay[c.dia] ??= []).push({ hora: c.hora_inicio, line })
  }
  const order = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  for (const d of order) {
    const items = byDay[d]
    if (!items || items.length === 0) continue
    items.sort((a, b) => a.hora.localeCompare(b.hora))
    lines.push('')
    lines.push(`${d}:`)
    for (const it of items) lines.push(it.line)
  }
  return lines.join('\n')
}

function generarJSON(horario: ClaseConDia[]): string {
  return JSON.stringify(horario.map(c => ({
    nrc: c.nrc, titulo: c.titulo, tipo: c.tipo, seccion: c.seccion,
    dia: c.dia, hora: `${c.hora_inicio} - ${c.hora_fin}`,
    lugar: `${c.edificio} ${c.salon}`
  })), null, 2)
}

function generarICal(horario: ClaseConDia[]): string {
  const diasMap: Record<string, string> = { Lunes: 'MO', Martes: 'TU', Miércoles: 'WE', Jueves: 'TH', Viernes: 'FR', Sábado: 'SA' }
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  let ical = 'BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//UniHorario USS//ES\n'
  for (const c of horario) {
    const day = diasMap[c.dia] ?? 'MO'
    ical += 'BEGIN:VEVENT\n'
    ical += `UID:${c.nrc}-${c.dia}-${c.hora_inicio}@unihorario\n`
    ical += `DTSTAMP:${now}\n`
    ical += `SUMMARY:${c.titulo} (${c.tipo})\n`
    ical += `LOCATION:${c.edificio} ${c.salon}\n`
    ical += `DESCRIPTION:NRC: ${c.nrc} | Sección: ${c.seccion} | Instructor: ${c.instructor}\n`
    const startDate = c.fecha_inicio.split('-').reverse().join('')
    const endDate = c.fecha_fin.split('-').reverse().join('')
    ical += `DTSTART;TZID=America/Santiago:${startDate}T${c.hora_inicio.replace(':', '')}00\n`
    ical += `DTEND;TZID=America/Santiago:${startDate}T${c.hora_fin.replace(':', '')}00\n`
    ical += `RRULE:FREQ=WEEKLY;BYDAY=${day};UNTIL=${endDate}T235959Z\n`
    ical += 'END:VEVENT\n'
  }
  ical += 'END:VCALENDAR'
  return ical
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const EXPORT_OPTIONS = [
  { id: 'csv', label: 'CSV (Excel)', desc: 'Compatible con Excel, Google Sheets, LibreOffice', icon: FileSpreadsheet, color: 'var(--color-success)', mime: 'text/csv', ext: 'csv', gen: generarCSV },
  { id: 'json', label: 'JSON', desc: 'Para respaldo técnico o integración con otras apps', icon: FileCode, color: 'var(--color-primary)', mime: 'application/json', ext: 'json', gen: generarJSON },
  { id: 'ical', label: 'iCal (.ics)', desc: 'Importar en Google Calendar, Apple Calendar, Outlook', icon: CalendarClock, color: 'var(--color-accent)', mime: 'text/calendar', ext: 'ics', gen: generarICal },
] as const

export default function ExportPage() {
  const store = useStore()
  const [generated, setGenerated] = useState<Record<string, string>>({})
  const [generating, setGenerating] = useState<string | null>(null)

  if (store.mejoresHorarios.length === 0) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
        <CalendarClock className="w-12 h-12 mx-auto text-muted mb-4" />
        <h2 className="text-xl font-bold text-fg mb-2">No hay horario para exportar</h2>
        <p className="text-muted mb-6">Primero genera un horario en la pestaña "Horario"</p>
        <button onClick={() => store.setActiveTab(2)} className="btn-primary">
          Ir a Horario
        </button>
      </motion.div>
    )
  }

  const horarioActual = store.mejoresHorarios[store.indiceHorario]
  const num = store.indiceHorario + 1

  const handleGenerate = async (id: string, gen: (h: ClaseConDia[]) => string) => {
    setGenerating(id)
    await new Promise(r => setTimeout(r, 100))
    const content = gen(horarioActual)
    setGenerated(prev => ({ ...prev, [id]: content }))
    const opt = EXPORT_OPTIONS.find(o => o.id === id)!
    downloadFile(content, `Horario_Opcion_${num}.${opt.ext}`, opt.mime)
    setGenerating(null)
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
          <h2 className="text-2xl font-bold text-fg">Exportar Resultado</h2>
          <p className="text-muted mt-1">
            Opción <strong className="text-fg">{num}</strong> de <strong className="text-fg">{store.mejoresHorarios.length}</strong>
          </p>
        </div>
        <button onClick={() => store.setIndiceHorario((store.indiceHorario + 1) % store.mejoresHorarios.length)} className="btn-secondary flex items-center gap-2">
          <RotateCcw className="w-4 h-4" />
          Ver otra opción
        </button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="grid md:grid-cols-3 gap-4"
      >
        {EXPORT_OPTIONS.map((opt, i) => (
          <motion.div
            key={opt.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i }}
            className="card rounded-2xl overflow-hidden border border-border"
          >
            <div className="p-4">
              <div className="flex items-start gap-3 mb-4">
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ background: `${opt.color}15` }}
                >
                  <opt.icon className="w-6 h-6" style={{ color: opt.color }} />
                </motion.div>
                <div>
                  <h3 className="font-semibold text-fg">{opt.label}</h3>
                  <p className="text-sm text-muted mt-0.5">{opt.desc}</p>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleGenerate(opt.id, opt.gen)}
                disabled={generating === opt.id}
                className="btn-primary w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2"
              >
                {generating === opt.id ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    Generar y descargar
                  </>
                )}
              </motion.button>

              {generated[opt.id] && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="mt-3"
                >
                  <details className="group">
                    <summary className="flex items-center gap-2 text-sm text-muted cursor-pointer list-none p-2 rounded-lg hover:bg-accent/30 transition-colors">
                      <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
                      Ver contenido generado
                    </summary>
                    <motion.pre
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="code-block mt-2"
                    >
                      {generated[opt.id].slice(0, 2000)}{generated[opt.id].length > 2000 ? '... (truncado)' : ''}
                    </motion.pre>
                  </details>
                </motion.div>
              )}
            </div>
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="card rounded-2xl p-4 border border-border"
      >
        <div className="flex items-center gap-3 mb-3">
          <Sparkles className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-fg">Tip: Importar a tu calendario</h3>
        </div>
        <div className="text-sm text-muted space-y-2">
          <p>• <strong>Google Calendar:</strong> Configuración → Importar → Selecciona el archivo <code className="bg-bg px-1.5 py-0.5 rounded text-xs font-mono">.ics</code></p>
          <p>• <strong>Apple Calendar:</strong> Archivo → Importar → Selecciona el archivo <code className="bg-bg px-1.5 py-0.5 rounded text-xs font-mono">.ics</code></p>
          <p>• <strong>Outlook:</strong> Archivo → Abrir y exportar → Importar/Exportar → Importar un calendario iCalendar (.ics)</p>
          <p className="text-primary text-sm">Los eventos se repetirán automáticamente cada semana hasta el fin del semestre.</p>
        </div>
      </motion.div>
    </motion.div>
  )
}