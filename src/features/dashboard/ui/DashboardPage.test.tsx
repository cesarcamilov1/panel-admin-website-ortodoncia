import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DashboardPage } from './DashboardPage'

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  http: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  appointmentsApi: { list: vi.fn() },
}))

vi.mock('../../auth/application/authContext', () => ({ useAuth: mocks.useAuth }))
vi.mock('../../../shared/api/httpContext', () => ({ useHttpTransport: () => mocks.http }))
vi.mock('../../agenda/application/useAppointmentsApi', () => ({ useAppointmentsApi: () => mocks.appointmentsApi }))

describe('DashboardPage', () => {
  beforeEach(() => { vi.clearAllMocks() })
  it('uses the appointment snapshot name when returned and does not fetch patients per row', async () => {
    mocks.useAuth.mockReturnValue({ state: { status: 'authenticated', user: { role: 'OWNER_DENTIST' } } })
    mocks.appointmentsApi.list.mockResolvedValue([{ id: 'appointment-1', patientId: 'patient-1', patientName: 'María Pérez', startsAt: '2025-01-01T10:00:00Z', status: 'CONFIRMED', reason: '', providerUserId: 'provider-1' }])
    mocks.http.get.mockResolvedValue({ queued: 1 })

    render(<BrowserRouter><DashboardPage /></BrowserRouter>)

    expect(await screen.findByText('María Pérez')).toBeInTheDocument()
    expect(mocks.http.get).toHaveBeenCalledTimes(1)
    expect(mocks.http.get).toHaveBeenCalledWith('/api/v1/communications/metrics', undefined)
  })

  it('uses an honest patient ID label when no snapshot name exists', async () => {
    mocks.useAuth.mockReturnValue({ state: { status: 'authenticated', user: { role: 'OWNER_DENTIST' } } })
    mocks.appointmentsApi.list.mockResolvedValue([{ id: 'appointment-2', patientId: 'patient-2', startsAt: '2025-01-01T10:00:00Z', status: 'PENDING', reason: '', providerUserId: 'provider-1' }])
    mocks.http.get.mockResolvedValue({})

    render(<BrowserRouter><DashboardPage /></BrowserRouter>)

    expect(await screen.findByText('Paciente patient-2')).toBeInTheDocument()
  })

  it('does not request protected data for denied roles', () => {
    mocks.useAuth.mockReturnValue({ state: { status: 'authenticated', user: { role: 'BILLING' } } })
    render(<BrowserRouter><DashboardPage /></BrowserRouter>)
    expect(screen.getByText('Tu rol no puede consultar este resumen.')).toBeInTheDocument()
    expect(mocks.http.get).not.toHaveBeenCalled()
    expect(mocks.appointmentsApi.list).not.toHaveBeenCalled()
  })
})
