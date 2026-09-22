import { useState } from 'react'
import { useResource } from '../../../shared/api/useResource'
import { Button } from '../../../shared/ui/atoms/Button'
import { TextField } from '../../../shared/ui/atoms/Field'
import { FormAlert } from '../../../shared/ui/molecules/FormAlert'
import { useAuth } from '../../auth/application/authContext'
import { usePatientsApi } from '../../patients/application/usePatientsApi'
import { patientDisplayName, type PatientSummary } from '../../patients/domain/patient'
import { usePaymentsApi } from '../../payments/application/usePaymentsApi'
import { canManagePayments } from '../../payments/domain/payment'
import { PaymentsPanel } from '../../payments/ui/PaymentsPanel'
import { useTreatmentsApi } from '../../treatments/application/useTreatmentsApi'
import styles from './RecordsPage.module.css'

export function PaymentsPage() {
  const { state: auth } = useAuth()
  const patientsApi = usePatientsApi()
  const paymentsApi = usePaymentsApi()
  const treatmentsApi = useTreatmentsApi()
  const [query, setQuery] = useState('')
  const [patient, setPatient] = useState<PatientSummary | null>(null)
  const results = useResource(
    (signal) => query.trim() ? patientsApi.list({ q: query.trim(), limit: 10, signal }) : Promise.resolve({ items: [], nextCursor: null }),
    [patientsApi, query],
  )

  if (auth.status !== 'authenticated') return null
  if (!canManagePayments(auth.user.role)) {
    return <div className={styles.page}><FormAlert tone="error">Tu rol no tiene acceso al servicio de pagos.</FormAlert></div>
  }

  return <div className={styles.page}>
    <section aria-label="Buscar paciente para pagos">
      <h2>Pagos</h2>
      <TextField label="Buscar paciente" placeholder="Nombre, teléfono o expediente" value={query} onChange={(event) => { setQuery(event.target.value); setPatient(null) }} />
      {results.state.status === 'loading' && query.trim() ? <p role="status">Buscando pacientes…</p> : null}
      {results.state.status === 'error' ? <FormAlert tone="error">No se pudo buscar pacientes. Intentá nuevamente.</FormAlert> : null}
      {results.state.status === 'ready' && query.trim() ? results.state.data.items.length ? <div>{results.state.data.items.map((item) => <Button key={item.id} size="sm" variant="secondary" onClick={() => setPatient(item)}>{patientDisplayName(item)} · Expediente {item.recordNumber}</Button>)}</div> : <p>No se encontraron pacientes.</p> : null}
    </section>
    {patient ? <PaymentsPanel key={patient.id} api={paymentsApi} treatmentsApi={treatmentsApi} patientId={patient.id} patientName={patientDisplayName(patient)} /> : <p>Seleccioná un paciente para consultar pagos reales. No se muestran cobros ni saldos de ejemplo.</p>}
  </div>
}
