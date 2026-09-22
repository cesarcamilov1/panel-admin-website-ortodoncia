import { isApiError } from '../../../shared/api/problem'

export type PatientStatus = 'ACTIVE' | 'INACTIVE' | 'DECEASED'
export type SexAtBirth = 'FEMALE' | 'MALE' | 'INTERSEX' | 'UNSPECIFIED' | ''

export interface Patient {
  id: string
  recordNumber: number
  firstName: string
  middleName: string
  lastName: string
  secondLastName: string
  preferredName: string
  birthDate: string
  sexAtBirth: SexAtBirth
  phoneE164: string
  email: string
  occupation: string
  status: PatientStatus
  notes: string
  archivedAt: string
  bookingBlocked: boolean
  version: number
  createdAt: string
  updatedAt: string
}

export interface PatientSummary {
  id: string
  recordNumber: number
  firstName: string
  lastName: string
  preferredName: string
  phoneE164: string
  email: string
  status: PatientStatus
  archived: boolean
  bookingBlocked: boolean
  version: number
}

export interface PatientDto {
  id: string
  record_number: number
  first_name: string
  middle_name: string | null
  last_name: string
  second_last_name: string | null
  preferred_name: string | null
  birth_date: string | null
  sex_at_birth: Exclude<SexAtBirth, ''> | null
  phone_e164: string
  email: string | null
  occupation: string | null
  status: PatientStatus
  notes: string | null
  archived_at: string | null
  booking_blocked: boolean
  version: number
  created_at: string
  updated_at: string
}

export interface PatientSummaryDto {
  id: string
  record_number: number
  first_name: string
  last_name: string
  preferred_name: string | null
  phone_e164: string
  email: string | null
  status: PatientStatus
  archived: boolean
  booking_blocked: boolean
  version: number
}

export interface PatientDraft {
  firstName: string
  middleName: string
  lastName: string
  secondLastName: string
  preferredName: string
  birthDate: string
  sexAtBirth: SexAtBirth
  phoneE164: string
  email: string
  occupation: string
  status: PatientStatus
  notes: string
}

export type PatientDraftErrors = Partial<Record<keyof PatientDraft, string>>

export const EMPTY_PATIENT_DRAFT: PatientDraft = {
  firstName: '',
  middleName: '',
  lastName: '',
  secondLastName: '',
  preferredName: '',
  birthDate: '',
  sexAtBirth: '',
  phoneE164: '',
  email: '',
  occupation: '',
  status: 'ACTIVE',
  notes: '',
}

const PHONE_PATTERN = /^\+[1-9][0-9]{7,14}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function characters(value: string): number {
  return Array.from(value.trim()).length
}

function optionalLength(value: string, maximum: number, label: string): string | null {
  return characters(value) > maximum ? `${label} no puede pasar de ${maximum} caracteres.` : null
}

export function validatePatientDraft(draft: PatientDraft): PatientDraftErrors {
  const errors: PatientDraftErrors = {}
  if (!draft.firstName.trim()) errors.firstName = 'El nombre es obligatorio.'
  else if (characters(draft.firstName) > 100) errors.firstName = 'El nombre no puede pasar de 100 caracteres.'
  if (!draft.lastName.trim()) errors.lastName = 'El primer apellido es obligatorio.'
  else if (characters(draft.lastName) > 100) errors.lastName = 'El primer apellido no puede pasar de 100 caracteres.'

  for (const [key, label] of [
    ['middleName', 'El segundo nombre'],
    ['secondLastName', 'El segundo apellido'],
    ['preferredName', 'El nombre preferido'],
  ] as const) {
    const error = optionalLength(draft[key], 100, label)
    if (error) errors[key] = error
  }
  const occupation = optionalLength(draft.occupation, 200, 'La ocupación')
  if (occupation) errors.occupation = occupation
  const notes = optionalLength(draft.notes, 2000, 'Las notas')
  if (notes) errors.notes = notes

  if (!PHONE_PATTERN.test(draft.phoneE164.trim())) {
    errors.phoneE164 = 'Escribe un teléfono en formato internacional, por ejemplo +525512345678.'
  }
  if (draft.email.trim() && (characters(draft.email) > 254 || !EMAIL_PATTERN.test(draft.email.trim()))) {
    errors.email = 'Escribe un correo válido de hasta 254 caracteres.'
  }
  if (draft.birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(draft.birthDate)) {
    errors.birthDate = 'Escribe una fecha de nacimiento válida.'
  }
  return errors
}

function nullable(value: string): string | null {
  const trimmed = value.trim()
  return trimmed || null
}

export function toPatientWriteDto(draft: PatientDraft) {
  return {
    first_name: draft.firstName.trim(),
    middle_name: nullable(draft.middleName),
    last_name: draft.lastName.trim(),
    second_last_name: nullable(draft.secondLastName),
    preferred_name: nullable(draft.preferredName),
    birth_date: draft.birthDate || null,
    sex_at_birth: draft.sexAtBirth || null,
    phone_e164: draft.phoneE164.trim(),
    email: nullable(draft.email),
    occupation: nullable(draft.occupation),
    status: draft.status,
    notes: nullable(draft.notes),
  }
}

export function fromPatientDto(dto: PatientDto): Patient {
  return {
    id: dto.id,
    recordNumber: dto.record_number,
    firstName: dto.first_name,
    middleName: dto.middle_name ?? '',
    lastName: dto.last_name,
    secondLastName: dto.second_last_name ?? '',
    preferredName: dto.preferred_name ?? '',
    birthDate: dto.birth_date ?? '',
    sexAtBirth: dto.sex_at_birth ?? '',
    phoneE164: dto.phone_e164,
    email: dto.email ?? '',
    occupation: dto.occupation ?? '',
    status: dto.status,
    notes: dto.notes ?? '',
    archivedAt: dto.archived_at ?? '',
    bookingBlocked: dto.booking_blocked,
    version: dto.version,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  }
}

export function fromPatientSummaryDto(dto: PatientSummaryDto): PatientSummary {
  return {
    id: dto.id,
    recordNumber: dto.record_number,
    firstName: dto.first_name,
    lastName: dto.last_name,
    preferredName: dto.preferred_name ?? '',
    phoneE164: dto.phone_e164,
    email: dto.email ?? '',
    status: dto.status,
    archived: dto.archived,
    bookingBlocked: dto.booking_blocked,
    version: dto.version,
  }
}

export function fromPatient(patient: Patient): PatientDraft {
  return {
    firstName: patient.firstName,
    middleName: patient.middleName,
    lastName: patient.lastName,
    secondLastName: patient.secondLastName,
    preferredName: patient.preferredName,
    birthDate: patient.birthDate,
    sexAtBirth: patient.sexAtBirth,
    phoneE164: patient.phoneE164,
    email: patient.email,
    occupation: patient.occupation,
    status: patient.status,
    notes: patient.notes,
  }
}

export function patientDisplayName(patient: Pick<Patient | PatientSummary, 'firstName' | 'lastName' | 'preferredName'>): string {
  return patient.preferredName || `${patient.firstName} ${patient.lastName}`.trim()
}

export function patientErrorMessage(error: unknown): string {
  if (!isApiError(error)) return 'Algo salió mal. Inténtalo de nuevo.'
  if (error.code === 'PRECONDITION_FAILED' || error.code === 'VERSION_CONFLICT') {
    return 'Otra persona actualizó este paciente. Se recargaron los datos actuales.'
  }
  if (error.code === 'FORBIDDEN') return 'Tu rol no tiene permiso para realizar este cambio.'
  if (error.code === 'RESOURCE_NOT_FOUND') return 'Este paciente ya no existe o no está disponible.'
  if (error.code === 'NETWORK' || error.code === 'TIMEOUT') return 'No pudimos conectar con el servidor. Revisa tu conexión.'
  if (error.status >= 500) return 'El servicio no está disponible por ahora. Inténtalo más tarde.'
  return error.detail ?? 'Revisa los datos e inténtalo de nuevo.'
}

export function isVersionConflict(error: unknown): boolean {
  return isApiError(error) && (error.code === 'PRECONDITION_FAILED' || error.code === 'VERSION_CONFLICT')
}
