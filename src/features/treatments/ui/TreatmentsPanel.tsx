import { type FormEvent, type ReactNode, useRef, useState } from 'react'
import { useResource } from '../../../shared/api/useResource'
import { Badge } from '../../../shared/ui/atoms/Badge'
import { Button } from '../../../shared/ui/atoms/Button'
import { SelectField, TextArea, TextField } from '../../../shared/ui/atoms/Field'
import { FormAlert } from '../../../shared/ui/molecules/FormAlert'
import type { ServicesApi } from '../../services/application/servicesApi'
import type { CatalogService } from '../../services/domain/service'
import styles from '../../patient-record/ui/ClinicalRecordTabs.module.css'
import type { TreatmentsApi } from '../application/treatmentsApi'
import {
  allowedItemTransitions,
  allowedPlanTransitions,
  isTreatmentConflict,
  treatmentErrorMessage,
  type TreatmentItem,
  type TreatmentPlan,
} from '../domain/treatment'

export interface TreatmentsPanelProps {
  api: TreatmentsApi
  servicesApi: ServicesApi
  patientId: string
  userId: string
  owner: boolean
}

export function TreatmentsPanel({ api, servicesApi, patientId, userId, owner }: TreatmentsPanelProps) {
  const plans = useResource((signal) => api.listPlans(patientId, signal), [api, patientId])
  const [creating, setCreating] = useState(false)
  const [selected, setSelected] = useState('')

  return (
    <section className={styles.stack} aria-label="Planes de tratamiento">
      <div className={styles.heading}>
        <div>
          <h3>Planes de tratamiento</h3>
          <p>Los importes se muestran exactamente como los devuelve el servicio.</p>
        </div>
        {owner ? <Button size="sm" onClick={() => setCreating(true)}>Nuevo plan</Button> : null}
      </div>
      <PlanList resource={plans} onSelect={setSelected} />
      {creating ? (
        <PlanForm
          patientId={patientId}
          userId={userId}
          onCancel={() => setCreating(false)}
          onSave={async (draft) => {
            await api.createPlan(draft)
            setCreating(false)
            await plans.reload()
          }}
        />
      ) : null}
      {selected ? <PlanDetail api={api} servicesApi={servicesApi} planId={selected} userId={userId} owner={owner} onChanged={plans.reload} /> : null}
    </section>
  )
}

function PlanList({ resource, onSelect }: { resource: ReturnType<typeof useResource<TreatmentPlan[]>>; onSelect: (id: string) => void }) {
  if (resource.state.status === 'loading') return <p role="status">Cargando planes de tratamiento…</p>
  if (resource.state.status === 'error') {
    return <FormAlert tone="error">{treatmentErrorMessage(resource.state.error)} <Button size="sm" variant="secondary" onClick={() => void resource.reload()}>Reintentar</Button></FormAlert>
  }
  if (!resource.state.data.length) return <p className={styles.empty}>No hay planes de tratamiento registrados.</p>
  return <div className={styles.list}>{resource.state.data.map((plan) => (
    <button className={styles.rowButton} type="button" key={plan.id} onClick={() => onSelect(plan.id)}>
      <strong>{plan.name}</strong><span>{plan.status} · {plan.currency} {plan.total}</span>
    </button>
  ))}</div>
}

interface PlanDraft {
  patientId: string
  providerUserId: string
  name: string
  currency: string
  notes: string
}

function PlanForm({ patientId, userId, onCancel, onSave }: { patientId: string; userId: string; onCancel: () => void; onSave: (draft: PlanDraft) => Promise<void> }) {
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('MXN')
  const [notes, setNotes] = useState('')
  return <MutationForm title="Nuevo plan de tratamiento" onCancel={onCancel} onSave={() => onSave({ patientId, providerUserId: userId, name, currency, notes })}>
    <TextField label="Nombre del plan" required value={name} onChange={(event) => setName(event.target.value)} />
    <TextField label="Moneda ISO" required maxLength={3} value={currency} onChange={(event) => setCurrency(event.target.value)} />
    <TextArea label="Notas" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
  </MutationForm>
}

function PlanDetail({ api, servicesApi, planId, userId, owner, onChanged }: { api: TreatmentsApi; servicesApi: ServicesApi; planId: string; userId: string; owner: boolean; onChanged: () => Promise<void> }) {
  const detail = useResource((signal) => api.getPlan(planId, signal), [api, planId])
  const items = useResource((signal) => api.listItems(planId, signal), [api, planId])
  const [mutationError, setMutationError] = useState<string | null>(null)
  const reload = async () => {
    await detail.reload()
    await items.reload()
    await onChanged()
  }

  return <article className={styles.card} aria-label="Detalle del plan">
    {mutationError ? <FormAlert tone="error">{mutationError}</FormAlert> : null}
    {detail.state.status === 'loading' ? <p role="status">Verificando estado actual del plan…</p> : null}
    {detail.state.status === 'error' ? <FormAlert tone="error">{treatmentErrorMessage(detail.state.error)}</FormAlert> : null}
    {detail.state.status === 'ready' ? <PlanContent api={api} servicesApi={servicesApi} plan={detail.state.data} items={items} userId={userId} owner={owner} reportError={setMutationError} reload={reload} /> : null}
  </article>
}

function PlanContent({ api, servicesApi, plan, items, userId, owner, reportError, reload }: { api: TreatmentsApi; servicesApi: ServicesApi; plan: TreatmentPlan; items: ReturnType<typeof useResource<TreatmentItem[]>>; userId: string; owner: boolean; reportError: (message: string) => void; reload: () => Promise<void> }) {
  const canMutate = owner && plan.providerUserId === userId
  const activeItems = items.state.status === 'ready' && items.state.data.some((item) => item.status !== 'CANCELLED')
  const planTransitions = allowedPlanTransitions(plan.status).filter((status) => status === 'CANCELLED' || activeItems)

  return <>
    <h4>{plan.name}</h4>
    <p><Badge tone="neutral">{plan.status}</Badge> Versión {plan.version} · Total {plan.currency} {plan.total}</p>
    <p>{plan.notes || 'Sin notas.'}</p>
    {canMutate ? <PlanActions api={api} plan={plan} transitions={planTransitions} reportError={reportError} reload={reload} /> : null}
    <PlanItems api={api} servicesApi={servicesApi} plan={plan} items={items} canMutate={canMutate} reportError={reportError} onChanged={reload} />
  </>
}

function PlanActions({ api, plan, transitions, reportError, reload }: { api: TreatmentsApi; plan: TreatmentPlan; transitions: string[]; reportError: (message: string) => void; reload: () => Promise<void> }) {
  const [status, setStatus] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false)
  const inFlight = useRef(false)
  if (!transitions.length) return null

  const confirm = async () => {
    if (!status || inFlight.current) return
    inFlight.current = true
    setPending(true)
    try {
      await api.transitionPlan(plan.id, plan.version, status)
      setConfirming(false)
      await reload()
    } catch (cause) {
      reportError(treatmentErrorMessage(cause))
      if (isTreatmentConflict(cause)) await reload()
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }

  return <div className={styles.actions}>
    <SelectField label="Cambiar estado" value={status} options={[{ value: '', label: 'Selecciona una transición' }, ...transitions]} disabled={pending} onChange={(event) => setStatus(event.target.value)} />
    {confirming ? <div className={styles.confirm} role="alertdialog" aria-label="Confirmar cambio de estado del plan">
      <p>¿Confirmas cambiar el estado a {status}? Este cambio puede ser irreversible.</p>
      <Button size="sm" variant="secondary" disabled={pending} onClick={() => setConfirming(false)}>Cancelar</Button>
      <Button size="sm" disabled={pending} onClick={() => void confirm()}>{pending ? 'Guardando…' : 'Confirmar cambio'}</Button>
    </div> : <Button size="sm" disabled={!status || pending} onClick={() => setConfirming(true)}>Cambiar estado</Button>}
  </div>
}

function PlanItems({ api, servicesApi, plan, items, canMutate, reportError, onChanged }: { api: TreatmentsApi; servicesApi: ServicesApi; plan: TreatmentPlan; items: ReturnType<typeof useResource<TreatmentItem[]>>; canMutate: boolean; reportError: (message: string) => void; onChanged: () => Promise<void> }) {
  const [adding, setAdding] = useState(false)
  const [historyId, setHistoryId] = useState('')
  const canAdd = canMutate && plan.status === 'DRAFT'
  const itemTransitions = (item: TreatmentItem) => canMutate && !['COMPLETED', 'CANCELLED'].includes(plan.status) ? allowedItemTransitions(item.status).filter((status) => status === 'CANCELLED' || plan.status === 'ACCEPTED' || plan.status === 'IN_PROGRESS') : []

  return <div className={styles.nested}>
    <div className={styles.heading}><h5>Procedimientos</h5>{canAdd ? <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>Agregar procedimiento</Button> : null}</div>
    {items.state.status === 'loading' ? <p role="status">Cargando procedimientos…</p> : null}
    {items.state.status === 'error' ? <FormAlert tone="error">{treatmentErrorMessage(items.state.error)} <Button size="sm" variant="secondary" onClick={() => void items.reload()}>Reintentar</Button></FormAlert> : null}
    {items.state.status === 'ready' && (items.state.data.length ? <div className={styles.list}>{items.state.data.map((item) => <ItemRow key={item.id} api={api} item={item} planVersion={plan.version} transitions={itemTransitions(item)} reportError={reportError} onChanged={onChanged} onHistory={() => setHistoryId(item.id)} />)}</div> : <p className={styles.empty}>No hay procedimientos registrados.</p>)}
    {adding ? <ItemForm servicesApi={servicesApi} onCancel={() => setAdding(false)} onSave={async (input) => { await api.addItem(plan.id, plan.version, input); setAdding(false); await onChanged() }} /> : null}
    {historyId ? <ItemHistory api={api} planId={plan.id} itemId={historyId} /> : null}
  </div>
}

function ItemRow({ api, item, planVersion, transitions, reportError, onChanged, onHistory }: { api: TreatmentsApi; item: TreatmentItem; planVersion: number; transitions: string[]; reportError: (message: string) => void; onChanged: () => Promise<void>; onHistory: () => void }) {
  const [status, setStatus] = useState('')
  const [reason, setReason] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const inFlight = useRef(false)

  const confirm = async () => {
    if (!status || inFlight.current) return
    if (status === 'CANCELLED' && !reason.trim()) {
      setValidationError('Indicá el motivo de la cancelación.')
      return
    }
    inFlight.current = true
    setPending(true)
    setValidationError(null)
    try {
      await api.transitionItem(item.treatmentPlanId, item.id, planVersion, item.version, status, status === 'CANCELLED' ? reason.trim() : '')
      setConfirming(false)
      await onChanged()
    } catch (cause) {
      reportError(treatmentErrorMessage(cause))
      if (isTreatmentConflict(cause)) await onChanged()
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }

  return <div className={styles.listItem}>
    <strong>{item.lineNumber}. {item.description}</strong>
    <p>{item.status} · {item.quantity} × {item.unitPrice} · Total {item.total}</p>
    <Button size="sm" variant="secondary" onClick={onHistory}>Ver historial</Button>
    {transitions.length ? <div className={styles.actions}>
      <SelectField label="Cambiar estado del procedimiento" value={status} options={[{ value: '', label: 'Selecciona una transición' }, ...transitions]} disabled={pending} onChange={(event) => setStatus(event.target.value)} />
      {confirming ? <div className={styles.confirm} role="alertdialog" aria-label="Confirmar cambio de estado del procedimiento">
        <p>¿Confirmas cambiar el procedimiento a {status}?</p>
        {status === 'CANCELLED' ? <TextArea label="Motivo de cancelación" required rows={3} value={reason} error={validationError ?? undefined} onChange={(event) => setReason(event.target.value)} /> : null}
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => setConfirming(false)}>Cancelar</Button>
        <Button size="sm" disabled={pending} onClick={() => void confirm()}>{pending ? 'Guardando…' : 'Confirmar cambio del procedimiento'}</Button>
      </div> : <Button size="sm" variant="secondary" disabled={!status || pending} onClick={() => setConfirming(true)}>Cambiar estado del procedimiento {item.description}</Button>}
    </div> : null}
  </div>
}

interface ItemDraft {
  serviceId: string
  quantity: string
  discount: string
  toothNumber?: number
  surfaces: string[]
}

const fdiTeeth = [
  ...[1, 2, 3, 4].flatMap((quadrant) => [1, 2, 3, 4, 5, 6, 7, 8].map((tooth) => quadrant * 10 + tooth)),
  ...[5, 6, 7, 8].flatMap((quadrant) => [1, 2, 3, 4, 5].map((tooth) => quadrant * 10 + tooth)),
]

function surfacesFor(tooth: string) {
  const position = Number(tooth) % 10
  if (!tooth || !Number.isInteger(position)) return []
  return ['MESIAL', 'DISTAL', 'BUCCAL', 'LINGUAL', position >= 4 ? 'OCCLUSAL' : 'INCISAL']
}

function ItemForm({ servicesApi, onCancel, onSave }: { servicesApi: ServicesApi; onCancel: () => void; onSave: (input: ItemDraft) => Promise<void> }) {
  const services = useResource(() => servicesApi.list(), [servicesApi])
  const [serviceId, setServiceId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [discount, setDiscount] = useState('0')
  const [tooth, setTooth] = useState('')
  const [surfaces, setSurfaces] = useState<string[]>([])
  const surfaceOptions = surfacesFor(tooth)

  return <MutationForm title="Agregar procedimiento" onCancel={onCancel} onSave={() => onSave({ serviceId, quantity, discount, toothNumber: tooth ? Number(tooth) : undefined, surfaces })}>
    <ServiceSelector resource={services} serviceId={serviceId} onChange={setServiceId} />
    <TextField label="Cantidad decimal" required value={quantity} onChange={(event) => setQuantity(event.target.value)} />
    <TextField label="Descuento decimal" required value={discount} onChange={(event) => setDiscount(event.target.value)} />
    <SelectField label="Pieza FDI (opcional)" value={tooth} options={[{ value: '', label: 'Sin pieza asociada' }, ...fdiTeeth.map((value) => String(value))]} onChange={(event) => { setTooth(event.target.value); setSurfaces([]) }} />
    {surfaceOptions.length ? <SelectField multiple label="Superficies de la pieza" value={surfaces} options={surfaceOptions} onChange={(event) => setSurfaces(Array.from(event.currentTarget.selectedOptions, (option) => option.value))} /> : null}
  </MutationForm>
}

function ServiceSelector({ resource, serviceId, onChange }: { resource: ReturnType<typeof useResource<CatalogService[]>>; serviceId: string; onChange: (id: string) => void }) {
  if (resource.state.status === 'loading') return <p role="status">Cargando catálogo de servicios…</p>
  if (resource.state.status === 'error') return <FormAlert tone="error">No se pudo cargar el catálogo de servicios. <Button size="sm" variant="secondary" onClick={() => void resource.reload()}>Reintentar</Button></FormAlert>
  return <SelectField label="Servicio del catálogo" required value={serviceId} options={[{ value: '', label: 'Selecciona un servicio' }, ...resource.state.data.map((service) => ({ value: service.id, label: `${service.code} · ${service.name} · ${service.defaultPrice} ${service.currency}` }))]} onChange={(event) => onChange(event.target.value)} />
}

function ItemHistory({ api, planId, itemId }: { api: TreatmentsApi; planId: string; itemId: string }) {
  const history = useResource((signal) => api.listHistory(planId, itemId, signal), [api, planId, itemId])
  if (history.state.status === 'loading') return <p role="status">Cargando historial…</p>
  if (history.state.status === 'error') return <FormAlert tone="error">{treatmentErrorMessage(history.state.error)}</FormAlert>
  return <div className={styles.nested}><h5>Historial del procedimiento</h5>{history.state.data.length ? history.state.data.map((entry) => <p key={entry.id}>{entry.fromStatus || 'Creado'} → {entry.toStatus}{entry.reason ? ` · ${entry.reason}` : ''}</p>) : <p className={styles.empty}>No hay cambios registrados.</p>}</div>
}

function MutationForm({ title, children, onCancel, onSave }: { title: string; children: ReactNode; onCancel: () => void; onSave: () => Promise<void> }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (inFlight.current) return
    inFlight.current = true
    setSaving(true)
    setError(null)
    try {
      await onSave()
    } catch (cause) {
      setError(treatmentErrorMessage(cause))
    } finally {
      inFlight.current = false
      setSaving(false)
    }
  }
  return <form className={styles.form} onSubmit={submit}><h5>{title}</h5>{error ? <FormAlert tone="error">{error}</FormAlert> : null}{children}<div className={styles.actions}><Button type="button" size="sm" variant="secondary" disabled={saving} onClick={onCancel}>Cancelar</Button><Button type="submit" size="sm" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</Button></div></form>
}
