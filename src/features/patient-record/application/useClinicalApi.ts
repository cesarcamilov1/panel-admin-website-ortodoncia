import { useMemo } from 'react'
import { useHttpTransport } from '../../../shared/api/httpContext'
import { createClinicalApi, type ClinicalApi } from './clinicalApi'

export function useClinicalApi(): ClinicalApi {
  const http = useHttpTransport()
  return useMemo(() => createClinicalApi(http), [http])
}
