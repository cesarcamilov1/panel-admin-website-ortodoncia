import { useRef, useState } from 'react'
import { Button } from '../../../shared/ui/atoms/Button'
import { FormAlert } from '../../../shared/ui/molecules/FormAlert'
import type { PrescriptionsApi } from '../application/prescriptionsApi'
import {
  canIssuePrescription,
  canVoidPrescription,
  isPrescriptionConflict,
  prescriptionErrorMessage,
  type Prescription,
} from '../domain/prescription'
import styles from '../../patient-record/ui/ClinicalRecordTabs.module.css'

type Action = 'issue' | 'void' | null

export function PrescriptionActions({ api, prescription, role, userId, ready, reload }: {
  api: PrescriptionsApi
  prescription: Prescription
  role: string
  userId: string
  ready: boolean
  reload: () => Promise<void>
}) {
  const [action, setAction] = useState<Action>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const inFlight = useRef(false)
  const canIssue = canIssuePrescription(prescription, role, userId)
  const canVoid = canVoidPrescription(prescription, role, userId)

  if (!canIssue && !canVoid) return null

  const execute = async () => {
    if (!action || inFlight.current || !ready) return
    inFlight.current = true
    setPending(true)
    setError(null)
    try {
      if (action === 'issue') await api.issue(prescription.id, prescription.version)
      else await api.void(prescription.id, prescription.version)
      setAction(null)
      await reload()
    } catch (cause) {
      setError(prescriptionErrorMessage(cause))
      if (isPrescriptionConflict(cause)) await reload()
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }

  return <div className={styles.actions}>
    {error ? <FormAlert tone="error">{error}</FormAlert> : null}
    {action ? <div className={styles.confirm} role="alertdialog" aria-label="Confirmar cambio de receta">
      <p>{action === 'issue' ? '¿Confirmás emitir esta receta? Quedará inmutable.' : '¿Confirmás anular esta receta? No se eliminará su historial.'}</p>
      <Button size="sm" variant="secondary" disabled={pending} onClick={() => setAction(null)}>Cancelar</Button>
      <Button size="sm" variant={action === 'void' ? 'danger' : 'primary'} disabled={!ready || pending} onClick={() => void execute()}>{pending ? 'Guardando…' : 'Confirmar'}</Button>
    </div> : <>
      {canVoid ? <Button size="sm" variant="secondary" disabled={!ready || pending} onClick={() => setAction('void')}>Anular receta</Button> : null}
      {canIssue ? <Button size="sm" disabled={!ready || pending} onClick={() => setAction('issue')}>Emitir receta</Button> : null}
    </>}
  </div>
}
