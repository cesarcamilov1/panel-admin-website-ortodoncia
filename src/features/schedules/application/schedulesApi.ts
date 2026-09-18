import type { HttpClient } from '../../../shared/api/http'
import { ApiError } from '../../../shared/api/problem'
import {
  type BlockWindow,
  type ScheduleBlock,
  type ScheduleBlockDraft,
  type ScheduleBlockDto,
  type ScheduleBlockListDto,
  byStartsAt,
  fromScheduleBlockDto,
  toScheduleBlockWriteDto,
} from '../domain/scheduleBlock'
import {
  type WorkSchedule,
  type WorkScheduleDraft,
  type WorkScheduleDto,
  type WorkScheduleListDto,
  byWeekdayThenStart,
  fromWorkScheduleDto,
  toWorkScheduleWriteDto,
} from '../domain/workSchedule'

export interface ListWorkSchedulesQuery {
  providerUserId: string
  /** Optional: the handler filters the provider rows by location after the query. */
  locationId?: string
}

export interface CreateWorkScheduleInput {
  providerUserId: string
  draft: WorkScheduleDraft
}

export interface DeleteWorkScheduleInput {
  id: string
  providerUserId: string
}

export interface ListScheduleBlocksQuery {
  providerUserId: string
  /** Required by the server: `from` and `to` are parsed with RFC3339 or the call is a 400. */
  window: BlockWindow
  locationId?: string
}

export interface CreateScheduleBlockInput {
  providerUserId: string
  draft: ScheduleBlockDraft
}

export interface DeleteScheduleBlockInput {
  id: string
  providerUserId: string
}

export interface SchedulesApi {
  listSchedules: (query: ListWorkSchedulesQuery) => Promise<WorkSchedule[]>
  createSchedule: (input: CreateWorkScheduleInput) => Promise<WorkSchedule>
  deleteSchedule: (input: DeleteWorkScheduleInput) => Promise<void>
  listBlocks: (query: ListScheduleBlocksQuery) => Promise<ScheduleBlock[]>
  createBlock: (input: CreateScheduleBlockInput) => Promise<ScheduleBlock>
  deleteBlock: (input: DeleteScheduleBlockInput) => Promise<void>
}

/**
 * `provider_user_id` is `required: true` on all six endpoints, including both deletes,
 * and no endpoint in the API lists providers. Failing here beats a delete the server
 * silently resolves to nothing.
 */
function requireProvider(providerUserId: string): string {
  if (!providerUserId) {
    throw new ApiError({
      status: 0,
      code: 'VALIDATION_ERROR',
      detail: 'Falta el profesional al que pertenece el horario.',
    })
  }
  return encodeURIComponent(providerUserId)
}

function locationFilter(locationId?: string): string {
  const trimmed = locationId?.trim()
  return trimmed ? `&location_id=${encodeURIComponent(trimmed)}` : ''
}

export function createSchedulesApi(http: HttpClient): SchedulesApi {
  return {
    async listSchedules({ providerUserId, locationId }) {
      const provider = requireProvider(providerUserId)
      const payload = await http.get<WorkScheduleListDto>(
        `/api/v1/schedules?provider_user_id=${provider}${locationFilter(locationId)}`,
      )
      if (!payload || !Array.isArray(payload.items)) return []
      return byWeekdayThenStart(payload.items.map(fromWorkScheduleDto))
    },

    async createSchedule({ providerUserId, draft }) {
      requireProvider(providerUserId)
      const dto = await http.post<WorkScheduleDto>(
        '/api/v1/schedules',
        toWorkScheduleWriteDto(draft, providerUserId),
      )
      return fromWorkScheduleDto(dto)
    },

    async deleteSchedule({ id, providerUserId }) {
      const provider = requireProvider(providerUserId)
      await http.del<void>(
        `/api/v1/schedules/${encodeURIComponent(id)}?provider_user_id=${provider}`,
      )
    },

    async listBlocks({ providerUserId, window, locationId }) {
      const provider = requireProvider(providerUserId)
      const from = encodeURIComponent(window.from)
      const to = encodeURIComponent(window.to)
      const payload = await http.get<ScheduleBlockListDto>(
        `/api/v1/schedule-blocks?provider_user_id=${provider}&from=${from}&to=${to}` +
          locationFilter(locationId),
      )
      if (!payload || !Array.isArray(payload.items)) return []
      return byStartsAt(payload.items.map(fromScheduleBlockDto))
    },

    async createBlock({ providerUserId, draft }) {
      requireProvider(providerUserId)
      const dto = await http.post<ScheduleBlockDto>(
        '/api/v1/schedule-blocks',
        toScheduleBlockWriteDto(draft, providerUserId),
      )
      return fromScheduleBlockDto(dto)
    },

    async deleteBlock({ id, providerUserId }) {
      const provider = requireProvider(providerUserId)
      await http.del<void>(
        `/api/v1/schedule-blocks/${encodeURIComponent(id)}?provider_user_id=${provider}`,
      )
    },
  }
}
