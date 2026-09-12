import type { Tone } from '../../../shared/ui/atoms/Badge'

export interface PatientTag {
  label: string
  tone: Tone
}

export interface PatientSummary {
  record: string
  name: string
  meta: string
  phone: string
  lastVisit: string
  nextVisit: string
  balance: string
  overdue: boolean
  tags: PatientTag[]
}

export const PATIENT_FILTERS = ['Todos', 'Con saldo', 'Sin próxima cita', 'Nuevos del mes']

export const PATIENTS: PatientSummary[] = [
  {
    record: 'EXP-0421',
    name: 'Lucía Mendoza Rivas',
    meta: 'EXP-0421 · 34 años',
    phone: '55 1874 2093',
    lastVisit: '16 sep 2026',
    nextVisit: 'jue 18 sep',
    balance: '$3,400.00',
    overdue: true,
    tags: [
      { label: 'Ortodoncia', tone: 'info' },
      { label: 'Alergia', tone: 'danger' },
    ],
  },
  {
    record: 'EXP-0388',
    name: 'Tomás Iriarte Rangel',
    meta: 'EXP-0388 · 41 años',
    phone: '55 2210 7741',
    lastVisit: '16 sep 2026',
    nextVisit: 'Sin agendar',
    balance: '$0.00',
    overdue: false,
    tags: [{ label: 'Higiene', tone: 'ok' }],
  },
  {
    record: 'EXP-0512',
    name: 'Renata Vidal Cobos',
    meta: 'EXP-0512 · 28 años',
    phone: '55 6633 1180',
    lastVisit: '2 sep 2026',
    nextVisit: 'mié 17 sep',
    balance: '$1,450.00',
    overdue: true,
    tags: [{ label: 'Plan activo', tone: 'info' }],
  },
  {
    record: 'EXP-0233',
    name: 'Jorge Lira Peña',
    meta: 'EXP-0233 · 52 años',
    phone: '55 4098 5512',
    lastVisit: '15 sep 2026',
    nextVisit: 'vie 3 oct',
    balance: '$0.00',
    overdue: false,
    tags: [{ label: 'Diabético', tone: 'warn' }],
  },
  {
    record: 'EXP-0604',
    name: 'Sofía Aguirre Nava',
    meta: 'EXP-0604 · 31 años',
    phone: '55 7712 0034',
    lastVisit: '14 sep 2026',
    nextVisit: 'mar 16 sep',
    balance: '$0.00',
    overdue: false,
    tags: [{ label: 'Estética', tone: 'neutral' }],
  },
  {
    record: 'EXP-0455',
    name: 'Emilia Cortés Ibarra',
    meta: 'EXP-0455 · 19 años',
    phone: '55 3320 9987',
    lastVisit: '22 ago 2026',
    nextVisit: 'lun 22 sep',
    balance: '$850.00',
    overdue: true,
    tags: [
      { label: 'Ortodoncia', tone: 'info' },
      { label: 'No-show', tone: 'danger' },
    ],
  },
  {
    record: 'EXP-0170',
    name: 'Martín Ochoa Sandoval',
    meta: 'EXP-0170 · 47 años',
    phone: '55 8845 6621',
    lastVisit: '3 sep 2026',
    nextVisit: 'mar 16 sep',
    balance: '$0.00',
    overdue: false,
    tags: [{ label: 'Cirugía', tone: 'warn' }],
  },
  {
    record: 'EXP-0577',
    name: 'Camila Bravo Ortiz',
    meta: 'EXP-0577 · 26 años',
    phone: '55 5507 2244',
    lastVisit: '12 sep 2026',
    nextVisit: 'mié 17 sep',
    balance: '$0.00',
    overdue: false,
    tags: [{ label: 'Reembolso', tone: 'danger' }],
  },
]
