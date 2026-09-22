/* oxlint-disable react/refs -- retained billing detail is deliberately visible while authority reloads. */
/* oxlint-disable react/set-state-in-effect -- a patient identity change must clear its aborted keyset state before another page can be selected. */
import { type FormEvent, useEffect, useRef, useState } from 'react'
import { useResource } from '../../../shared/api/useResource'
import { isApiError } from '../../../shared/api/problem'
import { Button } from '../../../shared/ui/atoms/Button'
import { SelectField, TextField } from '../../../shared/ui/atoms/Field'
import { FormAlert } from '../../../shared/ui/molecules/FormAlert'
import { useAuth } from '../../auth/application/authContext'
import { useFiscalApi } from '../../fiscal/application/useFiscalApi'
import { usePatientsApi } from '../../patients/application/usePatientsApi'
import { patientDisplayName, type PatientSummary } from '../../patients/domain/patient'
import { usePaymentsApi } from '../../payments/application/usePaymentsApi'
import type { Payment } from '../../payments/domain/payment'
import { useTreatmentsApi } from '../../treatments/application/useTreatmentsApi'
import { useBillingApi } from '../application/useBillingApi'
import {
  billingErrorMessage,
  billingStatusLabel,
  billingTypeLabel,
  canManageBilling,
  legalBillingActions,
  type BillingCatalog,
  type BillingDocument,
  type BillingDocumentDetail,
  type CancellationMotive,
} from '../domain/billing'
import styles from './BillingPage.module.css'

const PAGE_SIZE = 25
const CATALOGS: Array<{ value: BillingCatalog; label: string }> = [
  { value: 'payment-forms', label: 'Formas de pago' },
  { value: 'payment-methods', label: 'Métodos de pago' },
  { value: 'fiscal-regimes', label: 'Regímenes fiscales' },
  { value: 'cfdi-uses', label: 'Usos CFDI' },
  { value: 'currencies', label: 'Monedas' },
  { value: 'relation-types', label: 'Tipos de relación' },
  { value: 'federal-taxes', label: 'Impuestos federales' },
]

function key(): string {
  if (crypto?.randomUUID) return crypto.randomUUID()
  throw new Error('Este navegador no puede generar una clave segura de idempotencia.')
}

type BillingAction = 'replace' | 'cancel' | 'send-email' | 'reconcile'

function actionLabel(action: BillingAction): string {
  return ({
    replace: 'Solicitar sustitución',
    cancel: 'Solicitar cancelación',
    'send-email': 'Solicitar reenvío por correo',
    reconcile: 'Conciliar estado',
  })[action]
}

function actionConfirmation(action: BillingAction, document: BillingDocumentDetail, motive: CancellationMotive, frozen?: { version: number; motive?: CancellationMotive }): string {
  const version = frozen ? `versión de la solicitud original ${frozen.version}` : `versión actual ${document.version}`
  const attemptMotive = frozen?.motive ?? motive
  if (action === 'replace') return `Confirmo solicitar la sustitución con la ${version}. El servidor validará planes fuente, historial de complementos, sucesor, versión y requisitos fiscales.`
  if (action === 'cancel') return attemptMotive === '01'
    ? `Confirmo solicitar la cancelación con motivo 01 y ${version}. El servidor requiere o busca el sucesor emitido; no ingreses un UUID.`
    : `Confirmo solicitar la cancelación con motivo ${attemptMotive} y ${version}. El servidor valida los requisitos fiscales y la versión.`
  if (action === 'send-email') return `Confirmo solicitar el reenvío a la dirección almacenada al emitir el comprobante, con la ${version}. El servidor valida el destinatario; esto no confirma elegibilidad ni entrega.`
  return `Confirmo la acción fiscal con la ${version}. La solicitud queda en cola y debe verificarse por estado.`
}

function usePaymentChoices(patientId: string) {
  const paymentsApi = usePaymentsApi()
  const firstPage = useResource(
    (signal) => patientId
      ? paymentsApi.listPayments({ patientId, limit: PAGE_SIZE, signal })
      : Promise.resolve({ items: [], hasPossibleNextPage: false }),
    [paymentsApi, patientId],
  )
  const [extra, setExtra] = useState<Payment[]>([])
  const [more, setMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const controller = useRef<AbortController | null>(null)
  const requestId = useRef(0)
  const inFlight = useRef(false)

  useEffect(() => {
    controller.current?.abort()
    requestId.current += 1
    inFlight.current = false
    setExtra([])
    setMore(false)
    setError(null)
    setLoadingMore(false)
  }, [patientId])

  useEffect(() => () => controller.current?.abort(), [])

  const first = firstPage.state.status === 'ready' ? firstPage.state.data : null
  const ids = new Set<string>()
  const items = [...(first?.items ?? []), ...extra].filter((item) => {
    if (ids.has(item.id)) return false
    ids.add(item.id)
    return true
  })
  const canLoadMore = Boolean(first && (extra.length ? more : first.hasPossibleNextPage))

  const loadMore = async () => {
    const afterId = items.at(-1)?.id
    if (!patientId || !afterId || !canLoadMore || inFlight.current) return

    inFlight.current = true
    setLoadingMore(true)
    setError(null)
    const request = ++requestId.current
    const next = new AbortController()
    controller.current?.abort()
    controller.current = next

    try {
      const page = await paymentsApi.listPayments({
        patientId,
        afterId,
        limit: PAGE_SIZE,
        signal: next.signal,
      })
      if (next.signal.aborted || request !== requestId.current) return
      setExtra((current) => {
        const existing = new Set(current.map((payment) => payment.id))
        return [...current, ...page.items.filter((payment) => !existing.has(payment.id))]
      })
      setMore(page.hasPossibleNextPage)
    } catch (cause) {
      if (!next.signal.aborted && request === requestId.current) setError(billingErrorMessage(cause))
    } finally {
      if (!next.signal.aborted && request === requestId.current) {
        inFlight.current = false
        setLoadingMore(false)
      }
    }
  }

  return { firstPage, items, canLoadMore, loadingMore, error, loadMore }
}

function PaymentChoices({ choices, selectedIds, onChange }: {
  choices: ReturnType<typeof usePaymentChoices>
  selectedIds: string[]
  onChange: (id: string, selected: boolean) => void
}) {
  if (choices.firstPage.state.status === 'loading') return <p>Cargando pagos del paciente…</p>
  if (choices.firstPage.state.status === 'error') return <FormAlert tone="error">{billingErrorMessage(choices.firstPage.state.error)}</FormAlert>

  return <>
    {choices.items.map((payment) => <label className={styles.choice} key={payment.id}>
      <input
        type="checkbox"
        checked={selectedIds.includes(payment.id)}
        onChange={(event) => onChange(payment.id, event.target.checked)}
      />
      {' '}{payment.amount} {payment.currency} · {payment.status}
    </label>)}
    {choices.error ? <FormAlert tone="error">{choices.error}</FormAlert> : null}
    {choices.canLoadMore ? <Button size="sm" type="button" variant="secondary" disabled={choices.loadingMore} onClick={() => void choices.loadMore()}>{choices.loadingMore ? 'Cargando pagos…' : 'Cargar más pagos'}</Button> : null}
  </>
}

export function BillingPage() {
  const { state: auth } = useAuth()
  if (auth.status !== 'authenticated') return null
  if (!canManageBilling(auth.user.role)) {
    return <div className={styles.page}><FormAlert tone="error">Tu rol no tiene acceso al servicio de facturación.</FormAlert></div>
  }
  return <BillingContent />
}

function BillingContent() {
  const api = useBillingApi()
  const documents = useResource((signal) => api.listDocuments({ limit: PAGE_SIZE, signal }), [api])
  const [extra, setExtra] = useState<BillingDocument[]>([])
  const [more, setMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [selected, setSelected] = useState('')
  const [creating, setCreating] = useState(false)
  const controller = useRef<AbortController | null>(null)
  const inFlight = useRef(false)
  const first = documents.state.status === 'ready' ? documents.state.data : null
  const items = first ? [...first.items, ...extra] : extra
  const canLoadMore = Boolean(first && (extra.length ? more : first.hasPossibleNextPage))

  useEffect(() => () => controller.current?.abort(), [])

  const reload = async () => {
    controller.current?.abort()
    inFlight.current = false
    setExtra([])
    setMore(false)
    await documents.reload()
  }

  const loadMore = async () => {
    const afterId = items.at(-1)?.id
    if (!afterId || !canLoadMore || inFlight.current) return
    inFlight.current = true
    setLoadingMore(true)
    setListError(null)
    const next = new AbortController()
    controller.current?.abort()
    controller.current = next
    try {
      const page = await api.listDocuments({ afterId, limit: PAGE_SIZE, signal: next.signal })
      if (!next.signal.aborted) {
        setExtra((current) => {
          const ids = new Set([...items, ...current].map((item) => item.id))
          return [...current, ...page.items.filter((item) => !ids.has(item.id))]
        })
        setMore(page.hasPossibleNextPage)
      }
    } catch (error) {
      if (!next.signal.aborted) setListError(billingErrorMessage(error))
    } finally {
      if (!next.signal.aborted) {
        inFlight.current = false
        setLoadingMore(false)
      }
    }
  }

  return <div className={styles.page}>
    <header className={styles.header}>
      <div>
        <h2>Facturación</h2>
        <p>Documentos y estados fiscales informados por el servidor. Los importes son decimales exactos, sin cálculos en el navegador.</p>
      </div>
      <Button onClick={() => setCreating(true)}>Nueva factura</Button>
    </header>
    {documents.state.status === 'loading' && !items.length ? <p role="status">Cargando documentos…</p> : null}
    {documents.state.status === 'error' ? <FormAlert tone="error">{billingErrorMessage(documents.state.error)} <Button size="sm" variant="secondary" onClick={() => void reload()}>Reintentar consulta</Button></FormAlert> : null}
    {listError ? <FormAlert tone="error">{listError}</FormAlert> : null}
    {first && !items.length ? <p>No hay comprobantes fiscales para mostrar.</p> : null}
    <div className={styles.list}>
      {items.map((document) => <button className={styles.document} key={document.id} type="button" onClick={() => setSelected(document.id)}>
        <strong>{billingTypeLabel(document.type)} · {document.total}</strong>
        <span>{billingStatusLabel(document.status)} · {document.id}</span>
      </button>)}
    </div>
    {canLoadMore ? <Button size="sm" variant="secondary" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? 'Cargando…' : 'Cargar más'}</Button> : null}
    {creating ? <InvoiceForm api={api} onClose={() => setCreating(false)} onQueued={async () => {
      setCreating(false)
      try {
        await reload()
      } catch (error) {
        setListError(`La solicitud fue aceptada, pero no pudimos actualizar la lista. ${billingErrorMessage(error)}`)
      }
    }} /> : null}
    {selected ? <DocumentDetail key={selected} id={selected} api={api} onChanged={reload} /> : null}
    <CatalogLookup api={api} />
  </div>
}

function InvoiceForm({ api, onClose, onQueued }: { api: ReturnType<typeof useBillingApi>; onClose: () => void; onQueued: () => Promise<void> }) {
  const patients = usePatientsApi()
  const treatments = useTreatmentsApi()
  const fiscal = useFiscalApi()
  const [query, setQuery] = useState('')
  const [patient, setPatient] = useState<PatientSummary | null>(null)
  const [source, setSource] = useState<'payments' | 'plans'>('payments')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [confirmed, setConfirmed] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const busy = useRef(false)
  const attempt = useRef<{ body: { patientId: string; paymentIds?: string[]; treatmentPlanIds?: string[] }; key: string } | null>(null)
  const found = useResource(
    (signal) => query.trim() ? patients.list({ q: query.trim(), limit: 10, signal }) : Promise.resolve({ items: [], nextCursor: null }),
    [patients, query],
  )
  const paymentChoices = usePaymentChoices(source === 'payments' && patient ? patient.id : '')
  const planSources = useResource(
    (signal) => patient && source === 'plans' ? treatments.listPlans(patient.id, signal) : Promise.resolve([]),
    [treatments, patient, source],
  )
  const fiscalData = useResource((signal) => patient ? fiscal.get(patient.id, signal) : Promise.resolve(null), [fiscal, patient])

  const selectPayment = (paymentId: string, selected: boolean) => {
    setSelectedIds((current) => selected ? [...current, paymentId] : current.filter((id) => id !== paymentId))
    attempt.current = null
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy.current || !patient || !selectedIds.length || !confirmed) return
    busy.current = true
    setPending(true)
    setError(null)
    const body = attempt.current?.body ?? {
      patientId: patient.id,
      ...(source === 'payments' ? { paymentIds: selectedIds } : { treatmentPlanIds: selectedIds }),
    }
    const frozen = attempt.current ?? { body, key: key() }
    attempt.current = frozen
    try {
      await api.issueInvoice({ ...frozen.body, idempotencyKey: frozen.key })
      await onQueued()
    } catch (cause) {
      setError(billingErrorMessage(cause))
    } finally {
      busy.current = false
      setPending(false)
    }
  }

  return <form className={styles.form} onSubmit={(event) => void submit(event)}>
    <h3>Nueva factura</h3>
    <p>El servidor fija receptor, conceptos, impuestos y total desde datos fiscales, pagos y planes bloqueados.</p>
    {error ? <FormAlert tone="error">{error}</FormAlert> : null}
    <TextField label="Buscar paciente" value={query} onChange={(event) => {
      setQuery(event.target.value)
      setPatient(null)
      setSelectedIds([])
      attempt.current = null
    }} />
    {found.state.status === 'ready' ? <div>{found.state.data.items.map((item) => <Button type="button" size="sm" variant="secondary" key={item.id} onClick={() => {
      setPatient(item)
      setSelectedIds([])
      attempt.current = null
    }}>{patientDisplayName(item)} · {item.recordNumber}</Button>)}</div> : null}
    {patient ? <>
      <p><strong>Paciente:</strong> {patientDisplayName(patient)}. {fiscalData.state.status === 'ready' ? fiscalData.state.data ? 'Datos fiscales encontrados.' : 'Faltan datos fiscales.' : 'Verificando datos fiscales…'}</p>
      <SelectField label="Origen real" value={source} options={[{ value: 'payments', label: 'Pagos registrados' }, { value: 'plans', label: 'Planes de tratamiento' }]} onChange={(event) => {
        setSource(event.target.value as 'payments' | 'plans')
        setSelectedIds([])
        attempt.current = null
      }} />
      {source === 'payments' ? <PaymentChoices choices={paymentChoices} selectedIds={selectedIds} onChange={selectPayment} /> : null}
      {source === 'plans' && planSources.state.status === 'ready' ? planSources.state.data.map((plan: any) => <label className={styles.choice} key={plan.id}>
        <input type="checkbox" checked={selectedIds.includes(plan.id)} onChange={(event) => {
          setSelectedIds((current) => event.target.checked ? [...current, plan.id] : current.filter((value) => value !== plan.id))
          attempt.current = null
        }} />
        {' '}{plan.name} · {plan.currency}
      </label>) : null}
    </> : null}
    <label className={styles.choice}><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> Confirmo solicitar la factura. Un 202 la deja en cola; no equivale a un timbrado completado.</label>
    <Button type="submit" disabled={pending || !patient || !selectedIds.length || !confirmed}>{pending ? 'Enviando…' : 'Solicitar factura'}</Button>
    <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
  </form>
}

function DocumentDetail({ id, api, onChanged }: { id: string; api: ReturnType<typeof useBillingApi>; onChanged: () => Promise<void> }) {
  const detail = useResource((signal) => api.getDocument(id, signal), [api, id])
  const retained = useRef<BillingDocumentDetail | null>(null)
  const attempts = useRef<Record<string, { version: number; motive?: CancellationMotive; key: string }>>({})
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [refreshFailed, setRefreshFailed] = useState(false)
  const [motive, setMotive] = useState<CancellationMotive>('02')
  const [confirmedActions, setConfirmedActions] = useState<Partial<Record<BillingAction, boolean>>>({})
  const busy = useRef(false)

  if (detail.state.status === 'ready') retained.current = detail.state.data
  const document = detail.state.status === 'ready' ? detail.state.data : retained.current
  const authorityUnavailable = refreshFailed || detail.state.status === 'loading' || detail.state.status === 'error'

  const refreshAuthority = async (): Promise<boolean> => {
    try {
      const authoritative = await api.getDocument(id)
      retained.current = authoritative
      await detail.reload()
      setRefreshFailed(false)
      return true
    } catch (cause) {
      setRefreshFailed(true)
      setError(billingErrorMessage(cause))
      return false
    }
  }

  const refresh = async () => {
    if (busy.current) return
    busy.current = true
    setPending(true)
    await refreshAuthority()
    busy.current = false
    setPending(false)
  }

  const mutate = async (action: BillingAction) => {
    if (!document || busy.current || authorityUnavailable || !confirmedActions[action]) return
    busy.current = true
    setPending(true)
    setError(null)
    setNotice(null)
    const frozen = attempts.current[action] ?? {
      version: document.version,
      ...(action === 'cancel' ? { motive } : {}),
      key: key(),
    }
    attempts.current[action] = frozen

    try {
      if (action === 'replace') await api.replace({ id, version: frozen.version, idempotencyKey: frozen.key })
      if (action === 'cancel') await api.cancel({ id, version: frozen.version, motive: frozen.motive!, idempotencyKey: frozen.key })
      if (action === 'send-email') await api.sendEmail({ id, version: frozen.version, idempotencyKey: frozen.key })
      if (action === 'reconcile') await api.reconcile({ id, version: frozen.version, idempotencyKey: frozen.key })

      setNotice('La solicitud fue aceptada y quedó en cola para procesamiento fiscal; verificá su estado antes de asumir un resultado.')
      await refreshAuthority()
      try {
        await onChanged()
      } catch (cause) {
        setError(`La solicitud fue aceptada, pero no pudimos actualizar la lista. ${billingErrorMessage(cause)}`)
      }
    } catch (cause) {
      setError(billingErrorMessage(cause))
      if (isApiError(cause) && cause.status < 500) {
        setRefreshFailed(true)
        const refreshed = await refreshAuthority()
        if (refreshed) {
          delete attempts.current[action]
          setConfirmedActions((current) => ({ ...current, [action]: false }))
          setError(cause.status === 412
            ? 'El documento cambió en otra sesión. Se actualizó su autoridad; confirmá nuevamente antes de iniciar un intento nuevo.'
            : `${billingErrorMessage(cause)} El servidor confirmó que no quedó en cola; se actualizó la autoridad. Confirmá nuevamente antes de iniciar un intento nuevo.`)
        }
      }
    } finally {
      busy.current = false
      setPending(false)
    }
  }

  const actions = document ? legalBillingActions(document) : []

  return <section className={styles.detail}>
    <h3>Detalle del comprobante</h3>
    {detail.state.status === 'loading' && !document ? <p role="status">Cargando detalle…</p> : null}
    {error ? <FormAlert tone="error">{error}</FormAlert> : null}
    {notice ? <FormAlert tone="success">{notice}</FormAlert> : null}
    {document ? <>
      <p>{billingTypeLabel(document.type)} · <strong>{document.total}</strong> · {billingStatusLabel(document.status)}</p>
      <p>UUID: {document.cfdiUuid || 'Aún no disponible'} · Último error: {document.lastErrorCode || 'sin reporte'}</p>
      <p>Archivos: XML {document.files.xml ? 'disponible' : 'no disponible'}, PDF {document.files.pdf ? 'disponible' : 'no disponible'}, acuse {document.files.ack ? 'disponible' : 'no disponible'}.</p>
      <ArtifactLinks api={api} documentId={document.id} files={document.files} />
      {document.type === 'I' && document.status === 'ISSUED' ? <ComplementForm api={api} document={document} onQueued={onChanged} /> : null}
      {actions.length ? <>
        {actions.includes('cancel') ? <SelectField label="Motivo de cancelación" value={motive} disabled={Boolean(attempts.current.cancel) || pending} options={[
          { value: '01', label: '01 · Comprobante emitido con errores con relación' },
          { value: '02', label: '02 · Comprobante emitido con errores sin relación' },
          { value: '03', label: '03 · No se llevó a cabo la operación' },
          { value: '04', label: '04 · Operación nominativa relacionada en factura global' },
        ]} onChange={(event) => {
          setMotive(event.target.value as CancellationMotive)
          setConfirmedActions((current) => ({ ...current, cancel: false }))
        }} /> : null}
        <div className={styles.actions}>{actions.map((action) => {
          const frozen = attempts.current[action]
          return <div key={action}>
            <label className={styles.choice}><input type="checkbox" disabled={Boolean(frozen) || pending} checked={confirmedActions[action] === true} onChange={(event) => setConfirmedActions((current) => ({ ...current, [action]: event.target.checked }))} /> {actionConfirmation(action, document, motive, frozen)}</label>
            {frozen && frozen.version !== document.version ? <p>El servidor informa la versión actual {document.version}; el reintento conserva la versión original {frozen.version}.</p> : null}
            <Button size="sm" disabled={pending || authorityUnavailable || !confirmedActions[action]} onClick={() => void mutate(action)}>{actionLabel(action)}</Button>
          </div>
        })}</div>
      </> : null}
      <Button size="sm" variant="secondary" disabled={pending} onClick={() => void refresh()}>Actualizar estado</Button>
    </> : null}
  </section>
}

function artifactLabel(format: 'xml' | 'pdf' | 'ack'): string {
  return ({ xml: 'XML', pdf: 'PDF', ack: 'acuse' })[format]
}

function ArtifactLinks({ api, documentId, files }: { api: ReturnType<typeof useBillingApi>; documentId: string; files: BillingDocumentDetail['files'] }) {
  return <section aria-label="Archivos fiscales disponibles">
    <h4>Archivos fiscales</h4>
    <p>Solicitá una URL temporal al servidor y abrila manualmente. La aplicación no reenvía credenciales de API ni referrer; las cookies del destino dependen de la política del navegador y de ese destino.</p>
    <div className={styles.actions}>{(['xml', 'pdf', 'ack'] as const).filter((format) => files[format]).map((format) => <ArtifactLink key={format} api={api} documentId={documentId} format={format} />)}</div>
  </section>
}

function ArtifactLink({ api, documentId, format }: { api: ReturnType<typeof useBillingApi>; documentId: string; format: 'xml' | 'pdf' | 'ack' }) {
  const [state, setState] = useState<{ status: 'idle' | 'loading' | 'ready' | 'error'; url?: string; message?: string }>({ status: 'idle' })
  const controller = useRef<AbortController | null>(null)
  const expiryTimer = useRef<number | null>(null)
  const requestId = useRef(0)

  const clearExpiry = () => {
    if (expiryTimer.current !== null) window.clearTimeout(expiryTimer.current)
    expiryTimer.current = null
  }

  useEffect(() => () => {
    requestId.current += 1
    controller.current?.abort()
    clearExpiry()
  }, [api, documentId, format])

  const prepare = async () => {
    if (state.status === 'loading') return
    requestId.current += 1
    const request = requestId.current
    clearExpiry()
    controller.current?.abort()
    const next = new AbortController()
    controller.current = next
    setState({ status: 'loading' })

    try {
      const artifact = await api.getArtifact({ id: documentId, format, signal: next.signal })
      if (next.signal.aborted || request !== requestId.current) return
      setState({ status: 'ready', url: artifact.url })
      expiryTimer.current = window.setTimeout(() => {
        if (request !== requestId.current) return
        expiryTimer.current = null
        setState({ status: 'error', message: 'La URL temporal venció. Solicitá una nueva antes de abrir el archivo.' })
      }, artifact.expiresInSeconds * 1000)
    } catch (error) {
      if (!next.signal.aborted && request === requestId.current) setState({ status: 'error', message: billingErrorMessage(error) })
    }
  }

  const label = artifactLabel(format)
  return <div>
    <Button size="sm" variant="secondary" disabled={state.status === 'loading'} onClick={() => void prepare()}>{state.status === 'loading' ? 'Preparando…' : `Preparar ${label}`}</Button>
    {state.status === 'ready' && state.url ? <a href={state.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Abrir {label}</a> : null}
    {state.status === 'error' ? <FormAlert tone="error">{state.message}</FormAlert> : null}
  </div>
}

function ComplementForm({ api, document, onQueued }: { api: ReturnType<typeof useBillingApi>; document: BillingDocumentDetail; onQueued: () => Promise<void> }) {
  const paymentChoices = usePaymentChoices(document.patientId)
  const [paymentIds, setPaymentIds] = useState<string[]>([])
  const [confirmed, setConfirmed] = useState(false)
  const [pending, setPending] = useState(false)
  const [closed, setClosed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)
  const attempt = useRef<{ body: { parentDocumentId: string; paymentIds: string[] }; key: string } | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (inFlight.current || !paymentIds.length || !confirmed) return
    inFlight.current = true
    setPending(true)
    setError(null)
    const frozen = attempt.current ?? { body: { parentDocumentId: document.id, paymentIds: [...paymentIds] }, key: key() }
    attempt.current = frozen
    try {
      await api.createPaymentComplement({ ...frozen.body, idempotencyKey: frozen.key })
      setClosed(true)
      try {
        await onQueued()
      } catch (cause) {
        setError(`La solicitud fue aceptada, pero no pudimos actualizar la lista. ${billingErrorMessage(cause)}`)
      }
    } catch (cause) {
      setError(billingErrorMessage(cause))
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }

  if (closed) return error ? <FormAlert tone="error">{error}</FormAlert> : <p>Complemento solicitado: quedó en cola para procesamiento fiscal.</p>
  return <form className={styles.form} onSubmit={(event) => void submit(event)}>
    <h4>Complemento de pago</h4>
    <p>Seleccioná pagos reales del paciente. El servidor calcula parcialidades, saldos y el total; no ingreses importes manuales.</p>
    {error ? <FormAlert tone="error">{error}</FormAlert> : null}
    <PaymentChoices choices={paymentChoices} selectedIds={paymentIds} onChange={(paymentId, selected) => {
      setPaymentIds((current) => selected ? [...current, paymentId] : current.filter((id) => id !== paymentId))
      attempt.current = null
    }} />
    <label className={styles.choice}><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> Confirmo solicitar el complemento. Un 202 no confirma su emisión.</label>
    <Button type="submit" size="sm" disabled={pending || !paymentIds.length || !confirmed}>{pending ? 'Enviando…' : 'Solicitar complemento'}</Button>
  </form>
}

function CatalogLookup({ api }: { api: ReturnType<typeof useBillingApi> }) {
  const [catalog, setCatalog] = useState<BillingCatalog>('payment-forms')
  const [keyword, setKeyword] = useState('')
  const data = useResource((signal) => api.getCatalog({ catalog, signal }), [api, catalog])
  const normalizedKeyword = keyword.trim().toLocaleLowerCase()
  const items = data.state.status === 'ready' ? data.state.data.items.filter((item) => {
    if (!normalizedKeyword) return true
    return `${item.value} ${item.name}`.toLocaleLowerCase().includes(normalizedKeyword)
  }) : []

  return <section className={styles.catalog}>
    <h3>Catálogos fiscales</h3>
    <SelectField label="Catálogo" value={catalog} options={CATALOGS} onChange={(event) => setCatalog(event.target.value as BillingCatalog)} />
    <TextField label="Palabra clave" value={keyword} onChange={(event) => setKeyword(event.target.value)} hint="El filtro se aplica solo a las opciones base devueltas por el proveedor; no busca el catálogo SAT completo." />
    {data.state.status === 'ready' ? <p>{items.map((item) => `${item.value} — ${item.name}`).join(' · ') || 'Sin coincidencias entre las opciones cargadas.'}</p> : null}
    {data.state.status === 'error' ? <FormAlert tone="error">{billingErrorMessage(data.state.error)}</FormAlert> : null}
    {data.state.status === 'loading' ? <p>Cargando catálogo…</p> : null}
  </section>
}
