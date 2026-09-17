import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CatalogService } from '../../services/domain/service'
import {
  type LocationDraft,
  type PracticeLocation,
  byDefaultThenName,
  locationErrorMessage,
} from '../domain/location'
import type { LocationsApi } from './locationsApi'

export type LocationsState =
  | { status: 'loading' }
  | { status: 'ready'; locations: PracticeLocation[] }
  | { status: 'error'; message: string }

export interface UpdateLocationInput {
  id: string
  draft: LocationDraft
}

export interface ReplaceServicesInput {
  locationId: string
  serviceIds: string[]
}

export interface LocationsCatalog {
  state: LocationsState
  reload: () => Promise<void>
  create: (draft: LocationDraft) => Promise<PracticeLocation>
  update: (input: UpdateLocationInput) => Promise<PracticeLocation>
  listServices: (locationId: string) => Promise<CatalogService[]>
  replaceServices: (input: ReplaceServicesInput) => Promise<void>
}

export function useLocations(api: LocationsApi, providerUserId: string): LocationsCatalog {
  const [state, setState] = useState<LocationsState>({ status: 'loading' })

  const reload = useCallback(async () => {
    try {
      const locations = await api.list({ providerUserId })
      setState({ status: 'ready', locations })
    } catch (error) {
      setState({ status: 'error', message: locationErrorMessage(error) })
    }
  }, [api, providerUserId])

  useEffect(() => {
    // Synchronizes with the server on mount and whenever the provider changes.
    // oxlint-disable-next-line react/set-state-in-effect
    void reload()
  }, [reload])

  const create = useCallback(
    async (draft: LocationDraft) => {
      const created = await api.create({ providerUserId, draft })
      setState((current) =>
        current.status === 'ready'
          ? { status: 'ready', locations: byDefaultThenName([...current.locations, created]) }
          : current,
      )
      return created
    },
    [api, providerUserId],
  )

  const update = useCallback(
    async ({ id, draft }: UpdateLocationInput) => {
      const updated = await api.update({ id, providerUserId, draft })
      setState((current) =>
        current.status === 'ready'
          ? {
              status: 'ready',
              locations: byDefaultThenName(
                current.locations.map((item) => (item.id === updated.id ? updated : item)),
              ),
            }
          : current,
      )
      return updated
    },
    [api, providerUserId],
  )

  const listServices = useCallback(
    (locationId: string) => api.listServices({ locationId, providerUserId }),
    [api, providerUserId],
  )

  const replaceServices = useCallback(
    async ({ locationId, serviceIds }: ReplaceServicesInput) => {
      await api.replaceServices({ locationId, providerUserId, serviceIds })
      // The server also sets all_services = false, and 204 carries no body to read it
      // from, so the list has to come back from the server to stay truthful.
      await reload()
    },
    [api, providerUserId, reload],
  )

  return useMemo(
    () => ({ state, reload, create, update, listServices, replaceServices }),
    [state, reload, create, update, listServices, replaceServices],
  )
}
