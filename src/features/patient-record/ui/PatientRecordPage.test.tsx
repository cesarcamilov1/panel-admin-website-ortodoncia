import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthContext } from '../../auth/application/authContext'
import { HttpContext } from '../../../shared/api/httpContext'
import type { HttpTransport } from '../../../shared/api/http'
import { PatientRecordPage } from './PatientRecordPage'

const dto = {
  booking_blocked: false, id: '11111111-1111-1111-1111-111111111111', record_number: 42,
  first_name: 'Lucía', middle_name: null, last_name: 'Mendoza', second_last_name: null, preferred_name: null,
  birth_date: '1992-03-12', sex_at_birth: 'FEMALE', phone_e164: '+525518742093', email: 'lucia@example.mx',
  occupation: null, status: 'ACTIVE', notes: null, archived_at: null, version: 3,
  created_at: '2026-01-10T15:00:00Z', updated_at: '2026-02-11T09:30:00Z',
}

function setup(role: 'OWNER_DENTIST' | 'BILLING' | 'ASSISTANT' = 'OWNER_DENTIST') {
  const http = { get: vi.fn().mockImplementation((path: string) => Promise.resolve(path.startsWith('/api/v1/patients/') && !path.includes('/addresses') && !path.includes('/emergency-contacts') ? dto : { items: [] })), post: vi.fn(), put: vi.fn(), patch: vi.fn(), del: vi.fn(), upload: vi.fn(), download: vi.fn() } as unknown as HttpTransport
  render(<HttpContext value={http}><AuthContext value={{ state: { status: 'authenticated', user: { id: 'user-1', email: 'owner@example.mx', firstName: 'Ana', lastName: 'Dentista', role, mfaRequired: false } }, login: vi.fn(), verifyMfa: vi.fn(), logout: vi.fn(), logoutAll: vi.fn(), refresh: vi.fn(), forgotPassword: vi.fn(), resetPassword: vi.fn() }}><MemoryRouter initialEntries={['/pacientes/11111111-1111-1111-1111-111111111111']}><Routes><Route path="/pacientes/:patientId" element={<PatientRecordPage />} /></Routes></MemoryRouter></AuthContext></HttpContext>)
  return http
}

describe('PatientRecordPage', () => {
  it('uses the fetched patient header and marks unwired mock tabs unavailable', async () => {
    setup()
    expect(await screen.findByRole('heading', { name: 'Lucía Mendoza' })).toBeInTheDocument()
    expect(screen.queryByText('Lucía Mendoza Rivas')).not.toBeInTheDocument()
    expect(screen.queryByText('$3,400.00')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Agendar cita' })).toBeEnabled()
    expect(screen.getByText(/Las citas y pagos se consultan en sus secciones conectadas/i)).toBeInTheDocument()
    expect(screen.queryByText(/No hay citas ni saldos mostrados hasta conectar sus módulos/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /agendar próximamente/i })).not.toBeInTheDocument()
    const user = userEvent.setup()
    await user.click(screen.getByRole('tab', { name: 'Notas clínicas' }))
    expect(await screen.findByText(/no hay atenciones disponibles para registrar notas/i)).toBeInTheDocument()
  })

  it('loads clinical resources only when a permitted user opens a clinical tab', async () => {
    const http = setup()
    await screen.findByRole('heading', { name: 'Lucía Mendoza' })
    expect(http.get).toHaveBeenCalledTimes(1)
    const user = userEvent.setup()
    await user.click(screen.getByRole('tab', { name: 'Resumen clínico' }))
    expect(await screen.findByRole('heading', { name: 'Antecedentes clínicos' })).toBeInTheDocument()
    expect(http.get).toHaveBeenCalledWith('/api/v1/patients/11111111-1111-1111-1111-111111111111/addresses', expect.anything())
  })

  it('does not request protected clinical resources for billing users', async () => {
    const http = setup('BILLING')
    await screen.findByRole('heading', { name: 'Lucía Mendoza' })
    expect(screen.queryByRole('tab', { name: 'Resumen clínico' })).not.toBeInTheDocument()
    expect(http.get).toHaveBeenCalledTimes(1)
  })

  it('does not expose payment requests to assistant users because the service denies that role', async () => {
    const http = setup('ASSISTANT')
    await screen.findByRole('heading', { name: 'Lucía Mendoza' })

    expect(screen.queryByRole('tab', { name: 'Pagos' })).not.toBeInTheDocument()
    expect(http.get).toHaveBeenCalledTimes(1)
  })

  it('lazily loads the selected patient treatment plans without fixture rows', async () => {
    const http = setup()
    await screen.findByRole('heading', { name: 'Lucía Mendoza' })
    const user = userEvent.setup()

    await user.click(screen.getByRole('tab', { name: 'Planes' }))

    expect(await screen.findByText('No hay planes de tratamiento registrados.')).toBeInTheDocument()
    expect(http.get).toHaveBeenCalledWith(
      '/api/v1/treatment-plans?patient_id=11111111-1111-1111-1111-111111111111&limit=25',
      expect.anything(),
    )
    expect(screen.queryByText('Rehabilitación superior')).not.toBeInTheDocument()
  })

  it('loads real payments only after an authorized user opens Pagos', async () => {
    const http = setup()
    await screen.findByRole('heading', { name: 'Lucía Mendoza' })
    const user = userEvent.setup()

    await user.click(screen.getByRole('tab', { name: 'Pagos' }))

    expect(await screen.findByRole('heading', { name: 'Pagos de Lucía Mendoza' })).toBeInTheDocument()
    expect(http.get).toHaveBeenCalledWith(
      '/api/v1/payments?patient_id=11111111-1111-1111-1111-111111111111&limit=25',
      expect.anything(),
    )
    expect(screen.queryByText(/todavía no está conectado/i)).not.toBeInTheDocument()
  })

  it('lazily loads files for clinical roles and fiscal data for fiscal roles only', async () => {
    const owner = setup()
    await screen.findByRole('heading', { name: 'Lucía Mendoza' })
    const user = userEvent.setup()
    await user.click(screen.getByRole('tab', { name: 'Archivos' }))
    expect(await screen.findByRole('heading', { name: 'Archivos del paciente' })).toBeInTheDocument()
    expect(owner.get).toHaveBeenCalledWith('/api/v1/files?patient_id=11111111-1111-1111-1111-111111111111&limit=25', expect.anything())

    const billing = setup('BILLING')
    await screen.findAllByRole('heading', { name: 'Lucía Mendoza' })
    expect(screen.queryAllByRole('tab', { name: 'Archivos' })).toHaveLength(1)
    expect(screen.getAllByRole('tab', { name: 'Datos fiscales' })).toHaveLength(2)
    expect(billing.get).toHaveBeenCalledTimes(1)
  })
})
