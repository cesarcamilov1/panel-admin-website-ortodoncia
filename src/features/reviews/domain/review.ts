import { isApiError } from '../../../shared/api/problem'

export interface Review {
  id: string
  patientId: string
  appointmentId: string
  rating: number
  comment: string
  googleReviewRequested: boolean
  createdAt: string
}

export interface ReviewAttempt {
  patientId: string
  appointmentId: string
  rating: number
  comment: string
  idempotencyKey: string
}

export function isValidRating(value: string): value is `${1 | 2 | 3 | 4 | 5}` {
  return /^[1-5]$/.test(value)
}

export function reviewErrorMessage(error: unknown): string {
  if (!isApiError(error)) return 'No pudimos guardar la reseña privada.'
  if (error.code === 'FORBIDDEN') return 'Tu rol no tiene permiso para registrar reseñas privadas.'
  if (error.code === 'COMMUNICATION_CONFLICT' || error.code === 'IDEMPOTENCY_CONFLICT') return 'La cita ya tiene una reseña o el intento no coincide con la solicitud anterior.'
  if (error.code === 'VALIDATION_ERROR') return 'La cita, el paciente o la calificación ya no son válidos.'
  return error.detail ?? 'No pudimos guardar la reseña privada.'
}
