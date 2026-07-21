import { HorarioCrudo, ClaseConDia, SeleccionUsuario, Preferencias } from '../types'

function horaAMinutos(hora: string): number {
  try {
    const [h, m] = hora.split(':').map(Number)
    return h * 60 + m
  } catch { return 0 }
}

function toClaseConDia(info: SeleccionUsuario, prioridad: number): ClaseConDia {
  const h = info.horario
  const [hIni, hFin] = h.hora_str.split(' - ')
  const mIni = horaAMinutos(hIni)
  const mFin = horaAMinutos(hFin)
  const ubicacion = h.ubicacion.replace(/Edificio:/g, '').replace(/Salón:/g, '').trim()
  const partes = ubicacion.split(/\s+/)
  const edificio = partes[0] ?? 'N/A'
  const salon = partes[1] ?? 'N/A'
  return {
    nrc: h.nrc,
    titulo: h.titulo,
    tipo: h.tipo,
    seccion: h.seccion,
    dia: info.dia,
    hora_inicio: hIni,
    hora_fin: hFin,
    minutos_inicio: mIni,
    minutos_fin: mFin,
    edificio,
    salon,
    instructor: h.instructor,
    fecha_inicio: h.fecha_inicio,
    fecha_fin: h.fecha_fin,
    prioridad,
    liga: h.liga,
    conector: h.conector
  }
}

function* product<T>(arrays: T[][]): Generator<T[]> {
  if (arrays.length === 0) { yield []; return }
  const [first, ...rest] = arrays
  for (const item of first) {
    for (const tail of product(rest)) yield [item, ...tail]
  }
}

function verificarConflictos(horario: ClaseConDia[]): [boolean, string] {
  const ordenadas = [...horario].sort((a, b) => {
    if (a.dia !== b.dia) return a.dia.localeCompare(b.dia)
    return a.minutos_inicio - b.minutos_inicio
  })
  for (let i = 0; i < ordenadas.length - 1; i++) {
    const c1 = ordenadas[i], c2 = ordenadas[i + 1]
    if (c1.dia === c2.dia && c2.minutos_inicio < c1.minutos_fin) {
      return [false, `'${c1.titulo}' y '${c2.titulo}' chocan el ${c1.dia} (${c1.hora_inicio}-${c1.hora_fin})`]
    }
  }
  return [true, '']
}

function calcularVentanas(clases: ClaseConDia[]): number {
  let v = 0
  for (let i = 0; i < clases.length - 1; i++) {
    const gap = clases[i + 1].minutos_inicio - clases[i].minutos_fin
    if (gap > 20) v += gap
  }
  return v
}

function evaluarDia(clases: ClaseConDia[], prefs: Preferencias): number {
  let score = 0
  const inicio = clases[0].minutos_inicio
  const fin = clases[clases.length - 1].minutos_fin

  if (prefs.entrar_tarde && inicio < 660) score += (inicio - 480)
  if (prefs.salir_temprano && fin > 900) score -= (fin - 900) * 2
  if (prefs.sin_ventanas) score -= calcularVentanas(clases) * 3
  return score
}

function calcTeoLabGap(horario: ClaseConDia[]): number {
  const porTitulo: Record<string, ClaseConDia[]> = {}
  for (const c of horario) (porTitulo[c.titulo] ??= []).push(c)
  let totalGap = 0
  for (const clases of Object.values(porTitulo)) {
    let teoMid: number | null = null
    let labMid: number | null = null
    for (const cl of clases) {
      const mid = Math.floor((cl.minutos_inicio + cl.minutos_fin) / 2)
      const up = (cl.tipo || '').toUpperCase()
      if (up.includes('TEOR') || up.includes('TEO')) teoMid = mid
      else if (up.includes('LAB') || up.includes('TALLER') || up.includes('PRACT')) {
        if (labMid === null) labMid = mid
        else if (teoMid !== null && Math.abs(mid - teoMid) < Math.abs(labMid - teoMid)) labMid = mid
      }
    }
    if (teoMid !== null && labMid !== null) totalGap += Math.abs(teoMid - labMid)
  }
  return totalGap
}

function normTipo(tipo: string): 'TEO' | 'LAB' | 'OTRO' {
  const up = (tipo || '').toUpperCase()
  if (up.includes('TEOR') || up.includes('TEO')) return 'TEO'
  if (up.includes('LAB') || up.includes('TALLER') || up.includes('PRACT')) return 'LAB'
  return 'OTRO'
}

type OpcionRamo = ClaseConDia[]

function consolidarOpciones(
  agrupacion: Record<string, Record<string, ClaseConDia[][]>>
): [OpcionRamo[][], string[]] {
  const opciones: OpcionRamo[][] = []
  const nombres: string[] = []
  
  for (const [titulo, tipos] of Object.entries(agrupacion)) {
    const opts: OpcionRamo[] = []
    
    if (tipos.TEO && tipos.LAB) {
      for (const teoBlocks of tipos.TEO) {
        const tBase = teoBlocks[0]
        for (const labBlocks of tipos.LAB) {
          const lBase = labBlocks[0]
          const tLiga = tBase.liga?.trim() ?? ''
          const tConn = tBase.conector?.trim() ?? ''
          const lLiga = lBase.liga?.trim() ?? ''
          const lConn = lBase.conector?.trim() ?? ''
          
          let match = false
          if (!tLiga && !tConn && !lLiga && !lConn) match = true
          else if (tLiga === lConn && lLiga === tConn) match = true
          
          const combo = [...teoBlocks, ...labBlocks]
          const [valido] = verificarConflictos(combo)
          if (valido) opts.push(combo)
        }
      }
    }
    
    if (opts.length === 0) {
      if (!(tipos.TEO && tipos.LAB)) {
        for (const tKey of ['TEO', 'LAB', 'OTRO'] as const) {
          if (tipos[tKey]) for (const blocks of tipos[tKey]) opts.push(blocks)
        }
      }
    }
    
    if (opts.length > 0) {
      opciones.push(opts)
      nombres.push(titulo)
    }
  }
  return [opciones, nombres]
}

export function procesarSeleccionesUsuario(
  selecciones: Record<string, SeleccionUsuario>,
  prioridadesPorNrc: Record<string, number>
): ClaseConDia[] {
  const candidatos: ClaseConDia[] = []
  for (const [, info] of Object.entries(selecciones)) {
    const prioridad = prioridadesPorNrc[info.horario.nrc] ?? info.horario.prioridad
    candidatos.push(toClaseConDia(info, prioridad))
  }
  return candidatos
}

export function generarTopHorarios(
  candidatos: ClaseConDia[],
  topN = 20,
  preferencias: Preferencias
): [ClaseConDia[][], string] {
  // Dedup by title - keep highest priority (lowest number)
  const prioridadPorTitulo: Record<string, number> = {}
  for (const c of candidatos) {
    if (!(c.titulo in prioridadPorTitulo) || c.prioridad < prioridadPorTitulo[c.titulo]) {
      prioridadPorTitulo[c.titulo] = c.prioridad
    }
  }

  // Group by (title, nrc)
  const blocksList: Record<string, ClaseConDia[]> = {}
  for (const c of candidatos) {
    if (c.prioridad === prioridadPorTitulo[c.titulo]) {
      const k = `${c.titulo}|${c.nrc}`
      ;(blocksList[k] ??= []).push(c)
    }
  }

  // Group by priority and type
  const ramosPorPrioridad: Record<number, Record<string, Record<string, ClaseConDia[][]>>> = {
    0: {}, 1: {}, 2: {}
  }
  for (const [, blocks] of Object.entries(blocksList)) {
    const base = blocks[0]
    const tipoNorm = normTipo(base.tipo)
    const p = base.prioridad as 0 | 1 | 2
    ;(ramosPorPrioridad[p] ??= {})[base.titulo] ??= {}
    ;(ramosPorPrioridad[p][base.titulo][tipoNorm] ??= []).push(blocks)
  }

  const [opts0] = consolidarOpciones(ramosPorPrioridad[0] ?? {})
  const [opts1] = consolidarOpciones(ramosPorPrioridad[1] ?? {})
  const [opts2] = consolidarOpciones(ramosPorPrioridad[2] ?? {})

  const todasOptsElectivos: OpcionRamo[] = []
  for (const o of opts2) todasOptsElectivos.push(...o)

  const listaFinal: (OpcionRamo | [])[][] = []
  for (const o of opts0) listaFinal.push(o)
  if (todasOptsElectivos.length > 0) listaFinal.push(todasOptsElectivos)
  for (const o of opts1) listaFinal.push([...o, []])

  let total = 1
  for (const op of listaFinal) total *= op.length
  const LIMITE = 5_000_000
  if (total > LIMITE) return [[], `Demasiadas combinaciones (${total.toLocaleString()}). Reduce ramos opcionales.`]

  const validos: [number, ClaseConDia[]][] = []
  const conflictos: Record<string, number> = {}

  for (const combinacion of product(listaFinal)) {
    const plano: ClaseConDia[] = []
    for (const blocks of combinacion) {
      if (Array.isArray(blocks) && blocks.length > 0) plano.push(...blocks)
    }
    if (plano.length === 0) continue

    const [valido, msg] = verificarConflictos(plano)
    if (valido) {
      const nNrcs = new Set(plano.map(c => c.nrc)).size
      const gap = calcTeoLabGap(plano)
      const puntaje = calcularPuntaje(plano, preferencias) + (nNrcs * 500) - (gap / 5)
      validos.push([puntaje, plano])
    } else {
      conflictos[msg] = (conflictos[msg] ?? 0) + 1
    }
  }

  if (validos.length === 0) {
    let msg = 'No se encontró ningún horario válido (sin topes) con los ramos prioritarios.'
    if (Object.keys(conflictos).length > 0) {
      const tops = Object.entries(conflictos).sort((a, b) => b[1] - a[1]).slice(0, 3)
      msg += '\n\nConflictos más frecuentes:\n' + tops.map(([c, n]) => `• ${c} (${n})`).join('\n')
    }
    return [[], msg]
  }

  validos.sort((a, b) => b[0] - a[0])

  const mejores: ClaseConDia[][] = []
  const vistosSignatures = new Set<string>()
  const vistosLayouts: Set<string>[] = []

  for (const [, h] of validos) {
    const signature = [...new Set(h.map(c => c.nrc))].sort().join('|')
    if (vistosSignatures.has(signature)) continue

    const layoutActual = new Set(h.map(c => `${c.dia}|${c.hora_inicio}|${c.hora_fin}`))
    let similar = false
    for (const layoutPrevio of vistosLayouts) {
      let inter = 0
      for (const l of layoutActual) if (layoutPrevio.has(l)) inter++
      if (inter / layoutActual.size > 0.90) { similar = true; break }
    }

    if (!similar) {
      vistosSignatures.add(signature)
      vistosLayouts.push(layoutActual)
      mejores.push(h)
    }
    if (mejores.length >= topN) break
  }

  if (mejores.length < Math.min(topN, 5)) {
    for (const [, h] of validos) {
      const signature = [...new Set(h.map(c => c.nrc))].sort().join('|')
      if (!vistosSignatures.has(signature)) {
        vistosSignatures.add(signature)
        mejores.push(h)
      }
      if (mejores.length >= topN) break
    }
  }

  return [mejores, `¡Éxito! ${validos.length} opciones encontradas (${mejores.length} diversas).`]
}

function calcularPuntaje(horario: ClaseConDia[], prefs: Preferencias): number {
  let total = 0
  const porDia: Record<string, ClaseConDia[]> = {}
  for (const c of horario) (porDia[c.dia] ??= []).push(c)

  for (const [dia, clases] of Object.entries(porDia)) {
    if (dia === 'Sábado' && prefs.sin_sabados) total -= 10000
    const ordenadas = [...clases].sort((a, b) => a.minutos_inicio - b.minutos_inicio)
    total += evaluarDia(ordenadas, prefs)
  }

  const seccionesTeo = horario.filter(c => normTipo(c.tipo) === 'TEO').map(c => c.seccion)
  if (seccionesTeo.length > 0) {
    const conteo: Record<string, number> = {}
    for (const s of seccionesTeo) conteo[s] = (conteo[s] ?? 0) + 1
    const maxFreq = Math.max(...Object.values(conteo))
    total += maxFreq * 150
  }

  return Math.floor(total)
}

export { verificarConflictos, calcularPuntaje }