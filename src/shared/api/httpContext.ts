import { createContext, use } from 'react'
import { isHttpTransport, type HttpClient, type HttpTransport } from './http'

export const HttpContext = createContext<HttpClient | null>(null)

export function useHttp(): HttpClient {
  const client = use(HttpContext)
  if (!client) {
    throw new Error('useHttp requires an HttpProvider above it in the tree.')
  }
  return client
}

/** Access the extended PATCH and binary transport from the application provider. */
export function useHttpTransport(): HttpTransport {
  const client = useHttp()
  if (!isHttpTransport(client)) {
    throw new Error('useHttpTransport requires an HttpTransport-capable HttpProvider.')
  }
  return client
}
