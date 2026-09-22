import { describe, expect, it, vi } from 'vitest'
import type { HttpTransport } from '../../../shared/api/http'
import { createPaymentsApi } from './paymentsApi'

const payment = {
  id: '22222222-2222-2222-2222-222222222222',
  patient_id: '11111111-1111-1111-1111-111111111111',
  amount: '100.050', currency: 'MXN', internal_method: 'CARD', sat_payment_form_code: '04', status: 'PENDING', version: 7,
}

function transport() {
  return {
    get: vi.fn().mockResolvedValue({ items: [payment] }),
    post: vi.fn().mockResolvedValue(payment),
    put: vi.fn(), patch: vi.fn(), del: vi.fn(), upload: vi.fn(), download: vi.fn(),
  } as unknown as HttpTransport
}

describe('PaymentsApi', () => {
  it('uses the mounted payment paths, exact decimal strings, required versions, and idempotency headers', async () => {
    const http = transport()
    const api = createPaymentsApi(http)
    const patientId = payment.patient_id
    const paymentId = payment.id
    const allocationId = '33333333-3333-3333-3333-333333333333'
    const refundId = '44444444-4444-4444-4444-444444444444'

    await api.listPayments({ patientId, afterId: allocationId })
    await api.getPayment(paymentId)
    await api.createPayment({ patientId, amount: '100.050', currency: 'MXN', internalMethod: 'CARD', satPaymentFormCode: '04', idempotencyKey: 'payment-key' })
    await api.transitionPayment({ id: paymentId, version: 7, status: 'RECEIVED' })
    await api.listAllocations({ paymentId, afterId: allocationId })
    await api.allocatePayment({ paymentId, version: 7, treatmentPlanId: allocationId, treatmentPlanItemId: refundId, amount: '10.010' })
    await api.reverseAllocation({ paymentId, allocationId, version: 8 })
    await api.listRefunds({ paymentId, afterId: allocationId })
    await api.createRefund({ paymentId, version: 8, amount: '5.005', reason: 'DUPLICATE_PAYMENT', idempotencyKey: 'refund-key' })
    await api.transitionRefund({ id: refundId, version: 1, status: 'COMPLETED' })

    expect(http.get).toHaveBeenNthCalledWith(1, `/api/v1/payments?patient_id=${patientId}&limit=25&after_id=${allocationId}`, undefined)
    expect(http.get).toHaveBeenNthCalledWith(2, `/api/v1/payments/${paymentId}`, undefined)
    expect(http.get).toHaveBeenNthCalledWith(3, `/api/v1/payments/${paymentId}/allocations?limit=25&after_id=${allocationId}`, undefined)
    expect(http.get).toHaveBeenNthCalledWith(4, `/api/v1/refunds?payment_id=${paymentId}&limit=25&after_id=${allocationId}`, undefined)
    expect(http.post).toHaveBeenNthCalledWith(1, '/api/v1/payments', {
      patient_id: patientId, amount: '100.050', currency: 'MXN', internal_method: 'CARD', sat_payment_form_code: '04',
    }, { idempotencyKey: 'payment-key' })
    expect(http.post).toHaveBeenNthCalledWith(2, `/api/v1/payments/${paymentId}/status`, { expected_version: 7, status: 'RECEIVED' }, { ifMatch: 7 })
    expect(http.post).toHaveBeenNthCalledWith(3, `/api/v1/payments/${paymentId}/allocations`, {
      expected_version: 7, treatment_plan_id: allocationId, treatment_plan_item_id: refundId, amount: '10.010',
    }, { ifMatch: 7 })
    expect(http.post).toHaveBeenNthCalledWith(4, `/api/v1/payments/${paymentId}/allocations/${allocationId}/reverse`, { expected_version: 8 }, { ifMatch: 8 })
    expect(http.post).toHaveBeenNthCalledWith(5, '/api/v1/refunds', {
      payment_id: paymentId, expected_version: 8, amount: '5.005', reason: 'DUPLICATE_PAYMENT',
    }, { ifMatch: 8, idempotencyKey: 'refund-key' })
    expect(http.post).toHaveBeenNthCalledWith(6, `/api/v1/refunds/${refundId}/status`, { expected_version: 1, status: 'COMPLETED' }, { ifMatch: 1 })
  })

  it('uses a full items response only as a conservative keyset next-page signal', async () => {
    const http = transport()
    const api = createPaymentsApi(http)
    const page = await api.listPayments({ patientId: payment.patient_id, limit: 1 })

    expect(page.items[0]?.amount).toBe('100.050')
    expect(page.hasPossibleNextPage).toBe(true)
    expect(page).not.toHaveProperty('nextCursor')
  })

  it('marks short and empty pages complete rather than offering an unbounded fetch loop', async () => {
    const http = transport()
    const api = createPaymentsApi(http)

    expect((await api.listPayments({ patientId: payment.patient_id, limit: 25 })).hasPossibleNextPage).toBe(false)
    http.get = vi.fn().mockResolvedValue({ items: [] }) as typeof http.get
    expect((await api.listRefunds({ paymentId: payment.id, limit: 25 })).hasPossibleNextPage).toBe(false)
  })

  it('sends an uncertain refund replay as the exact original body with its matching header', async () => {
    const http = transport()
    const api = createPaymentsApi(http)
    const input = { paymentId: payment.id, version: 2, amount: '10.010', reason: 'PATIENT_REQUEST' as const, idempotencyKey: 'stable-v2-key' }

    await api.createRefund(input)
    await api.createRefund(input)

    const expected = ['/api/v1/refunds', { payment_id: payment.id, expected_version: 2, amount: '10.010', reason: 'PATIENT_REQUEST' }, { ifMatch: 2, idempotencyKey: 'stable-v2-key' }]
    expect(http.post).toHaveBeenNthCalledWith(1, ...expected)
    expect(http.post).toHaveBeenNthCalledWith(2, ...expected)
  })
})
