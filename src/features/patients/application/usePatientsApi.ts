import { useMemo } from 'react'
import { useHttpTransport } from '../../../shared/api/httpContext'
import { createPatientsApi, type PatientsApi } from './patientsApi'

export function usePatientsApi(): PatientsApi {
  const http = useHttpTransport()
  return useMemo(() => createPatientsApi(http), [http])
}
