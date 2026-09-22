import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { HttpTransport } from '../../../../shared/api/http'
import { HttpContext } from '../../../../shared/api/httpContext'
import { createFakeAuthApi, renderAuthenticated } from '../../../../test/auth'
import { NewAppointmentModal } from './NewAppointmentModal'

const PROVIDER = '33333333-3333-4333-8333-333333333333'
const PATIENT = '22222222-2222-4222-8222-222222222222'

function renderAssistant(http: HttpTransport) {
  const user = { id: 'assistant-id', email: 'asistente@example.mx', firstName: 'Ada', lastName: 'Asistente', role: 'ASSISTANT' as const, mfaRequired: true }
  return renderAuthenticated(<HttpContext value={http}><NewAppointmentModal onClose={vi.fn()} /></HttpContext>, { user, api: createFakeAuthApi({ me: vi.fn().mockResolvedValue(user) }) })
}

describe('<NewAppointmentModal />', () => {
  it('requires an assistant to explicitly supply the professional UUID before loading dependent data or creating', async () => {
    const get = vi.fn((path: string) => {
      if (path.startsWith('/api/v1/patients')) return Promise.resolve({ items: [{ id: PATIENT, record_number: 12, first_name: 'Paz', last_name: 'Paciente', phone_e164: '+525500000000', email: '', status: 'ACTIVE', archived: false, booking_blocked: false, version: 1 }] })
      if (path.startsWith('/api/v1/services')) return Promise.resolve([])
      if (path.startsWith('/api/v1/schedules/locations')) return Promise.resolve({ items: [] })
      return Promise.resolve({ items: [] })
    })
    const post = vi.fn().mockResolvedValue({})
    const http = { get, post, put: vi.fn(), patch: vi.fn(), del: vi.fn(), upload: vi.fn(), download: vi.fn() } as unknown as HttpTransport
    const user = userEvent.setup()

    renderAssistant(http)

    const provider = await screen.findByLabelText(/uuid del profesional/i)
    await waitFor(() => expect(provider).toBeEnabled())
    expect(provider).toHaveValue('')
    expect(get).not.toHaveBeenCalledWith(expect.stringContaining('provider_user_id=assistant-id'))
    await user.type(provider, PROVIDER)
    await waitFor(() => expect(get).toHaveBeenCalledWith(expect.stringContaining(`provider_user_id=${PROVIDER}`)))
    expect(post).not.toHaveBeenCalled()
  })
})
