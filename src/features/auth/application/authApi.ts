import type { HttpClient } from '../../../shared/api/http'
import { ApiError } from '../../../shared/api/problem'
import { type CurrentUser, type CurrentUserDto, fromCurrentUserDto } from '../domain/auth'

export type LoginResult =
  | { kind: 'authenticated'; csrfToken: string }
  | { kind: 'mfa'; challengeToken: string }

interface LoginResponseDto {
  mfa_required: boolean
  csrf_token?: string
  challenge_token?: string
}

interface VerifyMfaResponseDto {
  csrf_token: string
}

interface CsrfResponseDto {
  csrf_token: string
}

interface ForgotPasswordResponseDto {
  message: string
}

export interface AuthApi {
  login: (credentials: { email: string; password: string }) => Promise<LoginResult>
  verifyMfa: (input: { challengeToken: string; code: string }) => Promise<{ csrfToken: string }>
  logout: () => Promise<void>
  logoutAll: () => Promise<void>
  me: () => Promise<CurrentUser>
  rotateCsrf: () => Promise<{ csrfToken: string }>
  forgotPassword: (email: string) => Promise<void>
  resetPassword: (input: { token: string; newPassword: string }) => Promise<void>
}

export function createAuthApi(http: HttpClient): AuthApi {
  return {
    async login({ email, password }) {
      const response = await http.post<LoginResponseDto>('/api/v1/auth/login', { email, password })

      if (response.mfa_required === true) {
        if (typeof response.challenge_token !== 'string') {
          throw new ApiError({ status: 200, code: 'MALFORMED_RESPONSE' })
        }
        return { kind: 'mfa', challengeToken: response.challenge_token }
      }

      if (typeof response.csrf_token !== 'string') {
        throw new ApiError({ status: 200, code: 'MALFORMED_RESPONSE' })
      }
      return { kind: 'authenticated', csrfToken: response.csrf_token }
    },

    async verifyMfa({ challengeToken, code }) {
      const response = await http.post<VerifyMfaResponseDto>('/api/v1/auth/mfa/verify', {
        challenge_token: challengeToken,
        code,
      })
      return { csrfToken: response.csrf_token }
    },

    async logout() {
      await http.post('/api/v1/auth/logout')
    },

    async logoutAll() {
      await http.post('/api/v1/auth/logout-all')
    },

    async me() {
      const dto = await http.get<CurrentUserDto>('/api/v1/auth/me')
      return fromCurrentUserDto(dto)
    },

    async rotateCsrf() {
      const response = await http.get<CsrfResponseDto>('/api/v1/auth/csrf')
      return { csrfToken: response.csrf_token }
    },

    async forgotPassword(email: string) {
      await http.post<ForgotPasswordResponseDto>('/api/v1/auth/password/forgot', { email })
    },

    async resetPassword({ token, newPassword }) {
      await http.post('/api/v1/auth/password/reset', { token, new_password: newPassword })
    },
  }
}
