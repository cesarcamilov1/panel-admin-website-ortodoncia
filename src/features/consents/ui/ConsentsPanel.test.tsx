import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ConsentsApi } from '../application/consentsApi'
import type { FilesApi } from '../../files/application/filesApi'
import { ConsentsPanel } from './ConsentsPanel'

const patientId = '11111111-1111-1111-1111-111111111111'
const consentId = '22222222-2222-2222-2222-222222222222'
const templateVersionId = '33333333-3333-3333-3333-333333333333'

function filesApi(overrides: Partial<FilesApi> = {}): FilesApi {
  return {
    list: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue({ id: 'file-1', patientId, category: 'CONSENT', originalFilename: 'bound.pdf', mediaType: 'application/pdf', sizeBytes: 11, scanStatus: 'CLEAN', createdAt: '' }),
    upload: vi.fn(),
    download: vi.fn().mockResolvedValue(new Blob(['bound bytes'], { type: 'application/pdf' })),
    getSignedUrl: vi.fn(),
    ...overrides,
  }
}

function api(documentFileId = '', documentHash = ''): ConsentsApi {
  return {
    listTemplates: vi.fn().mockResolvedValue([]), getTemplate: vi.fn(), createTemplate: vi.fn(), updateTemplate: vi.fn(),
    listTemplateVersions: vi.fn(), publishVersion: vi.fn(),
    getTemplateVersion: vi.fn().mockResolvedValue({ id: templateVersionId, templateId: 'template-1', versionNumber: 4, contentMarkdown: '<strong>Texto inmutable</strong>', contentHash: 'hash', publishedAt: '2026-01-01T00:00:00Z', createdBy: 'user-1' }),
    listConsents: vi.fn().mockResolvedValue([{ id: consentId, patientId, treatmentPlanId: '', templateVersionId, appointmentId: '', status: 'PENDING', documentFileId, documentHash, signedAt: '', revokedAt: '', revocationReason: '', createdAt: '2026-01-01T00:00:00Z', version: 2 }]),
    createConsent: vi.fn(), getConsent: vi.fn().mockResolvedValue({ id: consentId, patientId, treatmentPlanId: '', templateVersionId, appointmentId: '', status: 'PENDING', documentFileId, documentHash, signedAt: '', revokedAt: '', revocationReason: '', createdAt: '2026-01-01T00:00:00Z', version: 2 }),
    sign: vi.fn(), revoke: vi.fn(), void: vi.fn(), listSignatures: vi.fn().mockResolvedValue([]),
  }
}

describe('ConsentsPanel', () => {
  it('shows the fetched immutable template version as escaped text before digital confirmation', async () => {
    const user = userEvent.setup()
    render(<ConsentsPanel api={api()} patientId={patientId} role="OWNER_DENTIST" />)

    await user.click(await screen.findByRole('button', { name: new RegExp(consentId) }))
    await user.click(await screen.findByRole('button', { name: 'Registrar confirmación digital' }))

    expect(await screen.findByText('<strong>Texto inmutable</strong>')).toBeInTheDocument()
    expect(screen.queryByText('Texto inmutable', { selector: 'strong' })).not.toBeInTheDocument()
  })

  it('fails closed until the bound CLEAN document bytes match its immutable hash and a human confirms that exact document', async () => {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('bound bytes'))
    const documentHash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
    const value = api('file-1', documentHash)
    const files = filesApi()
    const user = userEvent.setup()
    render(<ConsentsPanel api={value} filesApi={files} patientId={patientId} role="OWNER_DENTIST" />)

    await user.click(await screen.findByRole('button', { name: new RegExp(consentId) }))
    const signButton = await screen.findByRole('button', { name: 'Registrar confirmación digital' })
    await vi.waitFor(() => expect(signButton).toBeEnabled())
    await user.click(signButton)

    expect(await screen.findByRole('heading', { name: 'Documento vinculado verificado' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Texto de plantilla complementario' })).toBeInTheDocument()
    expect(files.get).toHaveBeenCalledWith('file-1', patientId, expect.any(AbortSignal))
    expect(files.download).toHaveBeenCalledWith('file-1', patientId, expect.any(AbortSignal))
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled()

    await user.click(screen.getByLabelText(/confirmo que revisé el documento vinculado/i))
    await user.type(screen.getByLabelText(/Nombre de quien firma/i), 'Ana')
    await user.click(screen.getByLabelText(/persona expresó su aceptación/i))
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeEnabled()
  })

  it('does not sign when the bound document hash mismatches', async () => {
    const value = api('file-1', '0'.repeat(64))
    const files = filesApi()
    const user = userEvent.setup()
    render(<ConsentsPanel api={value} filesApi={files} patientId={patientId} role="OWNER_DENTIST" />)

    await user.click(await screen.findByRole('button', { name: new RegExp(consentId) }))

    expect(await screen.findByText(/no coincide/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Registrar confirmación digital' })).toBeDisabled()
    expect(value.sign).not.toHaveBeenCalled()
  })

  it('does not sign when the authenticated bound-document download fails', async () => {
    const value = api('file-1', 'a'.repeat(64))
    const files = filesApi({ download: vi.fn().mockRejectedValue(new Error('unavailable')) })
    const user = userEvent.setup()
    render(<ConsentsPanel api={value} filesApi={files} patientId={patientId} role="OWNER_DENTIST" />)

    await user.click(await screen.findByRole('button', { name: new RegExp(consentId) }))

    expect(await screen.findByText(/no se pudo recuperar/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Registrar confirmación digital' })).toBeDisabled()
    expect(value.sign).not.toHaveBeenCalled()
  })

  it('does not allocate a blob URL when the deferred hash resolves after unmount', async () => {
    let resolveDigest: ((value: ArrayBuffer) => void) | undefined
    const deferredDigest = new Promise<ArrayBuffer>((resolve) => { resolveDigest = resolve })
    const digest = vi.spyOn(crypto.subtle, 'digest').mockImplementation(() => deferredDigest)
    const create = vi.spyOn(URL, 'createObjectURL')
    const value = api('file-1', 'a'.repeat(64))
    const files = filesApi()
    const { unmount } = render(<ConsentsPanel api={value} filesApi={files} patientId={patientId} role="OWNER_DENTIST" />)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: new RegExp(consentId) }))
    await vi.waitFor(() => expect(files.download).toHaveBeenCalled())
    unmount()
    await act(async () => resolveDigest!(new ArrayBuffer(32)))

    expect(create).not.toHaveBeenCalled()
    digest.mockRestore()
  })

  it('revokes the verified document blob URL when the selected consent changes', async () => {
    const anotherConsentId = '44444444-4444-4444-4444-444444444444'
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('bound bytes'))
    const documentHash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
    const value = api()
    const bound = (id: string, fileId: string) => ({ id, patientId, treatmentPlanId: '', templateVersionId, appointmentId: '', status: 'PENDING' as const, documentFileId: fileId, documentHash, signedAt: '', revokedAt: '', revocationReason: '', createdAt: '2026-01-01T00:00:00Z', version: 2 })
    value.listConsents = vi.fn().mockResolvedValue([bound(consentId, 'file-1'), bound(anotherConsentId, 'file-2')])
    value.getConsent = vi.fn().mockImplementation((id: string) => Promise.resolve(id === consentId ? bound(consentId, 'file-1') : bound(anotherConsentId, 'file-2')))
    const files = filesApi({ get: vi.fn().mockImplementation((fileId: string) => Promise.resolve({ id: fileId, patientId, category: 'CONSENT', originalFilename: `${fileId}.pdf`, mediaType: 'application/pdf', sizeBytes: 11, scanStatus: 'CLEAN', createdAt: '' })) })
    const revoke = vi.spyOn(URL, 'revokeObjectURL')
    const user = userEvent.setup()
    render(<ConsentsPanel api={value} filesApi={files} patientId={patientId} role="OWNER_DENTIST" />)

    await user.click(await screen.findByRole('button', { name: new RegExp(consentId) }))
    await vi.waitFor(() => expect(files.download).toHaveBeenCalledWith('file-1', patientId, expect.any(AbortSignal)))
    await user.click(await screen.findByRole('button', { name: new RegExp(anotherConsentId) }))
    await vi.waitFor(() => expect(files.download).toHaveBeenCalledWith('file-2', patientId, expect.any(AbortSignal)))
    expect(revoke).toHaveBeenCalled()
  })
})
