import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../shared/api/problem'
import { PanelActionsContext, type PanelActions } from '../../panel/application/panelContext'
import type { ServicesApi } from '../application/servicesApi'
import type { CatalogService } from '../domain/service'
import { ServicesScreen } from './ServicesPage'

function service(overrides: Partial<CatalogService> = {}): CatalogService {
  return {
    id: 'svc-1',
    code: 'LIMP-01',
    name: 'Limpieza dental',
    description: 'Profilaxis y pulido',
    durationMinutes: 45,
    defaultPrice: '850.00',
    currency: 'MXN',
    isActive: true,
    createdAt: '2026-01-10T15:00:00Z',
    updatedAt: '2026-02-11T09:30:00Z',
    version: 3,
    ...overrides,
  }
}

const PAUSED = service({
  id: 'svc-2',
  code: 'ORTO-09',
  name: 'Ortodoncia retiro',
  description: '',
  durationMinutes: 60,
  defaultPrice: '1500.00',
  isActive: false,
  version: 1,
})

function fakeApi(overrides: Partial<ServicesApi> = {}): ServicesApi {
  return {
    list: vi.fn().mockResolvedValue([service(), PAUSED]),
    create: vi.fn(),
    update: vi.fn(),
    putFiscalConfig: vi.fn().mockResolvedValue({}),
    ...overrides,
  }
}

function setup(api: ServicesApi = fakeApi()) {
  const notify = vi.fn()
  const actions: PanelActions = { openNewAppointment: vi.fn(), notify }
  render(
    <PanelActionsContext value={actions}>
      <ServicesScreen api={api} />
    </PanelActionsContext>,
  )
  return { api, notify, user: userEvent.setup() }
}

describe('ServicesScreen loading and failure', () => {
  it('announces that the catalog is loading', () => {
    setup(fakeApi({ list: vi.fn(() => new Promise<CatalogService[]>(() => {})) }))
    expect(screen.getByRole('status')).toHaveTextContent(/cargando/i)
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('offers a retry when the catalog cannot be loaded', async () => {
    const list = vi
      .fn()
      .mockRejectedValueOnce(new ApiError({ status: 0, code: 'NETWORK' }))
      .mockResolvedValueOnce([service()])
    const { user } = setup(fakeApi({ list }))

    expect(await screen.findByText(/revisa tu conexión/i)).toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Limpieza dental')).toBeInTheDocument()
  })

  it('shows an empty state when there is no catalog yet', async () => {
    setup(fakeApi({ list: vi.fn().mockResolvedValue([]) }))
    expect(await screen.findByText(/todavía no hay servicios/i)).toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })
})

describe('ServicesScreen table', () => {
  it('renders the service with its formatted price, duration and state', async () => {
    setup()

    expect(await screen.findByText('Limpieza dental')).toBeInTheDocument()
    expect(screen.getByText('Profilaxis y pulido')).toBeInTheDocument()
    expect(screen.getByText('LIMP-01')).toBeInTheDocument()
    expect(screen.getByText('45 min')).toBeInTheDocument()
    expect(screen.getByText('$850.00')).toBeInTheDocument()
    expect(screen.getByText('1 h')).toBeInTheDocument()
    expect(screen.getByText('$1,500.00')).toBeInTheDocument()
  })

  it('counts the catalog truthfully in the footer', async () => {
    setup()
    expect(await screen.findByText('2 servicios · 1 en pausa')).toBeInTheDocument()
  })

  it('filters to active and paused services without refetching', async () => {
    const { api, user } = setup()
    await screen.findByText('Limpieza dental')

    await user.click(screen.getByRole('button', { name: 'Activos' }))
    expect(screen.queryByText('Ortodoncia retiro')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Pausados' }))
    expect(screen.queryByText('Limpieza dental')).not.toBeInTheDocument()
    expect(screen.getByText('Ortodoncia retiro')).toBeInTheDocument()

    expect(api.list).toHaveBeenCalledTimes(1)
  })
})

describe('ServicesScreen creating', () => {
  it('creates a service and reports it', async () => {
    const created = service({ id: 'svc-3', code: 'ZZZ-01', name: 'Resina' })
    const api = fakeApi({ create: vi.fn().mockResolvedValue(created) })
    const { notify, user } = setup(api)
    await screen.findByText('Limpieza dental')

    await user.click(screen.getByRole('button', { name: /nuevo servicio/i }))
    await user.type(screen.getByLabelText('Código'), 'ZZZ-01')
    await user.type(screen.getByLabelText('Nombre'), 'Resina')
    await user.type(screen.getByLabelText('Precio (MXN)'), '900')
    await user.click(screen.getByRole('button', { name: 'Crear servicio' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByText('Resina')).toBeInTheDocument()
    expect(notify).toHaveBeenCalledWith('Servicio Resina creado.')
  })
})

describe('ServicesScreen editing', () => {
  it('opens the edit form from the row and saves with the current version', async () => {
    const update = vi.fn().mockResolvedValue(service({ name: 'Limpieza profunda', version: 4 }))
    const { notify, user } = setup(fakeApi({ update }))
    await screen.findByText('Limpieza dental')

    await user.click(screen.getByText('Limpieza dental'))
    expect(await screen.findByRole('dialog', { name: 'Editar servicio' })).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Nombre'))
    await user.type(screen.getByLabelText('Nombre'), 'Limpieza profunda')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith({
        id: 'svc-1',
        version: 3,
        draft: expect.objectContaining({ name: 'Limpieza profunda' }),
      }),
    )
    expect(notify).toHaveBeenCalledWith('Servicio Limpieza profunda actualizado.')
  })

  it('pauses a service from its row action without opening the edit form', async () => {
    const update = vi.fn().mockResolvedValue(service({ isActive: false, version: 4 }))
    const { notify, user } = setup(fakeApi({ update }))
    await screen.findByText('Limpieza dental')

    const row = screen.getByText('Limpieza dental').closest('[role="row"]') as HTMLElement
    await user.click(within(row).getByRole('button', { name: 'Pausar Limpieza dental' }))

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith({
        id: 'svc-1',
        version: 3,
        draft: expect.objectContaining({ isActive: false }),
      }),
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(notify).toHaveBeenCalledWith('Limpieza dental quedó en pausa.')
  })

  it('reactivates a paused service', async () => {
    const update = vi.fn().mockResolvedValue({ ...PAUSED, isActive: true, version: 2 })
    const { notify, user } = setup(fakeApi({ update }))
    await screen.findByText('Ortodoncia retiro')

    const row = screen.getByText('Ortodoncia retiro').closest('[role="row"]') as HTMLElement
    await user.click(within(row).getByRole('button', { name: 'Activar Ortodoncia retiro' }))

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith({
        id: 'svc-2',
        version: 1,
        draft: expect.objectContaining({ isActive: true }),
      }),
    )
    expect(notify).toHaveBeenCalledWith('Ortodoncia retiro quedó activo.')
  })

  it('reports a stale version on the page when a row toggle conflicts', async () => {
    const update = vi.fn().mockRejectedValue(new ApiError({ status: 412, code: 'PRECONDITION_FAILED' }))
    const { user } = setup(fakeApi({ update }))
    await screen.findByText('Limpieza dental')

    const row = screen.getByText('Limpieza dental').closest('[role="row"]') as HTMLElement
    await user.click(within(row).getByRole('button', { name: 'Pausar Limpieza dental' }))

    expect(await screen.findByText(/recarga la lista/i)).toBeInTheDocument()
  })
})

describe('ServicesScreen fiscal configuration', () => {
  it('saves the fiscal configuration from the row action', async () => {
    const putFiscalConfig = vi.fn().mockResolvedValue({})
    const { notify, user } = setup(fakeApi({ putFiscalConfig }))
    await screen.findByText('Limpieza dental')

    const row = screen.getByText('Limpieza dental').closest('[role="row"]') as HTMLElement
    await user.click(within(row).getByRole('button', { name: 'Datos fiscales de Limpieza dental' }))

    const dialog = await screen.findByRole('dialog', { name: /datos fiscales/i })
    await user.type(within(dialog).getByLabelText('Clave de producto o servicio SAT'), '86121600')
    await user.type(within(dialog).getByLabelText('Clave de unidad SAT'), 'E48')
    await user.type(within(dialog).getByLabelText('Clave de objeto de impuesto SAT'), '02')
    await user.type(within(dialog).getByLabelText('Vigente desde'), '2026-01-01')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar datos fiscales' }))

    await waitFor(() =>
      expect(putFiscalConfig).toHaveBeenCalledWith({
        serviceId: 'svc-1',
        draft: expect.objectContaining({ satProductServiceCode: '86121600' }),
      }),
    )
    expect(notify).toHaveBeenCalledWith('Datos fiscales de Limpieza dental guardados.')
  })
})

describe('ServicesScreen search and pagination', () => {
  const catalog = Array.from({ length: 21 }, (_, index) => service({
    id: `svc-${index + 1}`,
    code: `S-${String(index + 1).padStart(2, '0')}`,
    name: `Servicio ${index + 1}`,
    description: index === 20 ? 'Evaluación clínica' : '',
    isActive: index < 11,
  }))

  it('shows ten rows per page and disables navigation at both boundaries', async () => {
    const { user } = setup(fakeApi({ list: vi.fn().mockResolvedValue(catalog) }))
    await screen.findByText('Servicio 1')
    expect(screen.getAllByRole('row')).toHaveLength(11)
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()
    expect(screen.getByText('1–10 de 21 resultados')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(screen.getByText('Servicio 11')).toBeInTheDocument()
    expect(screen.queryByText('Servicio 1')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(screen.getAllByRole('row')).toHaveLength(2)
    expect(screen.getByText('21–21 de 21 resultados')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Anterior' }))
    expect(screen.getByText('Página 2 de 3')).toBeInTheDocument()
  })

  it('searches beyond the page, normalizes accents/case and combines status', async () => {
    const { api, user } = setup(fakeApi({ list: vi.fn().mockResolvedValue(catalog) }))
    await screen.findByText('Servicio 1')
    const search = screen.getByRole('searchbox', { name: 'Buscar servicios' })
    await user.type(search, '  EVALUACION  ')
    expect(screen.getByText('Servicio 21')).toBeInTheDocument()
    expect(screen.getByText('21 servicios · 10 en pausa')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Activos' }))
    expect(screen.getByText('No hay servicios que coincidan con la búsqueda y los filtros.')).toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Pausados' }))
    expect(screen.getByText('Servicio 21')).toBeInTheDocument()
    await user.clear(search)
    await user.type(search, 's-20')
    expect(screen.getByText('Servicio 20')).toBeInTheDocument()
    expect(screen.queryByText('Servicio 21')).not.toBeInTheDocument()
    expect(api.list).toHaveBeenCalledTimes(1)
  })

  it('resets the page when either the query or status changes', async () => {
    const { user } = setup(fakeApi({ list: vi.fn().mockResolvedValue(catalog) }))
    await screen.findByText('Servicio 1')
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    const search = screen.getByRole('searchbox', { name: 'Buscar servicios' })
    await user.type(search, 'Servicio')
    expect(screen.getByText('Página 1 de 3')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    await user.clear(search)
    expect(screen.getByText('Página 1 de 3')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    await user.click(screen.getByRole('button', { name: 'Activos' }))
    expect(screen.getByText('Página 1 de 2')).toBeInTheDocument()
  })

  it('clamps the page when pausing the last result removes the final page', async () => {
    const update = vi.fn().mockResolvedValue({ ...catalog[10], isActive: false, version: 4 })
    const { user } = setup(fakeApi({ list: vi.fn().mockResolvedValue(catalog), update }))
    await screen.findByText('Servicio 1')
    await user.click(screen.getByRole('button', { name: 'Activos' }))
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    await user.click(screen.getByRole('button', { name: 'Pausar Servicio 11' }))
    expect(await screen.findByText('Página 1 de 1')).toBeInTheDocument()
    expect(screen.getByText('1–10 de 10 resultados')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled()
    expect(screen.getByText('21 servicios · 11 en pausa')).toBeInTheDocument()
  })

  it('shows an honest empty status filter and no pagination', async () => {
    const { user } = setup(fakeApi({ list: vi.fn().mockResolvedValue([service()]) }))
    await screen.findByText('Limpieza dental')
    await user.click(screen.getByRole('button', { name: 'Pausados' }))
    expect(screen.getByText('No hay servicios que coincidan con la búsqueda y los filtros.')).toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })
})
