import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  type WorkSchedule,
  type WorkScheduleDraft,
  byWeekdayThenStart,
  scheduleErrorMessage,
} from '../domain/workSchedule'
import type { ListWorkSchedulesQuery, SchedulesApi } from './schedulesApi'

export type WorkSchedulesState =
  | { status: 'loading' }
  | { status: 'ready'; schedules: WorkSchedule[] }
  | { status: 'error'; message: string }

export interface WorkScheduleWeek {
  state: WorkSchedulesState
  reload: () => Promise<void>
  create: (draft: WorkScheduleDraft) => Promise<WorkSchedule>
  remove: (schedule: WorkSchedule) => Promise<void>
}

export function useWorkSchedules(
  api: SchedulesApi,
  providerUserId: string,
  locationId: string,
): WorkScheduleWeek {
  const [state, setState] = useState<WorkSchedulesState>({ status: 'loading' })

  const reload = useCallback(async () => {
    const query: ListWorkSchedulesQuery = locationId
      ? { providerUserId, locationId }
      : { providerUserId }
    try {
      const schedules = await api.listSchedules(query)
      setState({ status: 'ready', schedules })
    } catch (error) {
      setState({ status: 'error', message: scheduleErrorMessage(error) })
    }
  }, [api, providerUserId, locationId])

  useEffect(() => {
    // Synchronizes with the server on mount and whenever provider or location changes.
    // oxlint-disable-next-line react/set-state-in-effect
    void reload()
  }, [reload])

  const create = useCallback(
    async (draft: WorkScheduleDraft) => {
      const created = await api.createSchedule({ providerUserId, draft })
      setState((current) =>
        current.status === 'ready'
          ? { status: 'ready', schedules: byWeekdayThenStart([...current.schedules, created]) }
          : current,
      )
      return created
    },
    [api, providerUserId],
  )

  const remove = useCallback(
    async (schedule: WorkSchedule) => {
      await api.deleteSchedule({ id: schedule.id, providerUserId })
      setState((current) =>
        current.status === 'ready'
          ? {
              status: 'ready',
              schedules: current.schedules.filter((item) => item.id !== schedule.id),
            }
          : current,
      )
    },
    [api, providerUserId],
  )

  return useMemo(() => ({ state, reload, create, remove }), [state, reload, create, remove])
}
