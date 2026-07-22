import { HorarioCrudo, ClaseConDia, SeleccionUsuario, Preferencias, ResultadoOptimizacion, ExcluidoInfo } from '../types'

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
  const ventanas = calcularVentanas(clases)

  const ponderacion = (pos: number): number => {
    if (prefs.criterios.length === 0) return 1
    const pesoBase = prefs.criterios.length === 1 ? 3 : 1
    return prefs.criterios[pos] !== undefined ? pesoBase : 0
  }

  const criteriosSet = new Set(prefs.criterios)

  if (criteriosSet.has('entrar_tarde')) {
    if (inicio < 660) score += (inicio - 480) * ponderacion(prefs.criterios.indexOf('entrar_tarde'))
  }
  if (criteriosSet.has('salir_temprano')) {
    if (fin > 900) score -= (fin - 900) * 2 * ponderacion(prefs.criterios.indexOf('salir_temprano'))
  }
  if (criteriosSet.has('sin_ventanas')) {
    if (ventanas > 0) score -= ventanas * 3 * ponderacion(prefs.criterios.indexOf('sin_ventanas'))
  }
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
  if (up.includes('LAB') || up.includes('TALLER') || up === 'TAL' || up.includes('PRACT')) return 'LAB'
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
  topN = 10,
  preferencias: Preferencias
): ResultadoOptimizacion {
  const prioridadPorTitulo: Record<string, number> = {}
  for (const c of candidatos) {
    if (!(c.titulo in prioridadPorTitulo) || c.prioridad < prioridadPorTitulo[c.titulo]) {
      prioridadPorTitulo[c.titulo] = c.prioridad
    }
  }

  const blocksList: Record<string, ClaseConDia[]> = {}
  for (const c of candidatos) {
    if (c.prioridad === prioridadPorTitulo[c.titulo]) {
      const k = `${c.titulo}|${c.nrc}`
      ;(blocksList[k] ??= []).push(c)
    }
  }

  const ramosPorPrioridad: Record<number, Record<string, Record<string, ClaseConDia[][]>>> = {
    0: {}, 1: {}, 2: {}
  }
  for (const [, blocks] of Object.entries(blocksList)) {
    const p = blocks[0].prioridad as 0 | 1 | 2
    const titulo = blocks[0].titulo
    const porTipo: Record<string, ClaseConDia[]> = {}
    for (const b of blocks) {
      const tn = normTipo(b.tipo)
      ;(porTipo[tn] ??= []).push(b)
    }
    for (const [tn, tipoBlocks] of Object.entries(porTipo)) {
      ;(ramosPorPrioridad[p] ??= {})[titulo] ??= {}
      ;(ramosPorPrioridad[p][titulo][tn] ??= []).push(tipoBlocks)
    }
  }

  for (const [, porTitulo] of Object.entries(ramosPorPrioridad)) {
    for (const titulo of Object.keys(porTitulo)) {
      for (const tipo of Object.keys(porTitulo[titulo])) {
        const bloquesNrcs = porTitulo[titulo][tipo]
        if (bloquesNrcs.length <= 1) continue
        const seen = new Map<string, ClaseConDia[]>()
        for (const grupo of bloquesNrcs) {
          const sig = grupo.map(b => `${b.dia}|${b.hora_inicio}|${b.hora_fin}`).sort().join(';')
          if (!seen.has(sig)) seen.set(sig, grupo)
        }
        porTitulo[titulo][tipo] = [...seen.values()]
      }
    }
  }

  const [opts0, nombres0] = consolidarOpciones(ramosPorPrioridad[0] ?? {})
  const [opts1, nombres1] = consolidarOpciones(ramosPorPrioridad[1] ?? {})
  const [opts2, nombres2] = consolidarOpciones(ramosPorPrioridad[2] ?? {})

  if (ramosPorPrioridad[0] && Object.keys(ramosPorPrioridad[0]).length > 0) {
    const cursosP0 = Object.keys(ramosPorPrioridad[0])
    const cursosSinOpciones = cursosP0.filter(t => !nombres0.includes(t))
    if (cursosSinOpciones.length > 0) {
      const detalle = cursosSinOpciones.map(t => {
        const tieneTEO = !!ramosPorPrioridad[0][t].TEO
        const tieneLAB = !!ramosPorPrioridad[0][t].LAB
        return `• ${t}${tieneTEO && tieneLAB ? ' (sin combinación válida de TEO+LAB)' : ' (sin bloques asignados)'})`
      }).join('\n')
      return {
        horarios: [],
        mensaje: `Ramos prioritarios sin combinación válida:\n${detalle}\n\nQuítalo de Prioridad o cámbialo de NRC.`,
        excluidos: [],
        excluidosDetallados: []
      }
    }
  }

  const listaFinal: (OpcionRamo | [])[][] = []
  for (const o of opts0) listaFinal.push(o)
  for (const o of opts2) listaFinal.push([...o, []])
  for (const o of opts1) listaFinal.push([...o, []])

  let total = 1
  for (const op of listaFinal) total *= op.length
  const LIMITE = 100_000
  if (total > LIMITE) {
    return {
      horarios: [],
      mensaje: `Demasiadas combinaciones (${total.toLocaleString()}). Reduce ramos opcionales.`,
      excluidos: [],
      excluidosDetallados: []
    }
  }

  const titlesP0Set = new Set(nombres0)
  const titlesP1Set = new Set(nombres1)
  const titlesP2Set = new Set(nombres2)

  const validos: [number, ClaseConDia[]][] = []
  const conflictos: Record<string, number> = {}

  for (const combinacion of product(listaFinal)) {
    const plano: ClaseConDia[] = []
    for (const blocks of combinacion) {
      if (Array.isArray(blocks) && blocks.length > 0) plano.push(...blocks)
    }
    if (plano.length === 0) continue

    const titlesEnPlano = new Set(plano.map(c => c.titulo))
    let incluyeTodoP0 = true
    for (const t of titlesP0Set) {
      if (!titlesEnPlano.has(t)) { incluyeTodoP0 = false; break }
    }
    if (!incluyeTodoP0) {
      console.warn('[optimizer] combinación descartada, faltan P0:',
        [...titlesP0Set].filter(t => !titlesEnPlano.has(t)))
      continue
    }

    let mezclaNrcs = false
    const nrcsPorCursoYTipo: Record<string, Set<string>> = {}
    for (const c of plano) {
      const k = `${c.titulo}|${normTipo(c.tipo)}`
      if (!nrcsPorCursoYTipo[k]) nrcsPorCursoYTipo[k] = new Set()
      nrcsPorCursoYTipo[k].add(c.nrc)
      if (nrcsPorCursoYTipo[k].size > 1) { mezclaNrcs = true; break }
    }
    if (mezclaNrcs) continue

    const [valido, msg] = verificarConflictos(plano)
    if (valido) {
      const nNrcs = new Set(plano.map(c => c.nrc)).size
      const gap = calcTeoLabGap(plano)
      const nElectivos = plano.filter(c => c.prioridad === 2).length
      const titulosElectivos = new Set(plano.filter(c => c.prioridad === 2).map(c => c.titulo))
      const nTitulosElectivos = titulosElectivos.size
      const bonusElectivo = nTitulosElectivos * 2000
      const puntaje = calcularPuntaje(plano, preferencias) + (nNrcs * 500) - (gap / 5) + bonusElectivo
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
    return { horarios: [], mensaje: msg, excluidos: [], excluidosDetallados: [] }
  }

  validos.sort((a, b) => b[0] - a[0])

  const mejores: ClaseConDia[][] = []
  const vistosSignatures = new Set<string>()
  const vistosLayouts: Set<string>[] = []

  const contarElectivos = (h: ClaseConDia[]) => {
    const t = new Set(h.filter(c => c.prioridad === 2).map(c => c.titulo))
    return t.size
  }

  const layoutCore = (h: ClaseConDia[]) =>
    new Set(h.map(c => `${c.titulo}|${c.dia}|${c.hora_inicio}|${c.hora_fin}`))

  for (const [, h] of validos) {
    const signature = [...new Set(h.map(c => c.nrc))].sort().join('|')
    if (vistosSignatures.has(signature)) continue

    const coreActual = layoutCore(h)
    let similar = false
    for (const layoutPrevio of vistosLayouts) {
      let inter = 0
      for (const l of coreActual) if (layoutPrevio.has(l)) inter++
      if (inter > 0 && inter / coreActual.size > 0.90) { similar = true; break }
    }

    if (!similar) {
      vistosSignatures.add(signature)
      vistosLayouts.push(coreActual)
      mejores.push(h)
    }
    if (mejores.length >= topN) break
  }

  if (mejores.length < Math.min(topN, 3)) {
    for (const [, h] of validos) {
      const signature = [...new Set(h.map(c => c.nrc))].sort().join('|')
      if (!vistosSignatures.has(signature)) {
        vistosSignatures.add(signature)
        mejores.push(h)
      }
      if (mejores.length >= topN) break
    }
  }

  mejores.sort((a, b) => contarElectivos(b) - contarElectivos(a))

  const conElectivos = mejores.filter(h => contarElectivos(h) > 0)
  if (conElectivos.length > 0) {
    mejores.length = 0
    mejores.push(...conElectivos)
  }

  const electivosEnResultados = new Set<string>()
  for (const h of mejores) {
    for (const c of h) {
      if (c.prioridad === 2) electivosEnResultados.add(c.titulo)
    }
  }
  for (const titulo of nombres2) {
    if (electivosEnResultados.has(titulo)) continue
    const firmaFaltante = (h: ClaseConDia[]) => [...new Set(h.map(c => c.nrc))].sort().join('|')
    const firmasActuales = new Set(mejores.map(h => firmaFaltante(h)))
    const candidatoIdx = validos.findIndex(([, h]) => {
      if (!h.some(c => c.prioridad === 2 && c.titulo === titulo)) return false
      const f = firmaFaltante(h)
      if (firmasActuales.has(f)) return false
      const [valido] = verificarConflictos(h)
      return valido
    })
    if (candidatoIdx === -1) continue
    if (mejores.length === 0) {
      mejores.push(validos[candidatoIdx][1])
    } else {
      let peorIdx = 0
      for (let i = 1; i < mejores.length; i++) {
        if (contarElectivos(mejores[i]) < contarElectivos(mejores[peorIdx])) peorIdx = i
      }
      const peor = mejores[peorIdx]
      const electivosDelPeor = new Set(peor.filter(c => c.prioridad === 2).map(c => c.titulo))
      electivosDelPeor.delete(titulo)
      if (electivosDelPeor.size === 0) {
        mejores[peorIdx] = validos[candidatoIdx][1]
        firmasActuales.add(firmaFaltante(validos[candidatoIdx][1]))
      } else {
        mejores.push(validos[candidatoIdx][1])
        firmasActuales.add(firmaFaltante(validos[candidatoIdx][1]))
      }
    }
    electivosEnResultados.add(titulo)
    if (mejores.length > topN) mejores.length = topN
  }

  if (mejores.length === 0) {
    for (const [, h] of validos) {
      const signature = [...new Set(h.map(c => c.nrc))].sort().join('|')
      if (!vistosSignatures.has(signature)) {
        vistosSignatures.add(signature)
        mejores.push(h)
      }
      if (mejores.length >= topN) break
    }
  }

  // Red de seguridad: garantizar que ningún horario mostrado omita un P0.
  // Estructuralmente el loop de combinaciones ya lo asegura, pero el
  // post-procesamiento de electivos (diversidad/reemplazos) muta `mejores`,
  // así que forzamos la invariant de forma explícita por si fallara.
  const titulosP0Esperados = new Set(nombres0)
  if (titulosP0Esperados.size > 0 && mejores.length > 0) {
    for (let i = mejores.length - 1; i >= 0; i--) {
      const presentes = new Set(mejores[i].map(c => c.titulo))
      const faltantes = [...titulosP0Esperados].filter(t => !presentes.has(t))
      if (faltantes.length > 0) {
        console.warn('[optimizer] descartando horario final sin P0:', faltantes)
        mejores.splice(i, 1)
      }
    }
    if (mejores.length === 0) {
      return {
        horarios: [],
        mensaje: 'No se pudo generar ningún horario que incluya todos los ramos prioritarios (P0). Revisa que cada P0 tenga un NRC con día asignado y sin tope.',
        excluidos: [],
        excluidosDetallados: []
      }
    }
  }

  const titulosEnMejor = new Set<string>()
  for (const h of mejores) {
    for (const c of h) titulosEnMejor.add(c.titulo)
  }
  const excluidos: string[] = []
  for (const t of nombres1) if (!titulosEnMejor.has(t)) excluidos.push(t)
  for (const t of nombres2) if (!titulosEnMejor.has(t)) excluidos.push(t)

  const mejorHorario = mejores[0] ?? []
  const excluidosDetallados = calcularConflictosExcluidos(mejorHorario, candidatos, nombres1, nombres2)

  return {
    horarios: mejores,
    mensaje: `¡Éxito! ${validos.length} opciones encontradas (${mejores.length} diversas).`,
    excluidos,
    excluidosDetallados
  }
}

function calcularConflictosExcluidos(
  mejorHorario: ClaseConDia[],
  candidatos: ClaseConDia[],
  nombresP1: string[],
  nombresP2: string[]
): ExcluidoInfo[] {
  const titulosEnHorario = new Set(mejorHorario.map(c => c.titulo))
  const titulosExcluidos = new Set<string>()
  for (const t of nombresP1) if (!titulosEnHorario.has(t)) titulosExcluidos.add(t)
  for (const t of nombresP2) if (!titulosEnHorario.has(t)) titulosExcluidos.add(t)

  if (titulosExcluidos.size === 0) return []

  const bloquesExcluidos: Record<string, { dia: string; inicio: number; fin: number }[]> = {}
  for (const c of candidatos) {
    if (titulosExcluidos.has(c.titulo)) {
      (bloquesExcluidos[c.titulo] ??= []).push({
        dia: c.dia,
        inicio: c.minutos_inicio,
        fin: c.minutos_fin,
      })
    }
  }

  const resultado: ExcluidoInfo[] = []
  for (const titulo of titulosExcluidos) {
    const bloques = bloquesExcluidos[titulo] ?? []
    const conflictos: string[] = []

    for (const bloque of bloques) {
      for (const clase of mejorHorario) {
        if (clase.dia !== bloque.dia) continue
        if (clase.minutos_inicio < bloque.fin && clase.minutos_fin > bloque.inicio) {
          const mmToHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
          const msg = `${clase.titulo} (${clase.dia} ${mmToHHMM(clase.minutos_inicio)}-${mmToHHMM(clase.minutos_fin)})`
          if (!conflictos.includes(msg)) conflictos.push(msg)
        }
      }
    }

    if (conflictos.length === 0) {
      conflictos.push('Sin conflictos directos — no cupo en la mejor combinación')
    }

    resultado.push({ titulo, conflictos })
  }

  return resultado
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

export function cumplePreferencias(horario: ClaseConDia[], prefs: Preferencias): boolean {
  if (prefs.criterios.length === 0 && !prefs.sin_sabados) return true
  const porDia: Record<string, ClaseConDia[]> = {}
  for (const c of horario) (porDia[c.dia] ??= []).push(c)
  for (const [dia, clases] of Object.entries(porDia)) {
    if (dia === 'Sábado' && prefs.sin_sabados) return false
    const ordenadas = [...clases].sort((a, b) => a.minutos_inicio - b.minutos_inicio)
    const inicio = ordenadas[0].minutos_inicio
    const fin = ordenadas[ordenadas.length - 1].minutos_fin
    if (prefs.criterios.includes('entrar_tarde') && inicio < 660) return false
    if (prefs.criterios.includes('salir_temprano') && fin > 900) return false
    if (prefs.criterios.includes('sin_ventanas')) {
      for (let i = 0; i < ordenadas.length - 1; i++) {
        const gap = ordenadas[i + 1].minutos_inicio - ordenadas[i].minutos_fin
        if (gap > 20) return false
      }
    }
  }
  return true
}