import { useMemo } from 'react'
import { useHttpTransport } from '../../../shared/api/httpContext'
import { createTreatmentsApi, type TreatmentsApi } from './treatmentsApi'
export function useTreatmentsApi(): TreatmentsApi { const http = useHttpTransport(); return useMemo(() => createTreatmentsApi(http), [http]) }
