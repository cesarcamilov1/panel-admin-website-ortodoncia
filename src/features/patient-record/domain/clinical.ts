import { isApiError } from '../../../shared/api/problem'

export type ClinicalItemKind = 'conditions' | 'allergies' | 'medications'
export type EncounterStatus = 'OPEN' | 'COMPLETED' | 'VOIDED'
export type NoteStatus = 'DRAFT' | 'SIGNED' | 'AMENDED' | 'VOIDED'
export type OdontogramStatus = 'DRAFT' | 'SIGNED' | 'SUPERSEDED'
export type ToothSurface = 'GENERAL' | 'OCCLUSAL' | 'INCISAL' | 'MESIAL' | 'DISTAL' | 'VESTIBULAR' | 'BUCCAL' | 'LINGUAL' | 'PALATAL'

export interface Address { id: string; patientId: string; addressType: 'HOME' | 'CONTACT' | 'OTHER'; street: string; exteriorNumber: string; interiorNumber: string; neighborhood: string; municipality: string; state: string; postalCode: string; countryCode: string; isPrimary: boolean; createdAt: string; updatedAt: string }
export interface AddressDraft { addressType: Address['addressType']; street: string; exteriorNumber: string; interiorNumber: string; neighborhood: string; municipality: string; state: string; postalCode: string; countryCode: string; isPrimary: boolean }
export interface EmergencyContact { id: string; patientId: string; name: string; relationship: string; phoneE164: string; isPrimary: boolean; createdAt: string; updatedAt: string }
export interface EmergencyContactDraft { name: string; relationship: string; phoneE164: string; isPrimary: boolean }
export interface MedicalHistory { id: string; patientId: string; versionNumber: number; schemaVersion: 'v1'; answers: { conditions: string[]; smoker: boolean }; summaryNotes: string; recordedBy: string; confirmedAt: string; createdAt: string }
export interface MedicalHistoryDraft { conditions: string[]; smoker: boolean; summaryNotes: string; confirmedAt: string }
export interface ClinicalItem { id: string; patientId: string; name: string; codeSystem: string; code: string; reaction: string; severity: string; dose: string; frequency: string; diagnosedOn: string; startedOn: string; endedOn: string; isActive: boolean; notes: string; createdAt: string; updatedAt: string }
export interface ClinicalItemDraft { name: string; codeSystem: string; code: string; reaction: string; severity: string; dose: string; frequency: string; diagnosedOn: string; startedOn: string; endedOn: string; isActive: boolean; notes: string }
export interface ClinicalEncounter { id: string; appointmentId: string; patientId: string; providerUserId: string; status: EncounterStatus; startedAt: string; endedAt: string; voidReason: string; createdAt: string; updatedAt: string; version: number }
export interface ClinicalNote { id: string; encounterId: string; patientId: string; providerUserId: string; noteType: string; subjective: string; objective: string; assessment: string; plan: string; additionalNotes: string; status: NoteStatus; signedAt: string; contentHash: string; createdAt: string; updatedAt: string; version: number }
export interface ClinicalNoteDraft { encounterId?: string; noteType: string; subjective?: string; objective?: string; assessment?: string; plan?: string; additionalNotes?: string }
export interface ClinicalNoteAmendment { id: string; clinicalNoteId: string; reason: string; amendmentText: string; createdBy: string; createdAt: string; contentHash: string }
export interface EncounterDiagnosis { id: string; encounterId: string; codeSystem: string; code: string; description: string; toothNumber: number | null; diagnosisType: string; createdAt: string }
export interface Odontogram { id: string; patientId: string; encounterId: string; versionNumber: number; status: OdontogramStatus; signedAt: string; createdBy: string; createdAt: string; updatedAt: string; version: number }
export interface OdontogramEntry { id: string; odontogramId: string; toothNumber: number; surface: ToothSurface; conditionCode: string; status: string; notes: string; createdAt: string; updatedAt: string }

const empty = (value: string | null | undefined) => value ?? ''

export function fromAddressDto(dto: any): Address { return { id: dto.id, patientId: dto.patient_id, addressType: dto.address_type, street: empty(dto.street), exteriorNumber: empty(dto.exterior_number), interiorNumber: empty(dto.interior_number), neighborhood: empty(dto.neighborhood), municipality: empty(dto.municipality), state: empty(dto.state), postalCode: empty(dto.postal_code), countryCode: dto.country_code, isPrimary: dto.is_primary, createdAt: dto.created_at, updatedAt: dto.updated_at } }
export function fromEmergencyContactDto(dto: any): EmergencyContact { return { id: dto.id, patientId: dto.patient_id, name: dto.name, relationship: empty(dto.relationship), phoneE164: dto.phone_e164, isPrimary: dto.is_primary, createdAt: dto.created_at, updatedAt: dto.updated_at } }
export function fromMedicalHistoryDto(dto: any): MedicalHistory { return { id: dto.id, patientId: dto.patient_id, versionNumber: dto.version_number, schemaVersion: dto.schema_version, answers: dto.answers, summaryNotes: empty(dto.summary_notes), recordedBy: dto.recorded_by, confirmedAt: empty(dto.confirmed_at), createdAt: dto.created_at } }
export function fromClinicalItemDto(dto: any): ClinicalItem { return { id: dto.id, patientId: dto.patient_id, name: dto.name, codeSystem: empty(dto.code_system), code: empty(dto.code), reaction: empty(dto.reaction), severity: empty(dto.severity), dose: empty(dto.dose), frequency: empty(dto.frequency), diagnosedOn: empty(dto.diagnosed_on), startedOn: empty(dto.started_on), endedOn: empty(dto.ended_on), isActive: dto.is_active, notes: empty(dto.notes), createdAt: dto.created_at, updatedAt: dto.updated_at } }
export function fromEncounterDto(dto: any): ClinicalEncounter { return { id: dto.id, appointmentId: empty(dto.appointment_id), patientId: dto.patient_id, providerUserId: dto.provider_user_id, status: dto.status, startedAt: dto.started_at, endedAt: empty(dto.ended_at), voidReason: empty(dto.void_reason), createdAt: dto.created_at, updatedAt: dto.updated_at, version: dto.version } }
export function fromNoteDto(dto: any): ClinicalNote { return { id: dto.id, encounterId: dto.encounter_id, patientId: dto.patient_id, providerUserId: dto.provider_user_id, noteType: dto.note_type, subjective: empty(dto.subjective), objective: empty(dto.objective), assessment: empty(dto.assessment), plan: empty(dto.plan), additionalNotes: empty(dto.additional_notes), status: dto.status, signedAt: empty(dto.signed_at), contentHash: empty(dto.content_hash), createdAt: dto.created_at, updatedAt: dto.updated_at, version: dto.version } }
export function fromAmendmentDto(dto: any): ClinicalNoteAmendment { return { id: dto.id, clinicalNoteId: dto.clinical_note_id, reason: dto.reason, amendmentText: dto.amendment_text, createdBy: dto.created_by, createdAt: dto.created_at, contentHash: dto.content_hash } }
export function fromDiagnosisDto(dto: any): EncounterDiagnosis { return { id: dto.id, encounterId: dto.encounter_id, codeSystem: empty(dto.code_system), code: empty(dto.code), description: dto.description, toothNumber: dto.tooth_number ?? null, diagnosisType: empty(dto.diagnosis_type), createdAt: dto.created_at } }
export function fromOdontogramDto(dto: any): Odontogram { return { id: dto.id, patientId: dto.patient_id, encounterId: empty(dto.encounter_id), versionNumber: dto.version_number, status: dto.status, signedAt: empty(dto.signed_at), createdBy: dto.created_by, createdAt: dto.created_at, updatedAt: dto.updated_at, version: dto.version } }
export function fromOdontogramEntryDto(dto: any): OdontogramEntry { return { id: dto.id, odontogramId: dto.odontogram_id, toothNumber: dto.tooth_number, surface: dto.surface, conditionCode: empty(dto.condition_code), status: empty(dto.status), notes: empty(dto.notes), createdAt: dto.created_at, updatedAt: dto.updated_at } }

export function clinicalErrorMessage(error: unknown): string {
  if (!isApiError(error)) return 'Algo salió mal. Intentá nuevamente.'
  if (error.code === 'PRECONDITION_FAILED' || error.code === 'VERSION_CONFLICT' || error.status === 412) return 'El registro cambió en otra sesión. Recargamos los datos actuales.'
  if (error.code === 'FORBIDDEN') return 'Tu rol no tiene permiso para consultar o modificar información clínica.'
  if (error.code === 'INVALID_CLINICAL_TRANSITION') return 'Este registro clínico ya no admite ese cambio porque es inmutable o su estado no lo permite.'
  if (error.code === 'IDENTITY_REVIEW_REQUIRED') return 'La identidad de la cita debe revisarse antes de documentar la atención.'
  if (error.code === 'NETWORK' || error.code === 'TIMEOUT') return 'No pudimos conectar con el servidor. Revisá tu conexión.'
  if (error.status >= 500) return 'El servicio no está disponible por ahora. Intentá más tarde.'
  return error.detail ?? 'Revisá los datos e intentá nuevamente.'
}

export function isClinicalVersionConflict(error: unknown): boolean { return isApiError(error) && (error.code === 'PRECONDITION_FAILED' || error.code === 'VERSION_CONFLICT' || error.status === 412) }
export function canReadClinical(role: string): boolean { return role === 'OWNER_DENTIST' || role === 'ASSISTANT' }
export function canOwnClinical(role: string): boolean { return role === 'OWNER_DENTIST' }
