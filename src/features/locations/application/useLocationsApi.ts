import { useMemo } from 'react'
import { useHttp } from '../../../shared/api/httpContext'
import { type LocationsApi, createLocationsApi } from './locationsApi'

export function useLocationsApi(): LocationsApi {
  const http = useHttp()
  return useMemo(() => createLocationsApi(http), [http])
}
