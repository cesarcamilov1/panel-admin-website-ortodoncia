import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../../../../shared/ui/atoms/Button'
import { SelectField, TextArea, TextField } from '../../../../shared/ui/atoms/Field'
import { FormAlert } from '../../../../shared/ui/molecules/FormAlert'
import { useAuth } from '../../../auth/application/authContext'
import { useLocationsApi } from '../../../locations/application/useLocationsApi'
import type { PracticeLocation } from '../../../locations/domain/location'
import { usePatientsApi } from '../../../patients/application/usePatientsApi'
import type { PatientSummary } from '../../../patients/domain/patient'
import { useServicesApi } from '../../../services/application/useServicesApi'
import type { CatalogService } from '../../../services/domain/service'
import { useAppointmentsApi } from '../../application/useAppointmentsApi'
import { appointmentErrorMessage } from '../../domain/appointment'
import { CloseIcon } from '../../../../shared/ui/atoms/icons'
import styles from './NewAppointmentModal.module.css'

interface NewAppointmentModalProps {
  onClose: () => void
  onCreated?: () => void
  preselectedPatientId?: string
  providerUserId?: string
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function newAttemptKey(): string {
  return globalThis.crypto.randomUUID()
}

/** Staff booking deliberately accepts an explicit datetime: this panel has no private availability endpoint. */
export function NewAppointmentModal({ onClose, onCreated, preselectedPatientId, providerUserId: initialProviderUserId }: NewAppointmentModalProps) {
  const { state: auth } = useAuth()
  const appointments = useAppointmentsApi()
  const patientsApi = usePatientsApi()
  const servicesApi = useServicesApi()
  const locationsApi = useLocationsApi()
  const [patients, setPatients] = useState<PatientSummary[]>([])
  const [services, setServices] = useState<CatalogService[]>([])
  const [locationServices, setLocationServices] = useState<CatalogService[] | null>(null)
  const [locations, setLocations] = useState<PracticeLocation[]>([])
  const [assistantProviderId, setAssistantProviderId] = useState(initialProviderUserId ?? '')
  const [patientId, setPatientId] = useState(preselectedPatientId ?? '')
  const [serviceId, setServiceId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [source, setSource] = useState('MANUAL')
  const [reason, setReason] = useState('')
  const [internalNotes, setInternalNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const isAssistant = auth.status === 'authenticated' && auth.user.role === 'ASSISTANT'
  const providerUserId = auth.status !== 'authenticated' ? '' : isAssistant ? assistantProviderId.trim() : auth.user.id
  const hasValidProvider = Boolean(providerUserId) && (!isAssistant || UUID_PATTERN.test(providerUserId))
  const selectedLocation = useMemo(() => locations.find((location) => location.id === locationId), [locationId, locations])
  const availableServices = selectedLocation?.allServices === false ? locationServices ?? [] : services
  const fingerprint = `${providerUserId}|${patientId}|${serviceId}|${locationId}|${startsAt}|${source}|${reason}|${internalNotes}`
  const attempt = useRef<{ fingerprint: string; key: string } | null>(null)

  useEffect(() => {
    if (auth.status !== 'authenticated') return
    const controller = new AbortController()
    void Promise.all([
      patientsApi.list({ limit: 100, signal: controller.signal }),
      servicesApi.list(),
    ]).then(([patientPage, catalog]) => {
      if (controller.signal.aborted) return
      setPatients(patientPage.items)
      setServices(catalog.filter((service) => service.isActive))
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(appointmentErrorMessage(cause))
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [auth.status, patientsApi, servicesApi])

  useEffect(() => {
    if (!hasValidProvider) return
    const controller = new AbortController()
    void locationsApi.list({ providerUserId }).then((offices) => {
      if (controller.signal.aborted) return
      const active = offices.filter((location) => location.isActive)
      setLocations(active)
      setLocationId((current) => current || active.find((location) => location.isDefault)?.id || '')
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(appointmentErrorMessage(cause))
    })
    return () => controller.abort()
  }, [hasValidProvider, locationsApi, providerUserId])

  useEffect(() => {
    if (!hasValidProvider || !selectedLocation || selectedLocation.allServices) return
    const controller = new AbortController()
    void locationsApi.listServices({ locationId: selectedLocation.id, providerUserId }).then((items) => {
      if (!controller.signal.aborted) setLocationServices(items.filter((service) => service.isActive))
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(appointmentErrorMessage(cause))
    })
    return () => controller.abort()
  }, [hasValidProvider, locationsApi, providerUserId, selectedLocation])

  const changeProvider = (value: string) => {
    setAssistantProviderId(value)
    setLocations([])
    setLocationId('')
    setLocationServices(null)
    setServiceId('')
  }
  const changeLocation = (value: string) => {
    setLocationId(value)
    setLocationServices(null)
    setServiceId('')
  }
  const submit = async () => {
    if (auth.status !== 'authenticated') return
    if (!hasValidProvider) {
      setError('Ingresá un UUID válido del profesional responsable antes de agendar.')
      return
    }
    if (!patientId || !serviceId || !startsAt) {
      setError('Elegí un paciente, un servicio y una fecha y hora explícita.')
      return
    }
    const parsed = new Date(startsAt)
    if (Number.isNaN(parsed.valueOf())) { setError('La fecha y hora no es válida.'); return }
    const key = attempt.current?.fingerprint === fingerprint ? attempt.current.key : newAttemptKey()
    attempt.current = { fingerprint, key }
    setSaving(true); setError(null)
    try {
      await appointments.create({ patientId, providerUserId, serviceIds: [serviceId], startsAt: parsed.toISOString(), locationId: locationId || undefined, source: source as 'MANUAL' | 'PHONE' | 'WALK_IN' | 'WHATSAPP', reason, internalNotes, idempotencyKey: key })
      onCreated?.(); onClose()
    } catch (cause) { setError(appointmentErrorMessage(cause)) } finally { setSaving(false) }
  }

  const patientOptions = [{ value: '', label: 'Seleccioná un paciente' }, ...patients.map((patient) => ({ value: patient.id, label: `${patient.firstName} ${patient.lastName} · Exp. ${patient.recordNumber}` }))]
  const serviceOptions = [{ value: '', label: 'Seleccioná un servicio' }, ...availableServices.map((service) => ({ value: service.id, label: `${service.name} · ${service.durationMinutes} min` }))]
  const locationOptions = [{ value: '', label: 'Sin sede especificada' }, ...locations.map((location) => ({ value: location.id, label: location.name }))]

  return <div className={styles.scrim} role="dialog" aria-modal="true" aria-label="Nueva cita">
    <div className={styles.modal}>
      <header className={styles.header}><h2 className={styles.title}>Nueva cita</h2><button type="button" className={styles.close} onClick={onClose} aria-label="Cerrar" disabled={saving}><CloseIcon /></button></header>
      <div className={styles.body}>
        {error ? <FormAlert tone="error">{error}</FormAlert> : null}
        {loading ? <p role="status">Cargando pacientes y servicios…</p> : null}
        {isAssistant ? <TextField label="UUID del profesional responsable" value={assistantProviderId} onChange={(event) => changeProvider(event.target.value)} disabled={loading || saving} hint="Ingresá el UUID que te indicó el profesional. No hay un directorio de profesionales disponible." /> : <p>Profesional responsable: {auth.status === 'authenticated' ? `${auth.user.firstName} ${auth.user.lastName}` : ''}</p>}
        <SelectField label="Paciente" options={patientOptions} value={patientId} onChange={(event) => setPatientId(event.target.value)} disabled={loading || saving} />
        <SelectField label="Servicio" options={serviceOptions} value={serviceId} onChange={(event) => setServiceId(event.target.value)} disabled={loading || saving || !hasValidProvider} />
        <SelectField label="Sede" options={locationOptions} value={locationId} onChange={(event) => changeLocation(event.target.value)} disabled={loading || saving || !hasValidProvider} />
        <TextField label="Fecha y hora deseada" type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} disabled={loading || saving} hint="No mostramos disponibilidad: el servidor confirmará o rechazará conflictos." />
        <SelectField label="Origen" options={[{ value: 'MANUAL', label: 'Manual' }, { value: 'PHONE', label: 'Teléfono' }, { value: 'WHATSAPP', label: 'WhatsApp' }, { value: 'WALK_IN', label: 'Presencial' }]} value={source} onChange={(event) => setSource(event.target.value)} disabled={loading || saving} />
        <TextField label="Motivo" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} disabled={saving} />
        <TextArea label="Nota interna" value={internalNotes} onChange={(event) => setInternalNotes(event.target.value)} maxLength={2000} disabled={saving} />
      </div>
      <footer className={styles.footer}><p className={styles.summary}>El horario será validado por el servidor.</p><Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button><Button onClick={() => void submit()} disabled={loading || saving}>{saving ? 'Agendando…' : 'Agendar cita'}</Button></footer>
    </div>
  </div>
}
