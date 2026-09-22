import { describe, expect, it, vi } from 'vitest'
import type { HttpTransport } from '../../../shared/api/http'
import { createBillingApi } from './billingApi'

const patientId = '11111111-1111-1111-1111-111111111111'
const documentId = '22222222-2222-2222-2222-222222222222'
const paymentId = '33333333-3333-3333-3333-333333333333'
function transport() { return { get: vi.fn().mockResolvedValue({ items: [{ id: documentId, patient_id: patientId, cfdi_type: 'I', status: 'ISSUED', total: '10.010000', version: 4 }], files: { xml: true, pdf: false, ack: false } }), post: vi.fn().mockResolvedValue({ id: documentId, patient_id: patientId, cfdi_type: 'I', status: 'QUEUED', total: '10.010000', version: 4 }), put: vi.fn(), patch: vi.fn(), del: vi.fn(), upload: vi.fn(), download: vi.fn() } as unknown as HttpTransport & { get: ReturnType<typeof vi.fn> } }

describe('BillingApi', () => {
  it('uses actual mounted paths, server-owned decimal strings, concurrency versions, and idempotency headers', async () => {
    const http = transport(); const api = createBillingApi(http)
    await api.listDocuments({ patientId, afterId: documentId }); await api.getDocument(documentId)
    await api.issueInvoice({ patientId, paymentIds: [paymentId], idempotencyKey: 'invoice-key' }); await api.createPaymentComplement({ parentDocumentId: documentId, paymentIds: [paymentId], idempotencyKey: 'complement-key' })
    await api.replace({ id: documentId, version: 4, idempotencyKey: 'replace-key' }); await api.cancel({ id: documentId, version: 4, motive: '02', idempotencyKey: 'cancel-key' }); await api.sendEmail({ id: documentId, version: 4, idempotencyKey: 'email-key' }); await api.reconcile({ id: documentId, version: 4, idempotencyKey: 'reconcile-key' }); await api.getCatalog({ catalog: 'payment-forms' })
    expect(http.get).toHaveBeenNthCalledWith(1, `/api/v1/billing/documents?limit=25&patient_id=${patientId}&after_id=${documentId}`, undefined)
    expect(http.get).toHaveBeenNthCalledWith(2, `/api/v1/billing/documents/${documentId}`, undefined)
    expect(http.get).toHaveBeenNthCalledWith(3, '/api/v1/billing/catalogs/payment-forms', undefined)
    expect(http.post).toHaveBeenNthCalledWith(1, '/api/v1/billing/invoices', { patient_id: patientId, payment_ids: [paymentId] }, { idempotencyKey: 'invoice-key' })
    expect(http.post).toHaveBeenNthCalledWith(2, '/api/v1/billing/payment-complements', { parent_document_id: documentId, payment_ids: [paymentId] }, { idempotencyKey: 'complement-key' })
    expect(http.post).toHaveBeenNthCalledWith(3, `/api/v1/billing/documents/${documentId}/replace`, { expected_version: 4 }, { ifMatch: 4, idempotencyKey: 'replace-key' })
    expect(http.post).toHaveBeenNthCalledWith(4, `/api/v1/billing/documents/${documentId}/cancel`, { expected_version: 4, motive: '02' }, { ifMatch: 4, idempotencyKey: 'cancel-key' })
    expect(http.post).toHaveBeenNthCalledWith(5, `/api/v1/billing/documents/${documentId}/send-email`, { expected_version: 4 }, { ifMatch: 4, idempotencyKey: 'email-key' })
    expect(http.post).toHaveBeenNthCalledWith(6, `/api/v1/billing/documents/${documentId}/reconcile`, { expected_version: 4 }, { ifMatch: 4, idempotencyKey: 'reconcile-key' })
  })

  it('uses only a full list page as a bounded next-page signal', async () => { const http = transport(); const api = createBillingApi(http); expect((await api.listDocuments({ limit: 1 })).hasPossibleNextPage).toBe(true); expect((await api.listDocuments({ limit: 25 })).hasPossibleNextPage).toBe(false) })

  it('fetches only the supported base SAT catalog without a remote keyword or page', async () => {
    const http = transport()
    const api = createBillingApi(http)
    await api.getCatalog({ catalog: 'cfdi-uses' })
    expect(http.get).toHaveBeenCalledWith('/api/v1/billing/catalogs/cfdi-uses', undefined)
    expect(http.get).not.toHaveBeenCalledWith(expect.stringContaining('keyword='), expect.anything())
  })

  it('retrieves the mounted artifact response through the API and rejects unsafe or expired signed URLs', async () => {
    const http = transport()
    const api = createBillingApi(http)
    http.get = vi.fn().mockResolvedValueOnce({ url: 'https://storage.example/document.pdf?signature=opaque', expires_in_seconds: 120, media_type: 'application/pdf' })
    await expect(api.getArtifact({ id: documentId, format: 'pdf' })).resolves.toEqual({ url: 'https://storage.example/document.pdf?signature=opaque', expiresInSeconds: 120, mediaType: 'application/pdf' })
    expect(http.get).toHaveBeenCalledWith(`/api/v1/billing/documents/${documentId}/files/pdf`, undefined)

    http.get.mockResolvedValueOnce({ url: 'https://user:secret@storage.example/document.pdf', expires_in_seconds: 120, media_type: 'application/pdf' })
    await expect(api.getArtifact({ id: documentId, format: 'pdf' })).rejects.toThrow(/credential-free HTTPS/i)
    http.get.mockResolvedValueOnce({ url: 'https://storage.example/document.pdf', expires_in_seconds: 301, media_type: 'application/pdf' })
    await expect(api.getArtifact({ id: documentId, format: 'pdf' })).rejects.toThrow(/expiry/i)
  })
})
