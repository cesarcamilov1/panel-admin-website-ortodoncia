/* oxlint-disable react/refs -- retained snapshots keep selected detail mounted during authoritative refreshes. */
import { type FormEvent, useRef, useState } from 'react'
import { useResource } from '../../../shared/api/useResource'
import { Badge } from '../../../shared/ui/atoms/Badge'
import { Button } from '../../../shared/ui/atoms/Button'
import { SelectField, TextArea, TextField } from '../../../shared/ui/atoms/Field'
import { FormAlert } from '../../../shared/ui/molecules/FormAlert'
import type { ClinicalApi } from '../../patient-record/application/clinicalApi'
import type { TreatmentsApi } from '../../treatments/application/treatmentsApi'
import type { OrthodonticsApi } from '../application/orthodonticsApi'
import { allowedCaseTransitions, orthodonticsErrorMessage, type OrthodonticCase } from '../domain/orthodontics'
import { OrthodonticCaseActions } from './OrthodonticCaseActions'
import styles from '../../patient-record/ui/ClinicalRecordTabs.module.css'

export function OrthodonticsPanel({ api, clinicalApi, treatmentsApi, patientId, userId, owner }: { api: OrthodonticsApi; clinicalApi: ClinicalApi; treatmentsApi?: TreatmentsApi; patientId: string; userId: string; owner: boolean }) {
  const [afterId, setAfterId] = useState<string | undefined>()
  const casesResource = useResource((signal) => api.listCases(patientId, afterId, signal), [api, patientId, afterId])
  const retained = useRef<OrthodonticCase[]>([])
  if (casesResource.state.status === 'ready') retained.current = casesResource.state.data
  const cases = casesResource.state.status === 'ready' ? casesResource.state.data : retained.current
  const [creating, setCreating] = useState(false)
  const [selected, setSelected] = useState('')
  if (casesResource.state.status === 'loading' && retained.current.length === 0) return <p role="status">Cargando casos de ortodoncia…</p>
  return <section className={styles.stack} aria-label="Ortodoncia">
    <div className={styles.heading}><div><h3>Casos de ortodoncia</h3><p>La paginación usa el último identificador devuelto por el backend.</p></div>{owner ? <Button size="sm" onClick={() => setCreating(true)}>Nuevo caso</Button> : null}</div>
    {casesResource.state.status === 'error' ? <FormAlert tone="error">{orthodonticsErrorMessage(casesResource.state.error)} <Button size="sm" variant="secondary" onClick={() => void casesResource.reload()}>Reintentar</Button></FormAlert> : null}
    {casesResource.state.status === 'loading' ? <p role="status">Actualizando casos…</p> : null}
    {cases.length ? <div className={styles.list}>{cases.map((item) => <button className={styles.rowButton} key={item.id} type="button" onClick={() => setSelected(item.id)}><strong>Caso {item.id}</strong><span>{item.status} · {item.startedOn || 'Sin fecha de inicio'}</span></button>)}</div> : <p className={styles.empty}>No hay casos de ortodoncia registrados.</p>}
    {cases.length === 25 ? <Button size="sm" variant="secondary" onClick={() => setAfterId(cases.at(-1)?.id)}>Página siguiente</Button> : null}
    {afterId ? <Button size="sm" variant="secondary" onClick={() => setAfterId(undefined)}>Primera página</Button> : null}
    {creating ? <CaseForm patientId={patientId} userId={userId} treatmentsApi={treatmentsApi} onCancel={() => setCreating(false)} onSave={async (input) => { await api.createCase(input); setCreating(false); await casesResource.reload() }} /> : null}
    {selected ? <CaseDetail api={api} clinicalApi={clinicalApi} caseId={selected} owner={owner} userId={userId} onChanged={casesResource.reload} /> : null}
  </section>
}

function CaseForm({ patientId, userId, treatmentsApi, onCancel, onSave }: { patientId: string; userId: string; treatmentsApi?: TreatmentsApi; onCancel: () => void; onSave: (input: { patientId: string; providerUserId: string; treatmentPlanId: string; startedOn: string; estimatedEndOn: string; monthlyFee: string; currency: string; notes: string }) => Promise<void> }) {
  const plans = useResource((signal) => treatmentsApi ? treatmentsApi.listPlans(patientId, signal) : Promise.resolve([]), [treatmentsApi, patientId])
  const [treatmentPlanId, setPlan] = useState(''); const [startedOn, setStarted] = useState(''); const [estimatedEndOn, setEnd] = useState(''); const [monthlyFee, setFee] = useState(''); const [currency, setCurrency] = useState('MXN'); const [notes, setNotes] = useState('')
  return <SaveForm title="Nuevo caso de ortodoncia" onCancel={onCancel} onSave={() => onSave({ patientId, providerUserId: userId, treatmentPlanId, startedOn, estimatedEndOn, monthlyFee, currency, notes })}>
    {plans.state.status === 'loading' ? <p role="status">Cargando planes de tratamiento…</p> : plans.state.status === 'ready' ? <SelectField label="Plan de tratamiento (opcional)" value={treatmentPlanId} options={[{ value: '', label: 'Sin plan vinculado' }, ...plans.state.data.map((plan) => ({ value: plan.id, label: `${plan.name} · ${plan.status}` }))]} onChange={(event) => setPlan(event.target.value)} /> : <TextField label="ID del plan de tratamiento (opcional)" hint="No se pudo cargar el selector de planes del paciente; podés dejar este campo vacío." value={treatmentPlanId} onChange={(event) => setPlan(event.target.value)} />}
    <TextField label="Inicio" type="date" value={startedOn} onChange={(event) => setStarted(event.target.value)} /><TextField label="Fin estimado" type="date" value={estimatedEndOn} onChange={(event) => setEnd(event.target.value)} /><TextField label="Mensualidad decimal (opcional)" value={monthlyFee} onChange={(event) => setFee(event.target.value)} /><TextField label="Moneda ISO" required maxLength={3} value={currency} onChange={(event) => setCurrency(event.target.value)} /><TextArea label="Notas" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
  </SaveForm>
}

function CaseDetail({ api, clinicalApi, caseId, owner, userId, onChanged }: { api: OrthodonticsApi; clinicalApi: ClinicalApi; caseId: string; owner: boolean; userId: string; onChanged: () => Promise<void> }) {
  const detail = useResource((signal) => api.getCase(caseId, signal), [api, caseId]); const retained = useRef<OrthodonticCase | null>(null); if (detail.state.status === 'ready') retained.current = detail.state.data; const item = detail.state.status === 'ready' ? detail.state.data : retained.current
  if (!item) return detail.state.status === 'error' ? <FormAlert tone="error">{orthodonticsErrorMessage(detail.state.error)}</FormAlert> : <p role="status">Verificando estado actual del caso…</p>
  const ready = detail.state.status === 'ready'; const reload = async () => { await detail.reload(); await onChanged() }
  return <article className={styles.card} aria-busy={!ready}>{!ready ? <p role="status">Actualizando estado actual del caso…</p> : null}{detail.state.status === 'error' ? <FormAlert tone="error">{orthodonticsErrorMessage(detail.state.error)}</FormAlert> : null}<p><Badge tone="neutral">{item.status}</Badge> Versión {item.version}</p><p>{item.notes || 'Sin notas.'}</p>{owner && item.providerUserId === userId && allowedCaseTransitions(item.status).length ? <OrthodonticCaseActions api={api} item={item} ready={ready} reload={reload} /> : null}<Visits api={api} clinicalApi={clinicalApi} item={item} owner={owner && item.providerUserId === userId} ready={ready} onChanged={reload} /></article>
}

function Visits({ api, clinicalApi, item, owner, ready, onChanged }: { api: OrthodonticsApi; clinicalApi: ClinicalApi; item: OrthodonticCase; owner: boolean; ready: boolean; onChanged: () => Promise<void> }) {
  const visits = useResource((signal) => api.listVisits(item.id, undefined, signal), [api, item.id]); const [adding, setAdding] = useState(false)
  return <div className={styles.nested}><div className={styles.heading}><h5>Visitas</h5>{owner && ready && !['COMPLETED', 'CANCELLED'].includes(item.status) ? <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>Registrar visita</Button> : null}</div>{visits.state.status === 'loading' ? <p role="status">Cargando visitas…</p> : visits.state.status === 'error' ? <FormAlert tone="error">{orthodonticsErrorMessage(visits.state.error)}</FormAlert> : visits.state.data.length ? visits.state.data.map((visit) => <p key={visit.id}><strong>{visit.createdAt}</strong> · {[visit.upperArchwire, visit.lowerArchwire, visit.elastics, visit.procedures].filter(Boolean).join(' · ') || 'Sin detalle técnico'}</p>) : <p className={styles.empty}>No hay visitas registradas.</p>}{adding ? <VisitForm clinicalApi={clinicalApi} patientId={item.patientId} onCancel={() => setAdding(false)} onSave={async (input) => { await api.addVisit(item.id, item.version, input); setAdding(false); await visits.reload(); await onChanged() }} /> : null}</div>
}

function VisitForm({ clinicalApi, patientId, onCancel, onSave }: { clinicalApi: ClinicalApi; patientId: string; onCancel: () => void; onSave: (input: { appointmentId: string; encounterId: string; upperArchwire: string; lowerArchwire: string; elastics: string; procedures: string; observations: string; nextVisitNotes: string }) => Promise<void> }) {
  const encounters = useResource((signal) => clinicalApi.listEncounters(patientId, signal), [clinicalApi, patientId]); const [encounterId, setEncounter] = useState(''); const [upperArchwire, setUpper] = useState(''); const [lowerArchwire, setLower] = useState(''); const [elastics, setElastics] = useState(''); const [procedures, setProcedures] = useState(''); const [observations, setObservations] = useState(''); const [nextVisitNotes, setNext] = useState('')
  return <SaveForm title="Registrar visita" onCancel={onCancel} onSave={() => onSave({ appointmentId: '', encounterId, upperArchwire, lowerArchwire, elastics, procedures, observations, nextVisitNotes })}>{encounters.state.status === 'ready' ? <SelectField label="Atención vinculada (opcional)" value={encounterId} options={[{ value: '', label: 'Sin atención vinculada' }, ...encounters.state.data.map((entry) => ({ value: entry.id, label: `${entry.status} · ${entry.startedAt}` }))]} onChange={(event) => setEncounter(event.target.value)} /> : null}<TextField label="Arco superior" value={upperArchwire} onChange={(event) => setUpper(event.target.value)} /><TextField label="Arco inferior" value={lowerArchwire} onChange={(event) => setLower(event.target.value)} /><TextField label="Elásticos" value={elastics} onChange={(event) => setElastics(event.target.value)} /><TextArea label="Procedimientos" rows={2} value={procedures} onChange={(event) => setProcedures(event.target.value)} /><TextArea label="Observaciones" rows={2} value={observations} onChange={(event) => setObservations(event.target.value)} /><TextArea label="Indicaciones próxima visita" rows={2} value={nextVisitNotes} onChange={(event) => setNext(event.target.value)} /></SaveForm>
}

function SaveForm({ title, children, onCancel, onSave }: { title: string; children: React.ReactNode; onCancel: () => void; onSave: () => Promise<void> }) { const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null); const inFlight = useRef(false); const submit = async (event: FormEvent) => { event.preventDefault(); if (inFlight.current) return; inFlight.current = true; setSaving(true); setError(null); try { await onSave() } catch (cause) { setError(orthodonticsErrorMessage(cause)) } finally { inFlight.current = false; setSaving(false) } }; return <form className={styles.form} onSubmit={(event) => void submit(event)}><h5>{title}</h5>{error ? <FormAlert tone="error">{error}</FormAlert> : null}{children}<div className={styles.actions}><Button type="button" size="sm" variant="secondary" disabled={saving} onClick={onCancel}>Cancelar</Button><Button type="submit" size="sm" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</Button></div></form> }
