import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { FilesApi } from '../application/filesApi'
import { FilesPanel } from './FilesPanel'

const patientId = '11111111-1111-1111-1111-111111111111'
const clean = { id: '22222222-2222-2222-2222-222222222222', patientId, category: 'CONSENT' as const, originalFilename: 'firma.pdf', mediaType: 'application/pdf', sizeBytes: 2, scanStatus: 'CLEAN' as const, createdAt: '' }

function api(overrides: Partial<FilesApi> = {}): FilesApi { return { list: vi.fn().mockResolvedValue([clean]), get: vi.fn().mockResolvedValue(clean), upload: vi.fn(), download: vi.fn().mockResolvedValue(new Blob(['private'])), getSignedUrl: vi.fn(), ...overrides } }

describe('FilesPanel', () => {
  it('blocks non-CLEAN downloads and uses authenticated blob download with object URL cleanup for CLEAN files', async () => {
    const revoke = vi.fn(); const create = vi.fn().mockReturnValue('blob:private')
    vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: revoke })
    const value = api(); render(<FilesPanel api={value} patientId={patientId} />)
    await screen.findByText('firma.pdf')
    await userEvent.click(screen.getByRole('button', { name: /descargar firma.pdf/i }))
    expect(value.get).toHaveBeenCalledWith(clean.id, patientId)
    expect(value.download).toHaveBeenCalledWith(clean.id, patientId)
    await vi.waitFor(() => expect(revoke).toHaveBeenCalledWith('blob:private'))
    expect(value.getSignedUrl).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('shows actual scan state and never requests restricted file content', async () => {
    const pending = { ...clean, scanStatus: 'PENDING' as const }; const value = api({ list: vi.fn().mockResolvedValue([pending]) })
    render(<FilesPanel api={value} patientId={patientId} />)
    expect(await screen.findByText('Pendiente de análisis')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /descargar firma.pdf/i })).toBeDisabled()
    expect(value.get).not.toHaveBeenCalled()
  })

  it('does not submit an invalid selected upload', async () => {
    const value = api(); render(<FilesPanel api={value} patientId={patientId} />)
    const input = await screen.findByLabelText('Elegir archivo')
    await userEvent.setup({ applyAccept: false }).upload(input, new File(['gif'], 'scan.gif', { type: 'image/gif' }))
    expect(screen.getByText(/PDF, JPEG o PNG/i)).toBeInTheDocument()
    expect(value.upload).not.toHaveBeenCalled()
  })
})
