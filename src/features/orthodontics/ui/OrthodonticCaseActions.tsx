import { useRef, useState } from 'react'
import { Button } from '../../../shared/ui/atoms/Button'
import { SelectField } from '../../../shared/ui/atoms/Field'
import { FormAlert } from '../../../shared/ui/molecules/FormAlert'
import type { OrthodonticsApi } from '../application/orthodonticsApi'
import {
  allowedCaseTransitions,
  isOrthodonticsConflict,
  orthodonticsErrorMessage,
  type OrthodonticCase,
} from '../domain/orthodontics'
import styles from '../../patient-record/ui/ClinicalRecordTabs.module.css'

export function OrthodonticCaseActions({ api, item, ready, reload }: {
  api: OrthodonticsApi
  item: OrthodonticCase
  ready: boolean
  reload: () => Promise<void>
}) {
  const [status, setStatus] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const inFlight = useRef(false)

  const execute = async () => {
    if (!status || inFlight.current || !ready) return
    inFlight.current = true
    setPending(true)
    setError(null)
    try {
      await api.transitionCase(item.id, item.version, status)
      setConfirming(false)
      await reload()
    } catch (cause) {
      setError(orthodonticsErrorMessage(cause))
      if (isOrthodonticsConflict(cause)) await reload()
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }

  return <div className={styles.actions}>
    {error ? <FormAlert tone="error">{error}</FormAlert> : null}
    <SelectField label="Cambiar estado" value={status} options={[
      { value: '', label: 'Elegí una transición' },
      ...allowedCaseTransitions(item.status),
    ]} disabled={!ready || pending} onChange={(event) => setStatus(event.target.value)} />
    {confirming ? <div className={styles.confirm} role="alertdialog" aria-label="Confirmar cambio de estado del caso">
      <p>¿Confirmás cambiar el estado a {status}?</p>
      <Button size="sm" variant="secondary" disabled={pending} onClick={() => setConfirming(false)}>Cancelar</Button>
      <Button size="sm" disabled={!ready || pending} onClick={() => void execute()}>{pending ? 'Guardando…' : 'Confirmar cambio'}</Button>
    </div> : <Button size="sm" disabled={!status || !ready || pending} onClick={() => setConfirming(true)}>Cambiar estado</Button>}
  </div>
}
