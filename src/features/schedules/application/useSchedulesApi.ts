import { useMemo } from 'react'
import { useHttp } from '../../../shared/api/httpContext'
import { type SchedulesApi, createSchedulesApi } from './schedulesApi'

export function useSchedulesApi(): SchedulesApi {
  const http = useHttp()
  return useMemo(() => createSchedulesApi(http), [http])
}
