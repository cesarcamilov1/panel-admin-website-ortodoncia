import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { FilesApi } from '../../files/application/filesApi'
import type { PrivateFile } from '../../files/domain/file'
import { ConsentFileSelector } from './ConsentFileSelector'

const patientId = '11111111-1111-1111-1111-111111111111'
const clean: PrivateFile = { id: '22222222-2222-2222-2222-222222222222', patientId, category: 'CONSENT', originalFilename: 'firma.pdf', mediaType: 'application/pdf', sizeBytes: 2, scanStatus: 'CLEAN', createdAt: '' }
const api = (items: PrivateFile[] = [clean]) => ({ list: vi.fn().mockResolvedValue(items), get: vi.fn(), upload: vi.fn(), download: vi.fn(), getSignedUrl: vi.fn() } as unknown as FilesApi)

describe('ConsentFileSelector', () => {
  it('only offers actual CLEAN same-patient consent files and never manufactures an identifier', async () => {
    const changed = vi.fn(); render(<ConsentFileSelector api={api([clean, { ...clean, id: 'other', patientId: 'other-patient' }, { ...clean, id: 'pending', scanStatus: 'PENDING' }])} patientId={patientId} label="Archivo de firma" value="" onChange={changed} />)
    const select = await screen.findByLabelText('Archivo de firma')
    expect(screen.getByRole('option', { name: /firma.pdf/i })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /pending/i })).not.toBeInTheDocument()
    await userEvent.selectOptions(select, clean.id)
    expect(changed).toHaveBeenCalledWith(clean.id)
  })
})
