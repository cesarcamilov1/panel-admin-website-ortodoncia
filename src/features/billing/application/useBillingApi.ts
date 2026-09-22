import { useMemo } from 'react'
import { useHttpTransport } from '../../../shared/api/httpContext'
import { createBillingApi, type BillingApi } from './billingApi'

export function useBillingApi(): BillingApi {
  const http = useHttpTransport()
  return useMemo(() => createBillingApi(http), [http])
}
