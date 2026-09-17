import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import type { AuthApi } from '../features/auth/application/authApi'
import { AuthProvider } from '../features/auth/application/AuthProvider'
import { ApiError } from '../shared/api/problem'
import type { CurrentUser } from '../features/auth/domain/auth'

export const DEFAULT_FAKE_USER: CurrentUser = {
  id: 'id-1',
  email: 'mariana@clinica.mx',
  firstName: 'Mariana',
  lastName: 'Cázares',
  role: 'OWNER_DENTIST',
  mfaRequired: true,
}

export function createFakeAuthApi(overrides: Partial<AuthApi> = {}): AuthApi {
  return {
    login: vi.fn(),
    verifyMfa: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
    logoutAll: vi.fn().mockResolvedValue(undefined),
    me: vi.fn().mockRejectedValue(new ApiError({ status: 401, code: 'AUTHENTICATION_REQUIRED' })),
    rotateCsrf: vi.fn(),
    forgotPassword: vi.fn().mockResolvedValue(undefined),
    resetPassword: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

interface RenderAuthenticatedOptions {
  route?: string
  user?: CurrentUser
  api?: AuthApi
}

export function renderAuthenticated(ui: ReactElement, options: RenderAuthenticatedOptions = {}) {
  const user = options.user ?? DEFAULT_FAKE_USER
  const api = options.api ?? createFakeAuthApi({ me: vi.fn().mockResolvedValue(user) })

  return render(
    <AuthProvider api={api}>
      <MemoryRouter initialEntries={[options.route ?? '/']}>{ui}</MemoryRouter>
    </AuthProvider>,
  )
}
