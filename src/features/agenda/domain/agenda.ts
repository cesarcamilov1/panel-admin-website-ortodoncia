export const DAY_START_MINUTES = 8 * 60
export const DAY_END_MINUTES = 20 * 60
export const HOUR_HEIGHT = 46

export type AppointmentStatus =
  | 'confirmada'
  | 'pendiente'
  | 'curso'
  | 'completada'
  | 'noshow'
  | 'cancelada'

export interface Appointment {
  id: string
  time: string
  minutes: number
  durationMinutes: number
  patient: string
  service: string
  status: AppointmentStatus
}

export interface DayBlock {
  label: string
  from: string
  to: string
}

export interface AgendaDay {
  dow: string
  day: number
  today: boolean
  appointments: Appointment[]
  blocks: DayBlock[]
}

export interface MonthCell {
  day: number
  inMonth: boolean
}

export interface Placement {
  top: number
  height: number
}

export function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function gridHeight(): number {
  return ((DAY_END_MINUTES - DAY_START_MINUTES) / 60) * HOUR_HEIGHT
}

/** Vertical placement of a slot inside the week grid, in CSS pixels. */
export function slotPlacement(time: string, durationMinutes: number): Placement {
  const start = Math.max(toMinutes(time), DAY_START_MINUTES)
  const end = Math.min(start + durationMinutes, DAY_END_MINUTES)
  const top = ((start - DAY_START_MINUTES) / 60) * HOUR_HEIGHT
  return { top, height: Math.max(((end - start) / 60) * HOUR_HEIGHT, 0) }
}

export function blockPlacement(block: DayBlock): Placement {
  return slotPlacement(block.from, toMinutes(block.to) - toMinutes(block.from))
}

export function buildHourLabels(): string[] {
  const labels: string[] = []
  for (let minutes = DAY_START_MINUTES; minutes < DAY_END_MINUTES; minutes += 60) {
    labels.push(`${String(Math.floor(minutes / 60)).padStart(2, '0')}:00`)
  }
  return labels
}

export { gridHeight as agendaGridHeight }

/** Month grid starting on Monday, padded with the neighbouring months. */
export function buildMonthGrid(year: number, monthIndex: number): MonthCell[] {
  const first = new Date(year, monthIndex, 1)
  const leading = (first.getDay() + 6) % 7
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const daysInPrev = new Date(year, monthIndex, 0).getDate()

  const cells: MonthCell[] = []
  for (let i = leading; i > 0; i -= 1) {
    cells.push({ day: daysInPrev - i + 1, inMonth: false })
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ day, inMonth: true })
  }
  const total = Math.ceil(cells.length / 7) * 7
  for (let day = 1; cells.length < total; day += 1) {
    cells.push({ day, inMonth: false })
  }
  return cells
}
