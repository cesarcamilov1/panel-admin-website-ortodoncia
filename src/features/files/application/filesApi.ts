import type { HttpTransport } from '../../../shared/api/http'
import { fromPrivateFileDto, type FileCategory, type PrivateFile, type PrivateFileDto } from '../domain/file'

const id = encodeURIComponent

function patientQuery(patientId: string): string {
  return `patient_id=${id(patientId)}`
}

function secureSignedUrl(value: string): string {
  const parsed = new URL(value)
  if (parsed.protocol !== 'https:') throw new Error('Signed file URLs must use HTTPS.')
  return parsed.toString()
}

export interface FilesApi {
  list(input: { patientId: string; limit?: number; signal?: AbortSignal }): Promise<PrivateFile[]>
  get(fileId: string, patientId: string, signal?: AbortSignal): Promise<PrivateFile>
  upload(input: { patientId: string; category: FileCategory; file: File; signal?: AbortSignal }): Promise<PrivateFile>
  download(fileId: string, patientId: string, signal?: AbortSignal): Promise<Blob>
  /** Available for another approved use case; this UI intentionally uses authenticated blobs instead. */
  getSignedUrl(fileId: string, patientId: string, signal?: AbortSignal): Promise<string>
}

export function createFilesApi(http: HttpTransport): FilesApi {
  return {
    async list({ patientId, limit = 25, signal }) {
      const payload = await http.get<{ items?: PrivateFileDto[] }>(`/api/v1/files?${patientQuery(patientId)}&limit=${limit}`, signal ? { signal } : undefined)
      return Array.isArray(payload.items) ? payload.items.map(fromPrivateFileDto) : []
    },
    async get(fileId, patientId, signal) {
      return fromPrivateFileDto(await http.get<PrivateFileDto>(`/api/v1/files/${id(fileId)}?${patientQuery(patientId)}`, signal ? { signal } : undefined))
    },
    async upload({ patientId, category, file, signal }) {
      return fromPrivateFileDto(await http.upload<PrivateFileDto>(`/api/v1/files?${patientQuery(patientId)}&category=${category}`, file, { filename: file.name, ...(signal ? { signal } : {}) }))
    },
    download(fileId, patientId, signal) {
      return http.download(`/api/v1/files/${id(fileId)}/download?${patientQuery(patientId)}`, signal ? { signal } : undefined)
    },
    async getSignedUrl(fileId, patientId, signal) {
      const payload = await http.get<{ url: string }>(`/api/v1/files/${id(fileId)}/signed-url?${patientQuery(patientId)}`, signal ? { signal } : undefined)
      return secureSignedUrl(payload.url)
    },
  }
}
