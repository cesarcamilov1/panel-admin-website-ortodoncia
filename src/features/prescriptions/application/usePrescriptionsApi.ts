import { useMemo } from 'react'
import { useHttpTransport } from '../../../shared/api/httpContext'
import { createPrescriptionsApi, type PrescriptionsApi } from './prescriptionsApi'
export function usePrescriptionsApi(): PrescriptionsApi { const http = useHttpTransport(); return useMemo(() => createPrescriptionsApi(http), [http]) }
