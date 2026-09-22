import { render, screen } from '@testing-library/react'
import { MemoryRouter, Outlet } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { AuthContext, type AuthContextValue } from './features/auth/application/authContext'

vi.mock('./features/auth/ui/LoginPage', () => ({ LoginPage: () => <h1>Login screen</h1> }))
vi.mock('./features/auth/ui/ForgotPasswordPage', () => ({ ForgotPasswordPage: () => <h1>Password recovery</h1> }))
vi.mock('./features/auth/ui/ResetPasswordPage', () => ({ ResetPasswordPage: () => <h1>Password reset</h1> }))
vi.mock('./features/panel/ui/PanelShell', () => ({ PanelShell: () => <Outlet /> }))
vi.mock('./features/patients/ui/PatientsPage', () => ({ PatientsPage: () => <h1>Patients screen</h1> }))
vi.mock('./features/patient-record/ui/PatientRecordPage', () => ({ PatientRecordPage: () => <h1>Patient record screen</h1> }))

const authenticated: AuthContextValue = {
  state: {
    status: 'authenticated',
    user: { id: 'user-1', email: 'owner@example.mx', firstName: 'Ada', lastName: 'Lovelace', role: 'OWNER_DENTIST', mfaRequired: false },
  },
  login: vi.fn(),
  verifyMfa: vi.fn(),
  logout: vi.fn(),
  logoutAll: vi.fn(),
  refresh: vi.fn(),
  forgotPassword: vi.fn(),
  resetPassword: vi.fn(),
}

const anonymous: AuthContextValue = { ...authenticated, state: { status: 'anonymous' } }

function renderApp(path: string, auth = authenticated) {
  return render(
    <AuthContext value={auth}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </AuthContext>,
  )
}

describe('App route loading', () => {
  it('keeps protected routes behind auth while their screen chunk is loading', async () => {
    renderApp('/pacientes')

    expect(screen.getByRole('status')).toHaveTextContent('Cargando sección…')
    expect(await screen.findByRole('heading', { name: 'Patients screen' })).toBeInTheDocument()
  })

  it('redirects an anonymous protected patient route to login', async () => {
    renderApp('/pacientes', anonymous)

    expect(await screen.findByRole('heading', { name: 'Login screen' })).toBeInTheDocument()
  })

  it('matches a UUID patient route without changing its patientId path', async () => {
    renderApp('/pacientes/7e57d004-2b97-0e7a-b45f-5387367791cd')

    expect(await screen.findByRole('heading', { name: 'Patient record screen' })).toBeInTheDocument()
  })
})
