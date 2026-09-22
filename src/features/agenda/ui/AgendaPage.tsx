import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '../../../shared/ui/atoms/Button'
import { SelectField, TextField } from '../../../shared/ui/atoms/Field'
import { FormAlert } from '../../../shared/ui/molecules/FormAlert'
import { ChevronLeftIcon, ChevronRightIcon } from '../../../shared/ui/atoms/icons'
import { useAuth } from '../../auth/application/authContext'
import { useLocationsApi } from '../../locations/application/useLocationsApi'
import type { PracticeLocation } from '../../locations/domain/location'
import { usePatientsApi } from '../../patients/application/usePatientsApi'
import type { PatientSummary } from '../../patients/domain/patient'
import { useServicesApi } from '../../services/application/useServicesApi'
import type { CatalogService } from '../../services/domain/service'
import { useAppointmentsApi } from '../application/useAppointmentsApi'
import { type Appointment, type PreferredPeriod, type WaitlistEntry, type WaitlistStatus, appointmentErrorMessage, toAgendaWindow } from '../domain/appointment'
import { AppointmentDrawer } from './organisms/AppointmentDrawer'
import { NewAppointmentModal } from './organisms/NewAppointmentModal'
import { WeekGrid } from './organisms/WeekGrid'
import styles from './AgendaPage.module.css'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

interface AgendaResources {
  appointments: Appointment[]
  waitlist: WaitlistEntry[]
  locations: PracticeLocation[]
  patients: PatientSummary[]
  services: CatalogService[]
  locationServices: CatalogService[] | null
}

type AgendaResourcesAction =
  | { type: 'appointments'; value: Appointment[] }
  | { type: 'waitlist'; value: WaitlistEntry[] }
  | { type: 'locations'; value: PracticeLocation[] }
  | { type: 'patients'; value: PatientSummary[] }
  | { type: 'services'; value: CatalogService[] }
  | { type: 'locationServices'; value: CatalogService[] | null }

const EMPTY_RESOURCES: AgendaResources = { appointments: [], waitlist: [], locations: [], patients: [], services: [], locationServices: null }

function resourcesReducer(state: AgendaResources, action: AgendaResourcesAction): AgendaResources {
  return { ...state, [action.type]: action.value }
}

function weekStart(date: Date): Date { const value = new Date(date); value.setHours(0, 0, 0, 0); value.setDate(value.getDate() - ((value.getDay() + 6) % 7)); return value }
function formatRange(start: Date): string { const end = new Date(start); end.setDate(end.getDate() + 6); return `${start.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })} – ${end.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}` }

export function AgendaPage() {
  const { state: auth } = useAuth()
  const api = useAppointmentsApi()
  const locationsApi = useLocationsApi()
  const patientsApi = usePatientsApi()
  const servicesApi = useServicesApi()
  const [searchParams] = useSearchParams()
  const [start, setStart] = useState(() => weekStart(new Date()))
  const [locationId, setLocationId] = useState('')
  const [providerOnly, setProviderOnly] = useState(false)
  const [assistantProviderId, setAssistantProviderId] = useState('')
  const [{ appointments, waitlist, locations, patients, services, locationServices }, dispatchResources] = useReducer(resourcesReducer, EMPTY_RESOURCES)
  const [selected, setSelected] = useState<Appointment | null>(null)
  const [openCreate, setOpenCreate] = useState(false)
  const [showWaitlistForm, setShowWaitlistForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [waitlistError, setWaitlistError] = useState<string | null>(null)
  const [waitlistPending, setWaitlistPending] = useState(false)
  const [waitlistPatientId, setWaitlistPatientId] = useState(searchParams.get('patient_id') ?? '')
  const [waitlistServiceId, setWaitlistServiceId] = useState('')
  const [earliestDate, setEarliestDate] = useState('')
  const [period, setPeriod] = useState<PreferredPeriod>('MORNING')

  const canManage = auth.status === 'authenticated' && auth.user.role !== 'BILLING'
  const isAssistant = auth.status === 'authenticated' && auth.user.role === 'ASSISTANT'
  const providerId = auth.status !== 'authenticated' ? '' : isAssistant ? assistantProviderId.trim() : auth.user.id
  const hasValidProvider = Boolean(providerId) && (!isAssistant || UUID_PATTERN.test(providerId))
  const shouldScopeAppointments = isAssistant ? hasValidProvider : providerOnly && hasValidProvider
  const window = useMemo(() => toAgendaWindow(start), [start])
  const selectedLocation = useMemo(() => locations.find((location) => location.id === locationId), [locationId, locations])
  const availableServices = selectedLocation?.allServices === false ? locationServices ?? [] : services

  const reloadAppointments = useCallback(async (signal?: AbortSignal) => {
    if (isAssistant && !hasValidProvider) {
      if (!signal?.aborted) dispatchResources({ type: 'appointments', value: [] })
      return
    }
    const agenda = await api.list({ ...window, locationId: locationId || undefined, providerUserId: shouldScopeAppointments ? providerId : undefined, signal })
    if (!signal?.aborted) dispatchResources({ type: 'appointments', value: agenda })
  }, [api, hasValidProvider, isAssistant, locationId, providerId, shouldScopeAppointments, window])

  const reloadWaitlist = useCallback(async (signal?: AbortSignal) => {
    if (!hasValidProvider) return
    const entries = await api.listWaitlist({ providerUserId: providerId, signal })
    if (!signal?.aborted) dispatchResources({ type: 'waitlist', value: entries })
  }, [api, hasValidProvider, providerId])

  const loadAgendaResources = useCallback(async (signal: AbortSignal) => {
    try {
      const [, patientPage, catalog, offices] = await Promise.all([
        reloadAppointments(signal),
        patientsApi.list({ limit: 100, signal }),
        servicesApi.list(),
        hasValidProvider ? locationsApi.list({ providerUserId: providerId }) : Promise.resolve([]),
      ])
      if (signal.aborted) return
      dispatchResources({ type: 'patients', value: patientPage.items })
      dispatchResources({ type: 'services', value: catalog.filter((service) => service.isActive) })
      dispatchResources({ type: 'locations', value: offices.filter((office) => office.isActive) })
    } catch (cause) {
      if (!signal.aborted) setError(appointmentErrorMessage(cause))
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }, [hasValidProvider, locationsApi, patientsApi, providerId, reloadAppointments, servicesApi])

  useEffect(() => {
    if (!canManage) return
    const controller = new AbortController()
    void Promise.resolve().then(() => loadAgendaResources(controller.signal))
    return () => controller.abort()
  }, [canManage, loadAgendaResources])

  useEffect(() => {
    if (!canManage || !hasValidProvider) return
    const controller = new AbortController()
    void reloadWaitlist(controller.signal).catch((cause) => {
      if (!controller.signal.aborted) setWaitlistError(appointmentErrorMessage(cause))
    })
    return () => controller.abort()
  }, [canManage, hasValidProvider, reloadWaitlist])

  const reloadLocationServices = useCallback(async (signal: AbortSignal) => {
    if (!selectedLocation || selectedLocation.allServices) return
    try {
      const items = await locationsApi.listServices({ locationId: selectedLocation.id, providerUserId: providerId })
      if (!signal.aborted) dispatchResources({ type: 'locationServices', value: items.filter((service) => service.isActive) })
    } catch (cause) {
      if (!signal.aborted) setError(appointmentErrorMessage(cause))
    }
  }, [locationsApi, providerId, selectedLocation])

  useEffect(() => {
    if (!hasValidProvider || !selectedLocation || selectedLocation.allServices) return
    const controller = new AbortController()
    void Promise.resolve().then(() => reloadLocationServices(controller.signal))
    return () => controller.abort()
  }, [hasValidProvider, reloadLocationServices, selectedLocation])

  const refresh = () => {
    void reloadAppointments().catch((cause) => setError(appointmentErrorMessage(cause)))
    void reloadWaitlist().catch((cause) => setWaitlistError(appointmentErrorMessage(cause)))
  }
  const changeProvider = (value: string) => {
    setAssistantProviderId(value)
    dispatchResources({ type: 'locations', value: [] })
    setLocationId('')
    dispatchResources({ type: 'locationServices', value: null })
    dispatchResources({ type: 'waitlist', value: [] })
    setWaitlistError(null)
    setWaitlistServiceId('')
  }
  const changeLocation = (value: string) => {
    setLocationId(value)
    dispatchResources({ type: 'locationServices', value: null })
    setWaitlistServiceId('')
  }
  const submitWaitlist = async () => {
    if (!hasValidProvider) { setWaitlistError('Ingresá un UUID válido del profesional responsable antes de gestionar la lista de espera.'); return }
    if (!waitlistPatientId || !earliestDate) { setWaitlistError('Elegí un paciente y una fecha inicial.'); return }
    setWaitlistPending(true); setWaitlistError(null)
    try { await api.createWaitlist({ patientId: waitlistPatientId, providerUserId: providerId, earliestDate, preferredPeriods: [period], serviceId: waitlistServiceId || undefined }); setShowWaitlistForm(false); await reloadWaitlist() } catch (cause) { setWaitlistError(appointmentErrorMessage(cause)) } finally { setWaitlistPending(false) }
  }
  const updateWaitlist = async (id: string, status: Exclude<WaitlistStatus, 'ACTIVE'>) => {
    if (!hasValidProvider) { setWaitlistError('Elegí un profesional válido antes de gestionar la lista de espera.'); return }
    setWaitlistPending(true); setWaitlistError(null)
    try { await api.updateWaitlistStatus({ id, status }); await reloadWaitlist() } catch (cause) { setWaitlistError(appointmentErrorMessage(cause)) } finally { setWaitlistPending(false) }
  }
  const patientOptions = [{ value: '', label: 'Seleccioná un paciente' }, ...patients.map((patient) => ({ value: patient.id, label: `${patient.firstName} ${patient.lastName} · Exp. ${patient.recordNumber}` }))]
  const serviceOptions = [{ value: '', label: 'Cualquier servicio' }, ...availableServices.map((service) => ({ value: service.id, label: service.name }))]

  if (!canManage) return <div className={styles.layout}><FormAlert tone="error">Tu rol no tiene permiso para consultar o administrar la agenda.</FormAlert></div>
  return <div className={styles.layout}><div className={styles.rail}><section className={styles.panel}><h2 className={styles.panelTitle}>Filtros</h2>{isAssistant ? <TextField label="UUID del profesional responsable" value={assistantProviderId} onChange={(event) => changeProvider(event.target.value)} disabled={loading} hint="Ingresá el UUID que te indicó el profesional. No hay un directorio de profesionales disponible." /> : <p>Profesional responsable: {auth.status === 'authenticated' ? `${auth.user.firstName} ${auth.user.lastName}` : ''}</p>}<SelectField label="Sede" options={[{ value: '', label: 'Todas las sedes' }, ...locations.map((location) => ({ value: location.id, label: location.name }))]} value={locationId} onChange={(event) => changeLocation(event.target.value)} disabled={loading || !hasValidProvider} /><label><input type="checkbox" checked={providerOnly} onChange={(event) => setProviderOnly(event.target.checked)} disabled={loading || !hasValidProvider} /> {isAssistant ? 'Solo las citas del profesional seleccionado' : 'Solo mis citas'}</label><p>{providerOnly ? 'Mostrando citas del profesional seleccionado.' : 'Mostrando todas las citas permitidas por el servidor.'}</p></section><Button onClick={() => setOpenCreate(true)} disabled={loading}>Nueva cita</Button><Button variant="secondary" onClick={() => setShowWaitlistForm((current) => !current)} disabled={loading || !hasValidProvider}>Lista de espera</Button></div>
    <section className={styles.board}><header className={styles.toolbar}><div className={styles.stepper}><button type="button" className={styles.stepButton} aria-label="Semana anterior" onClick={() => setStart((current) => { const next = new Date(current); next.setDate(next.getDate() - 7); return next })}><ChevronLeftIcon size={14} /></button><button type="button" className={styles.stepButton} aria-label="Semana siguiente" onClick={() => setStart((current) => { const next = new Date(current); next.setDate(next.getDate() + 7); return next })}><ChevronRightIcon size={14} /></button></div><h2 className={styles.range}>{formatRange(start)}</h2><button type="button" className={styles.today} onClick={() => setStart(weekStart(new Date()))}>Hoy</button></header>{error ? <FormAlert tone="error">{error}</FormAlert> : null}{loading ? <p role="status">Cargando agenda…</p> : isAssistant && !hasValidProvider ? <p>Ingresá un UUID válido del profesional responsable para consultar la agenda.</p> : appointments.length === 0 ? <p>No hay citas en esta ventana.</p> : <WeekGrid start={start} appointments={appointments} onSelect={setSelected} />}
      {showWaitlistForm ? <section className={styles.panel}><h2 className={styles.panelTitle}>Nueva entrada en lista de espera</h2>{waitlistError ? <FormAlert tone="error">{waitlistError}</FormAlert> : null}<SelectField label="Paciente" options={patientOptions} value={waitlistPatientId} onChange={(event) => setWaitlistPatientId(event.target.value)} disabled={waitlistPending} /><SelectField label="Servicio" options={serviceOptions} value={waitlistServiceId} onChange={(event) => setWaitlistServiceId(event.target.value)} disabled={waitlistPending} /><TextField label="Disponible desde" type="date" value={earliestDate} onChange={(event) => setEarliestDate(event.target.value)} disabled={waitlistPending} /><SelectField label="Periodo preferido" options={[{ value: 'MORNING', label: 'Mañana' }, { value: 'AFTERNOON', label: 'Tarde' }, { value: 'EVENING', label: 'Noche' }]} value={period} onChange={(event) => setPeriod(event.target.value as PreferredPeriod)} disabled={waitlistPending} /><Button disabled={waitlistPending || !hasValidProvider} onClick={() => void submitWaitlist()}>{waitlistPending ? 'Guardando…' : 'Agregar a lista'}</Button></section> : null}
      <section className={styles.panel}><h2 className={styles.panelTitle}>Lista de espera</h2>{waitlistError ? <FormAlert tone="error">{waitlistError}</FormAlert> : null}{waitlist.length === 0 ? <p>Sin entradas en lista de espera.</p> : waitlist.map((entry) => <div key={entry.id}><span>{entry.patientId} · desde {entry.earliestDate} · {entry.status}</span>{entry.status === 'ACTIVE' ? <Button size="sm" variant="secondary" disabled={waitlistPending || !hasValidProvider} onClick={() => void updateWaitlist(entry.id, 'CONTACTED')}>Marcar contactado</Button> : null}{entry.status === 'CONTACTED' ? <Button size="sm" variant="secondary" disabled={waitlistPending || !hasValidProvider} onClick={() => void updateWaitlist(entry.id, 'BOOKED')}>Marcar reservado</Button> : null}</div>)}</section>
    </section>{selected ? <AppointmentDrawer appointment={selected} onClose={() => setSelected(null)} onChanged={() => { setSelected(null); refresh() }} /> : null}{openCreate ? <NewAppointmentModal preselectedPatientId={searchParams.get('patient_id') ?? undefined} providerUserId={hasValidProvider ? providerId : undefined} onClose={() => setOpenCreate(false)} onCreated={refresh} /> : null}</div>
}
