import { useMemo } from 'react'
import { useHttp } from '../../../shared/api/httpContext'
import { type ServicesApi, createServicesApi } from './servicesApi'

export function useServicesApi(): ServicesApi {
  const http = useHttp()
  return useMemo(() => createServicesApi(http), [http])
}
