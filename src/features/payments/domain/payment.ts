import { isApiError } from '../../../shared/api/problem'

export type PaymentMethod = 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'ONLINE' | 'OTHER'
export type PaymentStatus = 'PENDING' | 'RECEIVED' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED' | 'VOIDED'
export type RefundStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'VOIDED'
export type RefundReason = 'PATIENT_REQUEST' | 'DUPLICATE_PAYMENT' | 'TREATMENT_CANCELLED' | 'OTHER'

export interface Payment {
  id: string
  patientId: string
  appointmentId: string
  amount: string
  currency: string
  internalMethod: PaymentMethod
  satPaymentFormCode: string
  status: PaymentStatus
  version: number
}

export interface PaymentAllocation {
  id: string
  paymentId: string
  treatmentPlanId: string
  treatmentPlanItemId: string
  amount: string
  reversed: boolean
}

export interface Refund {
  id: string
  paymentId: string
  amount: string
  status: RefundStatus
  version: number
}

export interface PaymentDto {
  id: string
  patient_id: string
  appointment_id?: string | null
  amount: string
  currency: string
  internal_method: PaymentMethod
  sat_payment_form_code: string
  status: PaymentStatus
  version: number
}

const decimal = (value: unknown): string => typeof value === 'string' ? value : String(value ?? '')

export function fromPaymentDto(dto: PaymentDto): Payment {
  return {
    id: dto.id,
    patientId: dto.patient_id,
    appointmentId: dto.appointment_id ?? '',
    amount: decimal(dto.amount),
    currency: dto.currency,
    internalMethod: dto.internal_method,
    satPaymentFormCode: dto.sat_payment_form_code,
    status: dto.status,
    version: dto.version,
  }
}

export function fromPaymentAllocationDto(dto: any): PaymentAllocation {
  return {
    id: dto.id,
    paymentId: dto.payment_id,
    treatmentPlanId: dto.treatment_plan_id,
    treatmentPlanItemId: dto.treatment_plan_item_id ?? '',
    amount: decimal(dto.amount),
    reversed: dto.reversed === true,
  }
}

export function fromRefundDto(dto: any): Refund {
  return {
    id: dto.id,
    paymentId: dto.payment_id,
    amount: decimal(dto.amount),
    status: dto.status,
    version: dto.version,
  }
}

export function isExactPositiveDecimal(value: string): boolean {
  return /^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value) && !/^0(?:\.0+)?$/.test(value)
}

export function isPaymentFormCompatible(method: PaymentMethod, code: string): boolean {
  if (!/^\d{2}$/.test(code) || code === '30' || code === '99') return false
  if (method === 'CASH') return code === '01'
  if (method === 'CARD') return ['04', '28', '29'].includes(code)
  if (method === 'BANK_TRANSFER') return code === '03'
  return true
}

const paymentTransitions: Record<PaymentStatus, PaymentStatus[]> = {
  PENDING: ['RECEIVED', 'FAILED', 'VOIDED'],
  RECEIVED: ['VOIDED'],
  FAILED: [],
  REFUNDED: [],
  PARTIALLY_REFUNDED: [],
  VOIDED: [],
}

export function allowedPaymentTransitions(status: PaymentStatus, hasActiveAllocations: boolean, hasCompletedRefunds: boolean): PaymentStatus[] {
  return paymentTransitions[status].filter((next) => next !== 'VOIDED' || (!hasActiveAllocations && !hasCompletedRefunds))
}

export function allowedRefundTransitions(status: RefundStatus): RefundStatus[] {
  return status === 'PENDING' ? ['COMPLETED', 'FAILED', 'VOIDED'] : []
}

export function canManagePayments(role: string): boolean {
  return role === 'OWNER_DENTIST' || role === 'BILLING'
}

export function paymentErrorMessage(error: unknown): string {
  if (!isApiError(error)) return 'No pudimos completar la operación financiera. Intentá nuevamente.'
  if (error.code === 'PRECONDITION_FAILED' || error.code === 'VERSION_CONFLICT' || error.status === 412) return 'El pago cambió en otra sesión. Conservamos el formulario y recargamos el estado actual.'
  if (error.code === 'FORBIDDEN') return 'Tu rol no tiene permiso para consultar o administrar pagos.'
  if (error.code === 'PAYMENT_CONFLICT' || error.status === 409) return 'La operación ya no es válida para el estado o los importes actuales. Revisá el pago actualizado.'
  if (error.code === 'IDEMPOTENCY_CONFLICT') return 'Este reintento no coincide con la operación original. Revisá los datos antes de crear otra operación.'
  if (error.code === 'MFA_REQUIRED') return 'Esta acción requiere una sesión con MFA reciente.'
  if (error.code === 'NETWORK' || error.code === 'TIMEOUT') return 'No pudimos conectar con el servicio. Revisá tu conexión e intentá nuevamente.'
  return error.detail ?? 'Revisá los datos e intentá nuevamente.'
}
