import type { HttpTransport } from '../../../shared/api/http'
import { ApiError } from '../../../shared/api/problem'
import {
  type Appointment, type AppointmentDto, type AppointmentHistory, type AppointmentHistoryDto,
  type AppointmentSource, type AppointmentStatus, type IdentityCandidate, type IdentityCandidateDto,
  type IdentityResolutionAction, type PreferredPeriod, type WaitlistEntry, type WaitlistEntryDto, type WaitlistStatus,
  fromAppointmentDto, fromAppointmentHistoryDto, fromIdentityCandidateDto, fromWaitlistEntryDto,
} from '../domain/appointment'

export interface ListAppointmentsQuery {
  from: string
  to: string
  locationId?: string
  providerUserId?: string
  patientId?: string
  signal?: AbortSignal
}

export interface CreateAppointmentInput {
  patientId: string
  providerUserId: string
  serviceIds: string[]
  startsAt: string
  locationId?: string
  source: AppointmentSource
  reason?: string
  internalNotes?: string
  allowOutsideSchedule?: boolean
  idempotencyKey: string
}

export interface AppointmentsApi {
  list: (query: ListAppointmentsQuery) => Promise<Appointment[]>
  get: (id: string, signal?: AbortSignal) => Promise<Appointment>
  history: (id: string, signal?: AbortSignal) => Promise<AppointmentHistory[]>
  create: (input: CreateAppointmentInput) => Promise<Appointment>
  transition: (input: { id: string; version: number; status: AppointmentStatus; reason: string }) => Promise<Appointment>
  reschedule: (input: { id: string; version: number; startsAt: string }) => Promise<Appointment>
  listIdentityCandidates: (id: string, signal?: AbortSignal) => Promise<IdentityCandidate[]>
  resolveIdentity: (input: { id: string; version: number; action: IdentityResolutionAction; patientId?: string }) => Promise<Appointment>
  listWaitlist: (query?: { providerUserId?: string; status?: WaitlistStatus; signal?: AbortSignal }) => Promise<WaitlistEntry[]>
  createWaitlist: (input: { patientId: string; providerUserId: string; earliestDate: string; preferredPeriods: PreferredPeriod[]; serviceId?: string; latestDate?: string; status?: WaitlistStatus; notes?: string }) => Promise<WaitlistEntry>
  updateWaitlistStatus: (input: { id: string; status: Exclude<WaitlistStatus, 'ACTIVE'> }) => Promise<WaitlistEntry>
}

function listPath(query: ListAppointmentsQuery): string {
  const from = new Date(query.from)
  const to = new Date(query.to)
  if (Number.isNaN(from.valueOf()) || Number.isNaN(to.valueOf()) || from >= to || to.valueOf() - from.valueOf() > 31 * 24 * 60 * 60 * 1000) {
    throw new ApiError({ status: 0, code: 'VALIDATION_ERROR', detail: 'La agenda solo permite ventanas RFC3339 de hasta 31 días.' })
  }
  const params = new URLSearchParams({ from: query.from, to: query.to })
  if (query.locationId) params.set('location_id', query.locationId)
  if (query.providerUserId) params.set('provider_user_id', query.providerUserId)
  if (query.patientId) params.set('patient_id', query.patientId)
  return `/api/v1/appointments?${params.toString()}`
}

function waitlistPath(query: { providerUserId?: string; status?: WaitlistStatus }): string {
  const params = new URLSearchParams()
  if (query.providerUserId) params.set('provider_user_id', query.providerUserId)
  if (query.status) params.set('status', query.status)
  const encoded = params.toString()
  return encoded ? `/api/v1/waitlist?${encoded}` : '/api/v1/waitlist'
}

export function createAppointmentsApi(http: HttpTransport): AppointmentsApi {
  return {
    async list(query) {
      const payload = await http.get<{ items?: AppointmentDto[] }>(listPath(query), query.signal ? { signal: query.signal } : undefined)
      return Array.isArray(payload.items) ? payload.items.map(fromAppointmentDto) : []
    },
    async get(id, signal) { return fromAppointmentDto(await http.get<AppointmentDto>(`/api/v1/appointments/${encodeURIComponent(id)}`, signal ? { signal } : undefined)) },
    async history(id, signal) {
      const payload = await http.get<{ items?: AppointmentHistoryDto[] }>(`/api/v1/appointments/${encodeURIComponent(id)}/history`, signal ? { signal } : undefined)
      return Array.isArray(payload.items) ? payload.items.map(fromAppointmentHistoryDto) : []
    },
    async create(input) {
      const dto = await http.post<AppointmentDto>('/api/v1/appointments', {
        patient_id: input.patientId, provider_user_id: input.providerUserId, service_ids: input.serviceIds,
        starts_at: input.startsAt, ...(input.locationId ? { location_id: input.locationId } : {}),
        ...(input.source ? { source: input.source } : {}), ...(input.reason ? { reason: input.reason } : {}),
        ...(input.internalNotes ? { internal_notes: input.internalNotes } : {}),
        ...(input.allowOutsideSchedule ? { allow_outside_schedule: true } : {}),
      }, { idempotencyKey: input.idempotencyKey })
      return fromAppointmentDto(dto)
    },
    async transition({ id, version, status, reason }) {
      return fromAppointmentDto(await http.post<AppointmentDto>(`/api/v1/appointments/${encodeURIComponent(id)}/transition`, { status, reason }, { ifMatch: version }))
    },
    async reschedule({ id, version, startsAt }) {
      return fromAppointmentDto(await http.post<AppointmentDto>(`/api/v1/appointments/${encodeURIComponent(id)}/reschedule`, { starts_at: startsAt }, { ifMatch: version }))
    },
    async listIdentityCandidates(id, signal) {
      const path = `/api/v1/appointments/${encodeURIComponent(id)}/identity-candidates`
      const payload = signal
        ? await http.get<{ items?: IdentityCandidateDto[] }>(path, { signal })
        : await http.get<{ items?: IdentityCandidateDto[] }>(path)
      return Array.isArray(payload.items) ? payload.items.map(fromIdentityCandidateDto) : []
    },
    async resolveIdentity({ id, version, action, patientId }) {
      return fromAppointmentDto(await http.post<AppointmentDto>(`/api/v1/appointments/${encodeURIComponent(id)}/identity`, { action, ...(patientId ? { patient_id: patientId } : {}) }, { ifMatch: version }))
    },
    async listWaitlist(query = {}) {
      const payload = await http.get<{ items?: WaitlistEntryDto[] }>(waitlistPath(query), query.signal ? { signal: query.signal } : undefined)
      return Array.isArray(payload.items) ? payload.items.map(fromWaitlistEntryDto) : []
    },
    async createWaitlist(input) {
      const dto = await http.post<WaitlistEntryDto>('/api/v1/waitlist', {
        patient_id: input.patientId, provider_user_id: input.providerUserId, earliest_date: input.earliestDate,
        preferred_periods: input.preferredPeriods, ...(input.serviceId ? { service_id: input.serviceId } : {}),
        ...(input.latestDate ? { latest_date: input.latestDate } : {}), ...(input.status ? { status: input.status } : {}),
        ...(input.notes ? { notes: input.notes } : {}),
      })
      return fromWaitlistEntryDto(dto)
    },
    async updateWaitlistStatus({ id, status }) {
      return fromWaitlistEntryDto(await http.patch<WaitlistEntryDto>(`/api/v1/waitlist/${encodeURIComponent(id)}`, { status }))
    },
  }
}
