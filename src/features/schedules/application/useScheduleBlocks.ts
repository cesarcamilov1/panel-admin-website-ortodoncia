import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BLOCK_WINDOW_DAYS,
  type ScheduleBlock,
  type ScheduleBlockDraft,
  blockErrorMessage,
  blockWindow,
  byStartsAt,
} from '../domain/scheduleBlock'
import type { ListScheduleBlocksQuery, SchedulesApi } from './schedulesApi'

export type ScheduleBlocksState =
  | { status: 'loading' }
  | { status: 'ready'; blocks: ScheduleBlock[] }
  | { status: 'error'; message: string }

export interface ScheduleBlockAgenda {
  state: ScheduleBlocksState
  reload: () => Promise<void>
  create: (draft: ScheduleBlockDraft) => Promise<ScheduleBlock>
  remove: (block: ScheduleBlock) => Promise<void>
}

export function useScheduleBlocks(
  api: SchedulesApi,
  providerUserId: string,
  locationId: string,
  windowDays: number = BLOCK_WINDOW_DAYS,
): ScheduleBlockAgenda {
  const [state, setState] = useState<ScheduleBlocksState>({ status: 'loading' })

  const reload = useCallback(async () => {
    // The window is computed per request: a panel left open overnight must not keep
    // asking for yesterday's horizon.
    const window = blockWindow(new Date(), windowDays)
    const query: ListScheduleBlocksQuery = locationId
      ? { providerUserId, window, locationId }
      : { providerUserId, window }
    try {
      const blocks = await api.listBlocks(query)
      setState({ status: 'ready', blocks })
    } catch (error) {
      setState({ status: 'error', message: blockErrorMessage(error) })
    }
  }, [api, providerUserId, locationId, windowDays])

  useEffect(() => {
    // Synchronizes with the server on mount and whenever provider or location changes.
    // oxlint-disable-next-line react/set-state-in-effect
    void reload()
  }, [reload])

  const create = useCallback(
    async (draft: ScheduleBlockDraft) => {
      const created = await api.createBlock({ providerUserId, draft })
      setState((current) =>
        current.status === 'ready'
          ? { status: 'ready', blocks: byStartsAt([...current.blocks, created]) }
          : current,
      )
      return created
    },
    [api, providerUserId],
  )

  const remove = useCallback(
    async (block: ScheduleBlock) => {
      await api.deleteBlock({ id: block.id, providerUserId })
      setState((current) =>
        current.status === 'ready'
          ? { status: 'ready', blocks: current.blocks.filter((item) => item.id !== block.id) }
          : current,
      )
    },
    [api, providerUserId],
  )

  return useMemo(() => ({ state, reload, create, remove }), [state, reload, create, remove])
}
