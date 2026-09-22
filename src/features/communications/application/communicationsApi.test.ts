import { describe, expect, it, vi } from 'vitest'
import { createCommunicationsApi } from './communicationsApi'

function http() {
  return { get: vi.fn(), post: vi.fn(), patch: vi.fn() }
}

describe('communications API contract', () => {
  it('uses bounded keyset lists and exact queue preconditions', async () => {
    const client = http()
    client.get.mockResolvedValue({ items: [] })
    client.post.mockResolvedValue({ id: 'communication-id' })
    const api = createCommunicationsApi(client)

    await api.list({ afterId: 'cursor', limit: 26 })
    await api.queue({ appointmentId: 'appointment-id', templateId: 'template-id', channel: 'WHATSAPP', expectedVersion: 4, idempotencyKey: 'queue-key-123' })

    expect(client.get).toHaveBeenCalledWith('/api/v1/communications?limit=26&after_id=cursor', undefined)
    expect(client.post).toHaveBeenCalledWith('/api/v1/communications', {
      appointment_id: 'appointment-id', template_id: 'template-id', channel: 'WHATSAPP', expected_version: 4,
    }, { ifMatch: 4, idempotencyKey: 'queue-key-123' })
  })

  it('uses immutable template version and only explicit template fields', async () => {
    const client = http()
    client.patch.mockResolvedValue({ id: 'template-id' })
    const api = createCommunicationsApi(client)
    await api.updateTemplate({ id: 'template-id', bodyTemplate: 'Hola {{patient_name}}', providerTemplate: 'approved-template', isActive: true, expectedVersion: 7, idempotencyKey: 'template-key-123' })
    expect(client.patch).toHaveBeenCalledWith('/api/v1/communications/templates/template-id', {
      body_template: 'Hola {{patient_name}}', provider_template: 'approved-template', is_active: true, expected_version: 7,
    }, { ifMatch: 7, idempotencyKey: 'template-key-123' })
  })
})
