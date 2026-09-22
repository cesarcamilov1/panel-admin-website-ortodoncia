import { useCallback, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useResource } from '../../../shared/api/useResource'
import { Avatar } from '../../../shared/ui/atoms/Avatar'
import { Badge, type Tone } from '../../../shared/ui/atoms/Badge'
import { Button } from '../../../shared/ui/atoms/Button'
import { FormAlert } from '../../../shared/ui/molecules/FormAlert'
import { TabBar } from '../../../shared/ui/molecules/TabBar'
import { useAuth } from '../../auth/application/authContext'
import { usePatientsApi } from '../../patients/application/usePatientsApi'
import { useClinicalApi } from '../application/useClinicalApi'
import { useTreatmentsApi } from '../../treatments/application/useTreatmentsApi'
import { TreatmentsPanel } from '../../treatments/ui/TreatmentsPanel'
import { usePrescriptionsApi } from '../../prescriptions/application/usePrescriptionsApi'
import { PrescriptionsPanel } from '../../prescriptions/ui/PrescriptionsPanel'
import { useOrthodonticsApi } from '../../orthodontics/application/useOrthodonticsApi'
import { OrthodonticsPanel } from '../../orthodontics/ui/OrthodonticsPanel'
import { useConsentsApi } from '../../consents/application/useConsentsApi'
import { useAppointmentsApi } from '../../agenda/application/useAppointmentsApi'
import { useServicesApi } from '../../services/application/useServicesApi'
import { usePaymentsApi } from '../../payments/application/usePaymentsApi'
import { canManagePayments } from '../../payments/domain/payment'
import { PaymentsPanel } from '../../payments/ui/PaymentsPanel'
import { useFilesApi } from '../../files/application/useFilesApi'
import { FilesPanel } from '../../files/ui/FilesPanel'
import { useFiscalApi } from '../../fiscal/application/useFiscalApi'
import { canManageFiscalData } from '../../fiscal/domain/fiscal'
import { FiscalDataPanel } from '../../fiscal/ui/FiscalDataPanel'
import { ConsentsPanel } from '../../consents/ui/ConsentsPanel'
import { canReadClinical, canOwnClinical } from '../domain/clinical'
import { ClinicalSummaryTab, ClinicalTab, MedicalHistoryTab, NotesTab, OdontogramTab } from './ClinicalRecordTabs'
import { type Patient, type PatientDraft, fromPatient, isVersionConflict, patientDisplayName, patientErrorMessage } from '../../patients/domain/patient'
import { PatientFormModal } from '../../patients/ui/organisms/PatientFormModal'
import { RECORD_TABS, type RecordTabId } from './recordTabs'
import styles from './PatientRecordPage.module.css'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type PendingAction = 'booking-block' | 'booking-unblock' | 'archive' | null

export function PatientRecordPage() {
  const { patientId } = useParams<{ patientId: string }>()
  if (!patientId || !UUID_PATTERN.test(patientId)) {
    return <div className={styles.page}><FormAlert tone="error">El identificador del paciente no es válido.</FormAlert></div>
  }
  return <ConnectedPatientRecord patientId={patientId} />
}

function patientTone(patient: Patient): { label: string; tone: Tone } {
  if (patient.archivedAt) return { label: 'Archivado', tone: 'neutral' }
  if (patient.status === 'INACTIVE') return { label: 'Inactivo', tone: 'neutral' }
  if (patient.status === 'DECEASED') return { label: 'Fallecido', tone: 'danger' }
  return { label: 'Activo', tone: 'ok' }
}

function patchFromDraft(patient: Patient, draft: PatientDraft): Partial<PatientDraft> {
  const before = fromPatient(patient)
  return Object.fromEntries(
    (Object.keys(before) as (keyof PatientDraft)[])
      .filter((key) => before[key] !== draft[key])
      .map((key) => [key, draft[key]]),
  ) as Partial<PatientDraft>
}

function ConnectedPatientRecord({ patientId }: { patientId: string }) {
  const api = usePatientsApi()
  const clinicalApi = useClinicalApi()
  const treatmentsApi = useTreatmentsApi()
  const prescriptionsApi = usePrescriptionsApi()
  const orthodonticsApi = useOrthodonticsApi()
  const consentsApi = useConsentsApi()
  const appointmentsApi = useAppointmentsApi()
  const servicesApi = useServicesApi()
  const paymentsApi = usePaymentsApi()
  const filesApi = useFilesApi()
  const fiscalApi = useFiscalApi()
  const navigate = useNavigate()
  const { state: auth } = useAuth()
  const load = useCallback((signal: AbortSignal) => api.get(patientId, signal), [api, patientId])
  const resource = useResource(load, [load])
  const [tab, setTab] = useState<RecordTabId>('resumen')
  const [editing, setEditing] = useState(false)
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [acting, setActing] = useState(false)
  const canEdit = auth.status === 'authenticated' && auth.user.role !== 'BILLING'
  const clinicalAccess = auth.status === 'authenticated' && canReadClinical(auth.user.role)
  const clinicalOwner = auth.status === 'authenticated' && canOwnClinical(auth.user.role)
  const paymentAccess = auth.status === 'authenticated' && canManagePayments(auth.user.role)
  const fileAccess = auth.status === 'authenticated' && (auth.user.role === 'OWNER_DENTIST' || auth.user.role === 'ASSISTANT')
  const fiscalAccess = auth.status === 'authenticated' && canManageFiscalData(auth.user.role)
  const visibleTabs = RECORD_TABS.filter((item) => {
    if (!clinicalAccess && ['clinico', 'historial', 'notas', 'odontograma', 'planes', 'ortodoncia', 'recetas', 'consentimientos'].includes(item.id)) return false
    if (item.id === 'pagos') return paymentAccess
    if (item.id === 'archivos') return fileAccess
    if (item.id === 'fiscales') return fiscalAccess
    return true
  })

  if (resource.state.status === 'loading') return <div className={styles.page}><p role="status">Cargando paciente…</p></div>
  if (resource.state.status === 'error') return <div className={styles.page}><FormAlert tone="error">{patientErrorMessage(resource.state.error)}</FormAlert><Button variant="secondary" onClick={() => void resource.reload()}>Reintentar</Button></div>

  const patient = resource.state.data
  const status = patientTone(patient)
  const update = async (draft: PatientDraft) => {
    const patch = patchFromDraft(patient, draft)
    if (Object.keys(patch).length === 0) {
      setEditing(false)
      return
    }
    try {
      await api.update({ id: patient.id, version: patient.version, patch })
      setEditing(false)
      await resource.reload()
    } catch (error) {
      if (isVersionConflict(error)) void resource.reload()
      throw error
    }
  }
  const performAction = async () => {
    if (!pendingAction) return
    setActing(true)
    setActionError(null)
    try {
      if (pendingAction === 'archive') await api.archive({ id: patient.id, version: patient.version })
      else await api.setBookingBlocked({ id: patient.id, version: patient.version, bookingBlocked: pendingAction === 'booking-block' })
      setPendingAction(null)
      await resource.reload()
    } catch (error) {
      if (isVersionConflict(error)) void resource.reload()
      setActionError(patientErrorMessage(error))
    } finally {
      setActing(false)
    }
  }
  const currentTab = RECORD_TABS.find((item) => item.id === tab)?.label ?? 'Esta sección'

  return <div className={styles.page}>
    <header className={styles.header}>
      <Avatar name={patientDisplayName(patient)} size={56} />
      <div className={styles.identity}>
        <div className={styles.nameRow}><h2 className={styles.name}>{patientDisplayName(patient)}</h2><Badge tone={status.tone}>{status.label}</Badge>{patient.bookingBlocked ? <Badge tone="warn">Reservas bloqueadas</Badge> : null}</div>
        <div className={styles.facts}><span>Expediente {patient.recordNumber}</span><span>{patient.phoneE164}</span>{patient.email ? <span>{patient.email}</span> : <span>Sin correo registrado</span>}</div>
      </div>
      <div className={styles.headerActions}>
        <div className={styles.buttons}>
          {canEdit ? <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>Editar datos</Button> : null}
          {canEdit ? <Button size="sm" onClick={() => navigate(`/agenda?patient_id=${encodeURIComponent(patient.id)}`)}>Agendar cita</Button> : null}
        </div>
        <span className={styles.next}>Las citas y pagos se consultan en sus secciones conectadas. Los saldos y agregados no están disponibles en este encabezado.</span>
      </div>
    </header>

    {actionError ? <FormAlert tone="error">{actionError}</FormAlert> : null}
    {canEdit ? <div className={styles.actions}>
      <Button variant="secondary" size="sm" disabled={acting} onClick={() => setPendingAction(patient.bookingBlocked ? 'booking-unblock' : 'booking-block')}>
        {patient.bookingBlocked ? 'Permitir nuevas reservas' : 'Bloquear nuevas reservas'}
      </Button>
      {!patient.archivedAt ? <Button variant="secondary" size="sm" disabled={acting} onClick={() => setPendingAction('archive')}>Archivar paciente</Button> : null}
    </div> : null}
    {pendingAction ? <div className={styles.confirmation} role="alertdialog" aria-label="Confirmar acción sobre paciente">
      <p>{pendingAction === 'archive' ? '¿Archivar este paciente? No se eliminarán ni cancelarán sus datos existentes.' : pendingAction === 'booking-block' ? '¿Bloquear nuevas reservas para este paciente? Las citas existentes no cambian.' : '¿Permitir nuevas reservas para este paciente?'}</p>
      <div className={styles.buttons}><Button variant="secondary" size="sm" disabled={acting} onClick={() => setPendingAction(null)}>Cancelar</Button><Button size="sm" disabled={acting} onClick={() => void performAction()}>{acting ? 'Guardando…' : 'Confirmar'}</Button></div>
    </div> : null}

    <TabBar tabs={visibleTabs} current={tab} onSelect={setTab} label="Secciones del expediente" />
    {tab === 'resumen' ? <section className={styles.summary} aria-label="Datos principales del paciente">
      <h3>Datos principales</h3>
      <dl className={styles.detailGrid}>
        <div><dt>Nombre legal</dt><dd>{[patient.firstName, patient.middleName, patient.lastName, patient.secondLastName].filter(Boolean).join(' ')}</dd></div>
        <div><dt>Nombre preferido</dt><dd>{patient.preferredName || 'No registrado'}</dd></div>
        <div><dt>Fecha de nacimiento</dt><dd>{patient.birthDate || 'No registrada'}</dd></div>
        <div><dt>Ocupación</dt><dd>{patient.occupation || 'No registrada'}</dd></div>
        <div><dt>Notas administrativas</dt><dd>{patient.notes || 'Sin notas'}</dd></div>
      </dl>
    </section> : null}
    {clinicalAccess && tab === 'clinico' ? <div key={patient.id}><ClinicalSummaryTab api={clinicalApi} patientId={patient.id} /><ClinicalTab api={clinicalApi} patientId={patient.id} userId={auth.user.id} owner={clinicalOwner} /></div> : null}
    {clinicalAccess && tab === 'historial' ? <MedicalHistoryTab key={patient.id} api={clinicalApi} patientId={patient.id} /> : null}
    {clinicalAccess && tab === 'notas' ? <NotesTab key={patient.id} api={clinicalApi} patientId={patient.id} userId={auth.user.id} owner={clinicalOwner} /> : null}
    {clinicalAccess && tab === 'odontograma' ? <OdontogramTab key={patient.id} api={clinicalApi} patientId={patient.id} owner={clinicalOwner} /> : null}
    {clinicalAccess && tab === 'planes' ? <TreatmentsPanel key={patient.id} api={treatmentsApi} servicesApi={servicesApi} patientId={patient.id} userId={auth.user.id} owner={clinicalOwner} /> : null}
    {clinicalAccess && tab === 'recetas' ? <PrescriptionsPanel key={patient.id} api={prescriptionsApi} clinicalApi={clinicalApi} patientId={patient.id} userId={auth.user.id} role={auth.user.role} /> : null}
    {clinicalAccess && tab === 'ortodoncia' ? <OrthodonticsPanel key={patient.id} api={orthodonticsApi} clinicalApi={clinicalApi} treatmentsApi={treatmentsApi} patientId={patient.id} userId={auth.user.id} owner={clinicalOwner} /> : null}
    {clinicalAccess && tab === 'consentimientos' ? <ConsentsPanel key={patient.id} api={consentsApi} filesApi={filesApi} treatmentsApi={treatmentsApi} appointmentsApi={appointmentsApi} patientId={patient.id} providerUserId={auth.user.id} role={auth.user.role} /> : null}
    {paymentAccess && tab === 'pagos' ? <PaymentsPanel key={patient.id} api={paymentsApi} treatmentsApi={treatmentsApi} patientId={patient.id} patientName={patientDisplayName(patient)} /> : null}
    {fileAccess && tab === 'archivos' ? <FilesPanel key={patient.id} api={filesApi} patientId={patient.id} /> : null}
    {fiscalAccess && tab === 'fiscales' ? <FiscalDataPanel key={patient.id} api={fiscalApi} patientId={patient.id} canManage={fiscalAccess} /> : null}
    {!['resumen', 'clinico', 'historial', 'notas', 'odontograma', 'planes', 'recetas', 'ortodoncia', 'consentimientos', 'pagos', 'archivos', 'fiscales'].includes(tab) ? <section className={styles.unavailable} aria-live="polite"><h3>{currentTab} todavía no está conectado</h3><p>Esta sección no muestra datos de ejemplo. Se conectará a su recurso clínico o administrativo en una tarea posterior.</p></section> : null}
    {editing ? <PatientFormModal patient={patient} onClose={() => setEditing(false)} onSubmit={update} /> : null}
  </div>
}
