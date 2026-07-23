import { ClaseConDia } from '../types'
import { getNrcColor, normTipo } from './colors'
import * as XLSX from 'xlsx-js-style'

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

function toRgb(hex: string): string {
  return hex.replace('#', '').toUpperCase()
}

function cellStyle(
  fill?: string,
  fontColor?: string,
  fontBold?: boolean,
  fontSize?: number
): XLSX.CellStyle {
  const style: XLSX.CellStyle = {
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: {
      top: { color: { rgb: '475569' }, style: 'thin' },
      bottom: { color: { rgb: '475569' }, style: 'thin' },
      left: { color: { rgb: '475569' }, style: 'thin' },
      right: { color: { rgb: '475569' }, style: 'thin' }
    },
    font: {
      name: 'Arial',
      sz: fontSize ?? 9,
      color: { rgb: fontColor ?? '1E293B' },
      bold: fontBold ?? false
    }
  }
  if (fill) {
    style.fill = { fgColor: { rgb: toRgb(fill) }, patternType: 'solid' }
  }
  return style
}

export function generarExcelColoreado(horario: ClaseConDia[]): Uint8Array {
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

  // Encontrar qué clase va en cada celda del grid (slot x día)
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

  // Slots que deben saltarse porque están cubiertos por el rowspan de una clase anterior
  const skipSlots: Record<string, Set<number>> = {}
  for (const d of dias) skipSlots[d] = new Set()
  for (const c of horario) {
    const ci = hhmmToMin(c.hora_inicio)
    const cf = hhmmToMin(c.hora_fin)
    for (let t = ci + DURACION_BLOQUE; t < cf; t += DURACION_BLOQUE) {
      if (slots.includes(t)) skipSlots[c.dia].add(t)
    }
  }

  // Construir datos de la hoja de horario
  const data: (string | number)[][] = [['HORA', ...dias]]
  for (const slot of slots) {
    const row: (string | number)[] = [minToHhmm(slot)]
    for (const d of dias) {
      if (skipSlots[d].has(slot)) {
        row.push('')
        continue
      }
      const key = `${d}|${slot}`
      const c = placeCell[key]
      if (!c) {
        row.push('')
      } else {
        const lugar = `${c.edificio ?? ''} ${c.salon ?? ''}`.trim()
        const lugarFinal = !lugar || ['n/a', 'na', '-', 's/i'].includes(lugar.toLowerCase()) ? '' : lugar
        const lines = [
          c.titulo,
          `${c.tipo} ${c.seccion}`,
          `NRC ${c.nrc}`,
          `${c.hora_inicio}-${c.hora_fin}`
        ]
        if (lugarFinal) lines.push(lugarFinal)
        row.push(lines.join('\n'))
      }
    }
    data.push(row)
  }

  const ws = XLSX.utils.aoa_to_sheet(data)

  // Aplicar anchos de columna: primera (hora) angosta, días anchas
  ws['!cols'] = [{ wch: 10 }, ...dias.map(() => ({ wch: 28 }))]
  ws['!rows'] = [{ hpx: 30 }, ...slots.map(() => ({ hpx: 65 }))]

  // Calcular merges verticales para clases que ocupan varios slots
  const merges: XLSX.Range[] = []
  for (let di = 0; di < dias.length; di++) {
    let mergeStart = -1
    for (let si = 0; si < slots.length; si++) {
      const d = dias[di]
      const slot = slots[si]
      if (skipSlots[d].has(slot)) {
        if (mergeStart === -1) mergeStart = si - 1
      } else {
        if (mergeStart !== -1) {
          merges.push({
            s: { r: mergeStart + 1, c: di + 1 },
            e: { r: si, c: di + 1 }
          })
          mergeStart = -1
        }
      }
    }
    if (mergeStart !== -1) {
      merges.push({
        s: { r: mergeStart + 1, c: di + 1 },
        e: { r: slots.length, c: di + 1 }
      })
    }
  }
  if (merges.length > 0) ws['!merges'] = merges

  // Aplicar estilos celda por celda
  const headerStyle = cellStyle('1E293B', 'FFFFFF', true, 11)
  const timeStyle = cellStyle('334155', 'FFFFFF', true, 10)
  const emptyStyle = cellStyle('F8FAFC', '1E293B', false, 9)

  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1')
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c })
      if (!ws[addr]) ws[addr] = { v: '' }
      const cell = ws[addr]
      if (cell === undefined) continue

      if (r === 0) {
        cell.s = headerStyle
      } else if (c === 0) {
        cell.s = timeStyle
      } else {
        const dia = dias[c - 1]
        const slot = slots[r - 1]
        const key = `${dia}|${slot}`
        const clase = placeCell[key]
        if (clase) {
          const color = getNrcColor(horario, clase.nrc)
          cell.s = cellStyle(color, '1E293B', false, 9)
        } else if (skipSlots[dia]?.has(slot)) {
          // Celda dentro de un merge: no necesita estilo propio
        } else {
          cell.s = emptyStyle
        }
      }
    }
  }

  // Hoja de leyenda
  const cursosUnicos: Array<{ titulo: string; nrc: string; tipo: string; clases: ClaseConDia[] }> = []
  const visto = new Set<string>()
  for (const c of horario) {
    const key = `${c.titulo}|${c.nrc}|${c.tipo}`
    if (visto.has(key)) continue
    visto.add(key)
    const clases = horario.filter(h => h.titulo === c.titulo && h.nrc === c.nrc && h.tipo === c.tipo)
    cursosUnicos.push({ titulo: c.titulo, nrc: c.nrc, tipo: c.tipo, clases })
  }

  const legendData: (string | number)[][] = [['Color', 'Ramo', 'Tipo', 'NRC', 'Dias y horarios']]
  for (const item of cursosUnicos) {
    const ordenadas = [...item.clases].sort((a, b) => {
      const ordenDia = DIAS_FULL.indexOf(a.dia) - DIAS_FULL.indexOf(b.dia)
      return ordenDia !== 0 ? ordenDia : a.hora_inicio.localeCompare(b.hora_inicio)
    })
    const detalle = ordenadas.map(c => `${c.dia.substring(0, 3)} ${c.hora_inicio}-${c.hora_fin}`).join(' / ')
    legendData.push(['', item.titulo, item.tipo, item.nrc, detalle])
  }

  const wsLegend = XLSX.utils.aoa_to_sheet(legendData)
  wsLegend['!cols'] = [{ wch: 8 }, { wch: 35 }, { wch: 10 }, { wch: 15 }, { wch: 50 }]
  wsLegend['!rows'] = [{ hpx: 25 }, ...cursosUnicos.map(() => ({ hpx: 22 }))]

  const legendHeaderStyle = cellStyle('1E293B', 'FFFFFF', true, 11)
  const legendDataStyle = cellStyle(undefined, '1E293B', false, 10)
  const legendRange = XLSX.utils.decode_range(wsLegend['!ref'] ?? 'A1')
  for (let r = legendRange.s.r; r <= legendRange.e.r; r++) {
    for (let c = legendRange.s.c; c <= legendRange.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c })
      if (!wsLegend[addr]) wsLegend[addr] = { v: '' }
      const cell = wsLegend[addr]
      if (cell === undefined) continue

      if (r === 0) {
        cell.s = legendHeaderStyle
      } else {
        cell.s = legendDataStyle
        if (c === 0) {
          const item = cursosUnicos[r - 1]
          if (item) {
            const color = getNrcColor(horario, item.nrc)
            cell.s = cellStyle(color, '1E293B', false, 10)
          }
        }
      }
    }
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Horario')
  XLSX.utils.book_append_sheet(wb, wsLegend, 'Leyenda')

  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as Uint8Array
}

function generarExcelVacio(): Uint8Array {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([['No hay clases para exportar']])
  ws['!cols'] = [{ wch: 40 }]
  XLSX.utils.book_append_sheet(wb, ws, 'Horario')
  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as Uint8Array
}
