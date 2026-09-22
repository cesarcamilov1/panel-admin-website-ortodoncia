import { useMemo } from 'react'
import { useHttpTransport } from '../../../shared/api/httpContext'
import { createCommunicationsApi, type CommunicationsApi } from './communicationsApi'

export function useCommunicationsApi(): CommunicationsApi {
  const http = useHttpTransport()
  return useMemo(() => createCommunicationsApi(http), [http])
}
