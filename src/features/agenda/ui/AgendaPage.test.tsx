import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { HttpContext } from '../../../shared/api/httpContext'
import type { HttpTransport } from '../../../shared/api/http'
import { createFakeAuthApi, renderAuthenticated } from '../../../test/auth'
import { AgendaPage } from './AgendaPage'

const PROVIDER = '55555555-5555-4555-8555-555555555555'
const APPOINTMENT_START = new Date()
APPOINTMENT_START.setHours(15, 0, 0, 0)
const APPOINTMENT_END = new Date(APPOINTMENT_START)
APPOINTMENT_END.setMinutes(APPOINTMENT_END.getMinutes() + 30)
const APPOINTMENT = {
  id: '11111111-1111-4111-8111-111111111111', patient_id: '22222222-2222-4222-8222-222222222222',
  provider_user_id: PROVIDER, source: 'MANUAL', starts_at: APPOINTMENT_START.toISOString(), ends_at: APPOINTMENT_END.toISOString(),
  status: 'PENDING', version: 3, services: [], created_at: '2026-09-01T15:00:00Z', updated_at: '2026-09-01T15:00:00Z',
}

function renderAgenda(http: HttpTransport, role: 'OWNER_DENTIST' | 'ASSISTANT' = 'OWNER_DENTIST') {
  return renderAuthenticated(<HttpContext value={http}><AgendaPage /></HttpContext>, {
    user: { id: PROVIDER, email: 'owner@example.mx', firstName: 'Ana', lastName: 'Dueña', role, mfaRequired: true },
    api: createFakeAuthApi({ me: vi.fn().mockResolvedValue({ id: PROVIDER, email: 'owner@example.mx', firstName: 'Ana', lastName: 'Dueña', role, mfaRequired: true }) }),
  })
}

describe('<AgendaPage />', () => {
  it('loads the default agenda even if the provider-scoped waitlist fails', async () => {
    const get = vi.fn((path: string) => {
      if (path.startsWith('/api/v1/appointments?')) return Promise.resolve({ items: [APPOINTMENT] })
      if (path.startsWith('/api/v1/waitlist?')) return Promise.reject(new Error('waitlist unavailable'))
      return Promise.resolve({ items: [] })
    })
    const http = { get, post: vi.fn(), put: vi.fn(), patch: vi.fn(), del: vi.fn(), upload: vi.fn(), download: vi.fn() } as unknown as HttpTransport

    renderAgenda(http)

    await waitFor(() => expect(get).toHaveBeenCalledWith(expect.stringMatching(/^\/api\/v1\/waitlist\?provider_user_id=/), expect.anything()))
    expect(await screen.findByRole('button', { name: /22222222/ })).toBeInTheDocument()
    expect(screen.getByText(/algo salió mal/i)).toBeInTheDocument()
  })

  it('requires an assistant to select a valid provider before listing appointments and scopes the list to that provider', async () => {
    const get = vi.fn().mockResolvedValue({ items: [] })
    const http = { get, post: vi.fn(), put: vi.fn(), patch: vi.fn(), del: vi.fn(), upload: vi.fn(), download: vi.fn() } as unknown as HttpTransport
    const user = userEvent.setup()

    renderAgenda(http, 'ASSISTANT')

    expect(await screen.findByText(/ingresá un UUID válido del profesional responsable para consultar la agenda/i)).toBeInTheDocument()
    expect(get).not.toHaveBeenCalledWith(expect.stringMatching(/^\/api\/v1\/appointments\?/), expect.anything())

    await user.type(screen.getByLabelText('UUID del profesional responsable'), PROVIDER)

    await waitFor(() => expect(get).toHaveBeenCalledWith(expect.stringContaining(`provider_user_id=${PROVIDER}`), expect.anything()))
  })
})
