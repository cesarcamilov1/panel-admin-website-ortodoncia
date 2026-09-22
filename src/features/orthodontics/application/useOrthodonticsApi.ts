import { useMemo } from 'react'
import { useHttpTransport } from '../../../shared/api/httpContext'
import { createOrthodonticsApi, type OrthodonticsApi } from './orthodonticsApi'
export function useOrthodonticsApi(): OrthodonticsApi { const http = useHttpTransport(); return useMemo(() => createOrthodonticsApi(http), [http]) }
