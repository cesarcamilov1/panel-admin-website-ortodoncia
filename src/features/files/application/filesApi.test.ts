import { describe, expect, it, vi } from 'vitest'
import type { HttpTransport } from '../../../shared/api/http'
import { createFilesApi } from './filesApi'

const patientId = '11111111-1111-1111-1111-111111111111'
const fileId = '22222222-2222-2222-2222-222222222222'

function transport() {
  return { get: vi.fn().mockResolvedValue({ items: [] }), upload: vi.fn().mockResolvedValue({}), download: vi.fn().mockResolvedValue(new Blob(['private'])), post: vi.fn(), put: vi.fn(), patch: vi.fn(), del: vi.fn() } as unknown as HttpTransport & { get: ReturnType<typeof vi.fn> }
}

describe('FilesApi', () => {
  it('keeps every patient context in list, metadata, upload, and authenticated download paths', async () => {
    const http = transport(); const api = createFilesApi(http)
    await api.list({ patientId, limit: 25 })
    await api.get(fileId, patientId)
    await api.upload({ patientId, category: 'CONSENT', file: new File(['pdf'], 'firma.pdf', { type: 'application/pdf' }) })
    await api.download(fileId, patientId)
    expect(http.get).toHaveBeenNthCalledWith(1, `/api/v1/files?patient_id=${patientId}&limit=25`, undefined)
    expect(http.get).toHaveBeenNthCalledWith(2, `/api/v1/files/${fileId}?patient_id=${patientId}`, undefined)
    expect(http.upload).toHaveBeenCalledWith(`/api/v1/files?patient_id=${patientId}&category=CONSENT`, expect.any(File), { filename: 'firma.pdf' })
    expect(http.download).toHaveBeenCalledWith(`/api/v1/files/${fileId}/download?patient_id=${patientId}`, undefined)
  })

  it('exposes signed URL retrieval without using it for direct downloads', async () => {
    const http = transport(); http.get.mockResolvedValueOnce({ url: 'https://objects.example/private' })
    const api = createFilesApi(http)
    await expect(api.getSignedUrl(fileId, patientId)).resolves.toBe('https://objects.example/private')
    expect(http.download).not.toHaveBeenCalled()
  })

  it('rejects a non-HTTPS signed URL before any consumer could use it', async () => {
    const http = transport(); http.get.mockResolvedValueOnce({ url: 'http://objects.example/private' })
    await expect(createFilesApi(http).getSignedUrl(fileId, patientId)).rejects.toThrow('HTTPS')
  })
})
