import type { HttpTransport } from '../../../shared/api/http'
import type { PageOptions } from '../../communications/application/communicationsApi'
import type { Reminder, ReminderCancelAttempt, ReminderScheduleAttempt } from '../domain/reminder'

export type { Reminder, ReminderCancelAttempt, ReminderScheduleAttempt } from '../domain/reminder'

interface ReminderDto {
  id: string
  appointment_id: string
  patient_id: string
  channel: Reminder['channel']
  reminder_type: Reminder['reminderType']
  scheduled_for: string
  status: Reminder['status']
  attempt_count: number
  next_attempt_at: string | null
  communication_id: string | null
  template_id: string
  template_version: number
  appointment_version: number
  created_at: string
  updated_at: string
}

function fromDto(dto: ReminderDto): Reminder {
  return {
    id: dto.id, appointmentId: dto.appointment_id, patientId: dto.patient_id, channel: dto.channel,
    reminderType: dto.reminder_type, scheduledFor: dto.scheduled_for, status: dto.status,
    attemptCount: dto.attempt_count, nextAttemptAt: dto.next_attempt_at, communicationId: dto.communication_id,
    templateId: dto.template_id, templateVersion: dto.template_version, appointmentVersion: dto.appointment_version,
    createdAt: dto.created_at, updatedAt: dto.updated_at,
  }
}

export interface RemindersApi {
  list: (options?: PageOptions) => Promise<{ items: Reminder[] }>
  get: (id: string, signal?: AbortSignal) => Promise<Reminder>
  schedule: (input: ReminderScheduleAttempt) => Promise<{ id: string }>
  cancel: (input: ReminderCancelAttempt) => Promise<{ id: string }>
}

function pagePath(options: PageOptions = {}): string {
  const params = new URLSearchParams({ limit: String(options.limit ?? 25) })
  if (options.afterId) params.set('after_id', options.afterId)
  return `/api/v1/reminders?${params.toString()}`
}

function requestOptions(signal?: AbortSignal) {
  return signal ? { signal } : undefined
}

export function createRemindersApi(http: Pick<HttpTransport, 'get' | 'post'>): RemindersApi {
  return {
    async list(options = {}) {
      const page = await http.get<{ items?: ReminderDto[] }>(pagePath(options), requestOptions(options.signal))
      return { items: Array.isArray(page.items) ? page.items.map(fromDto) : [] }
    },
    async get(id, signal) {
      return fromDto(await http.get<ReminderDto>(`/api/v1/reminders/${encodeURIComponent(id)}`, requestOptions(signal)))
    },
    schedule: (input) => http.post<{ id: string }>('/api/v1/reminders', {
      appointment_id: input.appointmentId,
      template_id: input.templateId,
      channel: input.channel,
      reminder_type: input.reminderType,
      scheduled_for: input.scheduledFor,
      expected_version: input.expectedVersion,
    }, { ifMatch: input.expectedVersion, idempotencyKey: input.idempotencyKey }),
    cancel: (input) => http.post<{ id: string }>(`/api/v1/reminders/${encodeURIComponent(input.id)}/cancel`, {
      expected_version: input.expectedVersion,
    }, { ifMatch: input.expectedVersion, idempotencyKey: input.idempotencyKey }),
  }
}
