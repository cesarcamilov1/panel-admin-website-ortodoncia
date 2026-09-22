import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { PanelActionsContext, type PanelActions } from '../../panel/application/panelContext'
import type { PatientsApi } from '../application/patientsApi'
import { PatientsScreen } from './PatientsPage'

const summary = {
  id: '11111111-1111-1111-1111-111111111111', recordNumber: 42, firstName: 'Lucía', lastName: 'Mendoza', preferredName: '', phoneE164: '+525518742093', email: 'lucia@example.mx', status: 'ACTIVE' as const, archived: false, bookingBlocked: false, version: 3,
}

function api(overrides: Partial<PatientsApi> = {}): PatientsApi {
  return { list: vi.fn().mockResolvedValue({ items: [summary], nextCursor: null }), get: vi.fn(), create: vi.fn(), update: vi.fn(), setBookingBlocked: vi.fn(), archive: vi.fn(), ...overrides }
}

function setup(client = api()) {
  const actions: PanelActions = { openNewAppointment: vi.fn(), notify: vi.fn() }
  render(<MemoryRouter><PanelActionsContext value={actions}><PatientsScreen api={client} canEdit /></PanelActionsContext></MemoryRouter>)
  return { client, user: userEvent.setup() }
}

describe('PatientsScreen', () => {
  it('renders backend patient summaries without invented clinical or financial columns', async () => {
    setup()
    expect(await screen.findByText('Lucía Mendoza')).toBeInTheDocument()
    expect(screen.getByText('Expediente 42')).toBeInTheDocument()
    expect(screen.queryByText(/saldo/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/última visita/i)).not.toBeInTheDocument()
  })

  it('validates the required backend fields before creating', async () => {
    const { client, user } = setup()
    await screen.findByText('Lucía Mendoza')
    await user.click(screen.getByRole('button', { name: /nuevo paciente/i }))
    await user.click(screen.getByRole('button', { name: 'Crear paciente' }))
    expect(await screen.findByText('El nombre es obligatorio.')).toBeInTheDocument()
    expect(client.create).not.toHaveBeenCalled()
  })

  it('shows a retryable error instead of retaining mock rows', async () => {
    const client = api({ list: vi.fn().mockRejectedValue(new Error('offline')) })
    const { user } = setup(client)
    expect(await screen.findByText(/algo salió mal/i)).toBeInTheDocument()
    expect(screen.queryByText('Lucía Mendoza')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(client.list).toHaveBeenCalledTimes(2))
  })
})
