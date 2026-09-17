export interface ApiProblemField {
  field: string
  code: string
  message: string
}

export interface ApiProblem {
  type?: string
  title?: string
  status: number
  code: string
  detail?: string
  request_id?: string
  errors?: ApiProblemField[]
}

export interface ApiErrorInit {
  status: number
  code: string
  detail?: string
  requestId?: string
  fields?: ApiProblemField[]
  retryAfterSeconds?: number
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly detail?: string
  readonly requestId?: string
  readonly fields?: ApiProblemField[]
  readonly retryAfterSeconds?: number

  constructor(init: ApiErrorInit) {
    super(init.detail ?? init.code)
    this.name = 'ApiError'
    this.status = init.status
    this.code = init.code
    this.detail = init.detail
    this.requestId = init.requestId
    this.fields = init.fields
    this.retryAfterSeconds = init.retryAfterSeconds
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError
}

function parseRetryAfter(response: Response): number | undefined {
  const raw = response.headers.get('Retry-After')
  if (!raw) return undefined
  const seconds = Number.parseInt(raw, 10)
  return Number.isNaN(seconds) ? undefined : seconds
}

export async function parseProblemResponse(response: Response): Promise<ApiError> {
  const retryAfterSeconds = parseRetryAfter(response)

  let body: Partial<ApiProblem> | null = null
  try {
    body = (await response.json()) as Partial<ApiProblem>
  } catch {
    body = null
  }

  if (!body || typeof body !== 'object' || typeof body.code !== 'string') {
    return new ApiError({
      status: response.status,
      code: 'UNKNOWN',
      retryAfterSeconds,
    })
  }

  return new ApiError({
    status: response.status,
    code: body.code,
    detail: body.detail,
    requestId: body.request_id,
    fields: body.errors,
    retryAfterSeconds,
  })
}
