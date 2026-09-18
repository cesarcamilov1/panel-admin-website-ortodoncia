import { isApiError } from '../../../shared/api/problem'
import { formatCivilDate } from './clinicTime'

/**
 * ISO weekday. The server maps Go's Sunday `0` to `7` before comparing
 * (`scheduleApplies`), and `ValidateWorkSchedule` only accepts `1..7`.
 */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

/** The server stores `1` or `2`; `0` is normalized to a weekly schedule. */
export type IntervalWeeks = 1 | 2

export interface WorkSchedule {
  id: string
  locationId: string
  providerUserId: string
  weekday: Weekday
  /** `HH:MM`, clinic time. */
  startLocalTime: string
  endLocalTime: string
  timezone: string
  /** `YYYY-MM-DD`. */
  effectiveFrom: string
  /** `YYYY-MM-DD`, empty when the schedule has no end. */
  effectiveTo: string
  intervalWeeks: IntervalWeeks
  isActive: boolean
}

export interface WorkScheduleDto {
  id: string
  location_id?: string
  provider_user_id: string
  weekday: number
  start_local_time: string
  end_local_time: string
  timezone: string
  effective_from: string
  effective_to?: string
  interval_weeks?: number
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export interface WorkScheduleListDto {
  items: WorkScheduleDto[]
}

export interface WeekdayOption {
  value: Weekday
  label: string
  short: string
}

export const WEEKDAYS: readonly WeekdayOption[] = [
  { value: 1, label: 'Lunes', short: 'Lun' },
  { value: 2, label: 'Martes', short: 'Mar' },
  { value: 3, label: 'Miércoles', short: 'Mié' },
  { value: 4, label: 'Jueves', short: 'Jue' },
  { value: 5, label: 'Viernes', short: 'Vie' },
  { value: 6, label: 'Sábado', short: 'Sáb' },
  { value: 7, label: 'Domingo', short: 'Dom' },
]

export function weekdayLabel(weekday: Weekday): string {
  return WEEKDAYS.find((option) => option.value === weekday)?.label ?? ''
}

export function fromWorkScheduleDto(dto: WorkScheduleDto): WorkSchedule {
  return {
    id: dto.id,
    locationId: dto.location_id ?? '',
    providerUserId: dto.provider_user_id,
    weekday: (dto.weekday as Weekday) ?? 1,
    startLocalTime: dto.start_local_time,
    endLocalTime: dto.end_local_time,
    timezone: dto.timezone,
    effectiveFrom: dto.effective_from,
    effectiveTo: dto.effective_to ?? '',
    intervalWeeks: dto.interval_weeks === 2 ? 2 : 1,
    isActive: dto.is_active,
  }
}

export interface WorkScheduleDraft {
  weekday: Weekday
  startLocalTime: string
  endLocalTime: string
  effectiveFrom: string
  effectiveTo: string
  intervalWeeks: IntervalWeeks
  /** Empty means the provider's default location, which the server resolves. */
  locationId: string
  isActive: boolean
}

export interface WorkScheduleWriteDto {
  location_id?: string
  provider_user_id: string
  weekday: number
  start_local_time: string
  end_local_time: string
  effective_from: string
  effective_to?: string
  interval_weeks: number
  is_active: boolean
}

export function toWorkScheduleWriteDto(
  draft: WorkScheduleDraft,
  providerUserId: string,
): WorkScheduleWriteDto {
  const locationId = draft.locationId.trim()
  const effectiveTo = draft.effectiveTo.trim()
  return {
    ...(locationId ? { location_id: locationId } : {}),
    provider_user_id: providerUserId,
    weekday: draft.weekday,
    start_local_time: draft.startLocalTime,
    end_local_time: draft.endLocalTime,
    effective_from: draft.effectiveFrom,
    ...(effectiveTo ? { effective_to: effectiveTo } : {}),
    interval_weeks: draft.intervalWeeks,
    is_active: draft.isActive,
    // `timezone` is deliberately absent: the server fills it with the clinic zone and
    // rejects every other value, so sending it can only turn a valid range into a 422.
  }
}

const TIME_PATTERN = /^([01][0-9]|2[0-3]):[0-5][0-9]$/
const CIVIL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export function validateTimeOfDay(value: string): string | null {
  if (!value.trim()) return 'La hora es obligatoria.'
  if (!TIME_PATTERN.test(value)) return 'Escribe la hora en formato de 24 horas, como 09:00.'
  return null
}

export function validateTimeRange(start: string, end: string): string | null {
  const invalid = validateTimeOfDay(end)
  if (invalid) return invalid
  // The server compares the two strings, and `HH:MM` sorts chronologically.
  if (end <= start) return 'La hora de fin debe ser posterior a la de inicio.'
  return null
}

export function validateEffectiveRange(from: string, to: string): string | null {
  if (!from.trim()) return 'La fecha de inicio es obligatoria.'
  if (!CIVIL_DATE_PATTERN.test(from)) return 'Escribe la fecha de inicio como AAAA-MM-DD.'
  if (!to.trim()) return null
  if (!CIVIL_DATE_PATTERN.test(to)) return 'Escribe la fecha de fin como AAAA-MM-DD.'
  if (to < from) return 'La fecha de fin no puede ser anterior a la de inicio.'
  return null
}

export type WorkScheduleDraftErrors = Partial<Record<keyof WorkScheduleDraft, string>>

export function validateWorkScheduleDraft(draft: WorkScheduleDraft): WorkScheduleDraftErrors {
  const errors: WorkScheduleDraftErrors = {}

  if (draft.weekday < 1 || draft.weekday > 7) errors.weekday = 'Elige un día de la semana.'

  const start = validateTimeOfDay(draft.startLocalTime)
  if (start) errors.startLocalTime = start

  const end = validateTimeRange(draft.startLocalTime, draft.endLocalTime)
  if (end) errors.endLocalTime = end

  const effective = validateEffectiveRange(draft.effectiveFrom, draft.effectiveTo)
  if (effective) {
    if (effective.includes('fin')) errors.effectiveTo = effective
    else errors.effectiveFrom = effective
  }

  return errors
}

export function byWeekdayThenStart(schedules: WorkSchedule[]): WorkSchedule[] {
  return [...schedules].sort((left, right) => {
    if (left.weekday !== right.weekday) return left.weekday - right.weekday
    const byStart = left.startLocalTime.localeCompare(right.startLocalTime)
    return byStart !== 0 ? byStart : left.id.localeCompare(right.id)
  })
}

export type WeekGrid = Record<Weekday, WorkSchedule[]>

/** Every weekday is a key, so a day without ranges renders as closed instead of missing. */
export function groupByWeekday(schedules: WorkSchedule[]): WeekGrid {
  const grid = {} as WeekGrid
  for (const option of WEEKDAYS) grid[option.value] = []
  for (const schedule of byWeekdayThenStart(schedules)) {
    grid[schedule.weekday]?.push(schedule)
  }
  return grid
}

export function formatTimeRange(schedule: WorkSchedule): string {
  return `${schedule.startLocalTime} – ${schedule.endLocalTime}`
}

export function intervalLabel(intervalWeeks: IntervalWeeks): string {
  return intervalWeeks === 2 ? 'Cada 2 semanas' : 'Cada semana'
}

export function validityLabel(schedule: WorkSchedule): string {
  const from = formatCivilDate(schedule.effectiveFrom)
  if (!schedule.effectiveTo) return `Desde el ${from}`
  return `Del ${from} al ${formatCivilDate(schedule.effectiveTo)}`
}

export function scheduleErrorMessage(error: unknown): string {
  if (!isApiError(error)) return 'Algo salió mal. Inténtalo de nuevo.'

  if (error.status === 409) {
    return 'Ese horario se encima con otra franja activa del mismo día. Ajusta las horas.'
  }

  if (error.code === 'VALIDATION_ERROR' || error.status === 400 || error.status === 422) {
    return error.detail ?? 'Revisa los datos del horario: algún campo no es válido.'
  }

  if (error.code === 'FORBIDDEN' || error.status === 403) {
    return 'Solo el odontólogo titular puede cambiar el horario de trabajo.'
  }

  if (error.code === 'RESOURCE_NOT_FOUND' || error.status === 404) {
    return 'Esta franja ya no existe. Recarga el horario.'
  }

  if (error.code === 'RATE_LIMITED') {
    const wait = error.retryAfterSeconds ? `${error.retryAfterSeconds} segundos` : 'unos minutos'
    return `Demasiados intentos. Espera ${wait} e inténtalo de nuevo.`
  }

  if (error.code === 'DEPENDENCY_UNAVAILABLE') {
    return 'El servicio no está disponible por ahora. Inténtalo más tarde.'
  }

  if (error.code === 'NETWORK' || error.code === 'TIMEOUT') {
    return 'No pudimos conectar con el servidor. Revisa tu conexión.'
  }

  if (error.status >= 500) return 'El servidor tuvo un problema. Inténtalo más tarde.'

  return 'Algo salió mal. Inténtalo de nuevo.'
}
