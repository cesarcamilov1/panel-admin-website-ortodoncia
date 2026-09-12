import type { Tab } from '../../../shared/ui/molecules/TabBar'

export type RecordTabId =
  | 'resumen'
  | 'notas'
  | 'odontograma'
  | 'planes'
  | 'recetas'
  | 'pagos'
  | 'archivos'
  | 'consentimientos'
  | 'fiscales'

export const RECORD_TABS: Tab<RecordTabId>[] = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'notas', label: 'Notas clínicas' },
  { id: 'odontograma', label: 'Odontograma' },
  { id: 'planes', label: 'Planes' },
  { id: 'recetas', label: 'Recetas' },
  { id: 'pagos', label: 'Pagos' },
  { id: 'archivos', label: 'Archivos' },
  { id: 'consentimientos', label: 'Consentimientos' },
  { id: 'fiscales', label: 'Datos fiscales' },
]
