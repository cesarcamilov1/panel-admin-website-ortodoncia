import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../shared/api/problem'
import type { ServicesApi } from '../../services/application/servicesApi'
import type { TreatmentsApi } from '../application/treatmentsApi'
import { TreatmentsPanel } from './TreatmentsPanel'

const patientId = '11111111-1111-1111-1111-111111111111'
const userId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const plan = {
  id: '22222222-2222-2222-2222-222222222222',
  patientId,
  providerUserId: userId,
  name: 'Plan real',
  currency: 'MXN',
  notes: '',
  status: 'DRAFT' as const,
  subtotal: '0.00',
  discount: '0.00',
  total: '0.00',
  acceptedAt: '',
  completedAt: '',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  version: 3,
}
const item = {
  id: '33333333-3333-3333-3333-333333333333',
  treatmentPlanId: plan.id,
  lineNumber: 1,
  serviceId: '44444444-4444-4444-4444-444444444444',
  serviceCodeSnapshot: 'LIMP',
  description: 'Limpieza',
  toothNumber: null,
  quantity: '1',
  unitPrice: '100',
  discount: '0',
  subtotal: '100',
  total: '100',
  status: 'PLANNED' as const,
  surfaces: [],
  completedAt: '',
  createdAt: plan.createdAt,
  updatedAt: plan.updatedAt,
  version: 7,
}

function api(overrides: Partial<TreatmentsApi> = {}): TreatmentsApi {
  return {
    listPlans: vi.fn().mockResolvedValue([plan]),
    createPlan: vi.fn(),
    getPlan: vi.fn().mockResolvedValue(plan),
    transitionPlan: vi.fn(),
    listItems: vi.fn().mockResolvedValue([]),
    addItem: vi.fn(),
    transitionItem: vi.fn(),
    listHistory: vi.fn().mockResolvedValue([]),
    ...overrides,
  }
}

const servicesApi: ServicesApi = {
  list: vi.fn().mockResolvedValue([]),
  create: vi.fn(),
  update: vi.fn(),
  putFiscalConfig: vi.fn(),
}

async function openPlan(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /Plan real/ }))
}

describe('TreatmentsPanel', () => {
  it('does not expose versioned plan controls before the authoritative detail response arrives', async () => {
    let resolvePlan!: (value: typeof plan) => void
    const getPlan = vi.fn(() => new Promise<typeof plan>((resolve) => { resolvePlan = resolve }))
    render(<TreatmentsPanel api={api({ getPlan })} servicesApi={servicesApi} patientId={patientId} userId={userId} owner />)
    const user = userEvent.setup()

    await openPlan(user)

    expect(screen.getByText('Verificando estado actual del plan…')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cambiar estado' })).not.toBeInTheDocument()
    resolvePlan(plan)
    expect(await screen.findByRole('button', { name: 'Cambiar estado' })).toBeDisabled()
  })

  it('keeps a conflict visible after it refreshes the authoritative plan', async () => {
    const transitionPlan = vi.fn().mockRejectedValue(new ApiError({ status: 412, code: 'PRECONDITION_FAILED' }))
    render(<TreatmentsPanel api={api({ transitionPlan })} servicesApi={servicesApi} patientId={patientId} userId={userId} owner />)
    const user = userEvent.setup()

    await openPlan(user)
    await screen.findByRole('button', { name: 'Cambiar estado' })
    await user.selectOptions(screen.getByLabelText('Cambiar estado'), 'CANCELLED')
    await user.click(screen.getByRole('button', { name: 'Cambiar estado' }))
    await user.click(screen.getByRole('button', { name: 'Confirmar cambio' }))

    expect(await screen.findByText(/El plan cambió en otra sesión/)).toBeInTheDocument()
  })

  it('does not offer owner-only creation controls to a read-only assistant', async () => {
    render(<TreatmentsPanel api={api({ listPlans: vi.fn().mockResolvedValue([]) })} servicesApi={servicesApi} patientId={patientId} userId={userId} owner={false} />)

    expect(await screen.findByText('No hay planes de tratamiento registrados.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nuevo plan' })).not.toBeInTheDocument()
  })

  it('requires a cancellation reason and sends the entered reason with fresh versions', async () => {
    const transitionItem = vi.fn().mockResolvedValue({ ...item, status: 'CANCELLED' as const, version: 8 })
    render(<TreatmentsPanel api={api({ listItems: vi.fn().mockResolvedValue([item]), transitionItem })} servicesApi={servicesApi} patientId={patientId} userId={userId} owner />)
    const user = userEvent.setup()

    await openPlan(user)
    await user.selectOptions(screen.getByLabelText('Cambiar estado del procedimiento'), 'CANCELLED')
    await user.click(screen.getByRole('button', { name: 'Cambiar estado del procedimiento Limpieza' }))
    expect(screen.getByLabelText('Motivo de cancelación')).toBeRequired()
    await user.click(screen.getByRole('button', { name: 'Confirmar cambio del procedimiento' }))
    expect(transitionItem).not.toHaveBeenCalled()
    expect(await screen.findByText('Indicá el motivo de la cancelación.')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Motivo de cancelación'), 'Duplicado')
    await user.click(screen.getByRole('button', { name: 'Confirmar cambio del procedimiento' }))

    expect(transitionItem).toHaveBeenCalledWith(plan.id, item.id, plan.version, item.version, 'CANCELLED', 'Duplicado')
  })

  it('does not offer non-cancellation plan transitions without active items', async () => {
    render(<TreatmentsPanel api={api({ listItems: vi.fn().mockResolvedValue([]) })} servicesApi={servicesApi} patientId={patientId} userId={userId} owner />)
    const user = userEvent.setup()

    await openPlan(user)

    expect(screen.getByRole('option', { name: 'CANCELLED' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'PROPOSED' })).not.toBeInTheDocument()
  })

  it('allows additions only on draft plans and limits draft item transitions to cancellation', async () => {
    render(<TreatmentsPanel api={api({ listItems: vi.fn().mockResolvedValue([item]) })} servicesApi={servicesApi} patientId={patientId} userId={userId} owner />)
    const user = userEvent.setup()

    await openPlan(user)

    expect(screen.getByRole('button', { name: 'Agregar procedimiento' })).toBeInTheDocument()
    expect(screen.getAllByRole('option', { name: 'CANCELLED' })).toHaveLength(2)
    expect(screen.queryByRole('option', { name: 'SCHEDULED' })).not.toBeInTheDocument()
  })

  it('does not allow item mutations on terminal plans', async () => {
    render(<TreatmentsPanel api={api({ getPlan: vi.fn().mockResolvedValue({ ...plan, status: 'COMPLETED' as const }), listItems: vi.fn().mockResolvedValue([item]) })} servicesApi={servicesApi} patientId={patientId} userId={userId} owner />)
    const user = userEvent.setup()

    await openPlan(user)

    expect(screen.queryByRole('button', { name: 'Agregar procedimiento' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Cambiar estado del procedimiento')).not.toBeInTheDocument()
  })

  it('hides plan and item mutation controls when the authenticated provider does not own the plan', async () => {
    render(<TreatmentsPanel api={api({ getPlan: vi.fn().mockResolvedValue({ ...plan, providerUserId: patientId }), listItems: vi.fn().mockResolvedValue([item]) })} servicesApi={servicesApi} patientId={patientId} userId={userId} owner />)
    const user = userEvent.setup()

    await openPlan(user)
    await screen.findByLabelText('Detalle del plan')

    expect(screen.queryByLabelText('Cambiar estado')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Cambiar estado del procedimiento')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Agregar procedimiento' })).not.toBeInTheDocument()
  })

  it('uses FDI-dependent surface selectors rather than arbitrary surface text', async () => {
    const catalog = { id: item.serviceId, code: 'LIMP', name: 'Limpieza', defaultPrice: '100', currency: 'MXN', active: true, version: 1 }
    const addItem = vi.fn().mockResolvedValue(item)
    render(<TreatmentsPanel api={api({ listItems: vi.fn().mockResolvedValue([]), addItem })} servicesApi={{ ...servicesApi, list: vi.fn().mockResolvedValue([catalog]) }} patientId={patientId} userId={userId} owner />)
    const user = userEvent.setup()

    await openPlan(user)
    await user.click(screen.getByRole('button', { name: 'Agregar procedimiento' }))
    await user.selectOptions(await screen.findByLabelText('Servicio del catálogo'), item.serviceId)
    await user.selectOptions(screen.getByLabelText('Pieza FDI (opcional)'), '11')

    expect(screen.queryByLabelText('Superficies separadas por coma')).not.toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'INCISAL' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'OCCLUSAL' })).not.toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Superficies de la pieza'), ['MESIAL', 'INCISAL'])
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(addItem).toHaveBeenCalledWith(plan.id, plan.version, expect.objectContaining({ toothNumber: 11, surfaces: ['MESIAL', 'INCISAL'] }))
  })
})
