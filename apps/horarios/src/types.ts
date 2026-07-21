export interface HorarioCrudo {
  nrc: string
  titulo: string
  tipo: string
  seccion: string
  hora_str: string
  ubicacion: string
  instructor: string
  campus: string
  cupos_disponibles: number
  cupos_totales: number
  es_ligado: boolean
  fecha_inicio: string
  fecha_fin: string
  dia_parseado: string | null
  prioridad: number
  liga: string
  conector: string
}

export interface ClaseConDia {
  nrc: string
  titulo: string
  tipo: string
  seccion: string
  dia: string
  hora_inicio: string
  hora_fin: string
  minutos_inicio: number
  minutos_fin: number
  edificio: string
  salon: string
  instructor: string
  fecha_inicio: string
  fecha_fin: string
  prioridad: number
  liga: string
  conector: string
}

export interface SeleccionUsuario {
  dia: string
  horario: HorarioCrudo
  nrc_original: string
}

export interface Preferencias {
  entrar_tarde: boolean
  salir_temprano: boolean
  sin_ventanas: boolean
  sin_sabados: boolean
}

export interface JsonStoreItem {
  curso: string
  secciones: {
    nrc: string
    tipo: string
    seccion: string
    dia: string
    hora: string
    lugar: string
  }[]
}

export type Prioridad = 0 | 1 | 2

export const PRIORIDAD_LABELS: Record<Prioridad, string> = {
  0: 'Prioridad',
  1: 'Opcionales',
  2: 'Electivos'
}

export const PRIORIDAD_COLORS: Record<Prioridad, { bg: string; border: string; text: string }> = {
  0: { bg: 'var(--color-cat-0-light)', border: 'var(--color-cat-0)', text: 'var(--color-cat-0)' },
  1: { bg: 'var(--color-cat-1-light)', border: 'var(--color-cat-1)', text: 'var(--color-cat-1)' },
  2: { bg: 'var(--color-cat-2-light)', border: 'var(--color-cat-2)', text: 'var(--color-cat-2)' },
}

export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']