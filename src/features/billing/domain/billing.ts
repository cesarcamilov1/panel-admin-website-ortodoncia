import { isApiError } from '../../../shared/api/problem'

export type BillingDocumentType = 'I' | 'E' | 'P'
export type BillingDocumentStatus = 'QUEUED' | 'PROCESSING' | 'ISSUED' | 'UNKNOWN' | 'FAILED' | 'CANCEL_QUEUED' | 'CANCEL_PENDING' | 'CANCELLED' | 'CANCEL_FAILED'
export type BillingFileFormat = 'xml' | 'pdf' | 'ack'
export type BillingCatalog = 'payment-forms' | 'payment-methods' | 'fiscal-regimes' | 'cfdi-uses' | 'currencies' | 'relation-types' | 'federal-taxes'
export type CancellationMotive = '01' | '02' | '03' | '04'

export interface BillingDocument {
  id: string
  patientId: string
  type: BillingDocumentType
  status: BillingDocumentStatus
  total: string
  version: number
}

export interface BillingDocumentDetail extends BillingDocument {
  cfdiUuid: string
  lastErrorCode: string
  files: Record<BillingFileFormat, boolean>
}

export interface BillingCatalogEntry { value: string; name: string }
export interface BillingCatalogPage { items: BillingCatalogEntry[]; page: number; mayHaveMore: boolean }

const decimal = (value: unknown): string => typeof value === 'string' ? value : ''

export function fromBillingDocumentDto(dto: any): BillingDocument {
  return {
    id: dto.id,
    patientId: dto.patient_id,
    type: dto.cfdi_type,
    status: dto.status,
    total: decimal(dto.total),
    version: dto.version,
  }
}

export function fromBillingDetailDto(dto: any): BillingDocumentDetail {
  return {
    ...fromBillingDocumentDto(dto),
    cfdiUuid: dto.cfdi_uuid ?? '',
    lastErrorCode: dto.last_error_code ?? '',
    files: {
      xml: dto.files?.xml === true,
      pdf: dto.files?.pdf === true,
      ack: dto.files?.ack === true,
    },
  }
}

export function canManageBilling(role: string): boolean {
  return role === 'OWNER_DENTIST' || role === 'BILLING'
}

export function isExactFiscalDecimal(value: string): boolean {
  return /^\d+\.\d{6}$/.test(value)
}

export function billingTypeLabel(type: BillingDocumentType): string {
  return ({ I: 'Ingreso', E: 'Egreso', P: 'Complemento de pago' })[type]
}

export function billingStatusLabel(status: BillingDocumentStatus): string {
  return ({
    QUEUED: 'En cola',
    PROCESSING: 'Procesando',
    ISSUED: 'Emitido',
    UNKNOWN: 'Estado por confirmar',
    FAILED: 'Fallido',
    CANCEL_QUEUED: 'Cancelación en cola',
    CANCEL_PENDING: 'Cancelación pendiente',
    CANCELLED: 'Cancelado',
    CANCEL_FAILED: 'Cancelación fallida',
  })[status]
}

export function canRequestBillingReplacement(document: BillingDocumentDetail): boolean {
  return document.status === 'ISSUED' && document.type === 'I'
}

export function canRequestBillingEmail(document: BillingDocumentDetail): boolean {
  return document.status === 'ISSUED'
}

export function canRequestBillingCancellation(document: BillingDocumentDetail): boolean {
  return document.status === 'ISSUED' || document.status === 'CANCEL_FAILED'
}

export function legalBillingActions(document: BillingDocumentDetail): Array<'replace' | 'cancel' | 'send-email' | 'reconcile'> {
  const actions: Array<'replace' | 'cancel' | 'send-email' | 'reconcile'> = []
  if (canRequestBillingCancellation(document)) actions.push('cancel')
  if (canRequestBillingReplacement(document)) actions.push('replace')
  if (canRequestBillingEmail(document)) actions.push('send-email')
  if (['UNKNOWN', 'ISSUED', 'CANCEL_PENDING', 'CANCEL_FAILED'].includes(document.status)) actions.push('reconcile')
  return actions
}

export function billingErrorMessage(error: unknown): string {
  if (!isApiError(error)) return 'No pudimos comunicarnos con el servicio de facturación. La operación no se confirmó.'
  if (error.code === 'RECENT_MFA_REQUIRED') return 'Esta acción requiere MFA reciente. Cerrá sesión e ingresá nuevamente, completá MFA y reintentá; no se realizó ningún bypass.'
  if (error.code === 'FORBIDDEN') return 'Tu rol no tiene permiso para consultar o administrar facturación.'
  if (error.code === 'FISCAL_DATA_REQUIRED') return 'El paciente no tiene datos fiscales válidos. Completalos antes de solicitar el comprobante.'
  if (error.code === 'IDENTITY_REVIEW_REQUIRED') return 'La identidad del paciente debe ser revisada por personal antes de facturar.'
  if (error.code === 'DEPENDENCY_UNAVAILABLE') return 'La configuración fiscal del servidor o el proveedor no está disponible. Verificá emisor, PAC y dependencias con administración; no se creó ningún comprobante.'
  if (error.code === 'PRECONDITION_FAILED' || error.code === 'VERSION_CONFLICT' || error.status === 412) return 'El documento cambió en otra sesión. Se conservó el error y las acciones quedan bloqueadas hasta recargar el detalle.'
  if (error.code === 'IDEMPOTENCY_CONFLICT') return 'La clave de idempotencia ya pertenece a un intento distinto. No se reintentó con un cuerpo modificado.'
  if (error.code === 'FISCAL_CONFLICT' || error.code === 'REPLACEMENT_UNAVAILABLE' || error.status === 409) return 'La acción no es válida para el estado fiscal actual. Recargá el detalle antes de iniciar un nuevo intento.'
  if (error.code === 'VALIDATION_ERROR') return error.detail ?? 'El servidor rechazó los requisitos fiscales de esta solicitud. Corregí lo indicado y confirmá un intento nuevo.'
  return error.detail ?? 'El servidor rechazó la solicitud fiscal. Revisá los datos y el estado actual.'
}
