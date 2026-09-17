import { useCallback, useEffect, useState } from 'react'
import { Badge } from '../../../../shared/ui/atoms/Badge'
import { Button } from '../../../../shared/ui/atoms/Button'
import { CloseIcon } from '../../../../shared/ui/atoms/icons'
import { FormAlert } from '../../../../shared/ui/molecules/FormAlert'
import {
  type CatalogService,
  formatDuration,
  formatPrice,
} from '../../../services/domain/service'
import { type PracticeLocation, locationErrorMessage } from '../../domain/location'
import styles from './LocationServicesModal.module.css'

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; catalog: CatalogService[] }
  | { status: 'error'; message: string }

interface LocationServicesModalProps {
  location: PracticeLocation
  loadCatalog: () => Promise<CatalogService[]>
  loadEnabled: () => Promise<CatalogService[]>
  onClose: () => void
  onSubmit: (serviceIds: string[]) => Promise<void>
}

export function LocationServicesModal({
  location,
  loadCatalog,
  loadEnabled,
  onClose,
  onSubmit,
}: LocationServicesModalProps) {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [banner, setBanner] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const read = useCallback(async () => {
    setLoad({ status: 'loading' })
    try {
      const [catalog, enabled] = await Promise.all([loadCatalog(), loadEnabled()])
      setLoad({ status: 'ready', catalog })
      setSelected(new Set(enabled.map((item) => item.id)))
    } catch (error) {
      setLoad({ status: 'error', message: locationErrorMessage(error) })
    }
  }, [loadCatalog, loadEnabled])

  useEffect(() => {
    // Reads the catalog and the current allowlist from the server (external system).
    // oxlint-disable-next-line react/set-state-in-effect
    void read()
  }, [read])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const catalog = load.status === 'ready' ? load.catalog : []
  const ids = catalog.map((item) => item.id)
  const allSelected = ids.length > 0 && ids.every((id) => selected.has(id))

  const handleSubmit = async () => {
    setSaving(true)
    setBanner(null)
    try {
      // Preserve catalog order so the payload is stable and reviewable.
      await onSubmit(ids.filter((id) => selected.has(id)))
    } catch (error) {
      setBanner(locationErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const empty = selected.size === 0

  return (
    <div className={styles.scrim} role="dialog" aria-modal="true" aria-label="Servicios de la sede">
      <div className={styles.modal}>
        <header className={styles.header}>
          <span className={styles.heading}>
            <h2 className={styles.title}>Servicios de la sede</h2>
            <small className={styles.meta}>{location.name}</small>
          </span>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Cerrar">
            <CloseIcon />
          </button>
        </header>

        <div className={styles.body}>
          {location.allServices ? (
            <FormAlert tone="error">
              Esta sede ofrece hoy todos los servicios. Al guardar una selección pasa a lista
              restringida, y eso no tiene vuelta: la API no permite devolverla a «todos».
            </FormAlert>
          ) : null}

          {banner ? <FormAlert tone="error">{banner}</FormAlert> : null}

          {load.status === 'loading' ? (
            <p className={styles.state} role="status">
              Cargando el catálogo…
            </p>
          ) : null}

          {load.status === 'error' ? (
            <div className={styles.errorState}>
              <FormAlert tone="error">{load.message}</FormAlert>
              <Button variant="secondary" onClick={() => void read()}>
                Reintentar
              </Button>
            </div>
          ) : null}

          {load.status === 'ready' ? (
            catalog.length === 0 ? (
              <p className={styles.state}>
                No hay servicios en el catálogo. Crea servicios antes de asignarlos a una sede.
              </p>
            ) : (
              <>
                <div className={styles.bulk}>
                  <span className={styles.count}>
                    {selected.size} de {catalog.length} seleccionados
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      setSelected(allSelected ? new Set() : new Set(ids))
                    }
                  >
                    {allSelected ? 'Quitar todos' : 'Seleccionar todos'}
                  </Button>
                </div>

                <ul className={styles.list}>
                  {catalog.map((item) => (
                    <li key={item.id} className={styles.item}>
                      <label className={styles.option}>
                        <input
                          type="checkbox"
                          className={styles.checkbox}
                          checked={selected.has(item.id)}
                          onChange={() => toggle(item.id)}
                        />
                        <span className={styles.optionText}>
                          <strong className={styles.optionName}>{item.name}</strong>
                          <small className={styles.optionMeta}>
                            {item.code} · {formatDuration(item.durationMinutes)} ·{' '}
                            {formatPrice(item.defaultPrice)}
                          </small>
                        </span>
                        {item.isActive ? null : <Badge tone="neutral">En pausa</Badge>}
                      </label>
                    </li>
                  ))}
                </ul>

                {empty ? (
                  <FormAlert tone="error">
                    Sin servicios seleccionados no se podrá agendar nada en esta sede.
                  </FormAlert>
                ) : null}
              </>
            )
          ) : null}
        </div>

        <footer className={styles.footer}>
          <span className={styles.spacer} />
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            variant={empty ? 'danger' : 'primary'}
            onClick={() => void handleSubmit()}
            disabled={saving || load.status !== 'ready'}
          >
            {saving ? 'Guardando…' : empty ? 'Dejar la sede sin servicios' : 'Guardar servicios'}
          </Button>
        </footer>
      </div>
    </div>
  )
}
