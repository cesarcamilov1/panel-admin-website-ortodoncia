import { useMemo, useState } from 'react'
import { Badge } from '../../../shared/ui/atoms/Badge'
import { Button } from '../../../shared/ui/atoms/Button'
import { PlusIcon, ReceiptIcon } from '../../../shared/ui/atoms/icons'
import { DataTable, type Column, Stacked } from '../../../shared/ui/molecules/DataTable'
import { FormAlert } from '../../../shared/ui/molecules/FormAlert'
import { Toolbar } from '../../../shared/ui/molecules/Toolbar'
import { usePanelActions } from '../../panel/application/panelContext'
import { type ServicesApi } from '../application/servicesApi'
import { useServiceCatalog } from '../application/useServiceCatalog'
import { useServicesApi } from '../application/useServicesApi'
import {
  type CatalogService,
  type FiscalConfigDraft,
  type ServiceDraft,
  formatDuration,
  formatPrice,
  serviceErrorMessage,
} from '../domain/service'
import { FiscalConfigModal } from './organisms/FiscalConfigModal'
import { ServiceFormModal } from './organisms/ServiceFormModal'
import styles from './ServicesPage.module.css'

const FILTERS = ['Todos', 'Activos', 'Pausados'] as const
type Filter = (typeof FILTERS)[number]

type Dialog =
  | { kind: 'closed' }
  | { kind: 'create' }
  | { kind: 'edit'; service: CatalogService }
  | { kind: 'fiscal'; service: CatalogService }

/** Stable identity: a fresh [] literal would defeat the memo below on every render. */
const NO_SERVICES: CatalogService[] = []

function matchesFilter(service: CatalogService, filter: Filter): boolean {
  if (filter === 'Activos') return service.isActive
  if (filter === 'Pausados') return !service.isActive
  return true
}

/** Route-level container: wires the app-wide http client into the screen. */
export function ServicesPage() {
  const api = useServicesApi()
  return <ServicesScreen api={api} />
}

export function ServicesScreen({ api }: { api: ServicesApi }) {
  const { notify } = usePanelActions()
  const catalog = useServiceCatalog(api)
  const [filter, setFilter] = useState<Filter>('Todos')
  const [dialog, setDialog] = useState<Dialog>({ kind: 'closed' })
  const [rowError, setRowError] = useState<string | null>(null)

  const services = catalog.state.status === 'ready' ? catalog.state.services : NO_SERVICES
  const visible = useMemo(
    () => services.filter((service) => matchesFilter(service, filter)),
    [services, filter],
  )
  const pausedCount = services.filter((service) => !service.isActive).length

  const closeDialog = () => setDialog({ kind: 'closed' })

  const handleCreate = async (draft: ServiceDraft) => {
    const created = await catalog.create(draft)
    closeDialog()
    notify(`Servicio ${created.name} creado.`)
  }

  const handleEdit = (service: CatalogService) => async (draft: ServiceDraft) => {
    const updated = await catalog.update({ id: service.id, draft, version: service.version })
    closeDialog()
    notify(`Servicio ${updated.name} actualizado.`)
  }

  const handleFiscal = (service: CatalogService) => async (draft: FiscalConfigDraft) => {
    await catalog.saveFiscalConfig({ serviceId: service.id, draft })
    closeDialog()
    notify(`Datos fiscales de ${service.name} guardados.`)
  }

  const toggleActive = async (service: CatalogService) => {
    setRowError(null)
    try {
      const updated = await catalog.setActive(service, !service.isActive)
      notify(`${updated.name} quedó ${updated.isActive ? 'activo' : 'en pausa'}.`)
    } catch (error) {
      setRowError(serviceErrorMessage(error))
    }
  }

  const columns: Column<CatalogService>[] = [
    {
      key: 'service',
      label: 'Servicio',
      grow: 2,
      render: (service) =>
        service.description ? (
          <Stacked top={service.name} bottom={service.description} />
        ) : (
          <Stacked top={service.name} bottom="Sin descripción" />
        ),
    },
    {
      key: 'code',
      label: 'Código',
      width: '104px',
      render: (service) => <span className={styles.muted}>{service.code}</span>,
    },
    {
      key: 'duration',
      label: 'Duración',
      width: '92px',
      render: (service) => (
        <span className={styles.muted}>{formatDuration(service.durationMinutes)}</span>
      ),
    },
    {
      key: 'price',
      label: 'Precio',
      width: '104px',
      align: 'right',
      render: (service) => <span className={styles.price}>{formatPrice(service.defaultPrice)}</span>,
    },
    {
      key: 'state',
      label: 'Estado',
      width: '96px',
      render: (service) => (
        <Badge tone={service.isActive ? 'ok' : 'neutral'}>
          {service.isActive ? 'Activo' : 'En pausa'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: '',
      width: '150px',
      align: 'right',
      render: (service) => (
        <span className={styles.actions}>
          <button
            type="button"
            className={styles.action}
            aria-label={`Datos fiscales de ${service.name}`}
            onClick={(event) => {
              event.stopPropagation()
              setDialog({ kind: 'fiscal', service })
            }}
          >
            <ReceiptIcon size={15} />
          </button>
          <button
            type="button"
            className={styles.actionText}
            aria-label={`${service.isActive ? 'Pausar' : 'Activar'} ${service.name}`}
            onClick={(event) => {
              event.stopPropagation()
              void toggleActive(service)
            }}
          >
            {service.isActive ? 'Pausar' : 'Activar'}
          </button>
        </span>
      ),
    },
  ]

  return (
    <div className={styles.page}>
      <Toolbar filters={[...FILTERS]} selectedFilter={filter} onFilterChange={(next) => setFilter(next as Filter)}>
        <Button onClick={() => setDialog({ kind: 'create' })}>
          <PlusIcon />
          Nuevo servicio
        </Button>
      </Toolbar>

      {rowError ? <FormAlert tone="error">{rowError}</FormAlert> : null}

      {catalog.state.status === 'loading' ? (
        <p className={styles.state} role="status">
          Cargando el catálogo…
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
        services.length === 0 ? (
          <p className={styles.state}>
            Todavía no hay servicios en el catálogo. Crea el primero para poder agendar.
          </p>
        ) : (
          <DataTable
            columns={columns}
            rows={visible}
            rowKey={(service) => service.id}
            onRowClick={(service) => setDialog({ kind: 'edit', service })}
            footer={`${services.length} ${services.length === 1 ? 'servicio' : 'servicios'} · ${pausedCount} en pausa`}
          />
        )
      ) : null}

      {dialog.kind === 'create' ? (
        <ServiceFormModal onClose={closeDialog} onSubmit={handleCreate} />
      ) : null}

      {dialog.kind === 'edit' ? (
        <ServiceFormModal
          service={dialog.service}
          onClose={closeDialog}
          onSubmit={handleEdit(dialog.service)}
        />
      ) : null}

      {dialog.kind === 'fiscal' ? (
        <FiscalConfigModal
          service={dialog.service}
          onClose={closeDialog}
          onSubmit={handleFiscal(dialog.service)}
        />
      ) : null}
    </div>
  )
}
