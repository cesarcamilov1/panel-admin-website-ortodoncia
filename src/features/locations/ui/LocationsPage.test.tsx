import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../shared/api/problem'
import { PanelActionsContext, type PanelActions } from '../../panel/application/panelContext'
import type { ServicesApi } from '../../services/application/servicesApi'
import type { CatalogService } from '../../services/domain/service'
import type { LocationsApi } from '../application/locationsApi'
import type { PracticeLocation } from '../domain/location'
import { LocationsScreen } from './LocationsPage'

const PROVIDER = 'prov-1'

function location(overrides: Partial<PracticeLocation> = {}): PracticeLocation {
  return {
    id: 'loc-1',
    providerUserId: PROVIDER,
    name: 'Sede Polanco',
    address: 'Av. Masaryk 111',
    isActive: true,
    isDefault: true,
    allServices: true,
    travelBufferMinutes: 30,
    ...overrides,
  }
}

const RESTRICTED = location({
  id: 'loc-2',
  name: 'Sede Roma',
  address: 'Orizaba 20',
  isDefault: false,
  allServices: false,
  travelBufferMinutes: 0,
})

function service(): CatalogService {
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
  }
}

function fakeApi(overrides: Partial<LocationsApi> = {}): LocationsApi {
  return {
    list: vi.fn().mockResolvedValue([location(), RESTRICTED]),
    create: vi.fn(),
    update: vi.fn(),
    listServices: vi.fn().mockResolvedValue([]),
    replaceServices: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

function fakeServicesApi(overrides: Partial<ServicesApi> = {}): ServicesApi {
  return {
    list: vi.fn().mockResolvedValue([service()]),
    create: vi.fn(),
    update: vi.fn(),
    putFiscalConfig: vi.fn(),
    ...overrides,
  }
}

function setup({
  api = fakeApi(),
  servicesApi = fakeServicesApi(),
  canManage = true,
  providerUserId = PROVIDER,
} = {}) {
  const notify = vi.fn()
  const actions: PanelActions = { openNewAppointment: vi.fn(), notify }
  render(
    <PanelActionsContext value={actions}>
      <LocationsScreen
        api={api}
        servicesApi={servicesApi}
        providerUserId={providerUserId}
        canManage={canManage}
      />
    </PanelActionsContext>,
  )
  return { api, servicesApi, notify, user: userEvent.setup() }
}

describe('LocationsScreen role gate', () => {
  it('explains the limitation instead of showing an empty table to a non-owner', () => {
    const api = fakeApi()
    setup({ api, canManage: false })

    expect(screen.getByText(/solo el odontólogo titular/i)).toBeInTheDocument()
    expect(api.list).not.toHaveBeenCalled()
  })

  it('does not offer the create action to a non-owner', () => {
    setup({ canManage: false })
    expect(screen.queryByRole('button', { name: /nueva sede/i })).not.toBeInTheDocument()
  })
})

describe('LocationsScreen loading and failure', () => {
  it('announces that the sedes are loading', () => {
    setup({ api: fakeApi({ list: vi.fn(() => new Promise<PracticeLocation[]>(() => {})) }) })
    expect(screen.getByRole('status')).toHaveTextContent(/cargando/i)
  })

  it('offers a retry when the sedes cannot be loaded', async () => {
    const list = vi
      .fn()
      .mockRejectedValueOnce(new ApiError({ status: 0, code: 'NETWORK' }))
      .mockResolvedValueOnce([location()])
    const { user } = setup({ api: fakeApi({ list }) })

    expect(await screen.findByText(/revisa tu conexión/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Sede Polanco')).toBeInTheDocument()
  })

  it('shows an empty state when the provider has no sedes', async () => {
    setup({ api: fakeApi({ list: vi.fn().mockResolvedValue([]) }) })
    expect(await screen.findByText(/todavía no hay sedes/i)).toBeInTheDocument()
  })
})

describe('LocationsScreen table', () => {
  it('renders each sede with its coverage and travel buffer', async () => {
    setup()

    expect(await screen.findByText('Sede Polanco')).toBeInTheDocument()
    expect(screen.getByText('Av. Masaryk 111')).toBeInTheDocument()
    expect(screen.getByText('Todos los servicios')).toBeInTheDocument()
    expect(screen.getByText('30 min')).toBeInTheDocument()
    expect(screen.getByText('Sede Roma')).toBeInTheDocument()
    expect(screen.getByText('Sin traslado')).toBeInTheDocument()
    expect(screen.getByText('Lista restringida')).toBeInTheDocument()
    expect(screen.queryByText(/-1/)).not.toBeInTheDocument()
  })

  it('marks the default sede', async () => {
    setup()
    expect(await screen.findByText('Principal')).toBeInTheDocument()
  })

  it('counts the sedes in the footer', async () => {
    setup()
    expect(await screen.findByText('2 sedes')).toBeInTheDocument()
  })
})

describe('LocationsScreen creating and editing', () => {
  it('creates a sede and reports it', async () => {
    const created = location({ id: 'loc-3', name: 'Sede Condesa', isDefault: false })
    const api = fakeApi({ create: vi.fn().mockResolvedValue(created) })
    const { notify, user } = setup({ api })
    await screen.findByText('Sede Polanco')

    await user.click(screen.getByRole('button', { name: /nueva sede/i }))
    await user.type(screen.getByLabelText('Nombre de la sede'), 'Sede Condesa')
    await user.click(screen.getByRole('button', { name: 'Crear sede' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(api.create).toHaveBeenCalledWith({
      providerUserId: PROVIDER,
      draft: { name: 'Sede Condesa', address: '', travelBufferMinutes: 0 },
    })
    expect(notify).toHaveBeenCalledWith('Sede Sede Condesa creada.')
  })

  it('opens the edit form from the row', async () => {
    const api = fakeApi({ update: vi.fn().mockResolvedValue(location({ name: 'Sede Polanco Sur' })) })
    const { notify, user } = setup({ api })
    await screen.findByText('Sede Polanco')

    await user.click(screen.getByText('Sede Polanco'))
    expect(await screen.findByRole('dialog', { name: 'Editar sede' })).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Nombre de la sede'))
    await user.type(screen.getByLabelText('Nombre de la sede'), 'Sede Polanco Sur')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() =>
      expect(api.update).toHaveBeenCalledWith({
        id: 'loc-1',
        providerUserId: PROVIDER,
        draft: expect.objectContaining({ name: 'Sede Polanco Sur' }),
      }),
    )
    expect(notify).toHaveBeenCalledWith('Sede Sede Polanco Sur actualizada.')
  })
})

describe('LocationsScreen service allowlist', () => {
  it('edits the allowlist from the row without opening the edit form', async () => {
    const api = fakeApi()
    const { servicesApi, notify, user } = setup({ api })
    await screen.findByText('Sede Roma')

    const row = screen.getByText('Sede Roma').closest('[role="row"]') as HTMLElement
    await user.click(within(row).getByRole('button', { name: 'Servicios de Sede Roma' }))

    const dialog = await screen.findByRole('dialog', { name: /servicios de la sede/i })
    expect(screen.queryByRole('dialog', { name: 'Editar sede' })).not.toBeInTheDocument()
    expect(servicesApi.list).toHaveBeenCalledWith({ includeInactive: true })
    expect(api.listServices).toHaveBeenCalledWith({
      locationId: 'loc-2',
      providerUserId: PROVIDER,
    })

    await user.click(await within(dialog).findByRole('checkbox', { name: /Limpieza dental/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Guardar servicios' }))

    await waitFor(() =>
      expect(api.replaceServices).toHaveBeenCalledWith({
        locationId: 'loc-2',
        providerUserId: PROVIDER,
        serviceIds: ['svc-1'],
      }),
    )
    expect(notify).toHaveBeenCalledWith('Servicios de Sede Roma actualizados.')
  })
})
