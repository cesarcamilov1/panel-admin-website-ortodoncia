import { useMemo } from 'react'
import { useHttpTransport } from '../../../shared/api/httpContext'
import { createFiscalApi } from './fiscalApi'

export function useFiscalApi() {
  const http = useHttpTransport()
  return useMemo(() => createFiscalApi(http), [http])
}
