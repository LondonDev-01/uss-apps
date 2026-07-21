import { HorarioCrudo } from '../types'

const MAPPING_EN: Record<string, string> = { M: 'Lunes', T: 'Martes', W: 'Miércoles', R: 'Jueves', F: 'Viernes', S: 'Sábado', U: 'Domingo' }
const MAPPING_ES: Record<string, string> = { L: 'Lunes', M: 'Martes', X: 'Miércoles', W: 'Miércoles', J: 'Jueves', V: 'Viernes', S: 'Sábado', D: 'Domingo' }

const PATRON_TABULAR = /(\d{4,6})\t([^\t]+)\t([^\t]+)\t([^\t]+)\t([^\t]+)\t([^\t]+)\t([^\t]*)\t([^\t]*)\t(\d+)\t(?:(\d{2}-\d{2}-\d{4})\t(\d{2}-\d{2}-\d{4})\t)?([^\t]+)\t(\d{2,4})\t(\d{2,4})/

const MESES: Record<string, number> = {
  Ene: 1, Feb: 2, Mar: 3, Abr: 4, May: 5, Jun: 6,
  Jul: 7, Ago: 8, Sep: 9, Oct: 10, Nov: 11, Dic: 12,
  Jan: 1
}

export function calcularDiaDeFecha(fechaStr: string): string {
  const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
  try {
    const p = fechaStr.split('-')
    if (p.length < 3) return 'Lunes'
    const mStrRaw = p[1].slice(0, 3)
    const mStr = mStrRaw.charAt(0).toUpperCase() + mStrRaw.slice(1).toLowerCase()
    const mNum = MESES[mStr] ?? 3
    const d = new Date(parseInt(p[2]), mNum - 1, parseInt(p[0]))
    return DIAS[d.getDay()]
  } catch {
    return 'Lunes'
  }
}

function fmtH(h: string): string {
  h = h.replace(':', '').trim()
  if (h.length === 4) return `${h.slice(0, 2)}:${h.slice(2)}`
  if (h.length === 3) return `0${h[0]}:${h.slice(1)}`
  return h
}

function normHora(h: unknown): string {
  if (!h) return '00:00 - 00:00'
  let s: string
  if (typeof h === 'number') s = String(h)
  else s = String(h).trim()
  if (s.includes(' - ')) {
    const parts = s.split(' - ')
    const fmt = (p: string) => {
      p = p.split('.')[0]
      if (p.includes(':')) return p.slice(0, 5)
      if (p.length === 4 && /^\d+$/.test(p)) return `${p.slice(0, 2)}:${p.slice(2)}`
      return p
    }
    return `${fmt(parts[0])} - ${fmt(parts[1])}`
  }
  let p = s.split('.')[0]
  let hh = 0, mm = 0
  if (p.includes(':')) {
    const segs = p.split(':')
    hh = parseInt(segs[0])
    mm = segs.length > 1 ? parseInt(segs[1]) : 0
  } else if ((p.length === 3 || p.length === 4) && /^\d+$/.test(p)) {
    if (p.length === 3) { hh = parseInt(p[0]); mm = parseInt(p.slice(1)) }
    else { hh = parseInt(p.slice(0, 2)); mm = parseInt(p.slice(2)) }
  } else {
    return '00:00 - 00:00'
  }
  const startMin = hh * 60 + mm
  const endMin = startMin + 80
  const endH = Math.floor(endMin / 60)
  const endM = endMin % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} - ${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
}

function parsearJson(texto: string, prioridad: number): HorarioCrudo[] {
  const data = JSON.parse(texto)
  const items = Array.isArray(data) ? data : [data]
  const res: HorarioCrudo[] = []

  for (const item of items) {
    const tituloBase = (item.titulo || item.curso || 'Sin Título').toString().toUpperCase()
    const secciones = item.secciones

    if (Array.isArray(secciones)) {
      for (const sec of secciones) {
        const diaJson = sec.dia ? sec.dia.toString().trim() : calcularDiaDeFecha(sec.fecha_inicio || '02-03-2026')
        const horaNorm = normHora(sec.hora)
        const nrcVal = (sec.nrc || sec.seccion || '').toString().trim().toUpperCase()
        const seccionVal = (sec.seccion || 'T01').toString().trim().toUpperCase()
        res.push({
          nrc: nrcVal || seccionVal,
          titulo: tituloBase,
          tipo: (sec.tipo || 'TEO').toString().toUpperCase(),
          seccion: seccionVal,
          hora_str: horaNorm,
          ubicacion: sec.lugar || 'S/I',
          instructor: sec.instructor || 'S/I',
          campus: 'Principal',
          cupos_disponibles: 0,
          cupos_totales: 0,
          es_ligado: false,
          fecha_inicio: sec.fecha_inicio || '02-03-2026',
          fecha_fin: sec.fecha_fin || '11-07-2026',
          dia_parseado: diaJson,
          prioridad,
          liga: '',
          conector: ''
        })
      }
    } else {
      const diaJson = item.dia ? item.dia.toString().trim() : calcularDiaDeFecha(item.fecha_inicio || '02-03-2026')
      const horaNorm = normHora(item.hora)
      const nrcVal = (item.nrc || item.seccion || '').toString().trim().toUpperCase()
      const seccionVal = (item.seccion || 'T01').toString().trim().toUpperCase()
      res.push({
        nrc: nrcVal || seccionVal,
        titulo: tituloBase,
        tipo: (item.tipo || 'TEO').toString().toUpperCase(),
        seccion: seccionVal,
        hora_str: horaNorm,
        ubicacion: item.lugar || 'S/I',
        instructor: item.instructor || 'S/I',
        campus: 'Principal',
        cupos_disponibles: 0,
        cupos_totales: 0,
        es_ligado: false,
        fecha_inicio: item.fecha_inicio || '02-03-2026',
        fecha_fin: item.fecha_fin || '11-07-2026',
        dia_parseado: diaJson,
        prioridad,
        liga: '',
        conector: ''
      })
    }
  }
  return res
}

function parsearTabular(texto: string, prioridad: number): HorarioCrudo[] {
  const resultados: HorarioCrudo[] = []
  const texto2 = texto.replace(/\r/g, '')
  const esIngles = /\t[RTFS]\t/.test(texto2)
  const mapping = esIngles ? MAPPING_EN : MAPPING_ES

  const regex = new RegExp(PATRON_TABULAR.source, 'g')
  let m: RegExpExecArray | null
  while ((m = regex.exec(texto2)) !== null) {
    const [, nrc, , , sec, tipo, nombre, liga, conec, vac, fIni, fFin, sala, hIni, hFin] = m

    const posFin = m.index + m[0].length
    const fragmento = texto2.slice(posFin, posFin + 250).split('\t')
    let diaDetectado: string | null = null
    for (const seg of fragmento.slice(0, 15)) {
      const s = seg.trim().toUpperCase()
      if (s in mapping) { diaDetectado = mapping[s]; break }
    }
    if (!diaDetectado) diaDetectado = calcularDiaDeFecha(fIni || '02-03-2026')

    resultados.push({
      nrc,
      titulo: nombre.split(/\s+/).join(' ').toUpperCase(),
      tipo: tipo.trim().toUpperCase(),
      seccion: sec.trim(),
      hora_str: `${fmtH(hIni)} - ${fmtH(hFin)}`,
      ubicacion: sala.trim(),
      instructor: 'S/I',
      campus: 'Sede Principal',
      cupos_disponibles: vac && /^\d+$/.test(vac) ? parseInt(vac) : 0,
      cupos_totales: vac && /^\d+$/.test(vac) ? parseInt(vac) : 0,
      es_ligado: liga.trim().length > 0,
      fecha_inicio: fIni || '02-03-2026',
      fecha_fin: fFin || '11-07-2026',
      dia_parseado: diaDetectado,
      prioridad,
      liga: liga.trim(),
      conector: conec.trim()
    })
  }
  return resultados
}

export function parsearTextoPorPrioridad(texto: string, prioridad: number, modo: 'Auto' | 'JSON' | 'Tabular' = 'Auto'): HorarioCrudo[] {
  texto = texto.trim()
  if (!texto) return []

  if (modo === 'JSON' || (modo === 'Auto' && (texto.startsWith('[') || texto.startsWith('{')))) {
    try {
      const res = parsearJson(texto, prioridad)
      if (res.length > 0) return res
    } catch { /* fallback */ }
  }

  if (modo === 'Tabular' || modo === 'Auto') {
    const resultados = parsearTabular(texto, prioridad)
    if (resultados.length > 0) return resultados
  }

  return []
}

export function agruparPorNrc(horarios: HorarioCrudo[]): Record<string, HorarioCrudo[]> {
  const agrupados: Record<string, HorarioCrudo[]> = {}
  for (const h of horarios) {
    if (!agrupados[h.nrc]) agrupados[h.nrc] = []
    agrupados[h.nrc].push(h)
  }
  return agrupados
}
