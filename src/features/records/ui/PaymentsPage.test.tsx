import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AuthContext } from '../../auth/application/authContext'
import { HttpContext } from '../../../shared/api/httpContext'
import type { HttpTransport } from '../../../shared/api/http'
import { RecordsPage } from './RecordsPage'

const patient = {
  id: '11111111-1111-1111-1111-111111111111', record_number: 42, first_name: 'Lucía', last_name: 'Mendoza', preferred_name: null,
  phone_e164: '+525518742093', email: null, status: 'ACTIVE', archived: false, booking_blocked: false, version: 3,
}

function setup(role: 'OWNER_DENTIST' | 'BILLING' | 'ASSISTANT' = 'BILLING') {
  const http = {
    get: vi.fn().mockImplementation((path: string) => Promise.resolve(path.startsWith('/api/v1/patients?') ? { items: [patient] } : { items: [] })),
    post: vi.fn(), put: vi.fn(), patch: vi.fn(), del: vi.fn(), upload: vi.fn(), download: vi.fn(),
  } as unknown as HttpTransport
  render(<HttpContext value={http}><AuthContext value={{ state: { status: 'authenticated', user: { id: 'billing-user', email: 'billing@example.mx', firstName: 'Bea', lastName: 'Cobros', role, mfaRequired: false } }, login: vi.fn(), verifyMfa: vi.fn(), logout: vi.fn(), logoutAll: vi.fn(), refresh: vi.fn(), forgotPassword: vi.fn(), resetPassword: vi.fn() }}><RecordsPage section="pagos" /></AuthContext></HttpContext>)
  return http
}

describe('PaymentsPage through RecordsPage', () => {
  it('replaces global payment fixtures with a patient lookup and a real patient-scoped list', async () => {
    const http = setup()
    const user = userEvent.setup()

    expect(screen.queryByText('$18,450')).not.toBeInTheDocument()
    await user.type(screen.getByLabelText('Buscar paciente'), 'Lucía')
    await user.click(await screen.findByRole('button', { name: /Lucía Mendoza/i }))

    expect(await screen.findByRole('heading', { name: 'Pagos de Lucía Mendoza' })).toBeInTheDocument()
    expect(http.get).toHaveBeenCalledWith('/api/v1/payments?patient_id=11111111-1111-1111-1111-111111111111&limit=25', expect.anything())
  })

  it('does not make patient or payment requests for an assistant role denied by the payment service', () => {
    const http = setup('ASSISTANT')

    expect(screen.getByRole('alert')).toHaveTextContent(/no tiene acceso/i)
    expect(http.get).not.toHaveBeenCalled()
  })
})
