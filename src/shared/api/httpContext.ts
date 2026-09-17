import { createContext, use } from 'react'
import type { HttpClient } from './http'

export const HttpContext = createContext<HttpClient | null>(null)

export function useHttp(): HttpClient {
  const client = use(HttpContext)
  if (!client) {
    throw new Error('useHttp requires an HttpProvider above it in the tree.')
  }
  return client
}
