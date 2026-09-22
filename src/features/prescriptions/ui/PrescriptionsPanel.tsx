/* oxlint-disable react/refs -- retained snapshots keep selected detail mounted during authoritative refreshes. */
import { type FormEvent, useRef, useState } from 'react'
import { useResource } from '../../../shared/api/useResource'
import { Badge } from '../../../shared/ui/atoms/Badge'
import { Button } from '../../../shared/ui/atoms/Button'
import { SelectField, TextArea, TextField } from '../../../shared/ui/atoms/Field'
import { FormAlert } from '../../../shared/ui/molecules/FormAlert'
import type { ClinicalApi } from '../../patient-record/application/clinicalApi'
import type { PrescriptionsApi } from '../application/prescriptionsApi'
import { canEditPrescription, prescriptionErrorMessage, type Prescription } from '../domain/prescription'
import { PrescriptionActions } from './PrescriptionActions'
import styles from '../../patient-record/ui/ClinicalRecordTabs.module.css'

export function PrescriptionsPanel({ api, clinicalApi, patientId, userId, role }: { api: PrescriptionsApi; clinicalApi: ClinicalApi; patientId: string; userId: string; role: string }) {
  const resource = useResource((signal) => api.list(patientId, signal), [api, patientId])
  const retained = useRef<Prescription[]>([])
  if (resource.state.status === 'ready') retained.current = resource.state.data
  const prescriptions = resource.state.status === 'ready' ? resource.state.data : retained.current
  const [creating, setCreating] = useState(false)
  const [selected, setSelected] = useState('')
  const initialLoading = resource.state.status === 'loading' && retained.current.length === 0

  if (initialLoading) return <p role="status">Cargando recetas…</p>
  return <section className={styles.stack} aria-label="Recetas">
    <div className={styles.heading}><div><h3>Recetas</h3><p>Las recetas emitidas o anuladas no se pueden modificar.</p></div>{role !== 'BILLING' ? <Button size="sm" onClick={() => setCreating(true)}>Nueva receta</Button> : null}</div>
    {resource.state.status === 'error' ? <FormAlert tone="error">{prescriptionErrorMessage(resource.state.error)} <Button size="sm" variant="secondary" onClick={() => void resource.reload()}>Reintentar</Button></FormAlert> : null}
    {resource.state.status === 'loading' ? <p role="status">Actualizando recetas…</p> : null}
    {prescriptions.length ? <div className={styles.list}>{prescriptions.map((item) => <button className={styles.rowButton} type="button" key={item.id} onClick={() => setSelected(item.id)}><strong>Receta {item.id}</strong><span>{item.status} · {item.issuedAt || item.createdAt}</span></button>)}</div> : <p className={styles.empty}>No hay recetas registradas.</p>}
    {creating ? <PrescriptionForm clinicalApi={clinicalApi} patientId={patientId} userId={userId} onCancel={() => setCreating(false)} onSave={async (input) => { await api.create(input); setCreating(false); await resource.reload() }} /> : null}
    {selected ? <PrescriptionDetail api={api} prescriptionId={selected} userId={userId} role={role} onChanged={resource.reload} /> : null}
  </section>
}

function PrescriptionForm({ clinicalApi, patientId, userId, onCancel, onSave }: { clinicalApi: ClinicalApi; patientId: string; userId: string; onCancel: () => void; onSave: (input: { patientId: string; providerUserId: string; encounterId?: string; instructions: string }) => Promise<void> }) {
  const encounters = useResource((signal) => clinicalApi.listEncounters(patientId, signal), [clinicalApi, patientId])
  const [encounterId, setEncounterId] = useState('')
  const [instructions, setInstructions] = useState('')
  return <SaveForm title="Nueva receta" onCancel={onCancel} onSave={() => onSave({ patientId, providerUserId: userId, encounterId: encounterId || undefined, instructions })}>
    {encounters.state.status === 'loading' ? <p role="status">Cargando atenciones…</p> : encounters.state.status === 'error' ? <FormAlert tone="error">No se pudieron cargar las atenciones opcionales.</FormAlert> : <SelectField label="Atención vinculada (opcional)" value={encounterId} options={[{ value: '', label: 'Sin atención vinculada' }, ...encounters.state.data.map((item) => ({ value: item.id, label: `${item.status} · ${item.startedAt}` }))]} onChange={(event) => setEncounterId(event.target.value)} />}
    <TextArea label="Indicaciones" rows={3} value={instructions} onChange={(event) => setInstructions(event.target.value)} />
  </SaveForm>
}

function PrescriptionDetail({ api, prescriptionId, userId, role, onChanged }: { api: PrescriptionsApi; prescriptionId: string; userId: string; role: string; onChanged: () => Promise<void> }) {
  const detail = useResource((signal) => api.get(prescriptionId, signal), [api, prescriptionId])
  const retained = useRef<Prescription | null>(null)
  if (detail.state.status === 'ready') retained.current = detail.state.data
  const prescription = detail.state.status === 'ready' ? detail.state.data : retained.current
  if (!prescription) return detail.state.status === 'error' ? <FormAlert tone="error">{prescriptionErrorMessage(detail.state.error)}</FormAlert> : <p role="status">Verificando estado actual de la receta…</p>
  const ready = detail.state.status === 'ready'
  const reload = async () => { await detail.reload(); await onChanged() }
  return <article className={styles.card} aria-busy={!ready}>
    {!ready ? <p role="status">Actualizando estado actual de la receta…</p> : null}
    {detail.state.status === 'error' ? <FormAlert tone="error">{prescriptionErrorMessage(detail.state.error)}</FormAlert> : null}
    <p><Badge tone="neutral">{prescription.status}</Badge> Versión {prescription.version}</p>
    <PrescriptionItems api={api} prescription={prescription} editable={ready && canEditPrescription(prescription) && role !== 'BILLING' && (role !== 'OWNER_DENTIST' || prescription.providerUserId === userId)} onChanged={reload} />
    {canEditPrescription(prescription) && role !== 'BILLING' && (role !== 'OWNER_DENTIST' || prescription.providerUserId === userId) ? <InstructionsForm api={api} prescription={prescription} ready={ready} onChanged={reload} /> : <p className={styles.subtle}>Las indicaciones son inmutables una vez emitida o anulada la receta.</p>}
    <PrescriptionActions api={api} prescription={prescription} role={role} userId={userId} ready={ready} reload={reload} />
  </article>
}

function PrescriptionItems({ api, prescription, editable, onChanged }: { api: PrescriptionsApi; prescription: Prescription; editable: boolean; onChanged: () => Promise<void> }) {
  const items = useResource((signal) => api.listItems(prescription.id, signal), [api, prescription.id])
  const [adding, setAdding] = useState(false)
  return <div className={styles.nested}><div className={styles.heading}><h5>Medicamentos</h5>{editable ? <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>Agregar medicamento</Button> : null}</div>{items.state.status === 'loading' ? <p role="status">Cargando medicamentos…</p> : items.state.status === 'error' ? <FormAlert tone="error">{prescriptionErrorMessage(items.state.error)}</FormAlert> : items.state.data.length ? items.state.data.map((item) => <p key={item.id}><strong>{item.lineNumber}. {item.medication}</strong> · {item.dose} · {item.frequency} · {item.duration}</p>) : <p className={styles.empty}>No hay medicamentos registrados.</p>}{adding ? <MedicationForm nextLine={(items.state.status === 'ready' ? items.state.data.length : 0) + 1} onCancel={() => setAdding(false)} onSave={async (input) => { await api.addItem(prescription.id, prescription.version, input); setAdding(false); await items.reload(); await onChanged() }} /> : null}</div>
}

function MedicationForm({ nextLine, onCancel, onSave }: { nextLine: number; onCancel: () => void; onSave: (input: { lineNumber: number; medication: string; presentation: string; dose: string; route: string; frequency: string; duration: string; instructions: string }) => Promise<void> }) {
  const [medication, setMedication] = useState(''); const [presentation, setPresentation] = useState(''); const [dose, setDose] = useState(''); const [route, setRoute] = useState(''); const [frequency, setFrequency] = useState(''); const [duration, setDuration] = useState(''); const [instructions, setInstructions] = useState('')
  return <SaveForm title="Agregar medicamento" onCancel={onCancel} onSave={() => onSave({ lineNumber: nextLine, medication, presentation, dose, route, frequency, duration, instructions })}><TextField label="Medicamento" required value={medication} onChange={(event) => setMedication(event.target.value)} /><TextField label="Presentación" value={presentation} onChange={(event) => setPresentation(event.target.value)} /><TextField label="Dosis" required value={dose} onChange={(event) => setDose(event.target.value)} /><TextField label="Vía" value={route} onChange={(event) => setRoute(event.target.value)} /><TextField label="Frecuencia" required value={frequency} onChange={(event) => setFrequency(event.target.value)} /><TextField label="Duración" required value={duration} onChange={(event) => setDuration(event.target.value)} /><TextArea label="Indicaciones del medicamento" rows={2} value={instructions} onChange={(event) => setInstructions(event.target.value)} /></SaveForm>
}

function InstructionsForm({ api, prescription, ready, onChanged }: { api: PrescriptionsApi; prescription: Prescription; ready: boolean; onChanged: () => Promise<void> }) {
  const [editing, setEditing] = useState(false); const [instructions, setInstructions] = useState(prescription.instructions)
  return editing ? <SaveForm title="Editar indicaciones" onCancel={() => setEditing(false)} onSave={async () => { await api.update(prescription.id, prescription.version, instructions); setEditing(false); await onChanged() }}><TextArea label="Indicaciones" rows={3} value={instructions} onChange={(event) => setInstructions(event.target.value)} /></SaveForm> : <div className={styles.actions}><p>{prescription.instructions || 'Sin indicaciones generales.'}</p><Button size="sm" variant="secondary" disabled={!ready} onClick={() => setEditing(true)}>Editar indicaciones</Button></div>
}

function SaveForm({ title, children, onCancel, onSave }: { title: string; children: React.ReactNode; onCancel: () => void; onSave: () => Promise<void> }) {
  const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null); const inFlight = useRef(false)
  const submit = async (event: FormEvent) => { event.preventDefault(); if (inFlight.current) return; inFlight.current = true; setSaving(true); setError(null); try { await onSave() } catch (cause) { setError(prescriptionErrorMessage(cause)) } finally { inFlight.current = false; setSaving(false) } }
  return <form className={styles.form} onSubmit={(event) => void submit(event)}><h5>{title}</h5>{error ? <FormAlert tone="error">{error}</FormAlert> : null}{children}<div className={styles.actions}><Button type="button" size="sm" variant="secondary" disabled={saving} onClick={onCancel}>Cancelar</Button><Button type="submit" size="sm" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</Button></div></form>
}
