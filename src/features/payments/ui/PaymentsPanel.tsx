/* oxlint-disable react/refs -- retained detail data keeps financial forms mounted during an authoritative refresh. */
import { type FormEvent, type MutableRefObject, useEffect, useRef, useState } from 'react'
import { isApiError } from '../../../shared/api/problem'
import { useResource } from '../../../shared/api/useResource'
import { Badge } from '../../../shared/ui/atoms/Badge'
import { Button } from '../../../shared/ui/atoms/Button'
import { SelectField, TextField } from '../../../shared/ui/atoms/Field'
import { FormAlert } from '../../../shared/ui/molecules/FormAlert'
import type { TreatmentsApi } from '../../treatments/application/treatmentsApi'
import type { PaymentsApi } from '../application/paymentsApi'
import {
  allowedPaymentTransitions,
  allowedRefundTransitions,
  isExactPositiveDecimal,
  isPaymentFormCompatible,
  paymentErrorMessage,
  type Payment,
  type PaymentAllocation,
  type PaymentMethod,
  type PaymentStatus,
  type Refund,
  type RefundReason,
  type RefundStatus,
} from '../domain/payment'
import styles from './PaymentsPanel.module.css'

const PAGE_SIZE = 25

interface PaymentSnapshot {
  payment: Payment
  allocations: PaymentAllocation[]
  allocationsMayHaveMore: boolean
  refunds: Refund[]
  refundsMayHaveMore: boolean
}

interface RefundAttempt {
  paymentId: string
  version: number
  amount: string
  reason: RefundReason
  idempotencyKey: string
}

interface NestedPage<T> {
  items: T[]
  canLoadMore: boolean
  loading: boolean
  error: string | null
  loadMore: () => Promise<void>
}

function isVersionConflict(cause: unknown): boolean {
  return isApiError(cause) && (cause.status === 409 || cause.status === 412 || cause.code === 'VERSION_CONFLICT' || cause.code === 'PRECONDITION_FAILED')
}
const PAYMENT_METHODS: Array<{ value: PaymentMethod; label: string }> = [
  { value: 'CASH', label: 'Efectivo' },
  { value: 'CARD', label: 'Tarjeta' },
  { value: 'BANK_TRANSFER', label: 'Transferencia bancaria' },
  { value: 'ONLINE', label: 'Pago en línea' },
  { value: 'OTHER', label: 'Otro método' },
]
const REFUND_REASONS: Array<{ value: RefundReason; label: string }> = [
  { value: 'PATIENT_REQUEST', label: 'Solicitud del paciente' },
  { value: 'DUPLICATE_PAYMENT', label: 'Pago duplicado' },
  { value: 'TREATMENT_CANCELLED', label: 'Tratamiento cancelado' },
  { value: 'OTHER', label: 'Otro motivo' },
]

function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = crypto.getRandomValues(new Uint8Array(16))
    return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')
  }
  throw new Error('Este navegador no puede generar una clave segura de idempotencia.')
}

function submissionKey(ref: MutableRefObject<{ fingerprint: string; key: string } | null>, payload: unknown): string {
  const fingerprint = JSON.stringify(payload)
  if (!ref.current || ref.current.fingerprint !== fingerprint) ref.current = { fingerprint, key: newIdempotencyKey() }
  return ref.current.key
}

function amountLabel(currency: string, amount: string): string {
  return `${currency} ${amount}`
}

function paymentStatusLabel(status: PaymentStatus): string {
  return ({ PENDING: 'Pendiente', RECEIVED: 'Recibido', FAILED: 'Fallido', REFUNDED: 'Reembolsado', PARTIALLY_REFUNDED: 'Reembolsado parcialmente', VOIDED: 'Anulado' })[status]
}

function refundStatusLabel(status: RefundStatus): string {
  return ({ PENDING: 'Pendiente', COMPLETED: 'Completado', FAILED: 'Fallido', VOIDED: 'Anulado' })[status]
}

export function PaymentsPanel({ api, treatmentsApi, patientId, patientName }: { api: PaymentsApi; treatmentsApi: TreatmentsApi; patientId: string; patientName: string }) {
  return <PaymentsPanelContent key={patientId} api={api} treatmentsApi={treatmentsApi} patientId={patientId} patientName={patientName} />
}

function PaymentsPanelContent({ api, treatmentsApi, patientId, patientName }: { api: PaymentsApi; treatmentsApi: TreatmentsApi; patientId: string; patientName: string }) {
  const paymentsResource = useResource((signal) => api.listPayments({ patientId, limit: PAGE_SIZE, signal }), [api, patientId])
  const [selectedPaymentId, setSelectedPaymentId] = useState('')
  const [extraPayments, setExtraPayments] = useState<Payment[]>([])
  const [nextPage, setNextPage] = useState<{ hasPossibleNextPage: boolean; loading: boolean; error: string | null }>({ hasPossibleNextPage: false, loading: false, error: null })
  const [creating, setCreating] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const loadMoreInFlight = useRef(false)
  const loadMoreAbort = useRef<AbortController | null>(null)
  const firstPage = paymentsResource.state.status === 'ready' ? paymentsResource.state.data : null
  const payments = firstPage ? [...firstPage.items, ...extraPayments] : extraPayments
  const canLoadMore = Boolean(firstPage && (extraPayments.length ? nextPage.hasPossibleNextPage : firstPage.hasPossibleNextPage))

  useEffect(() => () => loadMoreAbort.current?.abort(), [])

  const reloadPayments = async () => {
    loadMoreAbort.current?.abort()
    loadMoreInFlight.current = false
    setExtraPayments([])
    setNextPage({ hasPossibleNextPage: false, loading: false, error: null })
    await paymentsResource.reload()
  }

  const loadMore = async () => {
    if (!firstPage || !canLoadMore || loadMoreInFlight.current) return
    const afterId = payments.at(-1)?.id
    if (!afterId) return
    const controller = new AbortController()
    loadMoreAbort.current?.abort()
    loadMoreAbort.current = controller
    loadMoreInFlight.current = true
    setNextPage((current) => ({ ...current, loading: true, error: null }))
    try {
      const page = await api.listPayments({ patientId, afterId, limit: PAGE_SIZE, signal: controller.signal })
      if (controller.signal.aborted) return
      setExtraPayments((current) => {
        const known = new Set([...firstPage.items, ...current].map((payment) => payment.id))
        return [...current, ...page.items.filter((payment) => !known.has(payment.id))]
      })
      setNextPage({ hasPossibleNextPage: page.hasPossibleNextPage, loading: false, error: null })
    } catch (cause) {
      if (controller.signal.aborted) return
      setNextPage((current) => ({ ...current, loading: false, error: paymentErrorMessage(cause) }))
    } finally {
      if (!controller.signal.aborted) loadMoreInFlight.current = false
    }
  }

  return <section className={styles.panel} aria-label={`Pagos de ${patientName}`}>
    <header className={styles.heading}>
      <div>
        <h3>Pagos de {patientName}</h3>
        <p>Los importes se muestran como valores decimales exactos informados por el servicio.</p>
      </div>
      <Button size="sm" onClick={() => setCreating(true)}>Registrar pago</Button>
    </header>

    {paymentsResource.state.status === 'loading' && payments.length === 0 ? <p role="status">Cargando pagos…</p> : null}
    {paymentsResource.state.status === 'error' ? <FormAlert tone="error">{paymentErrorMessage(paymentsResource.state.error)} <Button size="sm" variant="secondary" onClick={() => void reloadPayments()}>Reintentar</Button></FormAlert> : null}
    {notice ? <FormAlert tone="error">{notice}</FormAlert> : null}
    {paymentsResource.state.status === 'ready' && payments.length === 0 ? <p className={styles.empty}>No hay pagos registrados para este paciente.</p> : null}
    {payments.length ? <div className={styles.list}>{payments.map((payment) => <button className={styles.row} type="button" key={payment.id} onClick={() => setSelectedPaymentId(payment.id)}><span><strong>{amountLabel(payment.currency, payment.amount)}</strong><small>{PAYMENT_METHODS.find((method) => method.value === payment.internalMethod)?.label ?? payment.internalMethod}</small></span><Badge tone="neutral">{paymentStatusLabel(payment.status)}</Badge></button>)}</div> : null}
    {nextPage.error ? <FormAlert tone="error">{nextPage.error}</FormAlert> : null}
    {canLoadMore ? <Button size="sm" variant="secondary" disabled={nextPage.loading} onClick={() => void loadMore()}>{nextPage.loading ? 'Cargando…' : 'Cargar más'}</Button> : null}

    {creating ? <PaymentForm patientId={patientId} api={api} onCancel={() => setCreating(false)} onCreated={async () => { setCreating(false); try { await reloadPayments() } catch (cause) { setNotice(`El pago fue registrado, pero no pudimos actualizar la lista. ${paymentErrorMessage(cause)}`) } }} /> : null}
    {selectedPaymentId ? <PaymentDetail key={selectedPaymentId} paymentId={selectedPaymentId} patientId={patientId} api={api} treatmentsApi={treatmentsApi} onChanged={reloadPayments} /> : null}
  </section>
}

function PaymentForm({ patientId, api, onCancel, onCreated }: { patientId: string; api: PaymentsApi; onCancel: () => void; onCreated: () => Promise<void> }) {
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('CASH')
  const [paymentFormCode, setPaymentFormCode] = useState('01')
  const [confirmed, setConfirmed] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)
  const idempotency = useRef<{ fingerprint: string; key: string } | null>(null)
  const amountError = amount && !isExactPositiveDecimal(amount) ? 'Ingresá un decimal positivo exacto, sin separadores de miles.' : undefined
  const codeError = paymentFormCode && !isPaymentFormCompatible(method, paymentFormCode) ? 'La forma de pago no corresponde al método elegido.' : undefined

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (inFlight.current || amountError || codeError || !confirmed || !currency.trim()) return
    inFlight.current = true
    setPending(true)
    setError(null)
    const input = { patientId, amount, currency: currency.trim().toUpperCase(), internalMethod: method, satPaymentFormCode: paymentFormCode }
    try {
      await api.createPayment({ ...input, idempotencyKey: submissionKey(idempotency, input) })
      await onCreated()
    } catch (cause) {
      setError(paymentErrorMessage(cause))
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }

  return <form className={styles.form} onSubmit={(event) => void submit(event)}>
    <h4>Registrar pago</h4>
    {error ? <FormAlert tone="error">{error}</FormAlert> : null}
    <TextField label="Importe" inputMode="decimal" required value={amount} error={amountError} onChange={(event) => setAmount(event.target.value)} />
    <TextField label="Moneda ISO" placeholder="MXN" maxLength={3} required value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} />
    <SelectField label="Método interno" value={method} options={PAYMENT_METHODS} onChange={(event) => setMethod(event.target.value as PaymentMethod)} />
    <TextField label="Forma de pago SAT" hint="Código real de dos dígitos; el catálogo del servicio confirma su vigencia." inputMode="numeric" maxLength={2} required value={paymentFormCode} error={codeError} onChange={(event) => setPaymentFormCode(event.target.value)} />
    <label className={styles.confirm}><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> Confirmo el registro financiero con estos datos.</label>
    <FormActions pending={pending} onCancel={onCancel} submitLabel="Registrar pago" />
  </form>
}

function PaymentDetail({ paymentId, patientId, api, treatmentsApi, onChanged }: { paymentId: string; patientId: string; api: PaymentsApi; treatmentsApi: TreatmentsApi; onChanged: () => Promise<void> }) {
  const detail = useResource((signal) => api.getPayment(paymentId, signal), [api, paymentId])
  const allocations = useResource((signal) => api.listAllocations({ paymentId, limit: PAGE_SIZE, signal }), [api, paymentId])
  const refunds = useResource((signal) => api.listRefunds({ paymentId, limit: PAGE_SIZE, signal }), [api, paymentId])
  const retained = useRef<Payment | null>(null)
  const [extraAllocations, setExtraAllocations] = useState<PaymentAllocation[]>([])
  const [extraRefunds, setExtraRefunds] = useState<Refund[]>([])
  const [allocationsNext, setAllocationsNext] = useState({ hasPossibleNextPage: false, loading: false, error: null as string | null })
  const [refundsNext, setRefundsNext] = useState({ hasPossibleNextPage: false, loading: false, error: null as string | null })
  const allocationLoadInFlight = useRef(false)
  const refundLoadInFlight = useRef(false)
  const nestedEpoch = useRef(0)
  const [error, setError] = useState<string | null>(null)
  const [mutationPending, setMutationPending] = useState(false)
  const [refreshFailed, setRefreshFailed] = useState(false)
  if (detail.state.status === 'ready') retained.current = detail.state.data
  const payment = detail.state.status === 'ready' ? detail.state.data : retained.current
  const firstAllocations = allocations.state.status === 'ready' ? allocations.state.data : null
  const firstRefunds = refunds.state.status === 'ready' ? refunds.state.data : null
  const allocationItems = firstAllocations ? [...firstAllocations.items, ...extraAllocations] : []
  const refundItems = firstRefunds ? [...firstRefunds.items, ...extraRefunds] : []
  const allocationsCanLoadMore = Boolean(firstAllocations && (extraAllocations.length ? allocationsNext.hasPossibleNextPage : firstAllocations.hasPossibleNextPage))
  const refundsCanLoadMore = Boolean(firstRefunds && (extraRefunds.length ? refundsNext.hasPossibleNextPage : firstRefunds.hasPossibleNextPage))

  const resetNestedPages = () => {
    nestedEpoch.current += 1
    allocationLoadInFlight.current = false
    refundLoadInFlight.current = false
    setExtraAllocations([])
    setExtraRefunds([])
    setAllocationsNext({ hasPossibleNextPage: false, loading: false, error: null })
    setRefundsNext({ hasPossibleNextPage: false, loading: false, error: null })
  }

  const reload = async () => {
    resetNestedPages()
    // useResource.reload records rejected loads as state and resolves its promise. Verify each
    // source directly before treating a write as refreshed or allowing its form to close.
    await Promise.all([
      api.getPayment(paymentId),
      api.listAllocations({ paymentId, limit: PAGE_SIZE }),
      api.listRefunds({ paymentId, limit: PAGE_SIZE }),
    ])
    await Promise.all([detail.reload(), allocations.reload(), refunds.reload(), onChanged()])
  }

  const refreshCurrent = async () => {
    if (mutationPending) return
    setMutationPending(true)
    setError(null)
    try {
      await reload()
      setRefreshFailed(false)
    } catch (cause) {
      setRefreshFailed(true)
      setError(paymentErrorMessage(cause))
    } finally {
      setMutationPending(false)
    }
  }

  const loadMoreAllocations = async () => {
    const afterId = allocationItems.at(-1)?.id
    if (!afterId || !allocationsCanLoadMore || allocationLoadInFlight.current) return
    const epoch = nestedEpoch.current
    allocationLoadInFlight.current = true
    setAllocationsNext((current) => ({ ...current, loading: true, error: null }))
    try {
      const page = await api.listAllocations({ paymentId, afterId, limit: PAGE_SIZE })
      if (epoch !== nestedEpoch.current) return
      setExtraAllocations((current) => {
        const known = new Set([...(firstAllocations?.items ?? []), ...current].map((item) => item.id))
        return [...current, ...page.items.filter((item) => !known.has(item.id))]
      })
      setAllocationsNext({ hasPossibleNextPage: page.hasPossibleNextPage, loading: false, error: null })
    } catch (cause) {
      if (epoch === nestedEpoch.current) setAllocationsNext((current) => ({ ...current, loading: false, error: paymentErrorMessage(cause) }))
    } finally {
      if (epoch === nestedEpoch.current) allocationLoadInFlight.current = false
    }
  }

  const loadMoreRefunds = async () => {
    const afterId = refundItems.at(-1)?.id
    if (!afterId || !refundsCanLoadMore || refundLoadInFlight.current) return
    const epoch = nestedEpoch.current
    refundLoadInFlight.current = true
    setRefundsNext((current) => ({ ...current, loading: true, error: null }))
    try {
      const page = await api.listRefunds({ paymentId, afterId, limit: PAGE_SIZE })
      if (epoch !== nestedEpoch.current) return
      setExtraRefunds((current) => {
        const known = new Set([...(firstRefunds?.items ?? []), ...current].map((item) => item.id))
        return [...current, ...page.items.filter((item) => !known.has(item.id))]
      })
      setRefundsNext({ hasPossibleNextPage: page.hasPossibleNextPage, loading: false, error: null })
    } catch (cause) {
      if (epoch === nestedEpoch.current) setRefundsNext((current) => ({ ...current, loading: false, error: paymentErrorMessage(cause) }))
    } finally {
      if (epoch === nestedEpoch.current) refundLoadInFlight.current = false
    }
  }

  const mutateWithCurrentPayment = async (operation: (snapshot: PaymentSnapshot) => Promise<void>) => {
    if (mutationPending || refreshFailed || !firstAllocations || !firstRefunds || detail.state.status !== 'ready') throw new Error('El estado autorizado del pago todavía no está disponible.')
    setMutationPending(true)
    setRefreshFailed(false)
    setError(null)
    let acknowledged = false
    try {
      const [current, currentAllocations, currentRefunds] = await Promise.all([
        api.getPayment(paymentId),
        api.listAllocations({ paymentId, limit: PAGE_SIZE }),
        api.listRefunds({ paymentId, limit: PAGE_SIZE }),
      ])
      await operation({ payment: current, allocations: currentAllocations.items, allocationsMayHaveMore: currentAllocations.hasPossibleNextPage, refunds: currentRefunds.items, refundsMayHaveMore: currentRefunds.hasPossibleNextPage })
      acknowledged = true
      try {
        await reload()
      } catch (cause) {
        setRefreshFailed(true)
        setError(`La operación financiera fue confirmada, pero no pudimos actualizar los datos. ${paymentErrorMessage(cause)}`)
      }
    } catch (cause) {
      if (!acknowledged) {
        setRefreshFailed(true)
        setError(paymentErrorMessage(cause))
        await Promise.all([detail.reload(), allocations.reload(), refunds.reload()])
        throw cause
      }
    } finally {
      setMutationPending(false)
    }
  }

  const replayRefund = async (attempt: RefundAttempt) => {
    if (mutationPending) throw new Error('El reembolso todavía se está procesando.')
    setMutationPending(true)
    setError(null)
    try {
      await api.createRefund(attempt)
      try {
        await reload()
        setRefreshFailed(false)
      } catch (cause) {
        setRefreshFailed(true)
        setError(`El reembolso fue confirmado, pero no pudimos actualizar los datos. ${paymentErrorMessage(cause)}`)
      }
    } catch (cause) {
      setRefreshFailed(true)
      setError(paymentErrorMessage(cause))
      await Promise.all([detail.reload(), allocations.reload(), refunds.reload()])
      throw cause
    } finally {
      setMutationPending(false)
    }
  }

  if (!payment) return detail.state.status === 'error' ? <FormAlert tone="error">{paymentErrorMessage(detail.state.error)}</FormAlert> : <p role="status">Verificando el estado actual del pago…</p>
  const resourcesReady = !mutationPending && !refreshFailed && detail.state.status === 'ready' && Boolean(firstAllocations) && Boolean(firstRefunds)
  const hasActiveAllocations = Boolean(firstAllocations && (firstAllocations.hasPossibleNextPage || allocationItems.some((allocation) => !allocation.reversed)))
  const hasCompletedRefunds = Boolean(firstRefunds && (firstRefunds.hasPossibleNextPage || refundItems.some((refund) => refund.status === 'COMPLETED')))
  const transitions = resourcesReady ? allowedPaymentTransitions(payment.status, hasActiveAllocations, hasCompletedRefunds) : []
  const allocationPage: NestedPage<PaymentAllocation> = { items: allocationItems, canLoadMore: allocationsCanLoadMore, loading: allocationsNext.loading, error: allocationsNext.error, loadMore: loadMoreAllocations }
  const refundPage: NestedPage<Refund> = { items: refundItems, canLoadMore: refundsCanLoadMore, loading: refundsNext.loading, error: refundsNext.error, loadMore: loadMoreRefunds }

  return <article className={styles.detail} aria-busy={!resourcesReady}>
    <header className={styles.detailHeading}><div><h4>Detalle del pago</h4><p>{amountLabel(payment.currency, payment.amount)} · versión {payment.version}</p></div><Badge tone="neutral">{paymentStatusLabel(payment.status)}</Badge></header>
    {detail.state.status === 'loading' ? <p role="status">Actualizando el estado actual del pago…</p> : null}
    {detail.state.status === 'error' ? <FormAlert tone="error">{paymentErrorMessage(detail.state.error)}</FormAlert> : null}
    {error ? <FormAlert tone="error">{error}</FormAlert> : null}
    {!resourcesReady ? <div className={styles.inlineActions}><p className={styles.muted}>Las acciones esperan la información actual de asignaciones y reembolsos.</p><Button size="sm" variant="secondary" disabled={mutationPending} onClick={() => void refreshCurrent()}>Actualizar estado</Button></div> : null}
    {resourcesReady ? <PaymentStatusActions api={api} transitions={transitions} mutate={mutateWithCurrentPayment} /> : null}
    <AllocationSection api={api} treatmentsApi={treatmentsApi} patientId={patientId} payment={payment} page={allocationPage} ready={resourcesReady} mutate={mutateWithCurrentPayment} />
    <RefundSection api={api} payment={payment} page={refundPage} ready={resourcesReady} mutate={mutateWithCurrentPayment} replay={replayRefund} />
  </article>
}

function PaymentStatusActions({ api, transitions, mutate }: { api: PaymentsApi; transitions: PaymentStatus[]; mutate: (operation: (snapshot: PaymentSnapshot) => Promise<void>) => Promise<void> }) {
  const [pendingStatus, setPendingStatus] = useState<PaymentStatus | null>(null)
  const inFlight = useRef(false)
  const confirm = async () => {
    if (!pendingStatus || inFlight.current) return
    inFlight.current = true
    const status = pendingStatus
    try {
      await mutate((current) => {
        const legal = allowedPaymentTransitions(
          current.payment.status,
          current.allocationsMayHaveMore || current.allocations.some((allocation) => !allocation.reversed),
          current.refundsMayHaveMore || current.refunds.some((refund) => refund.status === 'COMPLETED'),
        )
        if (!legal.includes(status)) return Promise.reject(new Error('El estado actual ya no permite esta transición.'))
        return api.transitionPayment({ id: current.payment.id, version: current.payment.version, status }).then(() => undefined)
      })
    } catch {
      // PaymentDetail retains and reports the authoritative error.
    } finally {
      inFlight.current = false
      setPendingStatus(null)
    }
  }
  if (!transitions.length && !pendingStatus) return null
  return <section className={styles.actions} aria-label="Cambiar estado del pago">
    {transitions.map((status) => <Button key={status} size="sm" variant="secondary" onClick={() => setPendingStatus(status)}>{paymentStatusLabel(status)}</Button>)}
    {pendingStatus ? <Confirmation label={`¿Confirmás cambiar el pago a ${paymentStatusLabel(pendingStatus)}?`} onCancel={() => setPendingStatus(null)} onConfirm={() => void confirm()} /> : null}
  </section>
}

function AllocationSection({ api, treatmentsApi, patientId, payment, page, ready, mutate }: { api: PaymentsApi; treatmentsApi: TreatmentsApi; patientId: string; payment: Payment; page: NestedPage<PaymentAllocation>; ready: boolean; mutate: (operation: (snapshot: PaymentSnapshot) => Promise<void>) => Promise<void> }) {
  const [adding, setAdding] = useState(false)
  const [reversing, setReversing] = useState<string | null>(null)
  const inFlight = useRef(false)
  const reverse = async () => {
    if (!reversing || inFlight.current) return
    inFlight.current = true
    const allocationId = reversing
    try {
      await mutate((current) => api.reverseAllocation({ paymentId: current.payment.id, allocationId, version: current.payment.version }).then(() => undefined))
    } catch {
      // PaymentDetail retains and reports the authoritative error.
    } finally {
      inFlight.current = false
      setReversing(null)
    }
  }
  return <section className={styles.nested} aria-label="Asignaciones">
    <div className={styles.nestedHeading}><h5>Asignaciones</h5>{ready && ['RECEIVED', 'PARTIALLY_REFUNDED'].includes(payment.status) ? <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>Asignar a tratamiento</Button> : null}</div>
    {page.items.length ? <div className={styles.list}>{page.items.map((allocation) => <div className={styles.infoRow} key={allocation.id}><span>{amountLabel(payment.currency, allocation.amount)} · plan {allocation.treatmentPlanId}{allocation.treatmentPlanItemId ? ` · procedimiento ${allocation.treatmentPlanItemId}` : ''}</span>{!allocation.reversed && ready ? <Button size="sm" variant="secondary" onClick={() => setReversing(allocation.id)}>Revertir asignación</Button> : <small>{allocation.reversed ? 'Revertida' : ''}</small>}</div>)}</div> : <p className={styles.empty}>No hay asignaciones registradas.</p>}
    {page.error ? <FormAlert tone="error">{page.error}</FormAlert> : null}
    {page.canLoadMore ? <Button size="sm" variant="secondary" disabled={page.loading} onClick={() => void page.loadMore()}>{page.loading ? 'Cargando…' : 'Cargar más asignaciones'}</Button> : null}
    {adding ? <AllocationForm api={api} treatmentsApi={treatmentsApi} patientId={patientId} payment={payment} onCancel={() => setAdding(false)} onSubmit={async (input) => { await mutate((current) => api.allocatePayment({ ...input, paymentId: current.payment.id, version: current.payment.version }).then(() => undefined)); setAdding(false) }} /> : null}
    {reversing ? <Confirmation label="¿Confirmás revertir esta asignación financiera? El servicio conservará la bitácora." onCancel={() => setReversing(null)} onConfirm={() => void reverse()} /> : null}
  </section>
}

function AllocationForm({ api: _api, treatmentsApi, patientId, payment, onCancel, onSubmit }: { api: PaymentsApi; treatmentsApi: TreatmentsApi; patientId: string; payment: Payment; onCancel: () => void; onSubmit: (input: { treatmentPlanId: string; treatmentPlanItemId?: string; amount: string }) => Promise<void> }) {
  const plans = useResource((signal) => treatmentsApi.listPlans(patientId, signal), [treatmentsApi, patientId])
  const [planId, setPlanId] = useState('')
  const items = useResource((signal) => planId ? treatmentsApi.listItems(planId, signal) : Promise.resolve([]), [treatmentsApi, planId])
  const [itemId, setItemId] = useState('')
  const [amount, setAmount] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)
  const amountError = amount && !isExactPositiveDecimal(amount) ? 'Ingresá un decimal positivo exacto.' : undefined
  const eligiblePlans = plans.state.status === 'ready' ? plans.state.data.filter((plan) => ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED'].includes(plan.status) && plan.currency === payment.currency) : []
  const eligibleItems = items.state.status === 'ready' ? items.state.data.filter((item) => item.status !== 'CANCELLED') : []
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (inFlight.current || !planId || !confirmed || amountError) return
    inFlight.current = true
    setPending(true)
    setError(null)
    try {
      await onSubmit({ treatmentPlanId: planId, ...(itemId ? { treatmentPlanItemId: itemId } : {}), amount })
    } catch (cause) {
      setError(paymentErrorMessage(cause))
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }
  return <form className={styles.form} onSubmit={(event) => void submit(event)}><h5>Asignar pago</h5>{error ? <FormAlert tone="error">{error}</FormAlert> : null}{plans.state.status === 'error' ? <FormAlert tone="error">No se pudieron cargar los planes reales del paciente.</FormAlert> : null}<SelectField label="Plan de tratamiento" required value={planId} options={[{ value: '', label: 'Seleccioná un plan elegible' }, ...eligiblePlans.map((plan) => ({ value: plan.id, label: `${plan.name} · ${plan.status} · ${amountLabel(plan.currency, plan.total)}` }))]} onChange={(event) => { setPlanId(event.target.value); setItemId('') }} />{planId ? <SelectField label="Procedimiento (opcional)" value={itemId} options={[{ value: '', label: 'Aplicar al plan completo' }, ...eligibleItems.map((item) => ({ value: item.id, label: `${item.description} · ${amountLabel(payment.currency, item.total)}` }))]} onChange={(event) => setItemId(event.target.value)} /> : null}<TextField label="Importe a asignar" inputMode="decimal" required value={amount} error={amountError} onChange={(event) => setAmount(event.target.value)} /><label className={styles.confirm}><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> Confirmo la asignación financiera al tratamiento seleccionado.</label><FormActions pending={pending} onCancel={onCancel} submitLabel="Asignar" /></form>
}

function RefundSection({ api, payment, page, ready, mutate, replay }: { api: PaymentsApi; payment: Payment; page: NestedPage<Refund>; ready: boolean; mutate: (operation: (snapshot: PaymentSnapshot) => Promise<void>) => Promise<void>; replay: (attempt: RefundAttempt) => Promise<void> }) {
  const [creating, setCreating] = useState(false)
  const [pendingAttempt, setPendingAttempt] = useState<RefundAttempt | null>(null)
  const attempt = useRef<RefundAttempt | null>(null)
  const submit = async (input: { amount: string; reason: RefundReason; idempotencyKey: string }) => {
    try {
      if (attempt.current) await replay(attempt.current)
      else await mutate((current) => {
        const frozen: RefundAttempt = { paymentId: current.payment.id, version: current.payment.version, ...input }
        attempt.current = frozen
        setPendingAttempt(frozen)
        return api.createRefund(frozen).then(() => undefined)
      })
      attempt.current = null
      setPendingAttempt(null)
      setCreating(false)
    } catch (cause) {
      // A deliberate pre-commit conflict cannot be replayed with an obsolete authority.
      if (isVersionConflict(cause)) {
        attempt.current = null
        setPendingAttempt(null)
      }
      throw cause
    }
  }
  return <section className={styles.nested} aria-label="Reembolsos"><div className={styles.nestedHeading}><h5>Reembolsos</h5>{ready && ['RECEIVED', 'PARTIALLY_REFUNDED'].includes(payment.status) ? <Button size="sm" variant="secondary" onClick={() => setCreating(true)}>Crear reembolso</Button> : null}</div>{page.items.length ? <div className={styles.list}>{page.items.map((refund) => <RefundRow key={refund.id} api={api} refund={refund} mutate={mutate} />)}</div> : <p className={styles.empty}>No hay reembolsos registrados.</p>}{page.error ? <FormAlert tone="error">{page.error}</FormAlert> : null}{page.canLoadMore ? <Button size="sm" variant="secondary" disabled={page.loading} onClick={() => void page.loadMore()}>{page.loading ? 'Cargando…' : 'Cargar más reembolsos'}</Button> : null}{creating ? <RefundForm api={api} payment={payment} attempt={pendingAttempt} onCancel={() => { attempt.current = null; setPendingAttempt(null); setCreating(false) }} onSubmit={submit} /> : null}</section>
}

function RefundRow({ api, refund, mutate }: { api: PaymentsApi; refund: Refund; mutate: (operation: (snapshot: PaymentSnapshot) => Promise<void>) => Promise<void> }) {
  const [pendingStatus, setPendingStatus] = useState<RefundStatus | null>(null)
  const inFlight = useRef(false)
  const confirm = async () => {
    if (!pendingStatus || inFlight.current) return
    inFlight.current = true
    const status = pendingStatus
    try {
      await mutate((current) => {
        // The selected refund may be on a later keyset page. Its fetched version is the
        // authority for this refund endpoint; the first page only guards parent payment state.
        const latestRefund = current.refunds.find((item) => item.id === refund.id) ?? refund
        if (!allowedRefundTransitions(latestRefund.status).includes(status)) return Promise.reject(new Error('El reembolso actual ya no permite esta transición.'))
        return api.transitionRefund({ id: latestRefund.id, version: latestRefund.version, status }).then(() => undefined)
      })
    } catch {
      // PaymentDetail retains and reports the authoritative error.
    } finally {
      inFlight.current = false
      setPendingStatus(null)
    }
  }
  const transitions = allowedRefundTransitions(refund.status)
  return <div className={styles.infoRow}><span>{refund.amount} · <Badge tone="neutral">{refundStatusLabel(refund.status)}</Badge></span><span className={styles.inlineActions}>{transitions.map((status) => <Button key={status} size="sm" variant="secondary" onClick={() => setPendingStatus(status)}>{refundStatusLabel(status)}</Button>)}</span>{pendingStatus ? <Confirmation label={`¿Confirmás el reembolso como ${refundStatusLabel(pendingStatus)}?`} onCancel={() => setPendingStatus(null)} onConfirm={() => void confirm()} /> : null}</div>
}

function RefundForm({ payment, attempt, onCancel, onSubmit }: { api: PaymentsApi; payment: Payment; attempt: RefundAttempt | null; onCancel: () => void; onSubmit: (input: { amount: string; reason: RefundReason; idempotencyKey: string }) => Promise<void> }) {
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState<RefundReason>('PATIENT_REQUEST')
  const [confirmed, setConfirmed] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)
  const idempotency = useRef<{ fingerprint: string; key: string } | null>(null)
  const amountError = amount && !isExactPositiveDecimal(amount) ? 'Ingresá un decimal positivo exacto.' : undefined
  const submit = async (event: FormEvent) => { event.preventDefault(); if (inFlight.current || amountError || !confirmed) return; inFlight.current = true; setPending(true); setError(null); const input = { amount, reason }; try { await onSubmit({ ...input, idempotencyKey: submissionKey(idempotency, input) }) } catch (cause) { setError(paymentErrorMessage(cause)) } finally { inFlight.current = false; setPending(false) } }
  return <form className={styles.form} onSubmit={(event) => void submit(event)}><h5>Crear reembolso</h5>{attempt ? <FormAlert tone="error">Conservamos este reembolso pendiente con su versión original. Reintentá el mismo envío o cancelalo y actualizá el estado antes de iniciar una operación distinta.</FormAlert> : null}{error ? <FormAlert tone="error">{error}</FormAlert> : null}<TextField label={`Importe en ${payment.currency}`} inputMode="decimal" required disabled={Boolean(attempt)} value={amount} error={amountError} onChange={(event) => setAmount(event.target.value)} /><SelectField label="Motivo requerido" disabled={Boolean(attempt)} value={reason} options={REFUND_REASONS} onChange={(event) => setReason(event.target.value as RefundReason)} /><label className={styles.confirm}><input type="checkbox" disabled={Boolean(attempt)} checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> Confirmo la creación de este reembolso financiero.</label><FormActions pending={pending} onCancel={onCancel} submitLabel="Crear reembolso" /></form>
}

function Confirmation({ label, onCancel, onConfirm }: { label: string; onCancel: () => void; onConfirm: () => void }) {
  return <div className={styles.confirmation} role="alertdialog"><p>{label}</p><div className={styles.inlineActions}><Button size="sm" variant="secondary" onClick={onCancel}>Cancelar</Button><Button size="sm" onClick={onConfirm}>Confirmar</Button></div></div>
}

function FormActions({ pending, onCancel, submitLabel }: { pending: boolean; onCancel: () => void; submitLabel: string }) {
  return <div className={styles.inlineActions}><Button type="button" size="sm" variant="secondary" disabled={pending} onClick={onCancel}>Cancelar</Button><Button type="submit" size="sm" disabled={pending}>{pending ? 'Guardando…' : submitLabel}</Button></div>
}
