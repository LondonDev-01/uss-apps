import { ClaseConDia } from '../types'
import { getCourseColors, getNrcColor, normTipo } from './colors'

const DIAS_FULL = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const DURACION_BLOQUE = 80

function hhmmToMin(s: string): number {
  const [h, m] = s.split(':').map(Number)
  return h * 60 + m
}

function minToHhmm(m: number): string {
  const h = Math.floor(m / 60)
  const mm = m % 60
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function generarExcelColoreado(horario: ClaseConDia[]): string {
  if (horario.length === 0) {
    return generarExcelVacio()
  }

  const diasPresentes = new Set(horario.map(c => c.dia))
  const dias = DIAS_FULL.filter(d => diasPresentes.has(d))
  if (dias.length === 0) dias.push('Lunes')

  const inicioMin = Math.min(...horario.map(c => hhmmToMin(c.hora_inicio)))
  const finMax = Math.max(...horario.map(c => hhmmToMin(c.hora_fin)))
  const slots: number[] = []
  for (let t = inicioMin; t < finMax; t += DURACION_BLOQUE) {
    slots.push(t)
  }
  if (slots.length === 0) slots.push(inicioMin)

  const courseColors = getCourseColors(horario)

  const placeCell: Record<string, ClaseConDia | null> = {}
  for (const d of dias) {
    for (const slot of slots) {
      const found = horario.find(c => {
        if (c.dia !== d) return false
        const ci = hhmmToMin(c.hora_inicio)
        const cf = hhmmToMin(c.hora_fin)
        return ci <= slot && slot < cf
      })
      const key = `${d}|${slot}`
      if (!placeCell[key]) placeCell[key] = found ?? null
    }
  }

  const skipSlots: Record<string, Set<number>> = {}
  for (const d of dias) skipSlots[d] = new Set()
  for (const c of horario) {
    const ci = hhmmToMin(c.hora_inicio)
    const cf = hhmmToMin(c.hora_fin)
    for (let t = ci + DURACION_BLOQUE; t < cf; t += DURACION_BLOQUE) {
      if (slots.includes(t)) skipSlots[c.dia].add(t)
    }
  }

  const headerStyle = `background:#1E293B;color:#FFFFFF;font-weight:bold;text-align:center;border:1px solid #475569;padding:6px;font-family:Arial,sans-serif;font-size:11pt;`
  const timeStyle = `background:#334155;color:#FFFFFF;font-weight:bold;text-align:center;border:1px solid #475569;padding:4px 8px;font-family:Arial,sans-serif;font-size:10pt;white-space:nowrap;`
  const emptyStyle = `background:#F8FAFC;border:1px solid #CBD5E1;`

  let table = '<table cellspacing="0" cellpadding="0" style="border-collapse:collapse;">'
  table += '<thead><tr>'
  table += `<th style="${headerStyle}">HORA</th>`
  for (const d of dias) {
    table += `<th style="${headerStyle}">${d.toUpperCase()}</th>`
  }
  table += '</tr></thead><tbody>'

  for (const slot of slots) {
    table += '<tr>'
    table += `<td style="${timeStyle}">${minToHhmm(slot)}</td>`
    for (const d of dias) {
      if (skipSlots[d].has(slot)) continue
      const key = `${d}|${slot}`
      const c = placeCell[key]
      if (!c) {
        table += `<td style="${emptyStyle}width:140px;height:60px;">&nbsp;</td>`
      } else {
        const color = getNrcColor(horario, c.nrc)
        const lugar = `${c.edificio ?? ''} ${c.salon ?? ''}`.trim()
        const lugarFinal = !lugar || ['n/a', 'na', '-', 's/i'].includes(lugar.toLowerCase()) ? '' : lugar
        const cellStyle = `background:${color};border:1px solid #1E293B;color:#1E293B;padding:6px;font-family:Arial,sans-serif;font-size:9pt;vertical-align:middle;text-align:center;width:140px;height:60px;`
        const titulo = escapeHtml(c.titulo)
        const seccion = escapeHtml(c.seccion ?? '')
        table += `<td style="${cellStyle}"><b style="font-size:10pt;">${titulo}</b><br><span style="font-size:8pt;">${c.tipo} ${seccion}</span><br><span style="font-size:8pt;">NRC ${c.nrc}</span><br><span style="font-size:9pt;font-weight:bold;">${c.hora_inicio}-${c.hora_fin}</span>${lugarFinal ? `<br><span style="font-size:7pt;">${escapeHtml(lugarFinal)}</span>` : ''}</td>`
      }
    }
    table += '</tr>'
  }
  table += '</tbody></table>'

  const cursosUnicos: Array<{ titulo: string; nrc: string; tipo: string; clases: ClaseConDia[] }> = []
  const visto = new Set<string>()
  for (const c of horario) {
    const key = `${c.titulo}|${c.nrc}|${c.tipo}`
    if (visto.has(key)) continue
    visto.add(key)
    const clases = horario.filter(h => h.titulo === c.titulo && h.nrc === c.nrc && h.tipo === c.tipo)
    cursosUnicos.push({ titulo: c.titulo, nrc: c.nrc, tipo: c.tipo, clases })
  }

  let legendTable = '<table cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-top:8px;">'
  legendTable += '<thead><tr>'
  legendTable += `<th style="${headerStyle}">Color</th>`
  legendTable += `<th style="${headerStyle}">Ramo</th>`
  legendTable += `<th style="${headerStyle}">Tipo</th>`
  legendTable += `<th style="${headerStyle}">NRC</th>`
  legendTable += `<th style="${headerStyle}">Días y horarios</th>`
  legendTable += '</tr></thead><tbody>'

  for (const item of cursosUnicos) {
    const color = getNrcColor(horario, item.nrc)
    const cellStyle = `background:${color};border:1px solid #1E293B;width:40px;height:30px;`
    const dataStyle = `border:1px solid #CBD5E1;padding:6px;font-family:Arial,sans-serif;font-size:10pt;`
    const ordenadas = [...item.clases].sort((a, b) => {
      const ordenDia = DIAS_FULL.indexOf(a.dia) - DIAS_FULL.indexOf(b.dia)
      return ordenDia !== 0 ? ordenDia : a.hora_inicio.localeCompare(b.hora_inicio)
    })
    const detalle = ordenadas.map(c => `${c.dia.substring(0, 3)} ${c.hora_inicio}-${c.hora_fin}`).join(' / ')
    legendTable += '<tr>'
    legendTable += `<td style="${cellStyle}">&nbsp;</td>`
    legendTable += `<td style="${dataStyle}"><b>${escapeHtml(item.titulo)}</b></td>`
    legendTable += `<td style="${dataStyle}text-align:center;">${escapeHtml(item.tipo)}</td>`
    legendTable += `<td style="${dataStyle}text-align:center;font-family:monospace;">${escapeHtml(item.nrc)}</td>`
    legendTable += `<td style="${dataStyle}">${escapeHtml(detalle)}</td>`
    legendTable += '</tr>'
  }
  legendTable += '</tbody></table>'

  const css = `
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #1E293B; font-size: 18pt; margin-bottom: 4px; }
    .subtitulo { color: #64748B; font-size: 10pt; margin-bottom: 16px; }
  `

  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="UTF-8">
<style>${css}</style>
</head>
<body>
<h1>Horario USS</h1>
<p class="subtitulo">Generado por UniHorario USS · ${new Date().toLocaleDateString('es-CL')}</p>
${table}
<h2 style="margin-top:24px;color:#1E293B;font-size:14pt;">Leyenda de Ramos</h2>
${legendTable}
</body>
</html>`
}

function generarExcelVacio(): string {
  return `<html><body><h1>Horario vacio</h1></body></html>`
}
