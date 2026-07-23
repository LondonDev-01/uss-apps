import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { HorarioCrudo, ClaseConDia, SeleccionUsuario, Preferencias, CriterioHorario, JsonStoreItem, Prioridad, ExcluidoInfo } from './types'

interface Store {
  // Raw data
  horariosCrudos: HorarioCrudo[]
  setHorariosCrudos: (h: HorarioCrudo[]) => void
  addHorariosCrudos: (h: HorarioCrudo[]) => void
  removeHorarioByNrc: (nrc: string) => void
  clearHorarios: () => void
  
  // User selections
  selecciones: Record<string, SeleccionUsuario>
  setSeleccion: (key: string, value: SeleccionUsuario | null) => void
  updateSeleccion: (key: string, value: SeleccionUsuario | null) => void
  setSelecciones: (s: Record<string, SeleccionUsuario>) => void
  
  // Optimized schedules
  mejoresHorarios: ClaseConDia[][]
  setMejoresHorarios: (m: ClaseConDia[][]) => void
  indiceHorario: number
  setIndiceHorario: (i: number) => void
  excluidosDetallados: ExcluidoInfo[]
  setExcluidosDetallados: (e: ExcluidoInfo[]) => void
  
  // JSON store
  jsonStore: Record<string, JsonStoreItem>
  setJsonStore: (j: Record<string, JsonStoreItem>) => void
  
  // Preferences
  preferencias: Preferencias
  setPreferencia: (k: keyof Preferencias, v: boolean) => void
  setPreferencias: (p: Preferencias) => void
  setCriterios: (c: CriterioHorario[]) => void
  
  // Manual mode
  modoManual: boolean
  setModoManual: (m: boolean) => void
  manualNrcs: string[]
  setManualNrcs: (n: string[]) => void

  // UI state
  activeTab: number
  setActiveTab: (i: number) => void
  
  // Toast
  toast: string | null
  showToast: (msg: string) => void
  clearToast: () => void
  
  // Reset
  resetAll: () => void
}

const PREF_INIT: Preferencias = {
  criterios: [],
  sin_sabados: false
}

const StoreContext = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [horariosCrudos, setHorariosCrudos] = useState<HorarioCrudo[]>([])
  const [selecciones, setSelecciones] = useState<Record<string, SeleccionUsuario>>({})
  const [mejoresHorarios, setMejoresHorarios] = useState<ClaseConDia[][]>([])
  const [indiceHorario, setIndiceHorario] = useState(0)
  const [excluidosDetallados, setExcluidosDetallados] = useState<ExcluidoInfo[]>([])
  const [jsonStore, setJsonStore] = useState<Record<string, JsonStoreItem>>({})
  const [preferencias, setPreferencias] = useState<Preferencias>(PREF_INIT)
  const [activeTab, setActiveTab] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const [modoManual, setModoManual] = useState(false)
  const [manualNrcs, setManualNrcs] = useState<string[]>([])

  const addHorariosCrudos = useCallback((nuevos: HorarioCrudo[]) => {
    setHorariosCrudos(prev => {
      const existing = new Set(prev.map(h => `${h.nrc}|${h.dia_parseado}|${h.hora_str}`))
      const unicos = nuevos.filter(h => !existing.has(`${h.nrc}|${h.dia_parseado}|${h.hora_str}`))
      return [...prev, ...unicos]
    })
  }, [])

  const removeHorarioByNrc = useCallback((nrc: string) => {
    setHorariosCrudos(prev => prev.filter(h => h.nrc !== nrc))
    setSelecciones(prev => {
      const next = { ...prev }
      Object.keys(next).filter(k => k.startsWith(`${nrc}_`)).forEach(k => delete next[k])
      return next
    })
  }, [])

  const clearHorarios = useCallback(() => {
    setHorariosCrudos([])
    setSelecciones({})
    setMejoresHorarios([])
    setIndiceHorario(0)
    setJsonStore({})
    setManualNrcs([])
  }, [])

  const setSeleccion = useCallback((key: string, value: SeleccionUsuario | null) => {
    setSelecciones(prev => {
      const next = { ...prev }
      if (value === null) delete next[key]
      else next[key] = value
      return next
    })
  }, [])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }, [])

  const clearToast = useCallback(() => setToast(null), [])

  const resetAll = useCallback(() => {
    setHorariosCrudos([])
    setSelecciones({})
    setMejoresHorarios([])
    setIndiceHorario(0)
    setExcluidosDetallados([])
    setJsonStore({})
    setPreferencias(PREF_INIT)
    setActiveTab(0)
    setModoManual(false)
    setManualNrcs([])
  }, [])

  return (
    <StoreContext.Provider value={{
      horariosCrudos, setHorariosCrudos, addHorariosCrudos, removeHorarioByNrc, clearHorarios,
      selecciones, setSeleccion, updateSeleccion: setSeleccion, setSelecciones,
      mejoresHorarios, setMejoresHorarios, indiceHorario, setIndiceHorario,
      excluidosDetallados, setExcluidosDetallados,
      jsonStore, setJsonStore,
      preferencias, setPreferencia: (k, v) => setPreferencias(p => ({ ...p, [k]: v })), setPreferencias,
      setCriterios: (c) => setPreferencias(p => ({ ...p, criterios: c })),
      modoManual, setModoManual, manualNrcs, setManualNrcs,
      activeTab, setActiveTab,
      toast, showToast, clearToast,
      resetAll
    }}>
      {children}
    </StoreContext.Provider>
  )
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}