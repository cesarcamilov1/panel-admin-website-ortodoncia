import { useMemo } from 'react'
import { useHttpTransport } from '../../../shared/api/httpContext'
import { createConsentsApi, type ConsentsApi } from './consentsApi'
export function useConsentsApi(): ConsentsApi { const http = useHttpTransport(); return useMemo(() => createConsentsApi(http), [http]) }
