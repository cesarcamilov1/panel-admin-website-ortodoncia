import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AuthContext } from '../../auth/application/authContext'
import { HttpContext } from '../../../shared/api/httpContext'
import type { HttpTransport } from '../../../shared/api/http'
import { RecordsPage } from './RecordsPage'

vi.mock('../../reminders/ui/RemindersPage', () => ({ RemindersPage: () => <h1>Recordatorios cargados</h1> }))

function setup(role: 'OWNER_DENTIST' | 'BILLING' | 'ASSISTANT' = 'BILLING') {
  const http = { get: vi.fn().mockResolvedValue({ items: [] }), post: vi.fn(), put: vi.fn(), patch: vi.fn(), del: vi.fn(), upload: vi.fn(), download: vi.fn() } as unknown as HttpTransport
  render(<HttpContext value={http}><AuthContext value={{ state: { status: 'authenticated', user: { id: 'billing-user', email: 'billing@example.mx', firstName: 'Bea', lastName: 'Cobros', role, mfaRequired: false } }, login: vi.fn(), verifyMfa: vi.fn(), logout: vi.fn(), logoutAll: vi.fn(), refresh: vi.fn(), forgotPassword: vi.fn(), resetPassword: vi.fn() }}><RecordsPage section="facturacion" /></AuthContext></HttpContext>)
  return http
}

describe('Billing through RecordsPage', () => {
  it('routes facturación to the live billing feature rather than fixture rows', async () => {
    const http = setup()
    expect(await screen.findByRole('heading', { name: 'Facturación' })).toBeInTheDocument()
    expect(http.get).toHaveBeenCalledWith('/api/v1/billing/documents?limit=25', expect.anything())
    expect(screen.queryByText('$18,450')).not.toBeInTheDocument()
  })

  it('does not request billing data for a role denied by the billing handler', () => {
    const http = setup('ASSISTANT')
    expect(screen.getByRole('alert')).toHaveTextContent(/no tiene acceso/i)
    expect(http.get).not.toHaveBeenCalled()
  })

  it('shows an accessible fallback while a feature-specific records chunk loads', async () => {
    render(<RecordsPage section="recordatorios" />)

    expect(screen.getByRole('status')).toHaveTextContent('Cargando sección…')
    expect(await screen.findByRole('heading', { name: 'Recordatorios cargados' })).toBeInTheDocument()
  })
})
