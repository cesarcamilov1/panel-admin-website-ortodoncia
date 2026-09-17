import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../../shared/api/problem'
import type { CatalogService } from '../../../services/domain/service'
import type { PracticeLocation } from '../../domain/location'
import { LocationServicesModal } from './LocationServicesModal'

function service(overrides: Partial<CatalogService> = {}): CatalogService {
  return {
    id: 'svc-1',
    code: 'LIMP-01',
    name: 'Limpieza dental',
    description: '',
    durationMinutes: 45,
    defaultPrice: '850.00',
    currency: 'MXN',
    isActive: true,
    createdAt: '2026-01-10T15:00:00Z',
    updatedAt: '2026-02-11T09:30:00Z',
    version: 1,
    ...overrides,
  }
}

const CATALOG = [
  service(),
  service({ id: 'svc-2', code: 'ORTO-01', name: 'Ortodoncia ajuste' }),
  service({ id: 'svc-3', code: 'END-01', name: 'Endodoncia', isActive: false }),
]

const restricted: PracticeLocation = {
  id: 'loc-1',
  providerUserId: 'prov-1',
  name: 'Sede Polanco',
  address: '',
  isActive: true,
  isDefault: false,
  allServices: false,
  travelBufferMinutes: 0,
}

const unrestricted: PracticeLocation = { ...restricted, allServices: true, isDefault: true }

function setup(props: Partial<Parameters<typeof LocationServicesModal>[0]> = {}) {
  const onClose = vi.fn()
  const onSubmit = vi.fn().mockResolvedValue(undefined)
  const loadCatalog = vi.fn().mockResolvedValue(CATALOG)
  const loadEnabled = vi.fn().mockResolvedValue([service()])

  render(
    <LocationServicesModal
      location={restricted}
      loadCatalog={loadCatalog}
      loadEnabled={loadEnabled}
      onClose={onClose}
      onSubmit={onSubmit}
      {...props}
    />,
  )
  return { onClose, onSubmit, loadCatalog, loadEnabled, user: userEvent.setup() }
}

describe('LocationServicesModal loading', () => {
  it('names the sede it is editing', async () => {
    setup()
    expect(screen.getByRole('dialog', { name: /servicios de la sede/i })).toBeInTheDocument()
    expect(await screen.findByText(/Sede Polanco/)).toBeInTheDocument()
  })

  it('preselects the services already enabled at the sede', async () => {
    setup()
    expect(await screen.findByRole('checkbox', { name: /Limpieza dental/ })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /Ortodoncia ajuste/ })).not.toBeChecked()
  })

  it('shows a retryable error when the lists cannot be read', async () => {
    const loadCatalog = vi
      .fn()
      .mockRejectedValueOnce(new ApiError({ status: 0, code: 'NETWORK' }))
      .mockResolvedValueOnce(CATALOG)
    const { user } = setup({ loadCatalog })

    expect(await screen.findByText(/revisa tu conexión/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('checkbox', { name: /Limpieza dental/ })).toBeInTheDocument()
  })

  it('marks an inactive catalog service so it is not enabled by accident', async () => {
    setup()
    expect(await screen.findByText(/en pausa/i)).toBeInTheDocument()
  })
})

describe('LocationServicesModal one-way warning', () => {
  it('warns that restricting an unrestricted sede cannot be undone', async () => {
    setup({ location: unrestricted, loadEnabled: vi.fn().mockResolvedValue(CATALOG) })
    expect(await screen.findByText(/no tiene vuelta/i)).toBeInTheDocument()
  })

  it('does not repeat that warning for an already restricted sede', async () => {
    setup()
    await screen.findByRole('checkbox', { name: /Limpieza dental/ })
    expect(screen.queryByText(/no tiene vuelta/i)).not.toBeInTheDocument()
  })
})

describe('LocationServicesModal saving', () => {
  it('submits the selected ids', async () => {
    const { onSubmit, user } = setup()

    await user.click(await screen.findByRole('checkbox', { name: /Ortodoncia ajuste/ }))
    await user.click(screen.getByRole('button', { name: 'Guardar servicios' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(['svc-1', 'svc-2']))
  })

  it('drops a service by unchecking it', async () => {
    const { onSubmit, user } = setup()

    await user.click(await screen.findByRole('checkbox', { name: /Limpieza dental/ }))
    await user.click(screen.getByRole('button', { name: 'Dejar la sede sin servicios' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith([]))
  })

  it('renames the action and warns when the selection is empty', async () => {
    const { user } = setup()

    await user.click(await screen.findByRole('checkbox', { name: /Limpieza dental/ }))

    expect(screen.getByRole('button', { name: 'Dejar la sede sin servicios' })).toBeInTheDocument()
    expect(screen.getByText(/no se podrá agendar/i)).toBeInTheDocument()
  })

  it('can select and clear every service at once', async () => {
    const { onSubmit, user } = setup()

    await user.click(await screen.findByRole('button', { name: 'Seleccionar todos' }))
    await user.click(screen.getByRole('button', { name: 'Guardar servicios' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(['svc-1', 'svc-2', 'svc-3']))
  })

  it('shows the server message and stays open when saving fails', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new ApiError({ status: 403, code: 'FORBIDDEN' }))
    const { user } = setup({ onSubmit })

    await user.click(await screen.findByRole('button', { name: 'Guardar servicios' }))

    expect(await screen.findByText(/titular/i)).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: /servicios de la sede/i })).toBeInTheDocument()
  })

  it('closes on Escape', async () => {
    const { onClose, user } = setup()
    await screen.findByRole('checkbox', { name: /Limpieza dental/ })
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
