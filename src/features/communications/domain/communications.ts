import { isApiError } from '../../../shared/api/problem'

export const CHANNELS = ['EMAIL', 'SMS', 'WHATSAPP'] as const
export type Channel = (typeof CHANNELS)[number]

export const TEMPLATE_VARIABLES = [
  'patient_name',
  'appointment_date',
  'appointment_time',
  'clinic_name',
] as const
export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number]

export interface Communication {
  id: string
  patientId: string
  appointmentId: string
  channel: Channel
  status: string
  safePreview: string
  createdAt: string
}

export interface CommunicationEvent {
  id: string
  communicationId: string
  eventType: string
  safeMetadata: unknown
  createdAt: string
}

export interface MessageTemplate {
  id: string
  code: string
  channel: Channel
  locale: string
  providerTemplate: string | null
  bodyTemplate: string
  isActive: boolean
  version: number
  createdAt: string
  updatedAt: string
}

export interface TemplateDraft {
  code: string
  channel: Channel
  locale: string
  providerTemplate: string
  bodyTemplate: string
  isActive: boolean
}

export const EMPTY_TEMPLATE_DRAFT: TemplateDraft = {
  code: '', channel: 'WHATSAPP', locale: 'es-MX', providerTemplate: '', bodyTemplate: '', isActive: true,
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const VARIABLE_PATTERN = /{{([^{}]+)}}/g

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value.trim())
}

export function variablesInTemplate(body: string): TemplateVariable[] {
  return [...body.matchAll(VARIABLE_PATTERN)].map((match) => match[1])
    .filter((value): value is TemplateVariable => (TEMPLATE_VARIABLES as readonly string[]).includes(value))
}

export function validateTemplateBody(body: string): string | null {
  if (!body.trim()) return 'El cuerpo de la plantilla es obligatorio.'
  if (body.length > 4096) return 'El cuerpo de la plantilla no puede superar 4096 caracteres.'
  const variables = [...body.matchAll(VARIABLE_PATTERN)].map((match) => match[1])
  const withoutVariables = body.replace(VARIABLE_PATTERN, '')
  if (withoutVariables.includes('{{') || withoutVariables.includes('}}') || /[<>{}$]/.test(withoutVariables)) {
    return 'La plantilla contiene texto o sintaxis no permitidos.'
  }
  if (variables.some((variable) => !(TEMPLATE_VARIABLES as readonly string[]).includes(variable))) {
    return `Solo se permiten: ${TEMPLATE_VARIABLES.map((variable) => `{{${variable}}}`).join(', ')}.`
  }
  if (new Set(variables).size !== variables.length) return 'Cada variable solo puede aparecer una vez.'
  return null
}

export function communicationErrorMessage(error: unknown): string {
  if (!isApiError(error)) return 'No pudimos completar la comunicación. Verificá tu conexión e intentá nuevamente.'
  if (error.code === 'PRECONDITION_FAILED' || error.code === 'VERSION_CONFLICT') {
    return 'La cita o plantilla cambió mientras preparabas la cola. Actualizamos la autoridad; prepará una acción nueva.'
  }
  if (error.code === 'COMMUNICATION_CONFLICT') return 'Esta solicitud entra en conflicto con una comunicación existente.'
  if (error.code === 'FORBIDDEN') return 'Tu rol no tiene permiso para realizar esta acción.'
  if (error.code === 'DEPENDENCY_UNAVAILABLE' || error.status >= 500) return 'El servicio de comunicaciones no está disponible por ahora.'
  return error.detail || 'No pudimos completar la comunicación.'
}

export function isVersionConflict(error: unknown): boolean {
  return isApiError(error) && (error.code === 'PRECONDITION_FAILED' || error.code === 'VERSION_CONFLICT')
}

export function communicationStatusLabel(status: string): string {
  return status === 'QUEUED' ? 'En cola' : status
}
