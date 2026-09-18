import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../shared/api/problem'
import type { LocationsApi } from '../../locations/application/locationsApi'
import type { PracticeLocation } from '../../locations/domain/location'
import { PanelActionsContext, type PanelActions } from '../../panel/application/panelContext'
import type { SchedulesApi } from '../application/schedulesApi'
import type { ScheduleBlock } from '../domain/scheduleBlock'
import type { WorkSchedule } from '../domain/workSchedule'
import { SchedulesScreen } from './SchedulesPage'

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

function schedule(overrides: Partial<WorkSchedule> = {}): WorkSchedule {
  return {
    id: 'ws-1',
    locationId: '',
    providerUserId: PROVIDER,
    weekday: 1,
    startLocalTime: '09:00',
    endLocalTime: '14:00',
    timezone: 'America/Mexico_City',
    effectiveFrom: '2026-01-01',
    effectiveTo: '',
    intervalWeeks: 1,
    isActive: true,
    ...overrides,
  }
}

function block(overrides: Partial<ScheduleBlock> = {}): ScheduleBlock {
  return {
    id: 'blk-1',
    locationId: '',
    providerUserId: PROVIDER,
    startsAt: '2026-09-20T20:00:00Z',
    endsAt: '2026-09-20T21:00:00Z',
    blockType: 'MEAL',
    reason: '',
    createdBy: PROVIDER,
    ...overrides,
  }
}

function fakeApi(overrides: Partial<SchedulesApi> = {}): SchedulesApi {
  return {
    listSchedules: vi.fn().mockResolvedValue([schedule()]),
    createSchedule: vi.fn(),
    deleteSchedule: vi.fn().mockResolvedValue(undefined),
    listBlocks: vi.fn().mockResolvedValue([block()]),
    createBlock: vi.fn(),
    deleteBlock: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

function fakeLocationsApi(overrides: Partial<LocationsApi> = {}): LocationsApi {
  return {
    list: vi.fn().mockResolvedValue([location(), location({ id: 'loc-2', name: 'Sede Roma' })]),
    create: vi.fn(),
    update: vi.fn(),
    listServices: vi.fn().mockResolvedValue([]),
    replaceServices: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

function setup({
  api = fakeApi(),
  locationsApi = fakeLocationsApi(),
  providerUserId = PROVIDER,
  providerName = 'Dra. Mariana Cázares',
  roleLabel = 'Odontólogo titular',
  canManageSchedules = true,
  canManageBlocks = true,
} = {}) {
  const notify = vi.fn()
  const actions: PanelActions = { openNewAppointment: vi.fn(), notify }
  render(
    <PanelActionsContext value={actions}>
      <SchedulesScreen
        api={api}
        locationsApi={locationsApi}
        providerUserId={providerUserId}
        providerName={providerName}
        roleLabel={roleLabel}
        canManageSchedules={canManageSchedules}
        canManageBlocks={canManageBlocks}
      />
    </PanelActionsContext>,
  )
  return { api, locationsApi, notify, user: userEvent.setup() }
}

describe('SchedulesScreen loading', () => {
  it('announces that the schedule is loading', () => {
    setup({ api: fakeApi({ listSchedules: vi.fn(() => new Promise<WorkSchedule[]>(() => {})) }) })
    expect(screen.getAllByRole('status').length).toBeGreaterThan(0)
  })
})

describe('SchedulesScreen work schedule week', () => {
  it('renders a range under its weekday, Monday first', async () => {
    setup()
    expect(await screen.findByText('09:00 – 14:00')).toBeInTheDocument()
    expect(screen.getByText('Lunes')).toBeInTheDocument()
  })

  it('shows a day without ranges as closed', async () => {
    setup()
    await screen.findByText('09:00 – 14:00')
    expect(screen.getByText('Domingo')).toBeInTheDocument()
    expect(screen.getAllByText('Sin atención').length).toBeGreaterThan(0)
  })
})

describe('SchedulesScreen blocks', () => {
  it('renders the block list', async () => {
    setup()
    expect(await screen.findByText('Comida')).toBeInTheDocument()
  })

  it('shows the 90-day horizon when there are no blocks', async () => {
    setup({ api: fakeApi({ listBlocks: vi.fn().mockResolvedValue([]) }) })
    expect(await screen.findByText(/90 días/i)).toBeInTheDocument()
  })
})

describe('SchedulesScreen removal', () => {
  it('removes a range and notifies on success', async () => {
    const api = fakeApi()
    const { notify, user } = setup({ api })
    await screen.findByText('09:00 – 14:00')

    await user.click(screen.getByRole('button', { name: /quitar franja de lunes 09:00 – 14:00/i }))

    await waitFor(() =>
      expect(api.deleteSchedule).toHaveBeenCalledWith({ id: 'ws-1', providerUserId: PROVIDER }),
    )
    expect(notify).toHaveBeenCalled()
  })

  it('removes a block and notifies on success', async () => {
    const api = fakeApi()
    const { notify, user } = setup({ api })
    await screen.findByText('Comida')

    await user.click(screen.getByRole('button', { name: /quitar bloqueo/i }))

    await waitFor(() =>
      expect(api.deleteBlock).toHaveBeenCalledWith({ id: 'blk-1', providerUserId: PROVIDER }),
    )
    expect(notify).toHaveBeenCalled()
  })
})

describe('SchedulesScreen location filter', () => {
  it('re-queries both hooks with the chosen sede', async () => {
    const api = fakeApi()
    const { user } = setup({ api })
    await screen.findByText('09:00 – 14:00')

    await user.selectOptions(screen.getByLabelText('Sede'), 'Sede Roma')

    await waitFor(() =>
      expect(api.listSchedules).toHaveBeenCalledWith({ providerUserId: PROVIDER, locationId: 'loc-2' }),
    )
    expect(api.listBlocks).toHaveBeenCalledWith(
      expect.objectContaining({ providerUserId: PROVIDER, locationId: 'loc-2' }),
    )
  })
})

describe('SchedulesScreen error state', () => {
  it('offers a retry when the schedule cannot be loaded', async () => {
    const listSchedules = vi
      .fn()
      .mockRejectedValueOnce(new ApiError({ status: 0, code: 'NETWORK' }))
      .mockResolvedValueOnce([schedule()])
    const { user } = setup({ api: fakeApi({ listSchedules }) })

    expect(await screen.findByText(/revisa tu conexión/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('09:00 – 14:00')).toBeInTheDocument()
  })
})

describe('SchedulesScreen role gate', () => {
  it('hides schedule write controls and explains the limitation for a non-owner', async () => {
    setup({ canManageSchedules: false })
    await screen.findByText('Lunes')

    expect(screen.queryByRole('button', { name: 'Franja' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /quitar franja/i })).not.toBeInTheDocument()
    expect(screen.getByText(/solo el odontólogo titular puede crear o quitar franjas/i)).toBeInTheDocument()
  })

  it('hides block write controls and explains the limitation when the role cannot manage them', async () => {
    setup({ canManageBlocks: false })
    await screen.findByText('Comida')

    expect(screen.queryByRole('button', { name: 'Nuevo bloqueo' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /quitar bloqueo/i })).not.toBeInTheDocument()
    expect(screen.getByText(/pueden crear o quitar bloqueos/i)).toBeInTheDocument()
  })
})
