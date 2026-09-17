import { useCallback, useState } from 'react'
import { Badge } from '../../../shared/ui/atoms/Badge'
import { Button } from '../../../shared/ui/atoms/Button'
import { GridIcon, PlusIcon } from '../../../shared/ui/atoms/icons'
import { DataTable, type Column, Stacked } from '../../../shared/ui/molecules/DataTable'
import { FormAlert } from '../../../shared/ui/molecules/FormAlert'
import { Toolbar } from '../../../shared/ui/molecules/Toolbar'
import { useAuth } from '../../auth/application/authContext'
import { usePanelActions } from '../../panel/application/panelContext'
import { useServicesApi } from '../../services/application/useServicesApi'
import type { ServicesApi } from '../../services/application/servicesApi'
import type { LocationsApi } from '../application/locationsApi'
import { useLocations } from '../application/useLocations'
import { useLocationsApi } from '../application/useLocationsApi'
import {
  type LocationDraft,
  type PracticeLocation,
  formatTravelBuffer,
  serviceCoverageLabel,
} from '../domain/location'
import { LocationFormModal } from './organisms/LocationFormModal'
import { LocationServicesModal } from './organisms/LocationServicesModal'
import styles from './LocationsPage.module.css'

type Dialog =
  | { kind: 'closed' }
  | { kind: 'create' }
  | { kind: 'edit'; location: PracticeLocation }
  | { kind: 'services'; location: PracticeLocation }

/** Route-level container: resolves the provider and the role gate from the session. */
export function LocationsPage() {
  const api = useLocationsApi()
  const servicesApi = useServicesApi()
  const { state } = useAuth()

  if (state.status !== 'authenticated') return null

  return (
    <LocationsScreen
      api={api}
      servicesApi={servicesApi}
      providerUserId={state.user.id}
      canManage={state.user.role === 'OWNER_DENTIST'}
    />
  )
}

interface LocationsScreenProps {
  api: LocationsApi
  servicesApi: ServicesApi
  providerUserId: string
  canManage: boolean
}

export function LocationsScreen({
  api,
  servicesApi,
  providerUserId,
  canManage,
}: LocationsScreenProps) {
  if (!canManage) {
    return (
      <div className={styles.page}>
        <FormAlert tone="info">
          Solo el odontólogo titular puede administrar las sedes. Pídele a quien tenga ese rol que
          haga el cambio.
        </FormAlert>
      </div>
    )
  }

  return <ManagedLocations api={api} servicesApi={servicesApi} providerUserId={providerUserId} />
}

function ManagedLocations({
  api,
  servicesApi,
  providerUserId,
}: Omit<LocationsScreenProps, 'canManage'>) {
  const { notify } = usePanelActions()
  const catalog = useLocations(api, providerUserId)
  const [dialog, setDialog] = useState<Dialog>({ kind: 'closed' })

  const locations = catalog.state.status === 'ready' ? catalog.state.locations : []
  const closeDialog = () => setDialog({ kind: 'closed' })

  const loadCatalog = useCallback(() => servicesApi.list({ includeInactive: true }), [servicesApi])

  const handleCreate = async (draft: LocationDraft) => {
    const created = await catalog.create(draft)
    closeDialog()
    notify(`Sede ${created.name} creada.`)
  }

  const handleEdit = (location: PracticeLocation) => async (draft: LocationDraft) => {
    const updated = await catalog.update({ id: location.id, draft })
    closeDialog()
    notify(`Sede ${updated.name} actualizada.`)
  }

  const handleServices = (location: PracticeLocation) => async (serviceIds: string[]) => {
    await catalog.replaceServices({ locationId: location.id, serviceIds })
    closeDialog()
    notify(`Servicios de ${location.name} actualizados.`)
  }

  const columns: Column<PracticeLocation>[] = [
    {
      key: 'location',
      label: 'Sede',
      grow: 2,
      render: (location) => (
        <span className={styles.nameCell}>
          <Stacked top={location.name} bottom={location.address || 'Sin dirección'} />
          {location.isDefault ? <Badge tone="info">Principal</Badge> : null}
        </span>
      ),
    },
    {
      key: 'coverage',
      label: 'Servicios',
      width: '172px',
      render: (location) => (
        <span className={location.allServices ? styles.muted : styles.coverage}>
          {/* The count would cost one request per row, so the row states the mode only;
              the allowlist editor shows the exact selection. */}
          {serviceCoverageLabel({ allServices: location.allServices })}
        </span>
      ),
    },
    {
      key: 'buffer',
      label: 'Traslado',
      width: '110px',
      render: (location) => (
        <span className={styles.muted}>{formatTravelBuffer(location.travelBufferMinutes)}</span>
      ),
    },
    {
      key: 'actions',
      label: '',
      width: '120px',
      align: 'right',
      render: (location) => (
        <button
          type="button"
          className={styles.action}
          aria-label={`Servicios de ${location.name}`}
          onClick={(event) => {
            event.stopPropagation()
            setDialog({ kind: 'services', location })
          }}
        >
          <GridIcon size={14} />
          Servicios
        </button>
      ),
    },
  ]

  return (
    <div className={styles.page}>
      <Toolbar>
        <Button onClick={() => setDialog({ kind: 'create' })}>
          <PlusIcon />
          Nueva sede
        </Button>
      </Toolbar>

      {catalog.state.status === 'loading' ? (
        <p className={styles.state} role="status">
          Cargando las sedes…
        </p>
      ) : null}

      {catalog.state.status === 'error' ? (
        <div className={styles.errorState}>
          <FormAlert tone="error">{catalog.state.message}</FormAlert>
          <Button variant="secondary" onClick={() => void catalog.reload()}>
            Reintentar
          </Button>
        </div>
      ) : null}

      {catalog.state.status === 'ready' ? (
        locations.length === 0 ? (
          <p className={styles.state}>
            Todavía no hay sedes registradas. Crea la primera para poder agendar en ella.
          </p>
        ) : (
          <DataTable
            columns={columns}
            rows={locations}
            rowKey={(location) => location.id}
            onRowClick={(location) => setDialog({ kind: 'edit', location })}
            footer={`${locations.length} ${locations.length === 1 ? 'sede' : 'sedes'}`}
          />
        )
      ) : null}

      {dialog.kind === 'create' ? (
        <LocationFormModal onClose={closeDialog} onSubmit={handleCreate} />
      ) : null}

      {dialog.kind === 'edit' ? (
        <LocationFormModal
          location={dialog.location}
          onClose={closeDialog}
          onSubmit={handleEdit(dialog.location)}
        />
      ) : null}

      {dialog.kind === 'services' ? (
        <LocationServicesModal
          location={dialog.location}
          loadCatalog={loadCatalog}
          loadEnabled={() => catalog.listServices(dialog.location.id)}
          onClose={closeDialog}
          onSubmit={handleServices(dialog.location)}
        />
      ) : null}
    </div>
  )
}
