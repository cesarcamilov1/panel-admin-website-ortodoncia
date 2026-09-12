import type { AgendaDay, Appointment, AppointmentStatus } from './agenda'
import { toMinutes } from './agenda'

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  confirmada: 'Confirmada',
  pendiente: 'Sin confirmar',
  curso: 'En curso',
  completada: 'Completada',
  noshow: 'No asistió',
  cancelada: 'Cancelada',
}

export const STATUS_TONES: Record<AppointmentStatus, 'ok' | 'warn' | 'danger' | 'info' | 'neutral' | 'accent'> = {
  confirmada: 'accent',
  pendiente: 'warn',
  curso: 'info',
  completada: 'ok',
  noshow: 'danger',
  cancelada: 'neutral',
}

let sequence = 0

function appointment(
  time: string,
  patient: string,
  service: string,
  status: AppointmentStatus,
  durationMinutes: number,
): Appointment {
  sequence += 1
  return {
    id: `apt-${sequence}`,
    time,
    minutes: toMinutes(time),
    patient,
    service,
    status,
    durationMinutes,
  }
}

export type ScheduledAppointment = Appointment

const LUNCH = { label: 'Comida', from: '14:00', to: '15:00' }

export const WEEK: AgendaDay[] = [
  {
    dow: 'Lun',
    day: 15,
    today: false,
    blocks: [LUNCH],
    appointments: [
      appointment('09:00', 'Rodrigo Salas', 'Limpieza dental', 'completada', 45),
      appointment('10:30', 'Ana Belén Ruiz', 'Resina 26', 'completada', 60),
      appointment('12:00', 'Jorge Lira', 'Endodoncia 36', 'completada', 90),
      appointment('16:00', 'Emilia Cortés', 'Ortodoncia · ajuste', 'noshow', 30),
    ],
  },
  {
    dow: 'Mar',
    day: 16,
    today: true,
    blocks: [LUNCH],
    appointments: [
      appointment('08:30', 'Lucía Mendoza', 'Ortodoncia · ajuste', 'completada', 30),
      appointment('09:30', 'Tomás Iriarte', 'Limpieza dental', 'curso', 45),
      appointment('11:00', 'Renata Vidal', 'Resina 14', 'confirmada', 60),
      appointment('12:30', 'Pablo Duarte', 'Revisión', 'pendiente', 30),
      appointment('16:00', 'Sofía Aguirre', 'Blanqueamiento', 'confirmada', 90),
      appointment('18:00', 'Martín Ochoa', 'Extracción 48', 'confirmada', 60),
    ],
  },
  {
    dow: 'Mié',
    day: 17,
    today: false,
    blocks: [LUNCH],
    appointments: [
      appointment('09:00', 'Camila Bravo', 'Resina 37', 'confirmada', 60),
      appointment('11:00', 'Iker Zamudio', 'Ortodoncia · ajuste', 'confirmada', 30),
      appointment('15:00', 'Valeria Nolasco', 'Endodoncia 46', 'pendiente', 90),
      appointment('17:30', 'Diego Arriaga', 'Limpieza dental', 'confirmada', 45),
    ],
  },
  {
    dow: 'Jue',
    day: 18,
    today: false,
    blocks: [LUNCH],
    appointments: [
      appointment('08:30', 'Lucía Mendoza', 'Ortodoncia · ajuste', 'confirmada', 30),
      appointment('10:00', 'Fernanda Sosa', 'Corona 16', 'confirmada', 60),
      appointment('12:00', 'Bruno Casal', 'Limpieza dental', 'pendiente', 45),
      appointment('16:30', 'Elena Múgica', 'Resina 25', 'confirmada', 60),
    ],
  },
  {
    dow: 'Vie',
    day: 19,
    today: false,
    blocks: [LUNCH, { label: 'Congreso', from: '16:00', to: '20:00' }],
    appointments: [
      appointment('09:00', 'Óscar Belmont', 'Limpieza dental', 'confirmada', 45),
      appointment('10:30', 'Paula Iglesias', 'Revisión', 'cancelada', 30),
      appointment('11:30', 'Hugo Farías', 'Extracción 38', 'confirmada', 60),
    ],
  },
  {
    dow: 'Sáb',
    day: 20,
    today: false,
    blocks: [],
    appointments: [
      appointment('09:30', 'Nadia Quintero', 'Limpieza dental', 'confirmada', 45),
      appointment('11:00', 'Leo Pastrana', 'Ortodoncia · ajuste', 'pendiente', 30),
    ],
  },
]

export const TODAY = WEEK.find((day) => day.today) ?? WEEK[0]

/** Days with at least one appointment, used by the mini calendar dots. */
export const BUSY_DAYS = [15, 16, 17, 18, 19, 22, 23, 24, 25]

export const NEW_APPOINTMENT_SLOTS = [
  { time: '09:00', free: true },
  { time: '09:30', free: true },
  { time: '10:00', free: false },
  { time: '10:30', free: true },
  { time: '11:00', free: true },
  { time: '11:30', free: false },
  { time: '12:00', free: true },
  { time: '16:00', free: true },
  { time: '16:30', free: true },
  { time: '17:00', free: true },
]
