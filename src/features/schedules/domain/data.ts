export interface Provider {
  id: string
  name: string
  role: string
}

export const PROVIDERS: Provider[] = [
  { id: 'MC', name: 'Dra. Mariana Cázares', role: 'Odontología general' },
  { id: 'IR', name: 'Dr. Iván Robledo', role: 'Cirugía maxilofacial' },
  { id: 'PN', name: 'Paola Nieto', role: 'Higiene dental' },
  { id: 'LT', name: 'Dr. Luis Tovar', role: 'Ortodoncia' },
]

export interface WorkDay {
  key: string
  day: string
  ranges: string[]
  capacity: string
  enabled: boolean
}

export const WORK_WEEK: WorkDay[] = [
  { key: 'lun', day: 'Lunes', ranges: ['09:00 – 14:00', '16:00 – 20:00'], capacity: '16 espacios', enabled: true },
  { key: 'mar', day: 'Martes', ranges: ['08:30 – 14:00', '16:00 – 19:00'], capacity: '17 espacios', enabled: true },
  { key: 'mie', day: 'Miércoles', ranges: ['09:00 – 14:00', '15:00 – 19:00'], capacity: '18 espacios', enabled: true },
  { key: 'jue', day: 'Jueves', ranges: ['08:30 – 14:00', '16:00 – 18:30'], capacity: '16 espacios', enabled: true },
  { key: 'vie', day: 'Viernes', ranges: ['09:00 – 14:00'], capacity: '10 espacios', enabled: true },
  { key: 'sab', day: 'Sábado', ranges: ['09:00 – 13:00'], capacity: '8 espacios', enabled: true },
  { key: 'dom', day: 'Domingo', ranges: [], capacity: 'Cerrado', enabled: false },
]

export interface ScheduleBlock {
  id: string
  title: string
  meta: string
  range: string
  repeat: string
  kind: 'lunch' | 'event' | 'holiday' | 'maintenance'
}

export const SCHEDULE_BLOCKS: ScheduleBlock[] = [
  {
    id: 'comida',
    title: 'Comida',
    meta: 'Todos los días · Sede Polanco',
    range: '14:00 – 15:00',
    repeat: 'Semanal',
    kind: 'lunch',
  },
  {
    id: 'congreso',
    title: 'Congreso de odontología',
    meta: 'Toda la clínica',
    range: '19 sep, 16:00 – 20:00',
    repeat: 'Único',
    kind: 'event',
  },
  {
    id: 'vacaciones',
    title: 'Vacaciones',
    meta: 'Dra. Mariana Cázares',
    range: '21 dic – 5 ene',
    repeat: 'Único',
    kind: 'holiday',
  },
  {
    id: 'mantenimiento',
    title: 'Mantenimiento de equipo',
    meta: 'Consultorio 2',
    range: '24 sep, 08:00 – 11:00',
    repeat: 'Único',
    kind: 'maintenance',
  },
]
