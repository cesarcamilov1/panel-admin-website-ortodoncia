import { createContext, useContext } from 'react'
import type { ApiError } from '../../../shared/api/problem'
import type { CurrentUser } from '../domain/auth'

export type AuthState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'authenticated'; user: CurrentUser }
  | { status: 'unavailable'; error: ApiError }

export interface AuthContextValue {
  state: AuthState
  login: (credentials: {
    email: string
    password: string
  }) => Promise<{ kind: 'authenticated' } | { kind: 'mfa'; challengeToken: string }>
  verifyMfa: (input: { challengeToken: string; code: string }) => Promise<void>
  logout: () => Promise<void>
  logoutAll: () => Promise<void>
  refresh: () => Promise<void>
  forgotPassword: (email: string) => Promise<void>
  resetPassword: (input: { token: string; newPassword: string }) => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
