import { useMemo } from 'react'
import { useHttpTransport } from '../../../shared/api/httpContext'
import { createAppointmentsApi, type AppointmentsApi } from './appointmentsApi'

export function useAppointmentsApi(): AppointmentsApi {
  const http = useHttpTransport()
  return useMemo(() => createAppointmentsApi(http), [http])
}
