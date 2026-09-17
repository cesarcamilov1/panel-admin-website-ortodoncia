import { createHttpClient, type HttpClient } from '../../../shared/api/http'
import { type AuthApi, createAuthApi } from './authApi'
import { createCsrfTokenStore } from './csrfTokenStore'

export interface AuthClient {
  api: AuthApi
  csrfTokenStore: ReturnType<typeof createCsrfTokenStore>
}

export function createAuthClient(onUnauthorized: () => void): AuthClient {
  const csrfTokenStore = createCsrfTokenStore()

  const http: HttpClient = createHttpClient({
    baseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
    getCsrfToken: csrfTokenStore.get,
    setCsrfToken: csrfTokenStore.set,
    onUnauthorized: () => {
      csrfTokenStore.clear()
      onUnauthorized()
    },
  })

  return { api: createAuthApi(http), csrfTokenStore }
}
