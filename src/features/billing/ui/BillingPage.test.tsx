import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { HttpTransport } from '../../../shared/api/http'
import { HttpContext } from '../../../shared/api/httpContext'
import { ApiError } from '../../../shared/api/problem'
import { AuthContext } from '../../auth/application/authContext'
import { BillingPage } from './BillingPage'

const patientId = '11111111-1111-1111-1111-111111111111'
const id = '22222222-2222-2222-2222-222222222222'
const document = { id, patient_id: patientId, cfdi_type: 'I', status: 'ISSUED', total: '10.000000', version: 2, files: { xml: false, pdf: false, ack: false } }

describe('BillingPage authority guard', () => {
  it('treats a 202 as queued and blocks another action when its authority refresh fails', async () => {
    let detailReads = 0
    const http = { get: vi.fn().mockImplementation((path: string) => { if (path.startsWith('/api/v1/billing/documents?')) return Promise.resolve({ items: [document] }); if (path === `/api/v1/billing/documents/${id}`) return detailReads++ ? Promise.reject(new ApiError({ status: 503, code: 'DEPENDENCY_UNAVAILABLE' })) : Promise.resolve(document); if (path.startsWith('/api/v1/payments?')) return Promise.resolve({ items: [] }); return Promise.resolve({ items: [] }) }), post: vi.fn().mockResolvedValue(document), put: vi.fn(), patch: vi.fn(), del: vi.fn(), upload: vi.fn(), download: vi.fn() } as unknown as HttpTransport
    render(<HttpContext value={http}><AuthContext value={{ state: { status: 'authenticated', user: { id: 'billing-user', email: 'billing@example.mx', firstName: 'Bea', lastName: 'Cobros', role: 'BILLING', mfaRequired: false } }, login: vi.fn(), verifyMfa: vi.fn(), logout: vi.fn(), logoutAll: vi.fn(), refresh: vi.fn(), forgotPassword: vi.fn(), resetPassword: vi.fn() }}><BillingPage /></AuthContext></HttpContext>)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /Ingreso.*10.000000/i }))
    await user.click(await screen.findByLabelText(/Confirmo la acción fiscal/i))
    await user.click(screen.getByRole('button', { name: 'Conciliar estado' }))
    expect((await screen.findAllByText(/solicitud fue aceptada|configuración fiscal/i)).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Conciliar estado' })).toBeDisabled()
  })

  it('clears a definitively rejected action and requires a newly confirmed v3 request after the 412 refresh', async () => {
    let documentReads = 0
    const v3 = { ...document, version: 3 }
    let resolveRefresh!: (value: typeof v3) => void
    const refresh = new Promise<typeof v3>((resolve) => { resolveRefresh = resolve })
    const http = { get: vi.fn().mockImplementation((path: string) => {
      if (path.startsWith('/api/v1/billing/documents?')) return Promise.resolve({ items: [document] })
      if (path === `/api/v1/billing/documents/${id}`) return documentReads++ === 0 ? Promise.resolve(document) : refresh
      if (path.startsWith('/api/v1/payments?')) return Promise.resolve({ items: [] })
      return Promise.resolve({ items: [] })
    }), post: vi.fn().mockRejectedValueOnce(new ApiError({ status: 412, code: 'PRECONDITION_FAILED' })).mockResolvedValue(v3), put: vi.fn(), patch: vi.fn(), del: vi.fn(), upload: vi.fn(), download: vi.fn() } as unknown as HttpTransport
    render(<HttpContext value={http}><AuthContext value={{ state: { status: 'authenticated', user: { id: 'billing-user', email: 'billing@example.mx', firstName: 'Bea', lastName: 'Cobros', role: 'BILLING', mfaRequired: false } }, login: vi.fn(), verifyMfa: vi.fn(), logout: vi.fn(), logoutAll: vi.fn(), refresh: vi.fn(), forgotPassword: vi.fn(), resetPassword: vi.fn() }}><BillingPage /></AuthContext></HttpContext>)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: /Ingreso.*10.000000/i }))
    await user.click(await screen.findByLabelText(/Confirmo la acción fiscal/i))
    await user.click(screen.getByRole('button', { name: 'Conciliar estado' }))
    await vi.waitFor(() => expect(http.get).toHaveBeenCalledWith(`/api/v1/billing/documents/${id}`, expect.anything()))
    expect(screen.getByRole('button', { name: 'Conciliar estado' })).toBeDisabled()

    await act(async () => resolveRefresh(v3))
    await vi.waitFor(() => expect(screen.getByText(/documento cambió/i)).toBeInTheDocument())
    expect(screen.getByLabelText(/Confirmo la acción fiscal/i)).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Conciliar estado' })).toBeDisabled()

    await user.click(screen.getByLabelText(/Confirmo la acción fiscal/i))
    await user.click(screen.getByRole('button', { name: 'Conciliar estado' }))
    await vi.waitFor(() => expect((http.post as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(2))
    const [firstPath, firstBody, firstOptions] = (http.post as ReturnType<typeof vi.fn>).mock.calls[0]
    const [secondPath, secondBody, secondOptions] = (http.post as ReturnType<typeof vi.fn>).mock.calls[1]
    expect(secondPath).toBe(firstPath)
    expect(secondBody).toEqual({ expected_version: 3 })
    expect(secondOptions.ifMatch).toBe(3)
    expect(secondOptions.idempotencyKey).not.toBe(firstOptions.idempotencyKey)
    expect(firstBody).toEqual({ expected_version: 2 })
  })

  it('preserves an uncertain action body, version, and key across a manual refresh', async () => {
    let documentReads = 0
    const v3 = { ...document, version: 3 }
    const http = { get: vi.fn().mockImplementation((path: string) => {
      if (path.startsWith('/api/v1/billing/documents?')) return Promise.resolve({ items: [document] })
      if (path === `/api/v1/billing/documents/${id}`) return Promise.resolve(documentReads++ === 0 ? document : v3)
      if (path.startsWith('/api/v1/payments?')) return Promise.resolve({ items: [] })
      return Promise.resolve({ items: [] })
    }), post: vi.fn().mockRejectedValueOnce(new Error('timeout')).mockResolvedValue(v3), put: vi.fn(), patch: vi.fn(), del: vi.fn(), upload: vi.fn(), download: vi.fn() } as unknown as HttpTransport
    render(<HttpContext value={http}><AuthContext value={{ state: { status: 'authenticated', user: { id: 'billing-user', email: 'billing@example.mx', firstName: 'Bea', lastName: 'Cobros', role: 'BILLING', mfaRequired: false } }, login: vi.fn(), verifyMfa: vi.fn(), logout: vi.fn(), logoutAll: vi.fn(), refresh: vi.fn(), forgotPassword: vi.fn(), resetPassword: vi.fn() }}><BillingPage /></AuthContext></HttpContext>)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: /Ingreso.*10.000000/i }))
    await user.click(await screen.findByLabelText(/Confirmo la acción fiscal/i))
    await user.click(screen.getByRole('button', { name: 'Conciliar estado' }))
    await screen.findByText(/operación no se confirmó/i)
    await user.click(screen.getByRole('button', { name: 'Actualizar estado' }))
    expect(screen.getByLabelText(/Confirmo la acción fiscal con la versión de la solicitud original 2/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Conciliar estado' }))
    await vi.waitFor(() => expect((http.post as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(2))
    const [, firstBody, firstOptions] = (http.post as ReturnType<typeof vi.fn>).mock.calls[0]
    const [, secondBody, secondOptions] = (http.post as ReturnType<typeof vi.fn>).mock.calls[1]
    expect(secondBody).toEqual(firstBody)
    expect(secondOptions.ifMatch).toBe(firstOptions.ifMatch)
    expect(secondOptions.idempotencyKey).toBe(firstOptions.idempotencyKey)
  })

  it('keeps fiscal actions blocked when the authority refresh after a 412 fails', async () => {
    let documentReads = 0
    const http = { get: vi.fn().mockImplementation((path: string) => {
      if (path.startsWith('/api/v1/billing/documents?')) return Promise.resolve({ items: [document] })
      if (path === `/api/v1/billing/documents/${id}`) return documentReads++ === 0 ? Promise.resolve(document) : Promise.reject(new ApiError({ status: 503, code: 'DEPENDENCY_UNAVAILABLE' }))
      if (path.startsWith('/api/v1/payments?')) return Promise.resolve({ items: [] })
      return Promise.resolve({ items: [] })
    }), post: vi.fn().mockRejectedValue(new ApiError({ status: 412, code: 'PRECONDITION_FAILED' })), put: vi.fn(), patch: vi.fn(), del: vi.fn(), upload: vi.fn(), download: vi.fn() } as unknown as HttpTransport
    render(<HttpContext value={http}><AuthContext value={{ state: { status: 'authenticated', user: { id: 'billing-user', email: 'billing@example.mx', firstName: 'Bea', lastName: 'Cobros', role: 'BILLING', mfaRequired: false } }, login: vi.fn(), verifyMfa: vi.fn(), logout: vi.fn(), logoutAll: vi.fn(), refresh: vi.fn(), forgotPassword: vi.fn(), resetPassword: vi.fn() }}><BillingPage /></AuthContext></HttpContext>)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: /Ingreso.*10.000000/i }))
    await user.click(await screen.findByLabelText(/Confirmo la acción fiscal/i))
    await user.click(screen.getByRole('button', { name: 'Conciliar estado' }))
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Conciliar estado' })).toBeDisabled())
  })

  it('loads the next keyset page so the 26th payment is selectable for a complement', async () => {
    const firstPayments = Array.from({ length: 25 }, (_, index) => ({ id: `payment-${index + 1}`, patient_id: patientId, amount: `${index + 1}.000000`, currency: 'MXN', internal_method: 'CASH', sat_payment_form_code: '01', status: 'RECEIVED', version: 1 }))
    const twentySixth = { id: 'payment-26', patient_id: patientId, amount: '26.000000', currency: 'MXN', internal_method: 'CASH', sat_payment_form_code: '01', status: 'RECEIVED', version: 1 }
    const http = { get: vi.fn().mockImplementation((path: string) => {
      if (path.startsWith('/api/v1/billing/documents?')) return Promise.resolve({ items: [document] })
      if (path === `/api/v1/billing/documents/${id}`) return Promise.resolve(document)
      if (path === `/api/v1/payments?patient_id=${patientId}&limit=25`) return Promise.resolve({ items: firstPayments })
      if (path === `/api/v1/payments?patient_id=${patientId}&limit=25&after_id=payment-25`) return Promise.resolve({ items: [twentySixth] })
      return Promise.resolve({ items: [] })
    }), post: vi.fn(), put: vi.fn(), patch: vi.fn(), del: vi.fn(), upload: vi.fn(), download: vi.fn() } as unknown as HttpTransport
    render(<HttpContext value={http}><AuthContext value={{ state: { status: 'authenticated', user: { id: 'billing-user', email: 'billing@example.mx', firstName: 'Bea', lastName: 'Cobros', role: 'BILLING', mfaRequired: false } }, login: vi.fn(), verifyMfa: vi.fn(), logout: vi.fn(), logoutAll: vi.fn(), refresh: vi.fn(), forgotPassword: vi.fn(), resetPassword: vi.fn() }}><BillingPage /></AuthContext></HttpContext>)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: /Ingreso.*10.000000/i }))
    await user.click(await screen.findByRole('button', { name: 'Cargar más pagos' }))
    const twentySixthChoice = await screen.findByLabelText(/26\.000000 MXN/i)
    await user.click(twentySixthChoice)
    expect(twentySixthChoice).toBeChecked()
    expect(http.get).toHaveBeenCalledWith(`/api/v1/payments?patient_id=${patientId}&limit=25&after_id=payment-25`, { signal: expect.any(AbortSignal) })
  })

  it('retrieves a server-issued artifact URL only after an explicit action and exposes a no-referrer safe link', async () => {
    const artifactDocument = { ...document, files: { xml: false, pdf: true, ack: false } }
    const http = { get: vi.fn().mockImplementation((path: string) => {
      if (path.startsWith('/api/v1/billing/documents?')) return Promise.resolve({ items: [artifactDocument] })
      if (path === `/api/v1/billing/documents/${id}`) return Promise.resolve(artifactDocument)
      if (path === `/api/v1/billing/documents/${id}/files/pdf`) return Promise.resolve({ url: 'https://storage.example/fiscal.pdf?signature=opaque', expires_in_seconds: 120, media_type: 'application/pdf' })
      return Promise.resolve({ items: [] })
    }), post: vi.fn(), put: vi.fn(), patch: vi.fn(), del: vi.fn(), upload: vi.fn(), download: vi.fn() } as unknown as HttpTransport
    render(<HttpContext value={http}><AuthContext value={{ state: { status: 'authenticated', user: { id: 'billing-user', email: 'billing@example.mx', firstName: 'Bea', lastName: 'Cobros', role: 'BILLING', mfaRequired: false } }, login: vi.fn(), verifyMfa: vi.fn(), logout: vi.fn(), logoutAll: vi.fn(), refresh: vi.fn(), forgotPassword: vi.fn(), resetPassword: vi.fn() }}><BillingPage /></AuthContext></HttpContext>)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: /Ingreso.*10.000000/i }))
    await user.click(await screen.findByRole('button', { name: 'Preparar PDF' }))

    const link = await screen.findByRole('link', { name: 'Abrir PDF' })
    expect(link).toHaveAttribute('href', 'https://storage.example/fiscal.pdf?signature=opaque')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(link).toHaveAttribute('referrerpolicy', 'no-referrer')
    expect((http.get as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(`/api/v1/billing/documents/${id}/files/pdf`, { signal: expect.any(AbortSignal) })
  })

  it('clears the old artifact expiry before a new URL can replace it', async () => {
    const artifactDocument = { ...document, files: { xml: false, pdf: true, ack: false } }
    let artifactCalls = 0
    const clearTimeout = vi.spyOn(window, 'clearTimeout')
    const http = { get: vi.fn().mockImplementation((path: string) => {
      if (path.startsWith('/api/v1/billing/documents?')) return Promise.resolve({ items: [artifactDocument] })
      if (path === `/api/v1/billing/documents/${id}`) return Promise.resolve(artifactDocument)
      if (path === `/api/v1/billing/documents/${id}/files/pdf`) return Promise.resolve({ url: `https://storage.example/${++artifactCalls}.pdf`, expires_in_seconds: 60, media_type: 'application/pdf' })
      return Promise.resolve({ items: [] })
    }), post: vi.fn(), put: vi.fn(), patch: vi.fn(), del: vi.fn(), upload: vi.fn(), download: vi.fn() } as unknown as HttpTransport
    render(<HttpContext value={http}><AuthContext value={{ state: { status: 'authenticated', user: { id: 'billing-user', email: 'billing@example.mx', firstName: 'Bea', lastName: 'Cobros', role: 'BILLING', mfaRequired: false } }, login: vi.fn(), verifyMfa: vi.fn(), logout: vi.fn(), logoutAll: vi.fn(), refresh: vi.fn(), forgotPassword: vi.fn(), resetPassword: vi.fn() }}><BillingPage /></AuthContext></HttpContext>)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: /Ingreso.*10.000000/i }))
    await user.click(await screen.findByRole('button', { name: 'Preparar PDF' }))
    expect((await screen.findByRole('link', { name: 'Abrir PDF' }))).toHaveAttribute('href', 'https://storage.example/1.pdf')
    await user.click(screen.getByRole('button', { name: 'Preparar PDF' }))
    expect((await screen.findByRole('link', { name: 'Abrir PDF' }))).toHaveAttribute('href', 'https://storage.example/2.pdf')
    expect(clearTimeout).toHaveBeenCalled()
    clearTimeout.mockRestore()
  })

  it('shows confirmed candidate controls and sends each supported request to its mounted endpoint', async () => {
    const http = { get: vi.fn().mockImplementation((path: string) => {
      if (path.startsWith('/api/v1/billing/documents?')) return Promise.resolve({ items: [document] })
      if (path === `/api/v1/billing/documents/${id}`) return Promise.resolve(document)
      if (path.startsWith('/api/v1/payments?')) return Promise.resolve({ items: [] })
      return Promise.resolve({ items: [] })
    }), post: vi.fn().mockResolvedValue(document), put: vi.fn(), patch: vi.fn(), del: vi.fn(), upload: vi.fn(), download: vi.fn() } as unknown as HttpTransport
    render(<HttpContext value={http}><AuthContext value={{ state: { status: 'authenticated', user: { id: 'billing-user', email: 'billing@example.mx', firstName: 'Bea', lastName: 'Cobros', role: 'BILLING', mfaRequired: false } }, login: vi.fn(), verifyMfa: vi.fn(), logout: vi.fn(), logoutAll: vi.fn(), refresh: vi.fn(), forgotPassword: vi.fn(), resetPassword: vi.fn() }}><BillingPage /></AuthContext></HttpContext>)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: /Ingreso.*10.000000/i }))
    expect(await screen.findByRole('button', { name: 'Solicitar sustitución' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Solicitar reenvío por correo' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Solicitar cancelación' })).toBeDisabled()

    await user.click(screen.getByLabelText(/Confirmo solicitar la sustitución/i))
    await user.click(screen.getByRole('button', { name: 'Solicitar sustitución' }))
    await vi.waitFor(() => expect((http.post as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(`/api/v1/billing/documents/${id}/replace`, { expected_version: 2 }, expect.objectContaining({ ifMatch: 2, idempotencyKey: expect.any(String) })))

    await user.click(screen.getByLabelText(/Confirmo solicitar el reenvío/i))
    await user.click(screen.getByRole('button', { name: 'Solicitar reenvío por correo' }))
    await vi.waitFor(() => expect((http.post as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(`/api/v1/billing/documents/${id}/send-email`, { expected_version: 2 }, expect.objectContaining({ ifMatch: 2, idempotencyKey: expect.any(String) })))

    await user.selectOptions(screen.getByLabelText('Motivo de cancelación'), '01')
    expect(screen.getByText(/servidor requiere o busca el sucesor emitido/i)).toBeInTheDocument()
    await user.click(screen.getByLabelText(/Confirmo solicitar la cancelación con motivo 01/i))
    await user.click(screen.getByRole('button', { name: 'Solicitar cancelación' }))
    await vi.waitFor(() => expect((http.post as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(`/api/v1/billing/documents/${id}/cancel`, { expected_version: 2, motive: '01' }, expect.objectContaining({ ifMatch: 2, idempotencyKey: expect.any(String) })))
    expect(screen.getByText(/solicitud fue aceptada y quedó en cola/i)).toBeInTheDocument()
  })

  it('hides candidate controls for known-invalid document types and statuses', async () => {
    const invalid = { ...document, cfdi_type: 'P', status: 'QUEUED' }
    const http = { get: vi.fn().mockImplementation((path: string) => {
      if (path.startsWith('/api/v1/billing/documents?')) return Promise.resolve({ items: [invalid] })
      if (path === `/api/v1/billing/documents/${id}`) return Promise.resolve(invalid)
      return Promise.resolve({ items: [] })
    }), post: vi.fn(), put: vi.fn(), patch: vi.fn(), del: vi.fn(), upload: vi.fn(), download: vi.fn() } as unknown as HttpTransport
    render(<HttpContext value={http}><AuthContext value={{ state: { status: 'authenticated', user: { id: 'billing-user', email: 'billing@example.mx', firstName: 'Bea', lastName: 'Cobros', role: 'BILLING', mfaRequired: false } }, login: vi.fn(), verifyMfa: vi.fn(), logout: vi.fn(), logoutAll: vi.fn(), refresh: vi.fn(), forgotPassword: vi.fn(), resetPassword: vi.fn() }}><BillingPage /></AuthContext></HttpContext>)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: /Complemento de pago.*10.000000/i }))
    await vi.waitFor(() => expect(screen.queryByRole('button', { name: 'Solicitar sustitución' })).not.toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Solicitar cancelación' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Solicitar reenvío por correo' })).not.toBeInTheDocument()
  })

  it('keeps a server rejection visible without treating it as a successful request', async () => {
    const http = { get: vi.fn().mockImplementation((path: string) => {
      if (path.startsWith('/api/v1/billing/documents?')) return Promise.resolve({ items: [document] })
      if (path === `/api/v1/billing/documents/${id}`) return Promise.resolve(document)
      return Promise.resolve({ items: [] })
    }), post: vi.fn().mockRejectedValue(new ApiError({ status: 422, code: 'REPLACEMENT_UNAVAILABLE' })), put: vi.fn(), patch: vi.fn(), del: vi.fn(), upload: vi.fn(), download: vi.fn() } as unknown as HttpTransport
    render(<HttpContext value={http}><AuthContext value={{ state: { status: 'authenticated', user: { id: 'billing-user', email: 'billing@example.mx', firstName: 'Bea', lastName: 'Cobros', role: 'BILLING', mfaRequired: false } }, login: vi.fn(), verifyMfa: vi.fn(), logout: vi.fn(), logoutAll: vi.fn(), refresh: vi.fn(), forgotPassword: vi.fn(), resetPassword: vi.fn() }}><BillingPage /></AuthContext></HttpContext>)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: /Ingreso.*10.000000/i }))
    await user.click(screen.getByLabelText(/Confirmo solicitar la sustitución/i))
    await user.click(screen.getByRole('button', { name: 'Solicitar sustitución' }))
    expect(await screen.findByText(/acción no es válida para el estado fiscal actual/i)).toBeInTheDocument()
    expect(screen.queryByText(/solicitud fue aceptada y quedó en cola/i)).not.toBeInTheDocument()
  })

  it('locks a timed-out cancellation to its original motive, payload, and key until replayed', async () => {
    const http = { get: vi.fn().mockImplementation((path: string) => {
      if (path.startsWith('/api/v1/billing/documents?')) return Promise.resolve({ items: [document] })
      if (path === `/api/v1/billing/documents/${id}`) return Promise.resolve(document)
      return Promise.resolve({ items: [] })
    }), post: vi.fn().mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce(document), put: vi.fn(), patch: vi.fn(), del: vi.fn(), upload: vi.fn(), download: vi.fn() } as unknown as HttpTransport
    render(<HttpContext value={http}><AuthContext value={{ state: { status: 'authenticated', user: { id: 'billing-user', email: 'billing@example.mx', firstName: 'Bea', lastName: 'Cobros', role: 'BILLING', mfaRequired: false } }, login: vi.fn(), verifyMfa: vi.fn(), logout: vi.fn(), logoutAll: vi.fn(), refresh: vi.fn(), forgotPassword: vi.fn(), resetPassword: vi.fn() }}><BillingPage /></AuthContext></HttpContext>)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: /Ingreso.*10.000000/i }))
    await user.selectOptions(screen.getByLabelText('Motivo de cancelación'), '01')
    await user.click(screen.getByLabelText(/Confirmo solicitar la cancelación con motivo 01/i))
    await user.click(screen.getByRole('button', { name: 'Solicitar cancelación' }))
    await screen.findByText(/operación no se confirmó/i)

    expect(screen.getByLabelText('Motivo de cancelación')).toBeDisabled()
    expect(screen.getByText(/Confirmo solicitar la cancelación con motivo 01/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Solicitar cancelación' }))
    await vi.waitFor(() => expect((http.post as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2))
    expect((http.post as ReturnType<typeof vi.fn>).mock.calls[1]).toEqual((http.post as ReturnType<typeof vi.fn>).mock.calls[0])
  })

  it('retains the frozen v2 motive 02 cancellation after manual detail refresh and replays its full request', async () => {
    let documentReads = 0
    const v3 = { ...document, version: 3 }
    const http = { get: vi.fn().mockImplementation((path: string) => {
      if (path.startsWith('/api/v1/billing/documents?')) return Promise.resolve({ items: [document] })
      if (path === `/api/v1/billing/documents/${id}`) return Promise.resolve(documentReads++ === 0 ? document : v3)
      if (path.startsWith('/api/v1/payments?')) return Promise.resolve({ items: [] })
      return Promise.resolve({ items: [] })
    }), post: vi.fn().mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce(v3), put: vi.fn(), patch: vi.fn(), del: vi.fn(), upload: vi.fn(), download: vi.fn() } as unknown as HttpTransport
    render(<HttpContext value={http}><AuthContext value={{ state: { status: 'authenticated', user: { id: 'billing-user', email: 'billing@example.mx', firstName: 'Bea', lastName: 'Cobros', role: 'BILLING', mfaRequired: false } }, login: vi.fn(), verifyMfa: vi.fn(), logout: vi.fn(), logoutAll: vi.fn(), refresh: vi.fn(), forgotPassword: vi.fn(), resetPassword: vi.fn() }}><BillingPage /></AuthContext></HttpContext>)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: /Ingreso.*10.000000/i }))
    await user.click(screen.getByLabelText(/Confirmo solicitar la cancelación con motivo 02/i))
    await user.click(screen.getByRole('button', { name: 'Solicitar cancelación' }))
    await screen.findByText(/operación no se confirmó/i)

    await user.click(screen.getByRole('button', { name: 'Actualizar estado' }))
    const frozenConfirmation = await screen.findByLabelText(/Confirmo solicitar la cancelación con motivo 02 y versión de la solicitud original 2/i)
    expect(frozenConfirmation).toBeChecked()
    expect(screen.getByText(/versión actual 3; el reintento conserva la versión original 2/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Solicitar cancelación' }))
    await vi.waitFor(() => expect((http.post as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(2))
    const [firstPath, firstBody, firstOptions] = (http.post as ReturnType<typeof vi.fn>).mock.calls[0]
    const [retryPath, retryBody, retryOptions] = (http.post as ReturnType<typeof vi.fn>).mock.calls[1]
    expect(firstPath).toBe(`/api/v1/billing/documents/${id}/cancel`)
    expect(firstBody).toEqual({ expected_version: 2, motive: '02' })
    expect(firstOptions).toEqual({ ifMatch: 2, idempotencyKey: expect.any(String) })
    expect(retryPath).toBe(firstPath)
    expect(retryBody).toEqual(firstBody)
    expect(retryOptions).toEqual(firstOptions)
  })

  it('clears an expired artifact URL and requires a fresh server retrieval before opening it again', async () => {
      const artifactDocument = { ...document, files: { xml: false, pdf: true, ack: false } }
      const http = { get: vi.fn().mockImplementation((path: string) => {
        if (path.startsWith('/api/v1/billing/documents?')) return Promise.resolve({ items: [artifactDocument] })
        if (path === `/api/v1/billing/documents/${id}`) return Promise.resolve(artifactDocument)
        if (path === `/api/v1/billing/documents/${id}/files/pdf`) return Promise.resolve({ url: 'https://storage.example/fiscal.pdf?signature=opaque', expires_in_seconds: 1, media_type: 'application/pdf' })
        return Promise.resolve({ items: [] })
      }), post: vi.fn(), put: vi.fn(), patch: vi.fn(), del: vi.fn(), upload: vi.fn(), download: vi.fn() } as unknown as HttpTransport
      render(<HttpContext value={http}><AuthContext value={{ state: { status: 'authenticated', user: { id: 'billing-user', email: 'billing@example.mx', firstName: 'Bea', lastName: 'Cobros', role: 'BILLING', mfaRequired: false } }, login: vi.fn(), verifyMfa: vi.fn(), logout: vi.fn(), logoutAll: vi.fn(), refresh: vi.fn(), forgotPassword: vi.fn(), resetPassword: vi.fn() }}><BillingPage /></AuthContext></HttpContext>)
      const user = userEvent.setup()

      await user.click(await screen.findByRole('button', { name: /Ingreso.*10.000000/i }))
      await user.click(await screen.findByRole('button', { name: 'Preparar PDF' }))
      expect(await screen.findByRole('link', { name: 'Abrir PDF' })).toBeInTheDocument()
      expect(await screen.findByText(/URL temporal venció/i, {}, { timeout: 3000 })).toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'Abrir PDF' })).not.toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Preparar PDF' }))
      expect((http.get as ReturnType<typeof vi.fn>).mock.calls.filter(([path]) => path === `/api/v1/billing/documents/${id}/files/pdf`)).toHaveLength(2)
  })
})
