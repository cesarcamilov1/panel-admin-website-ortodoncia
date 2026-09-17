/**
 * The scheduling module accepts exactly one timezone: `ValidateWorkSchedule` rejects
 * anything other than `America/Mexico_City`. So every wall-clock value the panel shows or
 * sends is clinic time, never the browser's zone: a receptionist connecting from another
 * zone must still read and write the clinic's hours.
 */
export const CLINIC_TIMEZONE = 'America/Mexico_City'

const WALL_CLOCK = new Intl.DateTimeFormat('en-CA', {
  timeZone: CLINIC_TIMEZONE,
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

const CIVIL_DATE = new Intl.DateTimeFormat('es-MX', {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

export interface WallClock {
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

const MINUTE_MS = 60_000
export const DAY_MS = 86_400_000

function wallClock(instant: Date): WallClock {
  const parts = WALL_CLOCK.formatToParts(instant)
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number.parseInt(parts.find((part) => part.type === type)?.value ?? '0', 10)
  // Some ICU builds render midnight as hour 24 under the h24 cycle.
  const hour = read('hour')
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: hour === 24 ? 0 : hour,
    minute: read('minute'),
  }
}

/** Minutes the clinic zone is ahead of UTC at that instant (negative west of Greenwich). */
function offsetMinutes(instant: Date): number {
  const clock = wallClock(instant)
  const asUtc = Date.UTC(clock.year, clock.month - 1, clock.day, clock.hour, clock.minute)
  return (asUtc - Math.floor(instant.getTime() / MINUTE_MS) * MINUTE_MS) / MINUTE_MS
}

/** Turns a clinic wall-clock reading into the instant it names. */
export function fromWallClock({ year, month, day, hour, minute }: WallClock): Date {
  const naive = Date.UTC(year, month - 1, day, hour, minute)
  // Two passes: the first offset is read at the wrong instant on a DST boundary, the
  // second at the corrected one. Mexico has no DST since 2022, but the rule is the zone's.
  let instant = new Date(naive - offsetMinutes(new Date(naive)) * MINUTE_MS)
  instant = new Date(naive - offsetMinutes(instant) * MINUTE_MS)
  return instant
}

const pad = (value: number) => String(value).padStart(2, '0')

/** `YYYY-MM-DDTHH:MM`, the value shape of an `<input type="datetime-local">`. */
export function toLocalDateTime(instant: string | Date): string {
  const clock = wallClock(new Date(instant))
  return `${clock.year}-${pad(clock.month)}-${pad(clock.day)}T${pad(clock.hour)}:${pad(clock.minute)}`
}

/** Reads a `datetime-local` value as clinic time and returns its RFC3339 instant. */
export function toInstant(localDateTime: string): string {
  const [date = '', time = ''] = localDateTime.split('T')
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  return fromWallClock({ year, month, day, hour, minute }).toISOString()
}

/** Midnight in the clinic, as an instant: the honest left edge of a day window. */
export function clinicDayStart(reference: Date): Date {
  const clock = wallClock(reference)
  return fromWallClock({ ...clock, hour: 0, minute: 0 })
}

/** `21 sep 2026` from an instant, read in clinic time. */
export function formatClinicDate(instant: string | Date): string {
  const clock = wallClock(new Date(instant))
  return CIVIL_DATE.format(new Date(Date.UTC(clock.year, clock.month - 1, clock.day)))
}

/** `14:00` from an instant, read in clinic time. */
export function formatClinicTime(instant: string | Date): string {
  const clock = wallClock(new Date(instant))
  return `${pad(clock.hour)}:${pad(clock.minute)}`
}

/** `21 sep 2026` from a civil `YYYY-MM-DD`, which carries no instant at all. */
export function formatCivilDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return value
  return CIVIL_DATE.format(new Date(Date.UTC(year, month - 1, day)))
}

/** The same clinic day, regardless of the hours inside it. */
export function isSameClinicDay(left: string | Date, right: string | Date): boolean {
  const a = wallClock(new Date(left))
  const b = wallClock(new Date(right))
  return a.year === b.year && a.month === b.month && a.day === b.day
}
