import type { HttpTransport } from '../../../shared/api/http'
import type { PageOptions } from '../../communications/application/communicationsApi'
import type { Review, ReviewAttempt } from '../domain/review'

export type { Review, ReviewAttempt } from '../domain/review'

interface ReviewDto {
  id: string
  patient_id: string
  appointment_id: string
  rating: number
  comment: string | null
  google_review_requested: boolean
  created_at: string
}

function fromDto(dto: ReviewDto): Review {
  return {
    id: dto.id,
    patientId: dto.patient_id,
    appointmentId: dto.appointment_id,
    rating: dto.rating,
    comment: dto.comment ?? '',
    googleReviewRequested: dto.google_review_requested,
    createdAt: dto.created_at,
  }
}

function pagePath(options: PageOptions = {}): string {
  const params = new URLSearchParams({ limit: String(options.limit ?? 25) })
  if (options.afterId) params.set('after_id', options.afterId)
  return `/api/v1/reviews?${params.toString()}`
}

export function createReviewsApi(http: Pick<HttpTransport, 'get' | 'post'>) {
  return {
    async list(options: PageOptions = {}) {
      const page = await http.get<{ items?: ReviewDto[] }>(pagePath(options), options.signal ? { signal: options.signal } : undefined)
      return { items: Array.isArray(page.items) ? page.items.map(fromDto) : [] }
    },
    create: (input: ReviewAttempt) => http.post<{ id: string }>('/api/v1/reviews', {
      patient_id: input.patientId,
      appointment_id: input.appointmentId,
      rating: input.rating,
      comment: input.comment,
    }, { idempotencyKey: input.idempotencyKey }),
  }
}
