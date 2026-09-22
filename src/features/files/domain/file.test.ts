import { describe, expect, it } from 'vitest'
import { MAX_UPLOAD_BYTES, isCleanFile, validateUploadFile, type PrivateFile } from './file'

describe('file upload validation', () => {
  it('accepts supported files and rejects MIME, unsafe names, and the configured server limit', () => {
    expect(validateUploadFile(new File(['pdf'], 'consent.pdf', { type: 'application/pdf' }))).toBeNull()
    expect(validateUploadFile(new File(['x'], 'scan.gif', { type: 'image/gif' }))).toMatch(/PDF/i)
    expect(validateUploadFile(new File(['x'], '../scan.pdf', { type: 'application/pdf' }))).toMatch(/nombre/i)
    expect(validateUploadFile(new File(['x'], 'firma😀.pdf', { type: 'application/pdf' }))).toMatch(/renombr/i)
    expect(validateUploadFile(new File(['x'], 'firma\r\n.pdf', { type: 'application/pdf' }))).toMatch(/renombr/i)
    expect(validateUploadFile(new File([new Uint8Array(MAX_UPLOAD_BYTES + 1)], 'large.pdf', { type: 'application/pdf' }))).toMatch(/15 MiB/i)
  })

  it('only treats a same-patient CLEAN consent file as suitable evidence', () => {
    const file: PrivateFile = { id: 'file-1', patientId: 'patient-1', category: 'CONSENT', originalFilename: 'firma.pdf', mediaType: 'application/pdf', sizeBytes: 2, scanStatus: 'CLEAN', createdAt: '' }
    expect(isCleanFile(file, 'patient-1')).toBe(true)
    expect(isCleanFile({ ...file, scanStatus: 'PENDING' }, 'patient-1')).toBe(false)
    expect(isCleanFile(file, 'another-patient')).toBe(false)
  })
})
