import { isApiError } from '../../../shared/api/problem'

export type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'ARRIVED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW'
export type AppointmentSource = 'WEB' | 'WHATSAPP' | 'PHONE' | 'INSTAGRAM' | 'FACEBOOK' | 'GOOGLE' | 'WALK_IN' | 'MANUAL'
export type IdentityStatus = 'PENDING_REVIEW' | 'REVIEWED' | 'LEGACY_UNREVIEWED'
export type IdentityResolutionAction = 'CONFIRM_NEW' | 'LINK_EXISTING'
export type WaitlistStatus = 'ACTIVE' | 'CONTACTED' | 'BOOKED' | 'EXPIRED' | 'CANCELLED'
export type PreferredPeriod = 'MORNING' | 'AFTERNOON' | 'EVENING'

export interface AppointmentService {
  id: string
  serviceId: string
  serviceCode: string
  serviceName: string
  unitPrice: string
  currency: string
  lineNumber: number
  durationMinutes: number
  quantity: string
}

export interface Appointment {
  id: string
  locationId: string
  patientId: string
  providerUserId: string
  source: AppointmentSource
  reason: string
  internalNotes: string
  startsAt: string
  endsAt: string
  status: AppointmentStatus
  cancellationReason: string
  version: number
  services: AppointmentService[]
  identityStatus: IdentityStatus | ''
}

export interface AppointmentDto {
  id: string
  location_id?: string
  patient_id: string
  provider_user_id: string
  source: AppointmentSource
  reason?: string
  internal_notes?: string
  starts_at: string
  ends_at: string
  status: AppointmentStatus
  cancellation_reason?: string
  version: number
  identity_status?: IdentityStatus
  services: Array<{
    id: string
    service_id?: string
    service_code: string
    service_name: string
    unit_price: string
    currency: string
    line_number: number
    duration_minutes: number
    quantity: string
  }>
}

export interface AppointmentHistory {
  id: string
  appointmentId: string
  fromStatus: AppointmentStatus | null
  toStatus: AppointmentStatus
  reason: string
  changedBy: string
  createdAt: string
}

export interface AppointmentHistoryDto {
  id: string
  appointment_id: string
  from_status: AppointmentStatus | null
  to_status: AppointmentStatus
  reason?: string
  changed_by?: string
  created_at: string
}

export interface IdentityCandidate {
  patientId: string
  recordNumber: number
  firstName: string
  lastName: string
  phoneMasked: string
  identityStatus: IdentityStatus
  profileStatus: 'MINIMAL' | 'COMPLETE'
  archived: boolean
}

export interface IdentityCandidateDto {
  patient_id: string
  record_number: number
  first_name: string
  last_name: string
  phone_masked: string
  identity_status: IdentityStatus
  profile_status: 'MINIMAL' | 'COMPLETE'
  archived: boolean
}

export interface WaitlistEntry {
  id: string
  patientId: string
  serviceId: string
  providerUserId: string
  earliestDate: string
  latestDate: string
  preferredPeriods: PreferredPeriod[]
  status: WaitlistStatus
  notes: string
}

export interface WaitlistEntryDto {
  id: string
  patient_id: string
  service_id?: string
  provider_user_id: string
  earliest_date: string
  latest_date?: string
  preferred_periods: PreferredPeriod[]
  status: WaitlistStatus
  notes?: string
}

export function fromAppointmentDto(dto: AppointmentDto): Appointment {
  return {
    id: dto.id, locationId: dto.location_id ?? '', patientId: dto.patient_id, providerUserId: dto.provider_user_id,
    source: dto.source, reason: dto.reason ?? '', internalNotes: dto.internal_notes ?? '', startsAt: dto.starts_at,
    endsAt: dto.ends_at, status: dto.status, cancellationReason: dto.cancellation_reason ?? '', version: dto.version,
    identityStatus: dto.identity_status ?? '',
    services: dto.services.map((service) => ({
      id: service.id, serviceId: service.service_id ?? '', serviceCode: service.service_code, serviceName: service.service_name,
      unitPrice: service.unit_price, currency: service.currency, lineNumber: service.line_number,
      durationMinutes: service.duration_minutes, quantity: service.quantity,
    })),
  }
}

export function fromAppointmentHistoryDto(dto: AppointmentHistoryDto): AppointmentHistory {
  return { id: dto.id, appointmentId: dto.appointment_id, fromStatus: dto.from_status, toStatus: dto.to_status, reason: dto.reason ?? '', changedBy: dto.changed_by ?? '', createdAt: dto.created_at }
}

export function fromIdentityCandidateDto(dto: IdentityCandidateDto): IdentityCandidate {
  return { patientId: dto.patient_id, recordNumber: dto.record_number, firstName: dto.first_name, lastName: dto.last_name, phoneMasked: dto.phone_masked, identityStatus: dto.identity_status, profileStatus: dto.profile_status, archived: dto.archived }
}

export function fromWaitlistEntryDto(dto: WaitlistEntryDto): WaitlistEntry {
  return { id: dto.id, patientId: dto.patient_id, serviceId: dto.service_id ?? '', providerUserId: dto.provider_user_id, earliestDate: dto.earliest_date, latestDate: dto.latest_date ?? '', preferredPeriods: dto.preferred_periods, status: dto.status, notes: dto.notes ?? '' }
}

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  PENDING: 'Pendiente', CONFIRMED: 'Confirmada', ARRIVED: 'Llegó', IN_PROGRESS: 'En curso', COMPLETED: 'Completada', CANCELLED: 'Cancelada', NO_SHOW: 'No asistió',
}

const TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'], CONFIRMED: ['ARRIVED', 'CANCELLED', 'NO_SHOW'], ARRIVED: ['IN_PROGRESS', 'CANCELLED'], IN_PROGRESS: ['COMPLETED'], COMPLETED: [], CANCELLED: [], NO_SHOW: [],
}

export function allowedTransitions(status: AppointmentStatus): AppointmentStatus[] { return TRANSITIONS[status] }
export function requiresTransitionReason(status: AppointmentStatus): boolean { return status === 'CANCELLED' || status === 'NO_SHOW' }

export function appointmentErrorMessage(error: unknown): string {
  if (!isApiError(error)) return 'Algo salió mal. Intentalo de nuevo.'
  if (error.code === 'APPOINTMENT_SLOT_CONFLICT') return 'Ese horario ya no está disponible. Elegí otra fecha y hora.'
  if (error.code === 'IDEMPOTENCY_CONFLICT') return 'Este intento no coincide con la reserva anterior. Revisá los datos antes de reintentar.'
  if (error.code === 'PATIENT_BOOKING_BLOCKED') return 'No se pueden crear nuevas citas para este paciente.'
  if (error.code === 'PRECONDITION_FAILED' || error.code === 'VERSION_CONFLICT' || error.status === 412) return 'La cita cambió en otra sesión. Actualizamos los datos; revisalos antes de continuar.'
  if (error.code === 'FORBIDDEN') return 'Tu rol no tiene permiso para administrar la agenda.'
  if (error.code === 'MFA_REQUIRED') return 'Esta acción requiere una sesión con MFA reciente.'
  if (error.code === 'AUTHENTICATION_REQUIRED') return 'Tu sesión expiró. Iniciá sesión nuevamente.'
  if (error.code === 'VALIDATION_ERROR' || error.status === 400) return error.detail ?? 'Revisá los datos de la cita.'
  if (error.code === 'NETWORK' || error.code === 'TIMEOUT') return 'No pudimos conectar con el servidor. Revisá tu conexión.'
  if (error.status >= 500) return 'El servidor tuvo un problema. Intentá más tarde.'
  return error.detail ?? 'Algo salió mal. Intentalo de nuevo.'
}

export function appointmentDurationMinutes(appointment: Appointment): number { return appointment.services.reduce((total, service) => total + service.durationMinutes, 0) }

export function appointmentTime(instant: string): string {
  const date = new Date(instant)
  return Number.isNaN(date.valueOf()) ? instant : date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export function toAgendaWindow(start: Date, days = 7): { from: string; to: string } {
  const from = new Date(start)
  from.setHours(0, 0, 0, 0)
  const to = new Date(from)
  to.setDate(to.getDate() + days)
  return { from: from.toISOString(), to: to.toISOString() }
}
