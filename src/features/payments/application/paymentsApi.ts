import type { HttpTransport } from '../../../shared/api/http'
import {
  fromPaymentAllocationDto,
  fromPaymentDto,
  fromRefundDto,
  type Payment,
  type PaymentAllocation,
  type PaymentDto,
  type PaymentMethod,
  type PaymentStatus,
  type Refund,
  type RefundReason,
  type RefundStatus,
} from '../domain/payment'

export interface KeysetPage<T> {
  items: T[]
  /** The API returns only items, so callers use a full page as the conservative next-page signal. */
  hasPossibleNextPage: boolean
}

export interface ListPaymentsInput {
  patientId: string
  afterId?: string
  limit?: number
  signal?: AbortSignal
}

export interface PaymentsApi {
  listPayments(input: ListPaymentsInput): Promise<KeysetPage<Payment>>
  getPayment(id: string, signal?: AbortSignal): Promise<Payment>
  createPayment(input: { patientId: string; appointmentId?: string; amount: string; currency: string; internalMethod: PaymentMethod; satPaymentFormCode: string; idempotencyKey: string }): Promise<Payment>
  transitionPayment(input: { id: string; version: number; status: PaymentStatus }): Promise<Payment>
  listAllocations(input: { paymentId: string; afterId?: string; limit?: number; signal?: AbortSignal }): Promise<KeysetPage<PaymentAllocation>>
  allocatePayment(input: { paymentId: string; version: number; treatmentPlanId: string; treatmentPlanItemId?: string; amount: string }): Promise<PaymentAllocation>
  reverseAllocation(input: { paymentId: string; allocationId: string; version: number }): Promise<PaymentAllocation>
  listRefunds(input: { paymentId: string; afterId?: string; limit?: number; signal?: AbortSignal }): Promise<KeysetPage<Refund>>
  createRefund(input: { paymentId: string; version: number; amount: string; reason: RefundReason; idempotencyKey: string }): Promise<Refund>
  transitionRefund(input: { id: string; version: number; status: RefundStatus }): Promise<Refund>
}

const DEFAULT_LIMIT = 25
const id = encodeURIComponent

function keysetPath(path: string, params: URLSearchParams, afterId: string | undefined, limit: number): string {
  params.set('limit', String(limit))
  if (afterId) params.set('after_id', afterId)
  return `${path}?${params.toString()}`
}

async function list<T>(http: HttpTransport, path: string, map: (dto: any) => T, signal: AbortSignal | undefined, limit: number): Promise<KeysetPage<T>> {
  const response = await http.get<{ items?: any[] }>(path, signal ? { signal } : undefined)
  const items = Array.isArray(response.items) ? response.items.map(map) : []
  return { items, hasPossibleNextPage: items.length === limit }
}

export function createPaymentsApi(http: HttpTransport): PaymentsApi {
  return {
    listPayments: ({ patientId, afterId, limit = DEFAULT_LIMIT, signal }) => list(
      http,
      keysetPath('/api/v1/payments', new URLSearchParams({ patient_id: patientId }), afterId, limit),
      fromPaymentDto,
      signal,
      limit,
    ),
    getPayment: (paymentId, signal) => http.get<PaymentDto>(`/api/v1/payments/${id(paymentId)}`, signal ? { signal } : undefined).then(fromPaymentDto),
    createPayment: async (input) => fromPaymentDto(await http.post('/api/v1/payments', {
      patient_id: input.patientId,
      ...(input.appointmentId ? { appointment_id: input.appointmentId } : {}),
      amount: input.amount,
      currency: input.currency,
      internal_method: input.internalMethod,
      sat_payment_form_code: input.satPaymentFormCode,
    }, { idempotencyKey: input.idempotencyKey })),
    transitionPayment: async ({ id: paymentId, version, status }) => fromPaymentDto(await http.post(`/api/v1/payments/${id(paymentId)}/status`, {
      expected_version: version,
      status,
    }, { ifMatch: version })),
    listAllocations: ({ paymentId, afterId, limit = DEFAULT_LIMIT, signal }) => list(
      http,
      keysetPath(`/api/v1/payments/${id(paymentId)}/allocations`, new URLSearchParams(), afterId, limit),
      fromPaymentAllocationDto,
      signal,
      limit,
    ),
    allocatePayment: async (input) => fromPaymentAllocationDto(await http.post(`/api/v1/payments/${id(input.paymentId)}/allocations`, {
      expected_version: input.version,
      treatment_plan_id: input.treatmentPlanId,
      ...(input.treatmentPlanItemId ? { treatment_plan_item_id: input.treatmentPlanItemId } : {}),
      amount: input.amount,
    }, { ifMatch: input.version })),
    reverseAllocation: async ({ paymentId, allocationId, version }) => fromPaymentAllocationDto(await http.post(`/api/v1/payments/${id(paymentId)}/allocations/${id(allocationId)}/reverse`, {
      expected_version: version,
    }, { ifMatch: version })),
    listRefunds: ({ paymentId, afterId, limit = DEFAULT_LIMIT, signal }) => list(
      http,
      keysetPath('/api/v1/refunds', new URLSearchParams({ payment_id: paymentId }), afterId, limit),
      fromRefundDto,
      signal,
      limit,
    ),
    createRefund: async (input) => fromRefundDto(await http.post('/api/v1/refunds', {
      payment_id: input.paymentId,
      expected_version: input.version,
      amount: input.amount,
      reason: input.reason,
    }, { ifMatch: input.version, idempotencyKey: input.idempotencyKey })),
    transitionRefund: async ({ id: refundId, version, status }) => fromRefundDto(await http.post(`/api/v1/refunds/${id(refundId)}/status`, {
      expected_version: version,
      status,
    }, { ifMatch: version })),
  }
}
