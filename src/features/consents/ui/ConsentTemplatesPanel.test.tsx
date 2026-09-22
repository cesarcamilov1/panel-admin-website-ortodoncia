import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ConsentsApi } from '../application/consentsApi'
import { ConsentTemplatesPanel } from './ConsentTemplatesPanel'

const template = {
  id: '11111111-1111-1111-1111-111111111111',
  code: 'GENERAL',
  name: 'Consentimiento general',
  active: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  version: 3,
}
const version = {
  id: '22222222-2222-2222-2222-222222222222',
  templateId: template.id,
  versionNumber: 1,
  contentMarkdown: 'Términos publicados',
  contentHash: 'hash',
  publishedAt: '2026-01-01T00:00:00Z',
  createdBy: '33333333-3333-3333-3333-333333333333',
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((nextResolve, nextReject) => { resolve = nextResolve; reject = nextReject })
  return { promise, resolve, reject }
}

function api(overrides: Partial<ConsentsApi> = {}): ConsentsApi {
  return {
    listTemplates: vi.fn().mockResolvedValue([template]),
    getTemplate: vi.fn().mockResolvedValue(template),
    createTemplate: vi.fn(),
    updateTemplate: vi.fn(),
    listTemplateVersions: vi.fn().mockResolvedValue([version]),
    publishVersion: vi.fn(),
    getTemplateVersion: vi.fn(),
    listConsents: vi.fn(),
    createConsent: vi.fn(),
    getConsent: vi.fn(),
    sign: vi.fn(),
    revoke: vi.fn(),
    void: vi.fn(),
    listSignatures: vi.fn(),
    ...overrides,
  }
}

async function openTemplate(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /Consentimiento general/ }))
  await screen.findByText('Versiones publicadas')
}

describe('ConsentTemplatesPanel', () => {
  it('guards duplicate template creation while a request is pending and preserves its error', async () => {
    const request = deferred<typeof template>()
    const createTemplate = vi.fn(() => request.promise)
    render(<ConsentTemplatesPanel api={api({ createTemplate })} owner />)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Nueva plantilla' }))
    await user.type(screen.getByLabelText('Código'), 'general')
    await user.type(screen.getByLabelText('Nombre'), 'General')
    const form = screen.getByRole('heading', { name: 'Nueva plantilla' }).closest('form')!
    fireEvent.submit(form)
    fireEvent.submit(form)
    expect(createTemplate).toHaveBeenCalledTimes(1)

    request.reject(new Error('offline'))
    expect(await screen.findByText('No pudimos completar el consentimiento. Intentá nuevamente.')).toBeInTheDocument()
    expect(screen.getByLabelText('Nombre')).toHaveValue('General')
  })

  it('guards duplicate activation requests and refreshes authoritative template state after success', async () => {
    const request = deferred<typeof template>()
    const updateTemplate = vi.fn(() => request.promise)
    const getTemplate = vi.fn().mockResolvedValueOnce(template).mockResolvedValue({ ...template, active: false, version: 4 })
    const listTemplates = vi.fn().mockResolvedValueOnce([template]).mockResolvedValue([{ ...template, active: false, version: 4 }])
    render(<ConsentTemplatesPanel api={api({ updateTemplate, getTemplate, listTemplates })} owner />)
    const user = userEvent.setup()

    await openTemplate(user)
    const action = screen.getByRole('button', { name: 'Desactivar' })
    fireEvent.click(action)
    fireEvent.click(action)
    expect(updateTemplate).toHaveBeenCalledTimes(1)

    request.resolve({ ...template, active: false, version: 4 })
    await screen.findByRole('button', { name: 'Activar' })
    expect(getTemplate.mock.calls.length).toBeGreaterThan(1)
    expect(listTemplates.mock.calls.length).toBeGreaterThan(1)
  })

  it('guards duplicate publishing requests and refreshes template and version data after success', async () => {
    const request = deferred<typeof version>()
    const publishVersion = vi.fn(() => request.promise)
    const getTemplate = vi.fn().mockResolvedValue(template)
    const listTemplateVersions = vi.fn().mockResolvedValueOnce([version]).mockResolvedValue([{ ...version, versionNumber: 2 }])
    const listTemplates = vi.fn().mockResolvedValue([template])
    render(<ConsentTemplatesPanel api={api({ publishVersion, getTemplate, listTemplateVersions, listTemplates })} owner />)
    const user = userEvent.setup()

    await openTemplate(user)
    await user.click(screen.getByRole('button', { name: 'Publicar versión' }))
    await user.type(screen.getByLabelText('Contenido de la plantilla'), 'Términos actualizados')
    const form = screen.getByRole('heading', { name: 'Publicar versión inmutable' }).closest('form')!
    fireEvent.submit(form)
    fireEvent.submit(form)
    expect(publishVersion).toHaveBeenCalledTimes(1)

    request.resolve({ ...version, versionNumber: 2 })
    await screen.findByText(/Versión 2/)
    expect(getTemplate.mock.calls.length).toBeGreaterThan(1)
    expect(listTemplateVersions.mock.calls.length).toBeGreaterThan(1)
    expect(listTemplates.mock.calls.length).toBeGreaterThan(1)
  })
})
