import { isApiError } from '../../../shared/api/problem'
import {
  DAY_MS,
  clinicDayStart,
  formatClinicDate,
  formatClinicTime,
  isSameClinicDay,
  toInstant,
  toLocalDateTime,
} from './clinicTime'

export { toInstant, toLocalDateTime }

export const BLOCK_TYPES = [
  'PERSONAL',
  'VACATION',
  'HOLIDAY',
  'MEAL',
  'MAINTENANCE',
  'OTHER',
] as const

export type BlockType = (typeof BLOCK_TYPES)[number]

export const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  PERSONAL: 'Personal',
  VACATION: 'Vacaciones',
  HOLIDAY: 'Día festivo',
  MEAL: 'Comida',
  MAINTENANCE: 'Mantenimiento',
  OTHER: 'Otro',
}

export const REASON_MAX_LENGTH = 1000

/** Default horizon of the block list; `from` and `to` are required by the server. */
export const BLOCK_WINDOW_DAYS = 90

export interface ScheduleBlock {
  id: string
  locationId: string
  providerUserId: string
  /** RFC3339 instant. */
  startsAt: string
  endsAt: string
  /** The response types this as a plain string, so an unknown value still renders. */
  blockType: string
  reason: string
  createdBy: string
}

export interface ScheduleBlockDto {
  id: string
  location_id?: string
  provider_user_id: string
  starts_at: string
  ends_at: string
  block_type: string
  reason?: string
  created_by: string
  created_at?: string
  updated_at?: string
}

export interface ScheduleBlockListDto {
  items: ScheduleBlockDto[]
}

export function fromScheduleBlockDto(dto: ScheduleBlockDto): ScheduleBlock {
  return {
    id: dto.id,
    locationId: dto.location_id ?? '',
    providerUserId: dto.provider_user_id,
    startsAt: dto.starts_at,
    endsAt: dto.ends_at,
    blockType: dto.block_type,
    reason: dto.reason ?? '',
    createdBy: dto.created_by,
  }
}

export interface ScheduleBlockDraft {
  blockType: BlockType
  /** `YYYY-MM-DDTHH:MM` in clinic time, as typed in a `datetime-local` field. */
  startsAt: string
  endsAt: string
  reason: string
  /** Empty means the provider's default location, which the server resolves. */
  locationId: string
}

export interface ScheduleBlockWriteDto {
  location_id?: string
  provider_user_id: string
  starts_at: string
  ends_at: string
  block_type: BlockType
  reason?: string
}

export function toScheduleBlockWriteDto(
  draft: ScheduleBlockDraft,
  providerUserId: string,
): ScheduleBlockWriteDto {
  const locationId = draft.locationId.trim()
  const reason = draft.reason.trim()
  return {
    ...(locationId ? { location_id: locationId } : {}),
    provider_user_id: providerUserId,
    starts_at: toInstant(draft.startsAt),
    ends_at: toInstant(draft.endsAt),
    block_type: draft.blockType,
    ...(reason ? { reason } : {}),
  }
}

export type ScheduleBlockDraftErrors = Partial<Record<keyof ScheduleBlockDraft, string>>

const LOCAL_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T([01][0-9]|2[0-3]):[0-5][0-9]$/

export function validateScheduleBlockDraft(draft: ScheduleBlockDraft): ScheduleBlockDraftErrors {
  const errors: ScheduleBlockDraftErrors = {}

  if (!LOCAL_DATE_TIME_PATTERN.test(draft.startsAt)) {
    errors.startsAt = 'Indica la fecha y hora de inicio.'
  }

  if (!LOCAL_DATE_TIME_PATTERN.test(draft.endsAt)) {
    errors.endsAt = 'Indica la fecha y hora de fin.'
  } else if (!errors.startsAt && draft.endsAt <= draft.startsAt) {
    // The server rejects `!StartsAt.Before(EndsAt)`; the ISO-like text sorts the same way.
    errors.endsAt = 'El fin debe ser posterior al inicio.'
  }

  if (draft.reason.trim().length > REASON_MAX_LENGTH) {
    errors.reason = `El motivo no puede pasar de ${REASON_MAX_LENGTH} caracteres.`
  }

  return errors
}

export interface BlockWindow {
  from: string
  to: string
}

/** The required `from`/`to` pair: the clinic day of `reference` plus `days` of horizon. */
export function blockWindow(reference: Date, days: number = BLOCK_WINDOW_DAYS): BlockWindow {
  const from = clinicDayStart(reference)
  return {
    from: from.toISOString(),
    to: new Date(from.getTime() + days * DAY_MS).toISOString(),
  }
}

export function byStartsAt(blocks: ScheduleBlock[]): ScheduleBlock[] {
  return [...blocks].sort((left, right) => {
    const byStart = left.startsAt.localeCompare(right.startsAt)
    return byStart !== 0 ? byStart : left.id.localeCompare(right.id)
  })
}

export function blockTypeLabel(blockType: string): string {
  return BLOCK_TYPE_LABELS[blockType as BlockType] ?? blockType
}

export function formatBlockRange(block: ScheduleBlock): string {
  const start = `${formatClinicDate(block.startsAt)}, ${formatClinicTime(block.startsAt)}`
  if (isSameClinicDay(block.startsAt, block.endsAt)) {
    return `${start} – ${formatClinicTime(block.endsAt)}`
  }
  return `${start} – ${formatClinicDate(block.endsAt)}, ${formatClinicTime(block.endsAt)}`
}

export function blockErrorMessage(error: unknown): string {
  if (!isApiError(error)) return 'Algo salió mal. Inténtalo de nuevo.'

  if (error.status === 409) {
    return 'Ese bloqueo choca con una cita ya agendada. Reagenda la cita o ajusta el bloqueo.'
  }

  if (error.code === 'VALIDATION_ERROR' || error.status === 400 || error.status === 422) {
    return error.detail ?? 'Revisa los datos del bloqueo: algún campo no es válido.'
  }

  if (error.code === 'FORBIDDEN' || error.status === 403) {
    return 'No tienes permiso para administrar los bloqueos de este profesional.'
  }

  if (error.code === 'RESOURCE_NOT_FOUND' || error.status === 404) {
    return 'Este bloqueo ya no existe. Recarga la lista.'
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
