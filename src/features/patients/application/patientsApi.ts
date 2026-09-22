import type { HttpTransport } from '../../../shared/api/http'
import {
  type Patient,
  type PatientDraft,
  type PatientDto,
  type PatientSummary,
  type PatientSummaryDto,
  fromPatientDto,
  fromPatientSummaryDto,
  toPatientWriteDto,
} from '../domain/patient'

export type PatientSort = 'name' | 'record_number' | '-created_at'

export interface ListPatientsOptions {
  q?: string
  limit?: number
  cursor?: string
  sort?: PatientSort
  signal?: AbortSignal
}

export interface PatientPage {
  items: PatientSummary[]
  nextCursor: string | null
}

export interface PatientsApi {
  list: (options?: ListPatientsOptions) => Promise<PatientPage>
  get: (id: string, signal?: AbortSignal) => Promise<Patient>
  create: (draft: PatientDraft) => Promise<Patient>
  update: (input: { id: string; version: number; patch: Partial<PatientDraft> }) => Promise<Patient>
  setBookingBlocked: (input: { id: string; version: number; bookingBlocked: boolean }) => Promise<Patient>
  archive: (input: { id: string; version: number }) => Promise<void>
}

function pathForList(options: ListPatientsOptions): string {
  const params = new URLSearchParams()
  if (options.q) params.set('q', options.q)
  params.set('limit', String(options.limit ?? 25))
  if (options.cursor) params.set('cursor', options.cursor)
  params.set('sort', options.sort ?? 'name')
  return `/api/v1/patients?${params.toString()}`
}

function toPatchDto(patch: Partial<PatientDraft>) {
  const write = toPatientWriteDto({
    firstName: patch.firstName ?? '',
    middleName: patch.middleName ?? '',
    lastName: patch.lastName ?? '',
    secondLastName: patch.secondLastName ?? '',
    preferredName: patch.preferredName ?? '',
    birthDate: patch.birthDate ?? '',
    sexAtBirth: patch.sexAtBirth ?? '',
    phoneE164: patch.phoneE164 ?? '',
    email: patch.email ?? '',
    occupation: patch.occupation ?? '',
    status: patch.status ?? 'ACTIVE',
    notes: patch.notes ?? '',
  })
  const keys = Object.keys(patch) as (keyof PatientDraft)[]
  const keyMap: Record<keyof PatientDraft, keyof typeof write> = {
    firstName: 'first_name', middleName: 'middle_name', lastName: 'last_name',
    secondLastName: 'second_last_name', preferredName: 'preferred_name', birthDate: 'birth_date',
    sexAtBirth: 'sex_at_birth', phoneE164: 'phone_e164', email: 'email', occupation: 'occupation',
    status: 'status', notes: 'notes',
  }
  return Object.fromEntries(keys.map((key) => [keyMap[key], write[keyMap[key]]]))
}

export function createPatientsApi(http: HttpTransport): PatientsApi {
  return {
    async list(options = {}) {
      const payload = await http.get<{ items?: PatientSummaryDto[]; next_cursor?: string | null }>(
        pathForList(options),
        options.signal ? { signal: options.signal } : undefined,
      )
      return {
        items: Array.isArray(payload.items) ? payload.items.map(fromPatientSummaryDto) : [],
        nextCursor: payload.next_cursor ?? null,
      }
    },
    async get(id, signal) {
      const dto = await http.get<PatientDto>(`/api/v1/patients/${encodeURIComponent(id)}`, signal ? { signal } : undefined)
      return fromPatientDto(dto)
    },
    async create(draft) {
      return fromPatientDto(await http.post<PatientDto>('/api/v1/patients', toPatientWriteDto(draft)))
    },
    async update({ id, version, patch }) {
      return fromPatientDto(await http.patch<PatientDto>(
        `/api/v1/patients/${encodeURIComponent(id)}`,
        toPatchDto(patch),
        { ifMatch: version },
      ))
    },
    async setBookingBlocked({ id, version, bookingBlocked }) {
      return fromPatientDto(await http.put<PatientDto>(
        `/api/v1/patients/${encodeURIComponent(id)}/booking-block`,
        { booking_blocked: bookingBlocked },
        { ifMatch: version },
      ))
    },
    async archive({ id, version }) {
      await http.post(`/api/v1/patients/${encodeURIComponent(id)}/archive`, {}, { ifMatch: version })
    },
  }
}
