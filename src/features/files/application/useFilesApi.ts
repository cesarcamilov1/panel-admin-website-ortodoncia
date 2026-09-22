import { useMemo } from 'react'
import { useHttpTransport } from '../../../shared/api/httpContext'
import { createFilesApi } from './filesApi'

export function useFilesApi() {
  const http = useHttpTransport()
  return useMemo(() => createFilesApi(http), [http])
}
