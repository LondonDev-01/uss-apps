import { ClaseConDia } from '../types'

export const PALETA_RAMOS = [
  '#BFDBFE', '#BBF7D0', '#FEF3C7', '#FECACA', '#DDD6FE',
  '#F5D0FE', '#FED7AA', '#E9D5FF', '#A5F3FC', '#FDE68A',
  '#FBCFE8', '#C7D2FE', '#D9F99D', '#FCA5A5', '#A7F3D0'
]

export function hexToRgb(hex: string): [number, number, number] {
  const s = hex.replace('#', '')
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)]
}

export function rgbToHex(r: number, g: number, b: number): string {
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

export function adjustBrightness(hex: string, factor: number): string {
  const [r, g, b] = hexToRgb(hex)
  return rgbToHex(
    Math.max(0, Math.min(255, Math.floor(r * factor))),
    Math.max(0, Math.min(255, Math.floor(g * factor))),
    Math.max(0, Math.min(255, Math.floor(b * factor)))
  )
}

export function normTipo(tipo: string): 'TEO' | 'LAB' | 'OTRO' {
  const up = (tipo || '').toUpperCase()
  if (up.includes('TEOR') || up.includes('TEO')) return 'TEO'
  if (up.includes('LAB') || up.includes('TALLER') || up === 'TAL' || up.includes('PRACT')) return 'LAB'
  return 'OTRO'
}

export interface ColorInfo {
  base: string
  teo: string
  lab: string
}

export function getCourseColors(horario: ClaseConDia[]): Record<string, ColorInfo> {
  const courseBase: Record<string, string> = {}
  for (const h of horario) {
    if (!(h.titulo in courseBase)) {
      courseBase[h.titulo] = PALETA_RAMOS[Object.keys(courseBase).length % PALETA_RAMOS.length]
    }
  }
  const result: Record<string, ColorInfo> = {}
  for (const [titulo, base] of Object.entries(courseBase)) {
    result[titulo] = {
      base,
      teo: adjustBrightness(base, 1.15),
      lab: adjustBrightness(base, 0.78)
    }
  }
  return result
}

export function getNrcColor(horario: ClaseConDia[], nrc: string): string {
  for (const h of horario) {
    if (h.nrc === nrc) {
      const courseColors = getCourseColors(horario)
      const c = courseColors[h.titulo]
      if (!c) return '#CBD5E1'
      const t = normTipo(h.tipo)
      if (t === 'TEO') return c.teo
      if (t === 'LAB') return c.lab
      return c.base
    }
  }
  return '#CBD5E1'
}

export function getNrcColors(horario: ClaseConDia[]): Record<string, string> {
  const result: Record<string, string> = {}
  for (const h of horario) {
    if (!(h.nrc in result)) {
      result[h.nrc] = getNrcColor(horario, h.nrc)
    }
  }
  return result
}
