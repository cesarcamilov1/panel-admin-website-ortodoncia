import { useMemo } from 'react'
import { useHttpTransport } from '../../../shared/api/httpContext'
import { createPaymentsApi, type PaymentsApi } from './paymentsApi'

export function usePaymentsApi(): PaymentsApi {
  const http = useHttpTransport()
  return useMemo(() => createPaymentsApi(http), [http])
}
