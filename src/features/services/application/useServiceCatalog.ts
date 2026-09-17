import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  type CatalogService,
  type FiscalConfig,
  type FiscalConfigDraft,
  type ServiceDraft,
  fromCatalogService,
  isVersionConflict,
  serviceErrorMessage,
} from '../domain/service'
import type { ServicesApi } from './servicesApi'

export type CatalogState =
  | { status: 'loading' }
  | { status: 'ready'; services: CatalogService[] }
  | { status: 'error'; message: string }

export interface UpdateInput {
  id: string
  draft: ServiceDraft
  version: number
}

export interface SaveFiscalConfigInput {
  serviceId: string
  draft: FiscalConfigDraft
  version?: number
}

export interface ServiceCatalog {
  state: CatalogState
  reload: () => Promise<void>
  create: (draft: ServiceDraft) => Promise<CatalogService>
  update: (input: UpdateInput) => Promise<CatalogService>
  setActive: (service: CatalogService, isActive: boolean) => Promise<CatalogService>
  saveFiscalConfig: (input: SaveFiscalConfigInput) => Promise<FiscalConfig>
}

/** The backend orders by code; keep local mutations in that same order. */
function byCode(services: CatalogService[]): CatalogService[] {
  return [...services].sort((left, right) => left.code.localeCompare(right.code))
}

export function useServiceCatalog(api: ServicesApi): ServiceCatalog {
  const [state, setState] = useState<CatalogState>({ status: 'loading' })

  const reload = useCallback(async () => {
    try {
      // This is the admin screen: paused services must be visible to be reactivated.
      const services = await api.list({ includeInactive: true })
      setState({ status: 'ready', services: byCode(services) })
    } catch (error) {
      setState({ status: 'error', message: serviceErrorMessage(error) })
    }
  }, [api])

  useEffect(() => {
    // Synchronizes with the server catalog on mount (external system).
    // oxlint-disable-next-line react/set-state-in-effect
    void reload()
  }, [reload])

  const create = useCallback(
    async (draft: ServiceDraft) => {
      const created = await api.create(draft)
      setState((current) =>
        current.status === 'ready'
          ? { status: 'ready', services: byCode([...current.services, created]) }
          : current,
      )
      return created
    },
    [api],
  )

  const update = useCallback(
    async ({ id, draft, version }: UpdateInput) => {
      try {
        const updated = await api.update({ id, draft, version })
        setState((current) =>
          current.status === 'ready'
            ? {
                status: 'ready',
                services: byCode(
                  current.services.map((item) => (item.id === updated.id ? updated : item)),
                ),
              }
            : current,
        )
        return updated
      } catch (error) {
        // A stale version is only recoverable with fresh versions in hand.
        if (isVersionConflict(error)) void reload()
        throw error
      }
    },
    [api, reload],
  )

  const setActive = useCallback(
    (service: CatalogService, isActive: boolean) =>
      update({
        id: service.id,
        version: service.version,
        draft: { ...fromCatalogService(service), isActive },
      }),
    [update],
  )

  const saveFiscalConfig = useCallback(
    ({ serviceId, draft, version }: SaveFiscalConfigInput) =>
      api.putFiscalConfig(version === undefined ? { serviceId, draft } : { serviceId, draft, version }),
    [api],
  )

  return useMemo(
    () => ({ state, reload, create, update, setActive, saveFiscalConfig }),
    [state, reload, create, update, setActive, saveFiscalConfig],
  )
}
