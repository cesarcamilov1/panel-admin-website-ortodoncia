import type { ReactNode } from 'react'
import type { HttpClient } from './http'
import { HttpContext } from './httpContext'

interface HttpProviderProps {
  client: HttpClient
  children: ReactNode
}

/**
 * One client, one CSRF token store, one 401 handler for the whole app. A feature that
 * builds its own client would start with an empty token store and every mutation would
 * 403 before fighting the real client over token rotation.
 */
export function HttpProvider({ client, children }: HttpProviderProps) {
  return <HttpContext value={client}>{children}</HttpContext>
}
