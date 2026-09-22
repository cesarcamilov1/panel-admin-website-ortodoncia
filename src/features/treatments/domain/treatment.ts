import { isApiError } from '../../../shared/api/problem'

export type TreatmentPlanStatus = 'DRAFT' | 'PROPOSED' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
export type TreatmentItemStatus = 'PLANNED' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'

export interface TreatmentPlan { id: string; patientId: string; providerUserId: string; name: string; currency: string; notes: string; status: TreatmentPlanStatus; subtotal: string; discount: string; total: string; acceptedAt: string; completedAt: string; createdAt: string; updatedAt: string; version: number }
export interface TreatmentItem { id: string; treatmentPlanId: string; lineNumber: number; serviceId: string; serviceCodeSnapshot: string; description: string; toothNumber: number | null; quantity: string; unitPrice: string; discount: string; subtotal: string; total: string; status: TreatmentItemStatus; surfaces: string[]; completedAt: string; createdAt: string; updatedAt: string; version: number }
export interface TreatmentHistory { id: string; itemId: string; fromStatus: string; toStatus: string; reason: string; changedBy: string; createdAt: string }

const string = (value: unknown) => typeof value === 'string' ? value : ''
const amount = (value: unknown) => typeof value === 'string' ? value : String(value ?? '0')
export function fromTreatmentPlanDto(dto: any): TreatmentPlan { return { id: dto.id, patientId: dto.patient_id, providerUserId: dto.provider_user_id, name: dto.name, currency: dto.currency, notes: string(dto.notes), status: dto.status, subtotal: amount(dto.subtotal), discount: amount(dto.discount), total: amount(dto.total), acceptedAt: string(dto.accepted_at), completedAt: string(dto.completed_at), createdAt: dto.created_at, updatedAt: dto.updated_at, version: dto.version } }
export function fromTreatmentItemDto(dto: any): TreatmentItem { return { id: dto.id, treatmentPlanId: dto.treatment_plan_id, lineNumber: dto.line_number, serviceId: string(dto.service_id), serviceCodeSnapshot: string(dto.service_code_snapshot), description: dto.description, toothNumber: dto.tooth_number ?? null, quantity: amount(dto.quantity), unitPrice: amount(dto.unit_price), discount: amount(dto.discount), subtotal: amount(dto.subtotal), total: amount(dto.total), status: dto.status, surfaces: Array.isArray(dto.surfaces) ? dto.surfaces : [], completedAt: string(dto.completed_at), createdAt: dto.created_at, updatedAt: dto.updated_at, version: dto.version } }
export function fromTreatmentHistoryDto(dto: any): TreatmentHistory { return { id: dto.id, itemId: dto.treatment_plan_item_id, fromStatus: string(dto.from_status), toStatus: dto.to_status, reason: string(dto.reason), changedBy: dto.changed_by, createdAt: dto.created_at } }

const planTransitions: Record<TreatmentPlanStatus, TreatmentPlanStatus[]> = { DRAFT: ['PROPOSED', 'CANCELLED'], PROPOSED: ['ACCEPTED', 'CANCELLED'], ACCEPTED: ['IN_PROGRESS', 'CANCELLED'], IN_PROGRESS: ['COMPLETED', 'CANCELLED'], COMPLETED: [], CANCELLED: [] }
const itemTransitions: Record<TreatmentItemStatus, TreatmentItemStatus[]> = { PLANNED: ['SCHEDULED', 'IN_PROGRESS', 'CANCELLED'], SCHEDULED: ['IN_PROGRESS', 'CANCELLED'], IN_PROGRESS: ['COMPLETED', 'CANCELLED'], COMPLETED: [], CANCELLED: [] }
export const allowedPlanTransitions = (status: TreatmentPlanStatus) => planTransitions[status]
export const allowedItemTransitions = (status: TreatmentItemStatus) => itemTransitions[status]
export const treatmentErrorMessage = (error: unknown) => {
  if (!isApiError(error)) return 'No pudimos completar la operación. Intentá nuevamente.'
  if (error.code === 'PRECONDITION_FAILED' || error.code === 'VERSION_CONFLICT' || error.status === 412) return 'El plan cambió en otra sesión. Se conservaron tus datos y recargamos el estado actual.'
  if (error.code === 'FORBIDDEN') return 'Tu rol no tiene permiso para esta operación.'
  if (error.code === 'INVALID_TREATMENT_TRANSITION') return 'Ese cambio no está permitido en el estado actual del plan.'
  return error.detail ?? 'Revisá los datos e intentá nuevamente.'
}
export const isTreatmentConflict = (error: unknown) => isApiError(error) && (error.code === 'PRECONDITION_FAILED' || error.code === 'VERSION_CONFLICT' || error.status === 412)
