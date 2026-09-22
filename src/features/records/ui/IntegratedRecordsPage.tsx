import { useState } from 'react'
import { useResource } from '../../../shared/api/useResource'
import { Button } from '../../../shared/ui/atoms/Button'
import { TextField } from '../../../shared/ui/atoms/Field'
import { FormAlert } from '../../../shared/ui/molecules/FormAlert'
import { useAuth } from '../../auth/application/authContext'
import { useAppointmentsApi } from '../../agenda/application/useAppointmentsApi'
import { useConsentsApi } from '../../consents/application/useConsentsApi'
import { ConsentsPanel } from '../../consents/ui/ConsentsPanel'
import { useFilesApi } from '../../files/application/useFilesApi'
import { ConsentTemplatesPanel } from '../../consents/ui/ConsentTemplatesPanel'
import { useOrthodonticsApi } from '../../orthodontics/application/useOrthodonticsApi'
import { OrthodonticsPanel } from '../../orthodontics/ui/OrthodonticsPanel'
import { useClinicalApi } from '../../patient-record/application/useClinicalApi'
import { usePatientsApi } from '../../patients/application/usePatientsApi'
import { patientDisplayName, type PatientSummary } from '../../patients/domain/patient'
import { usePrescriptionsApi } from '../../prescriptions/application/usePrescriptionsApi'
import { PrescriptionsPanel } from '../../prescriptions/ui/PrescriptionsPanel'
import { useTreatmentsApi } from '../../treatments/application/useTreatmentsApi'
import styles from './RecordsPage.module.css'

type Section = 'ortodoncia' | 'recetas' | 'consentimientos'

export function IntegratedRecordsPage({ section }: { section: Section }) {
  const { state: auth } = useAuth()
  const patientsApi = usePatientsApi()
  const consentsApi = useConsentsApi()
  const [query, setQuery] = useState('')
  const [patient, setPatient] = useState<PatientSummary | null>(null)
  const results = useResource((signal) => query.trim() ? patientsApi.list({ q: query.trim(), limit: 10, signal }) : Promise.resolve({ items: [], nextCursor: null }), [patientsApi, query])
  if (auth.status !== 'authenticated') return null
  return <div className={styles.page}>
    <section aria-label="Buscar paciente"><h2>{section === 'ortodoncia' ? 'Casos de ortodoncia' : section === 'recetas' ? 'Recetas' : 'Consentimientos'}</h2><TextField label="Buscar paciente" placeholder="Nombre, teléfono o expediente" value={query} onChange={(event) => { setQuery(event.target.value); setPatient(null) }} />{results.state.status === 'loading' && query.trim() ? <p role="status">Buscando pacientes…</p> : null}{results.state.status === 'error' ? <FormAlert tone="error">No se pudo buscar pacientes. Intentá nuevamente.</FormAlert> : null}{results.state.status === 'ready' && query.trim() ? results.state.data.items.length ? <div>{results.state.data.items.map((item) => <Button key={item.id} size="sm" variant="secondary" onClick={() => setPatient(item)}>{patientDisplayName(item)} · Expediente {item.recordNumber}</Button>)}</div> : <p>No se encontraron pacientes.</p> : null}</section>
    {section === 'consentimientos' ? <ConsentTemplatesPanel api={consentsApi} owner={auth.user.role === 'OWNER_DENTIST'} /> : null}
    {patient ? <SelectedSection section={section} patient={patient} userId={auth.user.id} role={auth.user.role} /> : <p>Seleccioná un paciente para consultar registros reales. No se muestran totales ni nombres de ejemplo.</p>}
  </div>
}

function SelectedSection({ section, patient, userId, role }: { section: Section; patient: PatientSummary; userId: string; role: string }) {
  const clinicalApi = useClinicalApi(); const orthodonticsApi = useOrthodonticsApi(); const prescriptionsApi = usePrescriptionsApi(); const consentsApi = useConsentsApi(); const filesApi = useFilesApi(); const treatmentsApi = useTreatmentsApi(); const appointmentsApi = useAppointmentsApi()
  if (section === 'ortodoncia') return <OrthodonticsPanel api={orthodonticsApi} clinicalApi={clinicalApi} treatmentsApi={treatmentsApi} patientId={patient.id} userId={userId} owner={role === 'OWNER_DENTIST'} />
  if (section === 'recetas') return <PrescriptionsPanel api={prescriptionsApi} clinicalApi={clinicalApi} patientId={patient.id} userId={userId} role={role} />
  return <ConsentsPanel api={consentsApi} filesApi={filesApi} treatmentsApi={treatmentsApi} appointmentsApi={appointmentsApi} patientId={patient.id} providerUserId={userId} role={role} />
}
