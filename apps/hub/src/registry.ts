// Static registry of apps shown as cards on the dashboard. Adding an app
// here is step 5 of PLAN_V3 §3.3 ("Registrar la app en el menú del hub").

export interface AppRegistryEntry {
  id: string
  name: string
  description: string
  icon: string
  url: string
}

export const APPS: AppRegistryEntry[] = [
  {
    id: 'horarios',
    name: 'UniHorario',
    description: 'Optimizador inteligente de horarios de ramos.',
    icon: '🗓️',
    url: 'http://localhost:3000',
  },
  {
    id: 'malla',
    name: 'Malla Curricular',
    description: 'Malla interactiva con prioridad de ramos por período.',
    icon: '🎓',
    url: 'http://localhost:3003',
  },
]
