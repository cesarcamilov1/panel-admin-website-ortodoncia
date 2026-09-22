import { isApiError } from '../../../shared/api/problem'

export type ReminderChannel = 'EMAIL' | 'SMS' | 'WHATSAPP'
export type ReminderType = 'CONFIRMATION' | 'TWENTY_FOUR_HOURS' | 'SAME_DAY' | 'CUSTOM'
export type ReminderStatus = 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED' | 'CANCELLED'

export interface Reminder {
  id: string
  appointmentId: string
  patientId: string
  channel: ReminderChannel
  reminderType: ReminderType
  scheduledFor: string
  status: ReminderStatus
  attemptCount: number
  nextAttemptAt: string | null
  communicationId: string | null
  templateId: string
  templateVersion: number
  appointmentVersion: number
  createdAt: string
  updatedAt: string
}

export interface ReminderScheduleAttempt {
  appointmentId: string
  templateId: string
  channel: ReminderChannel
  reminderType: ReminderType
  scheduledFor: string
  expectedVersion: number
  idempotencyKey: string
}

export interface ReminderCancelAttempt {
  id: string
  expectedVersion: number
  idempotencyKey: string
}

export function isCancelableReminder(reminder: Reminder): boolean {
  return reminder.status === 'SCHEDULED' || reminder.status === 'PROCESSING' || reminder.status === 'FAILED'
}

export function reminderStatusLabel(status: ReminderStatus): string {
  if (status === 'SENT') return 'Enviado'
  if (status === 'CANCELLED') return 'Cancelado'
  if (status === 'FAILED') return 'Falló; el backend puede reintentar'
  if (status === 'PROCESSING') return 'En procesamiento'
  return 'Programado en cola'
}

export function isVersionConflict(error: unknown): boolean {
  return isApiError(error) && (error.status === 412 || error.code === 'PRECONDITION_FAILED' || error.code === 'VERSION_CONFLICT')
}

export function reminderErrorMessage(error: unknown): string {
  if (!isApiError(error)) return 'No pudimos completar la acción de recordatorio.'
  if (isVersionConflict(error)) return 'La cita cambió en otra sesión. Recargamos la autoridad; prepará una acción nueva.'
  if (error.code === 'FORBIDDEN') return 'Tu rol no tiene permiso para administrar recordatorios.'
  if (error.code === 'COMMUNICATION_CONFLICT' || error.code === 'IDEMPOTENCY_CONFLICT') return 'La acción entra en conflicto con el estado actual. Revisá los datos antes de crear un intento nuevo.'
  return error.detail ?? 'No pudimos completar la acción de recordatorio.'
}
