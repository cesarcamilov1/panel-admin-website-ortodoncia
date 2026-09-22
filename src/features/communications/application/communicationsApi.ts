import type { HttpTransport } from '../../../shared/api/http'

export type Channel = 'EMAIL' | 'SMS' | 'WHATSAPP'
export type TemplateWrite = { code?: string; channel?: Channel; locale?: string; providerTemplate?: string | null; bodyTemplate: string; isActive?: boolean; expectedVersion?: number; idempotencyKey: string }
export type QueueInput = { appointmentId: string; templateId: string; channel: Channel; expectedVersion: number; idempotencyKey: string }
export type PageOptions = { afterId?: string; limit?: number; signal?: AbortSignal }

export interface CommunicationsApi {
  list: (options?: PageOptions) => Promise<{ items: CommunicationDto[] }>
  get: (id: string, signal?: AbortSignal) => Promise<CommunicationDto>
  events: (id: string, options?: PageOptions) => Promise<{ items: CommunicationEventDto[] }>
  templates: (options?: PageOptions) => Promise<{ items: TemplateDto[] }>
  metrics: (signal?: AbortSignal) => Promise<Record<string, number>>
  queue: (input: QueueInput) => Promise<{ id: string }>
  createTemplate: (input: Required<Pick<TemplateWrite, 'code' | 'channel' | 'bodyTemplate' | 'idempotencyKey'>> & Omit<TemplateWrite, 'code' | 'channel' | 'bodyTemplate' | 'idempotencyKey'>) => Promise<{ id: string }>
  updateTemplate: (input: TemplateWrite & { id: string; expectedVersion: number }) => Promise<{ id: string }>
}

export interface CommunicationDto { id: string; patient_id: string; appointment_id: string; channel: Channel; status: string; safe_preview: string; created_at: string; [key: string]: unknown }
export interface CommunicationEventDto { id: string; communication_id: string; event_type: string; safe_metadata: unknown; created_at: string }
export interface TemplateDto { id: string; code: string; channel: Channel; locale: string; provider_template: string | null; body_template: string; is_active: boolean; version: number; created_at: string; updated_at: string }

function pagePath(path: string, options: PageOptions = {}): string {
  const params = new URLSearchParams({ limit: String(options.limit ?? 25) })
  if (options.afterId) params.set('after_id', options.afterId)
  return `${path}?${params.toString()}`
}
function option(signal?: AbortSignal) { return signal ? { signal } : undefined }

export function createCommunicationsApi(http: Pick<HttpTransport, 'get' | 'post' | 'patch'>): CommunicationsApi {
  return {
    list: (options = {}) => http.get(pagePath('/api/v1/communications', options), option(options.signal)),
    get: (id, signal) => http.get(`/api/v1/communications/${encodeURIComponent(id)}`, option(signal)),
    events: (id, options = {}) => http.get(pagePath(`/api/v1/communications/${encodeURIComponent(id)}/events`, options), option(options.signal)),
    templates: (options = {}) => http.get(pagePath('/api/v1/communications/templates', options), option(options.signal)),
    metrics: (signal) => http.get('/api/v1/communications/metrics', option(signal)),
    queue: ({ appointmentId, templateId, channel, expectedVersion, idempotencyKey }) => http.post('/api/v1/communications', { appointment_id: appointmentId, template_id: templateId, channel, expected_version: expectedVersion }, { ifMatch: expectedVersion, idempotencyKey }),
    createTemplate: ({ code, channel, locale, providerTemplate, bodyTemplate, isActive, idempotencyKey }) => http.post('/api/v1/communications/templates', { code, channel, ...(locale ? { locale } : {}), ...(providerTemplate !== undefined ? { provider_template: providerTemplate } : {}), body_template: bodyTemplate, ...(isActive !== undefined ? { is_active: isActive } : {}) }, { idempotencyKey }),
    updateTemplate: ({ id, providerTemplate, bodyTemplate, isActive, expectedVersion, idempotencyKey }) => http.patch(`/api/v1/communications/templates/${encodeURIComponent(id)}`, { ...(providerTemplate !== undefined ? { provider_template: providerTemplate } : {}), body_template: bodyTemplate, ...(isActive !== undefined ? { is_active: isActive } : {}), expected_version: expectedVersion }, { ifMatch: expectedVersion, idempotencyKey }),
  }
}
