import type { HttpTransport } from '../../../shared/api/http'
import { fromBillingDetailDto, fromBillingDocumentDto, type BillingCatalog, type BillingCatalogPage, type BillingDocument, type BillingDocumentDetail, type CancellationMotive } from '../domain/billing'

const id = encodeURIComponent
const PAGE_SIZE = 25
export interface BillingArtifact {
  url: string
  expiresInSeconds: number
  mediaType: string
}

function validateArtifactUrl(value: string): string {
  const parsed = new URL(value)
  if (parsed.protocol !== 'https:' || !parsed.host || parsed.username || parsed.password) {
    throw new Error('Fiscal artifact URLs must be credential-free HTTPS URLs.')
  }
  return parsed.toString()
}

export interface BillingApi {
  listDocuments(input: { patientId?: string; afterId?: string; limit?: number; signal?: AbortSignal }): Promise<{ items: BillingDocument[]; hasPossibleNextPage: boolean }>
  getDocument(id: string, signal?: AbortSignal): Promise<BillingDocumentDetail>
  getArtifact(input: { id: string; format: 'xml' | 'pdf' | 'ack'; signal?: AbortSignal }): Promise<BillingArtifact>
  issueInvoice(input: { patientId: string; paymentIds?: string[]; treatmentPlanIds?: string[]; idempotencyKey: string }): Promise<BillingDocument>
  createPaymentComplement(input: { parentDocumentId: string; paymentIds: string[]; idempotencyKey: string }): Promise<BillingDocument>
  replace(input: { id: string; version: number; idempotencyKey: string }): Promise<BillingDocument>
  cancel(input: { id: string; version: number; motive: CancellationMotive; idempotencyKey: string }): Promise<BillingDocument>
  sendEmail(input: { id: string; version: number; idempotencyKey: string }): Promise<BillingDocument>
  reconcile(input: { id: string; version: number; idempotencyKey: string }): Promise<BillingDocument>
  getCatalog(input: { catalog: BillingCatalog; signal?: AbortSignal }): Promise<BillingCatalogPage>
}

export function createBillingApi(http: HttpTransport): BillingApi {
  return {
    async listDocuments({ patientId, afterId, limit = PAGE_SIZE, signal }) {
      const query = new URLSearchParams({ limit: String(limit) })
      if (patientId) query.set('patient_id', patientId)
      if (afterId) query.set('after_id', afterId)
      const response = await http.get<{ items?: any[] }>(`/api/v1/billing/documents?${query}`, signal ? { signal } : undefined)
      const items = Array.isArray(response.items) ? response.items.map(fromBillingDocumentDto) : []
      return { items, hasPossibleNextPage: items.length === limit }
    },
    getDocument: (documentId, signal) => http.get(`/api/v1/billing/documents/${id(documentId)}`, signal ? { signal } : undefined).then(fromBillingDetailDto),
    async getArtifact({ id: documentId, format, signal }) {
      const response = await http.get<{ url: string; expires_in_seconds: number; media_type: string }>(`/api/v1/billing/documents/${id(documentId)}/files/${format}`, signal ? { signal } : undefined)
      if (!Number.isInteger(response.expires_in_seconds) || response.expires_in_seconds < 1 || response.expires_in_seconds > 300) {
        throw new Error('Fiscal artifact URL expiry is invalid.')
      }
      const expectedMediaType = format === 'xml' ? 'application/xml' : 'application/pdf'
      if (response.media_type !== expectedMediaType) throw new Error('Fiscal artifact media type is invalid.')
      return { url: validateArtifactUrl(response.url), expiresInSeconds: response.expires_in_seconds, mediaType: response.media_type }
    },
    issueInvoice: async ({ patientId, paymentIds, treatmentPlanIds, idempotencyKey }) => fromBillingDocumentDto(await http.post('/api/v1/billing/invoices', { patient_id: patientId, ...(paymentIds?.length ? { payment_ids: paymentIds } : {}), ...(treatmentPlanIds?.length ? { treatment_plan_ids: treatmentPlanIds } : {}) }, { idempotencyKey })),
    createPaymentComplement: async ({ parentDocumentId, paymentIds, idempotencyKey }) => fromBillingDocumentDto(await http.post('/api/v1/billing/payment-complements', { parent_document_id: parentDocumentId, payment_ids: paymentIds }, { idempotencyKey })),
    replace: async ({ id: documentId, version, idempotencyKey }) => fromBillingDocumentDto(await http.post(`/api/v1/billing/documents/${id(documentId)}/replace`, { expected_version: version }, { ifMatch: version, idempotencyKey })),
    cancel: async ({ id: documentId, version, motive, idempotencyKey }) => fromBillingDocumentDto(await http.post(`/api/v1/billing/documents/${id(documentId)}/cancel`, { expected_version: version, motive }, { ifMatch: version, idempotencyKey })),
    sendEmail: async ({ id: documentId, version, idempotencyKey }) => fromBillingDocumentDto(await http.post(`/api/v1/billing/documents/${id(documentId)}/send-email`, { expected_version: version }, { ifMatch: version, idempotencyKey })),
    reconcile: async ({ id: documentId, version, idempotencyKey }) => fromBillingDocumentDto(await http.post(`/api/v1/billing/documents/${id(documentId)}/reconcile`, { expected_version: version }, { ifMatch: version, idempotencyKey })),
    async getCatalog({ catalog, signal }) {
      const response = await http.get<{ items?: BillingCatalogPage['items']; page?: number }>(`/api/v1/billing/catalogs/${id(catalog)}`, signal ? { signal } : undefined)
      return { items: Array.isArray(response.items) ? response.items : [], page: response.page ?? 0, mayHaveMore: false }
    },
  }
}
