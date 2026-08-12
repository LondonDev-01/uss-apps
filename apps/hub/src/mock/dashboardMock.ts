// MOCK data for the Fase C dashboard visual pass (PLAN_V3 §7). None of this
// is wired to services/api — it exists only to validate the layout with the
// USS brand before the `malla`/`scheduler` endpoints that would back it
// (Fase D/E) exist. Replace this whole module with real API calls then.

export interface RamoCursando {
  codigo: string
  nombre: string
}

export interface DashboardMock {
  carreraProgreso: number // 0-100
  ramosAprobados: number
  ramosTotal: number
  ramosCursando: RamoCursando[]
  proximoPeriodo: string
}

export const MOCK_DASHBOARD: DashboardMock = {
  carreraProgreso: 62,
  ramosAprobados: 34,
  ramosTotal: 55,
  ramosCursando: [
    { codigo: 'INF-301', nombre: 'Base de Datos' },
    { codigo: 'INF-315', nombre: 'Ingeniería de Software' },
    { codigo: 'MAT-220', nombre: 'Probabilidad y Estadística' },
    { codigo: 'ELE-104', nombre: 'Electivo de Especialidad I' },
  ],
  proximoPeriodo: '2026-2',
}
