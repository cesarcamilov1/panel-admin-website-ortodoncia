import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { type AuthApi } from './authApi'
import { type AuthClient, createAuthClient } from './authClient'
import { AuthContext, type AuthState } from './authContext'
import { createCsrfTokenStore } from './csrfTokenStore'
import { ApiError, isApiError } from '../../../shared/api/problem'

function isSessionGone(error: unknown): boolean {
  return isApiError(error) && error.status === 401
}

function toApiError(error: unknown): ApiError {
  return isApiError(error) ? error : new ApiError({ status: 0, code: 'UNKNOWN' })
}

interface AuthProviderProps {
  api?: AuthApi
  children: ReactNode
}

export function AuthProvider({ api: injectedApi, children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({ status: 'loading' })
  const [localCsrfStore] = useState(() => createCsrfTokenStore())
  const [authClient] = useState<AuthClient | null>(() =>
    injectedApi ? null : createAuthClient(() => setState({ status: 'anonymous' })),
  )

  const api = injectedApi ?? authClient!.api
  const csrfStore = injectedApi ? localCsrfStore : authClient!.csrfTokenStore

  const refresh = useCallback(async () => {
    try {
      const user = await api.me()
      setState({ status: 'authenticated', user })
    } catch (error) {
      if (isSessionGone(error)) setState({ status: 'anonymous' })
      else setState({ status: 'unavailable', error: toApiError(error) })
    }
  }, [api])

  useEffect(() => {
    // Synchronizes auth state with the server session on boot (external system).
    // oxlint-disable-next-line react/set-state-in-effect
    void refresh()
  }, [refresh])

  const login = useCallback(
    async (credentials: { email: string; password: string }) => {
      const result = await api.login(credentials)
      if (result.kind === 'mfa') {
        return { kind: 'mfa' as const, challengeToken: result.challengeToken }
      }
      csrfStore.set(result.csrfToken)
      const user = await api.me()
      setState({ status: 'authenticated', user })
      return { kind: 'authenticated' as const }
    },
    [api, csrfStore],
  )

  const verifyMfa = useCallback(
    async (input: { challengeToken: string; code: string }) => {
      const result = await api.verifyMfa(input)
      csrfStore.set(result.csrfToken)
      const user = await api.me()
      setState({ status: 'authenticated', user })
    },
    [api, csrfStore],
  )

  const logout = useCallback(async () => {
    try {
      await api.logout()
    } catch (error) {
      if (!isSessionGone(error)) throw error
    }
    csrfStore.clear()
    setState({ status: 'anonymous' })
  }, [api, csrfStore])

  const logoutAll = useCallback(async () => {
    try {
      await api.logoutAll()
    } catch (error) {
      if (!isSessionGone(error)) throw error
    }
    csrfStore.clear()
    setState({ status: 'anonymous' })
  }, [api, csrfStore])

  const forgotPassword = useCallback((email: string) => api.forgotPassword(email), [api])
  const resetPassword = useCallback(
    async (input: { token: string; newPassword: string }) => {
      await api.resetPassword(input)
      // A successful reset revokes every session and clears the cookie server-side.
      csrfStore.clear()
      setState({ status: 'anonymous' })
    },
    [api, csrfStore],
  )

  const value = useMemo(
    () => ({ state, login, verifyMfa, logout, logoutAll, refresh, forgotPassword, resetPassword }),
    [state, login, verifyMfa, logout, logoutAll, refresh, forgotPassword, resetPassword],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
