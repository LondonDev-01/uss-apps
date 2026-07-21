import { HorarioCrudo } from '../types'
import * as XLSX from 'xlsx'

// Detección de día: las columnas LUNES/MARTES/etc. contienen una letra.
// Estrategia robusta: detectar qué columna tiene valor y usar el nombre de la columna.
// Esto funciona independientemente de la convención de letras que use el portal USS.
// Letras conocidas (todas las soportadas): M/L=Lunes, T/M=Martes, W/X=Miércoles, R/J=Jueves, F/V=Viernes, S=Sábado
const DIA_COLUMNAS: { col: string; letras: string[]; label: string }[] = [
  { col: 'lunes', letras: ['M', 'L', 'X', '1', 'SI', 'SÍ', 'TRUE'], label: 'Lunes' },
  { col: 'martes', letras: ['T', 'M', 'X', '1', 'SI', 'SÍ', 'TRUE'], label: 'Martes' },
  { col: 'miercoles', letras: ['W', 'X', 'M', '1', 'SI', 'SÍ', 'TRUE'], label: 'Miércoles' },
  { col: 'jueves', letras: ['R', 'J', 'X', '1', 'SI', 'SÍ', 'TRUE'], label: 'Jueves' },
  { col: 'viernes', letras: ['F', 'V', 'X', '1', 'SI', 'SÍ', 'TRUE'], label: 'Viernes' },
  { col: 'sabado', letras: ['S', 'X', '1', 'SI', 'SÍ', 'TRUE'], label: 'Sábado' },
]

function parseTime(h: string): string {
  if (!h) return '00:00'
  const cleaned = h.toString().replace(':', '').trim()
  if (cleaned.length === 4 && /^\d+$/.test(cleaned)) return `${cleaned.slice(0, 2)}:${cleaned.slice(2)}`
  if (cleaned.length === 3 && /^\d+$/.test(cleaned)) return `0${cleaned[0]}:${cleaned.slice(1)}`
  return h
}

function timeToMin(hhmm: string): number {
  try {
    const [h, m] = hhmm.split(':').map(Number)
    return h * 60 + m
  } catch { return 0 }
}

function minToTime(m: number): string {
  const hh = Math.floor(m / 60)
  const mm = m % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

function addMinutes(hhmm: string, mins: number): string {
  return minToTime(timeToMin(hhmm) + mins)
}

// Duración por defecto de bloque USS: 80 minutos (TEO y LAB)
const DURACION_BLOQUE = 80

function detectDayFromRow(row: Record<string, unknown>): string | null {
  // Estrategia principal: la columna que tiene un valor (no vacía) indica el día
  // Esto es robusto porque funciona con cualquier convención de letras del portal
  for (const d of DIA_COLUMNAS) {
    const val = (row[d.col] || '').toString().trim().toUpperCase()
    if (val && val.length > 0 && val !== '0' && val !== 'NO' && val !== 'FALSE') {
      return d.label
    }
  }
  return null
}

function findColIdx(headers: string[], matches: string[]): number {
  for (const m of matches) {
    const i = headers.findIndex(h => h.toLowerCase().trim() === m.toLowerCase())
    if (i >= 0) return i
  }
  for (const m of matches) {
    const i = headers.findIndex(h => h.toLowerCase().trim().includes(m.toLowerCase()))
    if (i >= 0) return i
  }
  return -1
}

export function parseExcelToHorarioCrudo(data: unknown[][]): HorarioCrudo[] {
  if (!data || data.length < 2) return []
  
  const headers = (data[0] || []).map((h: unknown) => String(h).toLowerCase().trim())
  const rows = data.slice(1)
  
  const nrcIdx = findColIdx(headers, ['nrc'])
  const nombreIdx = findColIdx(headers, ['nombre'])
  const componenteIdx = findColIdx(headers, ['componente'])
  const seccionIdx = findColIdx(headers, ['seccion'])
  const ligaIdx = findColIdx(headers, ['liga'])
  const conectorIdx = findColIdx(headers, ['conector'])
  const nCursoIdx = findColIdx(headers, ['n_curso'])
  const hrInicioIdx = findColIdx(headers, ['hr_inicio', 'h_inicio'])
  const hrFinIdx = findColIdx(headers, ['hr_fin', 'h_fin'])
  const nombreProfIdx = findColIdx(headers, ['nombre_'])
  const apellidoProfIdx = findColIdx(headers, ['apellido'])
  
  // Construir mapa de día -> índice de columna
  const diaColMap: Record<string, number> = {}
  for (const d of DIA_COLUMNAS) {
    const i = findColIdx(headers, [d.col])
    if (i >= 0) diaColMap[d.col] = i
  }
  
  // Lista para detectar duplicados
  const seen = new Set<string>()
  const results: HorarioCrudo[] = []
  
  for (const rowRaw of rows) {
    if (!rowRaw || rowRaw.length < 3) continue
    const row = rowRaw as unknown[]
    
    const nrc = String(row[nrcIdx] || '').trim()
    const titulo = String(row[nombreIdx] || '').trim().toUpperCase()
    if (!nrc || !titulo) continue
    
    const tipoRaw = String(row[componenteIdx] || '').trim().toUpperCase()
    const tipo = tipoRaw.includes('TEO') ? 'TEO'
      : tipoRaw.includes('LAB') || tipoRaw.includes('TALLER') || tipoRaw === 'TAL' ? 'LAB'
      : tipoRaw || 'TEO'
    
    const seccion = String(row[seccionIdx] || '').trim()
    const liga = String(row[ligaIdx] || '').trim()
    const conector = String(row[conectorIdx] || '').trim()
    const nCurso = String(row[nCursoIdx] || '').trim()
    
    // Detectar día desde columnas LUNES/MARTES/etc.
    const rowObj: Record<string, unknown> = {}
    for (const d of DIA_COLUMNAS) {
      const i = diaColMap[d.col]
      if (i !== undefined) rowObj[d.col] = row[i]
    }
    const diaParseado = detectDayFromRow(rowObj)
    
    // Hora inicio
    const hIni = parseTime(String(row[hrInicioIdx] || ''))
    
    // Hora fin: usar si existe, sino calcular
    let hFin: string
    if (hrFinIdx >= 0 && row[hrFinIdx] && String(row[hrFinIdx]).trim()) {
      hFin = parseTime(String(row[hrFinIdx]))
    } else {
      hFin = addMinutes(hIni, DURACION_BLOQUE)
    }
    const horaStr = `${hIni} - ${hFin}`
    
    // Instructor
    const instructorParts = [
      String(row[nombreProfIdx] || '').trim(),
      String(row[apellidoProfIdx] || '').trim()
    ].filter(Boolean)
    const instructor = instructorParts.join(' ') || 'S/I'
    
    // Clave de deduplicación: NRC + TIPO + SECCION + HORA + DIA
    // CARRERA_RESERVA se ignora completamente
    const dedupKey = `${nrc}|${tipo}|${seccion}|${hIni}|${hFin}|${diaParseado || 'ND'}`
    if (seen.has(dedupKey)) continue
    seen.add(dedupKey)
    
    results.push({
      nrc,
      titulo,
      tipo,
      seccion,
      hora_str: horaStr,
      ubicacion: '',
      instructor,
      campus: 'USS',
      cupos_disponibles: 0,
      cupos_totales: 0,
      es_ligado: !!liga,
      fecha_inicio: '02-03-2026',
      fecha_fin: '11-07-2026',
      dia_parseado: diaParseado,
      prioridad: 0,
      liga,
      conector
    })
  }
  
  return results
}

export function parseExcelFile(file: File): Promise<HorarioCrudo[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const json = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
        const parsed = parseExcelToHorarioCrudo(json)
        resolve(parsed)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('Error leyendo archivo'))
    reader.readAsArrayBuffer(file)
  })
}