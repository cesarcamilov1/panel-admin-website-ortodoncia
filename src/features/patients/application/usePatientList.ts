import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { isApiError } from '../../../shared/api/problem'
import { patientErrorMessage, type PatientSummary } from '../domain/patient'
import type { PatientsApi, PatientSort } from './patientsApi'

const SEARCH_DEBOUNCE_MS = 300
const PAGE_SIZE = 25

export type PatientListState =
  | { status: 'loading' }
  | { status: 'ready'; patients: PatientSummary[]; nextCursor: string | null }
  | { status: 'error'; message: string }

function cancelled(error: unknown): boolean {
  return isApiError(error) && error.code === 'CANCELLED'
}

export function usePatientList(api: PatientsApi) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [sort, setSort] = useState<PatientSort>('name')
  const [cursors, setCursors] = useState<string[]>([])
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState<PatientListState>({ status: 'loading' })
  const requestSequence = useRef(0)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.length >= 2 ? query : '')
      setCursors([])
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query])

  const cursor = cursors.at(-1)
  useEffect(() => {
    const controller = new AbortController()
    const sequence = ++requestSequence.current
    // Synchronizes UI state with a new external request.
    // oxlint-disable-next-line react/set-state-in-effect
    setState({ status: 'loading' })
    void api.list({
      q: debouncedQuery || undefined,
      limit: PAGE_SIZE,
      cursor,
      sort,
      signal: controller.signal,
    }).then((page) => {
      if (sequence === requestSequence.current) {
        setState({ status: 'ready', patients: page.items, nextCursor: page.nextCursor })
      }
    }).catch((error: unknown) => {
      if (sequence === requestSequence.current && !cancelled(error)) {
        setState({ status: 'error', message: patientErrorMessage(error) })
      }
    })
    return () => controller.abort()
  }, [api, cursor, debouncedQuery, revision, sort])

  const reload = useCallback(() => setRevision((current) => current + 1), [])
  const nextPage = useCallback(() => {
    if (state.status === 'ready' && state.nextCursor) setCursors((current) => [...current, state.nextCursor!])
  }, [state])
  const previousPage = useCallback(() => setCursors((current) => current.slice(0, -1)), [])
  const changeSort = useCallback((next: PatientSort) => {
    setSort(next)
    setCursors([])
  }, [])

  return useMemo(() => ({
    state, query, setQuery, sort, setSort: changeSort, reload, nextPage, previousPage,
    canGoPrevious: cursors.length > 0,
  }), [state, query, sort, changeSort, reload, nextPage, previousPage, cursors.length])
}
