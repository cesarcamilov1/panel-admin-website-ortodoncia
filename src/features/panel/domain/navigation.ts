export type SectionId =
  | 'inicio'
  | 'agenda'
  | 'pacientes'
  | 'ficha'
  | 'ortodoncia'
  | 'recetas'
  | 'consentimientos'
  | 'pagos'
  | 'facturacion'
  | 'servicios'
  | 'horarios'
  | 'recordatorios'
  | 'resenas'
  | 'reportes'
  | 'cuenta'
  | 'ajustes'

export interface NavItem {
  id: Exclude<SectionId, 'ficha'>
  label: string
  count?: number
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Clínica',
    items: [
      { id: 'inicio', label: 'Inicio' },
      { id: 'agenda', label: 'Agenda', count: 14 },
      { id: 'pacientes', label: 'Pacientes' },
      { id: 'ortodoncia', label: 'Ortodoncia' },
    ],
  },
  {
    label: 'Expediente',
    items: [
      { id: 'recetas', label: 'Recetas' },
      { id: 'consentimientos', label: 'Consentimientos', count: 3 },
    ],
  },
  {
    label: 'Administración',
    items: [
      { id: 'pagos', label: 'Pagos y caja' },
      { id: 'facturacion', label: 'Facturación', count: 5 },
      { id: 'servicios', label: 'Servicios' },
      { id: 'horarios', label: 'Horarios' },
    ],
  },
  {
    label: 'Relación',
    items: [
      { id: 'recordatorios', label: 'Recordatorios' },
      { id: 'resenas', label: 'Reseñas' },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { id: 'reportes', label: 'Reportes' },
      { id: 'cuenta', label: 'Mi cuenta' },
      { id: 'ajustes', label: 'Ajustes' },
    ],
  },
]

export const SECTION_TITLES: Record<SectionId, string> = {
  inicio: 'Hoy en la clínica',
  agenda: 'Agenda',
  pacientes: 'Pacientes',
  ficha: 'Expediente del paciente',
  ortodoncia: 'Ortodoncia',
  recetas: 'Recetas',
  consentimientos: 'Consentimientos',
  pagos: 'Pagos y caja',
  facturacion: 'Facturación CFDI',
  servicios: 'Servicios y precios',
  horarios: 'Horarios y bloqueos',
  recordatorios: 'Recordatorios',
  resenas: 'Reseñas',
  reportes: 'Reportes',
  cuenta: 'Mi cuenta',
  ajustes: 'Ajustes de la clínica',
}

/** Pacientes stays lit while one of its records is open. */
export function isNavItemActive(itemId: NavItem['id'], current: SectionId): boolean {
  if (itemId === current) return true
  return itemId === 'pacientes' && current === 'ficha'
}

export function sectionPath(id: SectionId): string {
  return id === 'inicio' ? '/' : `/${id}`
}

export function sectionFromPath(pathname: string): SectionId {
  const [, head, tail] = pathname.split('/')
  if (!head) return 'inicio'
  if (head === 'pacientes') return tail ? 'ficha' : 'pacientes'
  const known = NAV_GROUPS.flatMap((group) => group.items).find((item) => item.id === head)
  return known ? known.id : 'inicio'
}
