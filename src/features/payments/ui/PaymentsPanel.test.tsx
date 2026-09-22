import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../shared/api/problem'
import type { PaymentsApi } from '../application/paymentsApi'
import type { TreatmentsApi } from '../../treatments/application/treatmentsApi'
import { PaymentsPanel } from './PaymentsPanel'

const patientId = '11111111-1111-1111-1111-111111111111'
const paymentId = '22222222-2222-2222-2222-222222222222'
const planId = '33333333-3333-3333-3333-333333333333'

const receivedPayment = {
  id: paymentId, patientId, appointmentId: '', amount: '100.050', currency: 'MXN', internalMethod: 'CARD' as const, satPaymentFormCode: '04', status: 'RECEIVED' as const, version: 2,
}

function paymentsApi(overrides: Partial<PaymentsApi> = {}): PaymentsApi {
  return {
    listPayments: vi.fn().mockResolvedValue({ items: [], hasPossibleNextPage: false }),
    getPayment: vi.fn().mockResolvedValue(receivedPayment),
    createPayment: vi.fn().mockResolvedValue(receivedPayment),
    transitionPayment: vi.fn().mockResolvedValue(receivedPayment),
    listAllocations: vi.fn().mockResolvedValue({ items: [], hasPossibleNextPage: false }),
    allocatePayment: vi.fn().mockResolvedValue({}),
    reverseAllocation: vi.fn().mockResolvedValue({}),
    listRefunds: vi.fn().mockResolvedValue({ items: [], hasPossibleNextPage: false }),
    createRefund: vi.fn().mockResolvedValue({}),
    transitionRefund: vi.fn().mockResolvedValue({}),
    ...overrides,
  }
}

function treatmentsApi(): TreatmentsApi {
  return {
    listPlans: vi.fn().mockResolvedValue([{ id: planId, patientId, providerUserId: 'provider', name: 'Ortodoncia', currency: 'MXN', notes: '', status: 'ACCEPTED', subtotal: '100.050', discount: '0', total: '100.050', acceptedAt: '', completedAt: '', createdAt: '', updatedAt: '', version: 1 }]),
    listItems: vi.fn().mockResolvedValue([]),
    createPlan: vi.fn(), getPlan: vi.fn(), transitionPlan: vi.fn(), addItem: vi.fn(), transitionItem: vi.fn(), listHistory: vi.fn(),
  }
}

function renderPanel(api = paymentsApi()) {
  render(<PaymentsPanel api={api} treatmentsApi={treatmentsApi()} patientId={patientId} patientName="Lucía Mendoza" />)
  return api
}

async function openPaymentForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Registrar pago' }))
  await user.type(screen.getByLabelText('Importe'), '100.050')
  await user.type(screen.getByLabelText('Moneda ISO'), 'MXN')
  await user.click(screen.getByLabelText(/Confirmo el registro financiero/i))
}

describe('PaymentsPanel', () => {
  it('preserves an exact decimal and the same idempotency key when an uncertain create is retried', async () => {
    const createPayment = vi.fn().mockRejectedValueOnce(new ApiError({ status: 0, code: 'TIMEOUT' })).mockResolvedValueOnce(receivedPayment)
    const api = renderPanel(paymentsApi({ createPayment }))
    const user = userEvent.setup()

    await openPaymentForm(user)
    await user.click(screen.getAllByRole('button', { name: 'Registrar pago' }).at(-1)!)
    expect(await screen.findByRole('alert')).toHaveTextContent(/No pudimos conectar/i)
    await user.click(screen.getAllByRole('button', { name: 'Registrar pago' }).at(-1)!)

    await waitFor(() => expect(createPayment).toHaveBeenCalledTimes(2))
    expect(createPayment.mock.calls[0]?.[0]).toMatchObject({ amount: '100.050', currency: 'MXN', internalMethod: 'CASH', satPaymentFormCode: '01' })
    expect(createPayment.mock.calls[1]?.[0].idempotencyKey).toBe(createPayment.mock.calls[0]?.[0].idempotencyKey)
    expect(api.listPayments).toHaveBeenCalled()
  })

  it('blocks a synchronous double submit while a payment creation is pending', async () => {
    let resolve!: (value: typeof receivedPayment) => void
    const createPayment = vi.fn().mockReturnValue(new Promise<typeof receivedPayment>((done) => { resolve = done }))
    renderPanel(paymentsApi({ createPayment }))
    const user = userEvent.setup()

    await openPaymentForm(user)
    const submit = screen.getAllByRole('button', { name: 'Registrar pago' }).at(-1)!
    await user.click(submit)
    await user.click(submit)
    expect(createPayment).toHaveBeenCalledTimes(1)

    resolve(receivedPayment)
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Registrar pago' })).not.toBeInTheDocument())
  })

  it('keeps an allocation form and conflict error visible after refreshing authoritative payment detail', async () => {
    const allocatePayment = vi.fn().mockRejectedValue(new ApiError({ status: 412, code: 'PRECONDITION_FAILED' }))
    const api = renderPanel(paymentsApi({ listPayments: vi.fn().mockResolvedValue({ items: [receivedPayment], hasPossibleNextPage: false }), allocatePayment }))
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: /MXN 100.050/i }))
    await user.click(await screen.findByRole('button', { name: 'Asignar a tratamiento' }))
    await user.selectOptions(screen.getByLabelText('Plan de tratamiento'), planId)
    await user.type(screen.getByLabelText('Importe a asignar'), '25.025')
    await user.click(screen.getByLabelText(/Confirmo la asignación financiera/i))
    await user.click(screen.getByRole('button', { name: 'Asignar' }))

    await waitFor(() => expect(screen.getAllByRole('alert').some((alert) => /conservamos el formulario/i.test(alert.textContent ?? ''))).toBe(true))
    expect(screen.getByRole('heading', { name: 'Asignar pago' })).toBeInTheDocument()
    expect(allocatePayment).toHaveBeenCalledWith(expect.objectContaining({ amount: '25.025', version: 2, treatmentPlanId: planId }))
    expect(api.getPayment).toHaveBeenCalled()
  })

  it('closes an acknowledged allocation form and reports a refresh failure without another submit', async () => {
    const getPayment = vi.fn()
      .mockResolvedValueOnce(receivedPayment)
      .mockResolvedValueOnce(receivedPayment)
      .mockRejectedValueOnce(new ApiError({ status: 0, code: 'TIMEOUT' }))
      .mockRejectedValue(new ApiError({ status: 0, code: 'TIMEOUT' }))
    renderPanel(paymentsApi({
      listPayments: vi.fn().mockResolvedValue({ items: [receivedPayment], hasPossibleNextPage: false }),
      getPayment,
    }))
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: /MXN 100.050/i }))
    await user.click(await screen.findByRole('button', { name: 'Asignar a tratamiento' }))
    await user.selectOptions(screen.getByLabelText('Plan de tratamiento'), planId)
    await user.type(screen.getByLabelText('Importe a asignar'), '25.025')
    await user.click(screen.getByLabelText(/Confirmo la asignación financiera/i))
    await user.click(screen.getByRole('button', { name: 'Asignar' }))

    await waitFor(() => expect(screen.getAllByRole('alert').some((alert) => /operación financiera fue confirmada/i.test(alert.textContent ?? ''))).toBe(true))
    expect(screen.queryByRole('heading', { name: 'Asignar pago' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Crear reembolso' })).not.toBeInTheDocument()
  })

  it('uses the last returned identifier to request a conservative next keyset page', async () => {
    const firstPage = Array.from({ length: 25 }, (_, index) => ({ ...receivedPayment, id: `00000000-0000-0000-0000-${String(index + 1).padStart(12, '0')}` }))
    const listPayments = vi.fn()
      .mockResolvedValueOnce({ items: firstPage, hasPossibleNextPage: true })
      .mockResolvedValueOnce({ items: [{ ...receivedPayment, id: '99999999-9999-9999-9999-999999999999' }], hasPossibleNextPage: false })
    renderPanel(paymentsApi({ listPayments }))
    const user = userEvent.setup()

    await screen.findByRole('button', { name: 'Cargar más' })
    await user.click(screen.getByRole('button', { name: 'Cargar más' }))

    await waitFor(() => expect(listPayments).toHaveBeenCalledTimes(2))
    expect(listPayments).toHaveBeenLastCalledWith({ patientId, afterId: firstPage.at(-1)?.id, limit: 25, signal: expect.any(AbortSignal) })
  })

  it('guards concurrent payment page requests, deduplicates against latest state, and stops on an empty final page', async () => {
    const firstPage = Array.from({ length: 25 }, (_, index) => ({ ...receivedPayment, id: `10000000-0000-0000-0000-${String(index + 1).padStart(12, '0')}` }))
    let resolvePage!: (page: { items: typeof firstPage; hasPossibleNextPage: boolean }) => void
    const listPayments = vi.fn()
      .mockResolvedValueOnce({ items: firstPage, hasPossibleNextPage: true })
      .mockReturnValueOnce(new Promise((resolve) => { resolvePage = resolve }))
    renderPanel(paymentsApi({ listPayments }))
    const user = userEvent.setup()

    const loadMore = await screen.findByRole('button', { name: 'Cargar más' })
    await user.click(loadMore)
    await user.click(loadMore)
    expect(listPayments).toHaveBeenCalledTimes(2)
    resolvePage({ items: [], hasPossibleNextPage: false })

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Cargar más' })).not.toBeInTheDocument())
    expect(screen.getAllByRole('button', { name: /MXN 100.050/i })).toHaveLength(25)
  })

  it('loads the 26th allocation page and permits its reversal', async () => {
    const firstAllocations = Array.from({ length: 25 }, (_, index) => ({ id: `allocation-${index + 1}`, paymentId, treatmentPlanId: planId, treatmentPlanItemId: '', amount: '1.000', reversed: false }))
    const lastAllocation = { ...firstAllocations[0], id: 'allocation-26' }
    const listAllocations = vi.fn((input: { afterId?: string }) => Promise.resolve(input.afterId ? { items: [lastAllocation], hasPossibleNextPage: false } : { items: firstAllocations, hasPossibleNextPage: true }))
    const reverseAllocation = vi.fn().mockResolvedValue(lastAllocation)
    renderPanel(paymentsApi({
      listPayments: vi.fn().mockResolvedValue({ items: [receivedPayment], hasPossibleNextPage: false }),
      listAllocations,
      reverseAllocation,
    }))
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: /MXN 100.050/i }))
    await user.click(await screen.findByRole('button', { name: 'Cargar más asignaciones' }))
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Revertir asignación' })).toHaveLength(26))
    await user.click(screen.getAllByRole('button', { name: 'Revertir asignación' }).at(-1)!)
    await user.click(screen.getByRole('button', { name: 'Confirmar' }))

    await waitFor(() => expect(reverseAllocation).toHaveBeenCalledWith({ paymentId, allocationId: 'allocation-26', version: 2 }))
    expect(listAllocations).toHaveBeenCalledWith({ paymentId, afterId: 'allocation-25', limit: 25 })
  })

  it('loads the 26th refund page and permits its transition', async () => {
    const firstRefunds = Array.from({ length: 25 }, (_, index) => ({ id: `refund-${index + 1}`, paymentId, amount: '1.000', status: 'PENDING' as const, version: 1 }))
    const lastRefund = { ...firstRefunds[0], id: 'refund-26', version: 2 }
    const listRefunds = vi.fn((input: { afterId?: string }) => Promise.resolve(input.afterId ? { items: [lastRefund], hasPossibleNextPage: false } : { items: firstRefunds, hasPossibleNextPage: true }))
    const transitionRefund = vi.fn().mockResolvedValue({ ...lastRefund, status: 'COMPLETED' as const })
    renderPanel(paymentsApi({
      listPayments: vi.fn().mockResolvedValue({ items: [receivedPayment], hasPossibleNextPage: false }),
      listRefunds,
      transitionRefund,
    }))
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: /MXN 100.050/i }))
    await user.click(await screen.findByRole('button', { name: 'Cargar más reembolsos' }))
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Completado' })).toHaveLength(26))
    await user.click(screen.getAllByRole('button', { name: 'Completado' }).at(-1)!)
    await user.click(screen.getByRole('button', { name: 'Confirmar' }))

    await waitFor(() => expect(transitionRefund).toHaveBeenCalledWith({ id: 'refund-26', version: 2, status: 'COMPLETED' }))
    expect(listRefunds).toHaveBeenCalledWith({ paymentId, afterId: 'refund-25', limit: 25 })
  })

  it('replays an uncertain refund with the immutable v2 request body and key after refresh observes v3', async () => {
    const v3Payment = { ...receivedPayment, version: 3, status: 'PARTIALLY_REFUNDED' as const }
    const createRefund = vi.fn()
      .mockRejectedValueOnce(new ApiError({ status: 0, code: 'TIMEOUT' }))
      .mockResolvedValueOnce({ id: 'refund-v2', paymentId, amount: '10.010', status: 'PENDING', version: 1 })
    const getPayment = vi.fn().mockResolvedValueOnce(receivedPayment).mockResolvedValueOnce(receivedPayment).mockResolvedValue(v3Payment)
    const api = renderPanel(paymentsApi({
      listPayments: vi.fn().mockResolvedValue({ items: [receivedPayment], hasPossibleNextPage: false }),
      getPayment,
      createRefund,
    }))
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: /MXN 100.050/i }))
    await user.click(await screen.findByRole('button', { name: 'Crear reembolso' }))
    await user.type(screen.getByLabelText(/Importe en MXN/i), '10.010')
    await user.click(screen.getByLabelText(/Confirmo la creación/i))
    await user.click(screen.getAllByRole('button', { name: 'Crear reembolso' }).at(-1)!)
    await waitFor(() => expect(screen.getAllByRole('alert').some((alert) => /No pudimos conectar/i.test(alert.textContent ?? ''))).toBe(true))
    expect(screen.getByLabelText(/Importe en MXN/i)).toBeDisabled()
    expect(screen.getByLabelText('Motivo requerido')).toBeDisabled()

    await user.click(screen.getAllByRole('button', { name: 'Crear reembolso' }).at(-1)!)
    await waitFor(() => expect(createRefund).toHaveBeenCalledTimes(2))
    expect(createRefund.mock.calls[0]?.[0]).toEqual({ paymentId, version: 2, amount: '10.010', reason: 'PATIENT_REQUEST', idempotencyKey: expect.any(String) })
    expect(createRefund.mock.calls[1]?.[0]).toEqual(createRefund.mock.calls[0]?.[0])
    expect(api.getPayment).toHaveBeenCalled()
  })
})
