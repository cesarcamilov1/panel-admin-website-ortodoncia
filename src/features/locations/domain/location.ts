import { isApiError } from '../../../shared/api/problem'

export interface PracticeLocation {
  id: string
  providerUserId: string
  name: string
  address: string
  isActive: boolean
  isDefault: boolean
  /** False means the location only offers the services in its allowlist. */
  allServices: boolean
  travelBufferMinutes: number
}

export interface PracticeLocationDto {
  id: string
  provider_user_id: string
  name: string
  address?: string
  is_active: boolean
  is_default: boolean
  all_services: boolean
  travel_buffer_minutes: number
}

export interface PracticeLocationListDto {
  items: PracticeLocationDto[]
}

export function fromLocationDto(dto: PracticeLocationDto): PracticeLocation {
  return {
    id: dto.id,
    providerUserId: dto.provider_user_id,
    name: dto.name,
    address: dto.address ?? '',
    isActive: dto.is_active,
    isDefault: dto.is_default,
    allServices: dto.all_services,
    travelBufferMinutes: dto.travel_buffer_minutes,
  }
}

export interface LocationDraft {
  name: string
  address: string
  travelBufferMinutes: number
}

export interface LocationWriteDto {
  provider_user_id: string
  name: string
  address?: string
  travel_buffer_minutes: number
}

export function fromPracticeLocation(location: PracticeLocation): LocationDraft {
  return {
    name: location.name,
    address: location.address,
    travelBufferMinutes: location.travelBufferMinutes,
  }
}

export const NAME_MAX_LENGTH = 200
export const ADDRESS_MAX_LENGTH = 1000
export const TRAVEL_BUFFER_MAX_MINUTES = 1440

export function validateLocationName(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return 'El nombre de la sede es obligatorio.'
  if (trimmed.length > NAME_MAX_LENGTH) {
    return `El nombre no puede pasar de ${NAME_MAX_LENGTH} caracteres.`
  }
  return null
}

export function validateLocationAddress(value: string): string | null {
  if (value.trim().length > ADDRESS_MAX_LENGTH) {
    return `La dirección no puede pasar de ${ADDRESS_MAX_LENGTH} caracteres.`
  }
  return null
}

export function validateTravelBuffer(minutes: number): string | null {
  if (!Number.isInteger(minutes)) return 'El margen de traslado debe ser un número entero de minutos.'
  if (minutes < 0 || minutes > TRAVEL_BUFFER_MAX_MINUTES) {
    return `El margen de traslado va de 0 a ${TRAVEL_BUFFER_MAX_MINUTES} minutos.`
  }
  return null
}

export type LocationDraftErrors = Partial<Record<keyof LocationDraft, string>>

export function validateLocationDraft(draft: LocationDraft): LocationDraftErrors {
  const errors: LocationDraftErrors = {}
  const name = validateLocationName(draft.name)
  if (name) errors.name = name
  const address = validateLocationAddress(draft.address)
  if (address) errors.address = address
  const buffer = validateTravelBuffer(draft.travelBufferMinutes)
  if (buffer) errors.travelBufferMinutes = buffer
  return errors
}

export function toLocationWriteDto(draft: LocationDraft, providerUserId: string): LocationWriteDto {
  const address = draft.address.trim()
  return {
    provider_user_id: providerUserId,
    name: draft.name.trim(),
    ...(address ? { address } : {}),
    travel_buffer_minutes: draft.travelBufferMinutes,
  }
}

/** The server lists `ORDER BY is_default DESC, name, id`; keep local edits in that order. */
export function byDefaultThenName(locations: PracticeLocation[]): PracticeLocation[] {
  return [...locations].sort((left, right) => {
    if (left.isDefault !== right.isDefault) return left.isDefault ? -1 : 1
    const byName = left.name.localeCompare(right.name)
    return byName !== 0 ? byName : left.id.localeCompare(right.id)
  })
}

export function serviceCoverageLabel({
  allServices,
  enabledCount,
}: {
  allServices: boolean
  /** Omit when the caller has not counted the allowlist; never pass a placeholder. */
  enabledCount?: number
}): string {
  if (allServices) return 'Todos los servicios'
  if (enabledCount === undefined) return 'Lista restringida'
  if (enabledCount <= 0) return 'Sin servicios habilitados'
  return `${enabledCount} ${enabledCount === 1 ? 'servicio' : 'servicios'}`
}

export function formatTravelBuffer(minutes: number): string {
  if (minutes === 0) return 'Sin traslado'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}

export function locationErrorMessage(error: unknown): string {
  if (!isApiError(error)) return 'Algo salió mal. Inténtalo de nuevo.'

  if (error.code === 'VALIDATION_ERROR' || error.status === 400) {
    return error.detail ?? 'Revisa los datos de la sede: algún campo no es válido.'
  }

  if (error.code === 'FORBIDDEN') {
    return 'Solo el odontólogo titular puede administrar las sedes.'
  }

  if (error.code === 'RESOURCE_NOT_FOUND') {
    return 'Esta sede ya no existe. Recarga la lista.'
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

  if (error.status >= 500) {
    return 'El servidor tuvo un problema. Inténtalo más tarde.'
  }

  return 'Algo salió mal. Inténtalo de nuevo.'
}
