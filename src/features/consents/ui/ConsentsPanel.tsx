/* oxlint-disable react/refs -- retained snapshots keep selected detail mounted during authoritative refreshes. */
import { type FormEvent, useMemo, useRef, useState } from 'react'
import { useResource } from '../../../shared/api/useResource'
import { Badge } from '../../../shared/ui/atoms/Badge'
import { Button } from '../../../shared/ui/atoms/Button'
import { SelectField, TextField } from '../../../shared/ui/atoms/Field'
import { FormAlert } from '../../../shared/ui/molecules/FormAlert'
import type { AppointmentsApi } from '../../agenda/application/appointmentsApi'
import { toAgendaWindow } from '../../agenda/domain/appointment'
import type { FilesApi } from '../../files/application/filesApi'
import type { TreatmentsApi } from '../../treatments/application/treatmentsApi'
import type { ConsentsApi } from '../application/consentsApi'
import { consentErrorMessage, type PatientConsent } from '../domain/consent'
import { ConsentActions } from './ConsentActions'
import { ConsentFileSelector } from './ConsentFileSelector'
import styles from '../../patient-record/ui/ClinicalRecordTabs.module.css'

export function ConsentsPanel({ api, filesApi, treatmentsApi, appointmentsApi, patientId, providerUserId, role }: {
  api: ConsentsApi
  filesApi?: FilesApi
  treatmentsApi?: TreatmentsApi
  appointmentsApi?: AppointmentsApi
  patientId: string
  providerUserId?: string
  role: string
}) {
  const consentsResource = useResource((signal) => api.listConsents(patientId, signal), [api, patientId])
  const templates = useResource((signal) => api.listTemplates(true, signal), [api])
  const retained = useRef<PatientConsent[]>([])
  if (consentsResource.state.status === 'ready') retained.current = consentsResource.state.data
  const consents = consentsResource.state.status === 'ready' ? consentsResource.state.data : retained.current
  const [creating, setCreating] = useState(false)
  const [selected, setSelected] = useState('')
  if (consentsResource.state.status === 'loading' && retained.current.length === 0) return <p role="status">Cargando consentimientos…</p>

  return <section className={styles.stack} aria-label="Consentimientos">
    <div className={styles.heading}><div><h3>Consentimientos</h3><p>La firma vincula datos humanos ingresados por el personal y evidencia inmutable.</p></div>{role !== 'BILLING' ? <Button size="sm" disabled={templates.state.status !== 'ready'} onClick={() => setCreating(true)}>Crear consentimiento</Button> : null}</div>
    {consentsResource.state.status === 'error' ? <FormAlert tone="error">{consentErrorMessage(consentsResource.state.error)} <Button size="sm" variant="secondary" onClick={() => void consentsResource.reload()}>Reintentar</Button></FormAlert> : null}
    {templates.state.status === 'error' ? <FormAlert tone="error">No se pudieron cargar las plantillas activas.</FormAlert> : null}
    {consentsResource.state.status === 'loading' ? <p role="status">Actualizando consentimientos…</p> : null}
    {consents.length ? <div className={styles.list}>{consents.map((item) => <button className={styles.rowButton} key={item.id} type="button" onClick={() => setSelected(item.id)}><strong>Consentimiento {item.id}</strong><span>{item.status} · {item.createdAt}</span></button>)}</div> : <p className={styles.empty}>No hay consentimientos registrados.</p>}
    {creating && templates.state.status === 'ready' ? <CreateConsentForm patientId={patientId} templates={templates.state.data} api={api} filesApi={filesApi} treatmentsApi={treatmentsApi} appointmentsApi={appointmentsApi} providerUserId={providerUserId} onCancel={() => setCreating(false)} onSave={async (input) => { await api.createConsent(input); setCreating(false); await consentsResource.reload() }} /> : null}
    {selected ? <ConsentDetail api={api} filesApi={filesApi} patientId={patientId} consentId={selected} role={role} onChanged={consentsResource.reload} /> : null}
  </section>
}

function CreateConsentForm({ patientId, templates, api, filesApi, treatmentsApi, appointmentsApi, providerUserId, onCancel, onSave }: {
  patientId: string
  templates: { id: string; name: string }[]
  api: ConsentsApi
  filesApi?: FilesApi
  treatmentsApi?: TreatmentsApi
  appointmentsApi?: AppointmentsApi
  providerUserId?: string
  onCancel: () => void
  onSave: (input: { patientId: string; templateVersionId: string; treatmentPlanId: string; appointmentId: string; documentFileId: string }) => Promise<void>
}) {
  const [templateId, setTemplateId] = useState('')
  const versions = useResource((signal) => templateId ? api.listTemplateVersions(templateId, signal) : Promise.resolve([]), [api, templateId])
  const plans = useResource((signal) => treatmentsApi ? treatmentsApi.listPlans(patientId, signal) : Promise.resolve([]), [treatmentsApi, patientId])
  const window = useMemo(() => toAgendaWindow(new Date(), 31), [])
  const appointments = useResource((signal) => appointmentsApi && providerUserId ? appointmentsApi.list({ ...window, patientId, providerUserId, signal }) : Promise.resolve([]), [appointmentsApi, patientId, providerUserId, window])
  const [templateVersionId, setVersion] = useState('')
  const [treatmentPlanId, setPlan] = useState('')
  const [appointmentId, setAppointment] = useState('')
  const [documentFileId, setDocument] = useState('')

  return <SaveForm title="Crear consentimiento" onCancel={onCancel} onSave={() => onSave({ patientId, templateVersionId, treatmentPlanId, appointmentId, documentFileId })}>
    <SelectField label="Plantilla activa" required value={templateId} options={[{ value: '', label: 'Seleccioná una plantilla' }, ...templates.map((item) => ({ value: item.id, label: item.name }))]} onChange={(event) => { setTemplateId(event.target.value); setVersion('') }} />
    {versions.state.status === 'loading' ? <p role="status">Cargando versiones…</p> : <SelectField label="Versión publicada" required value={templateVersionId} options={[{ value: '', label: 'Seleccioná una versión' }, ...(versions.state.status === 'ready' ? versions.state.data.map((item) => ({ value: item.id, label: `Versión ${item.versionNumber}` })) : [])]} onChange={(event) => setVersion(event.target.value)} />}
    {plans.state.status === 'ready' ? <SelectField label="Plan de tratamiento (opcional)" value={treatmentPlanId} options={[{ value: '', label: 'Sin plan vinculado' }, ...plans.state.data.map((plan) => ({ value: plan.id, label: `${plan.name} · ${plan.status}` }))]} onChange={(event) => setPlan(event.target.value)} /> : <TextField label="ID del plan de tratamiento (opcional)" hint="El selector de planes no está disponible; este campo es opcional." value={treatmentPlanId} onChange={(event) => setPlan(event.target.value)} />}
    {appointmentsApi && providerUserId && appointments.state.status === 'ready' ? <SelectField label="Cita reciente del profesional actual (opcional)" value={appointmentId} options={[{ value: '', label: 'Sin cita vinculada' }, ...appointments.state.data.map((appointment) => ({ value: appointment.id, label: `${appointment.startsAt} · ${appointment.status}` }))]} onChange={(event) => setAppointment(event.target.value)} /> : <TextField label="ID de cita (opcional)" hint="No hay un selector seguro de citas disponible para este contexto." value={appointmentId} onChange={(event) => setAppointment(event.target.value)} />}
    {filesApi ? <ConsentFileSelector api={filesApi} patientId={patientId} label="Documento de consentimiento CLEAN (opcional)" value={documentFileId} onChange={setDocument} /> : <p className={styles.subtle}>No hay selector de evidencia segura disponible en este contexto.</p>}
  </SaveForm>
}

function ConsentDetail({ api, filesApi, patientId, consentId, role, onChanged }: { api: ConsentsApi; filesApi?: FilesApi; patientId: string; consentId: string; role: string; onChanged: () => Promise<void> }) {
  const detail = useResource((signal) => api.getConsent(consentId, patientId, signal), [api, consentId, patientId])
  const signatures = useResource((signal) => api.listSignatures(consentId, patientId, signal), [api, consentId, patientId])
  const retained = useRef<PatientConsent | null>(null)
  if (detail.state.status === 'ready') retained.current = detail.state.data
  const consent = detail.state.status === 'ready' ? detail.state.data : retained.current
  if (!consent) return detail.state.status === 'error' ? <FormAlert tone="error">{consentErrorMessage(detail.state.error)}</FormAlert> : <p role="status">Verificando estado actual del consentimiento…</p>
  const ready = detail.state.status === 'ready'
  const reload = async () => { await detail.reload(); await signatures.reload(); await onChanged() }
  return <article className={styles.card} aria-busy={!ready}>
    {!ready ? <p role="status">Actualizando estado actual del consentimiento…</p> : null}
    {detail.state.status === 'error' ? <FormAlert tone="error">{consentErrorMessage(detail.state.error)}</FormAlert> : null}
    <p><Badge tone="neutral">{consent.status}</Badge> Versión {consent.version}</p>
    <p>Hash documental: {consent.documentHash || 'No disponible'}</p>
    {signatures.state.status === 'ready' ? <div className={styles.nested}><h5>Firmas registradas</h5>{signatures.state.data.length ? signatures.state.data.map((item) => <p key={item.id}>{item.signerName} · {item.method} · {item.signedAt}</p>) : <p className={styles.empty}>No hay firmas registradas.</p>}</div> : null}
    <ConsentActions api={api} filesApi={filesApi} consent={consent} patientId={patientId} role={role} ready={ready} reload={reload} />
  </article>
}

function SaveForm({ title, children, onCancel, onSave }: { title: string; children: React.ReactNode; onCancel: () => void; onSave: () => Promise<void> }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (inFlight.current) return
    inFlight.current = true
    setSaving(true)
    setError(null)
    try { await onSave() } catch (cause) { setError(consentErrorMessage(cause)) } finally { inFlight.current = false; setSaving(false) }
  }
  return <form className={styles.form} onSubmit={(event) => void submit(event)}><h5>{title}</h5>{error ? <FormAlert tone="error">{error}</FormAlert> : null}{children}<div className={styles.actions}><Button type="button" size="sm" variant="secondary" disabled={saving} onClick={onCancel}>Cancelar</Button><Button type="submit" size="sm" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</Button></div></form>
}
