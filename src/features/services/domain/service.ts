import { isApiError } from '../../../shared/api/problem'

/**
 * Money is never a JavaScript number here. The backend models prices as exact
 * decimal strings (`^(0|[1-9][0-9]{0,11})(\.[0-9]{1,6})?$`) and so do we: a float
 * round-trip would silently lose cents on the way to an invoice.
 */
export type Currency = 'MXN'

export interface CatalogService {
  id: string
  code: string
  name: string
  description: string
  durationMinutes: number
  defaultPrice: string
  currency: Currency
  isActive: boolean
  createdAt: string
  updatedAt: string
  version: number
}

export interface CatalogServiceDto {
  id: string
  code: string
  name: string
  description?: string
  duration_minutes: number
  default_price: string
  currency: Currency
  is_active: boolean
  created_at: string
  updated_at: string
  version: number
}

export interface ServiceListDto {
  items: CatalogServiceDto[]
}

export function fromCatalogServiceDto(dto: CatalogServiceDto): CatalogService {
  return {
    id: dto.id,
    code: dto.code,
    name: dto.name,
    description: dto.description ?? '',
    durationMinutes: dto.duration_minutes,
    defaultPrice: dto.default_price,
    currency: dto.currency,
    isActive: dto.is_active,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
    version: dto.version,
  }
}

export interface ServiceDraft {
  code: string
  name: string
  description: string
  durationMinutes: number
  defaultPrice: string
  isActive: boolean
}

export interface ServiceWriteDto {
  code: string
  name: string
  description?: string
  duration_minutes: number
  default_price: string
  currency: Currency
  is_active: boolean
}

export interface ServiceUpdateDto extends ServiceWriteDto {
  expected_version?: number
}

export const DURATION_MIN_MINUTES = 5
export const DURATION_MAX_MINUTES = 480
export const DURATION_STEP_MINUTES = 5
export const CODE_MAX_LENGTH = 50
export const NAME_MAX_LENGTH = 200
export const DESCRIPTION_MAX_LENGTH = 2000

const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{1,49}$/
const PRICE_PATTERN = /^(0|[1-9][0-9]{0,11})(\.[0-9]{1,6})?$/

export function validateServiceCode(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return 'El código es obligatorio.'
  if (trimmed.length > CODE_MAX_LENGTH) {
    return `El código no puede pasar de ${CODE_MAX_LENGTH} caracteres.`
  }
  if (!CODE_PATTERN.test(trimmed)) {
    return 'Usa 2 a 50 caracteres en mayúsculas, números, guion o guion bajo, empezando por letra o número.'
  }
  return null
}

export function validateServiceName(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return 'El nombre es obligatorio.'
  if (trimmed.length > NAME_MAX_LENGTH) {
    return `El nombre no puede pasar de ${NAME_MAX_LENGTH} caracteres.`
  }
  return null
}

export function validateServiceDescription(value: string): string | null {
  if (value.trim().length > DESCRIPTION_MAX_LENGTH) {
    return `La descripción no puede pasar de ${DESCRIPTION_MAX_LENGTH} caracteres.`
  }
  return null
}

export function validateServiceDuration(minutes: number): string | null {
  if (!Number.isInteger(minutes)) return 'La duración debe ser un número entero de minutos.'
  if (minutes < DURATION_MIN_MINUTES || minutes > DURATION_MAX_MINUTES) {
    return `La duración debe estar entre ${DURATION_MIN_MINUTES} y ${DURATION_MAX_MINUTES} minutos.`
  }
  if (minutes % DURATION_STEP_MINUTES !== 0) {
    return `La duración debe ir en múltiplos de ${DURATION_STEP_MINUTES} minutos.`
  }
  return null
}

export function validateServicePrice(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return 'El precio es obligatorio.'
  if (!PRICE_PATTERN.test(trimmed)) {
    return 'Escribe un precio válido, sin separador de miles y con hasta 6 decimales.'
  }
  return null
}

export type ServiceDraftErrors = Partial<Record<keyof ServiceDraft, string>>

export function validateServiceDraft(draft: ServiceDraft): ServiceDraftErrors {
  const errors: ServiceDraftErrors = {}
  const code = validateServiceCode(draft.code)
  if (code) errors.code = code
  const name = validateServiceName(draft.name)
  if (name) errors.name = name
  const description = validateServiceDescription(draft.description)
  if (description) errors.description = description
  const duration = validateServiceDuration(draft.durationMinutes)
  if (duration) errors.durationMinutes = duration
  const price = validateServicePrice(draft.defaultPrice)
  if (price) errors.defaultPrice = price
  return errors
}

export function toServiceWriteDto(draft: ServiceDraft): ServiceWriteDto {
  const description = draft.description.trim()
  return {
    code: draft.code.trim(),
    name: draft.name.trim(),
    ...(description ? { description } : {}),
    duration_minutes: draft.durationMinutes,
    default_price: draft.defaultPrice.trim(),
    currency: 'MXN',
    is_active: draft.isActive,
  }
}

export function toServiceUpdateDto(draft: ServiceDraft, expectedVersion?: number): ServiceUpdateDto {
  return {
    ...toServiceWriteDto(draft),
    ...(expectedVersion !== undefined ? { expected_version: expectedVersion } : {}),
  }
}

export function fromCatalogService(service: CatalogService): ServiceDraft {
  return {
    code: service.code,
    name: service.name,
    description: service.description,
    durationMinutes: service.durationMinutes,
    defaultPrice: service.defaultPrice,
    isActive: service.isActive,
  }
}

const PRICE_FORMATTER = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Display only. The exact string stays the source of truth for every write. */
export function formatPrice(value: string): string {
  if (!PRICE_PATTERN.test(value.trim())) return value
  const amount = Number(value)
  if (!Number.isFinite(amount)) return value
  return PRICE_FORMATTER.format(amount).replace(/ /g, ' ')
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}

export type TaxKind = 'TRANSFER' | 'WITHHOLDING'
export type FactorType = 'Tasa' | 'Cuota' | 'Exento'

export interface TaxRuleDraft {
  taxKind: TaxKind
  satTaxCode: string
  factorType: FactorType
  rateOrQuota: string
  isActive: boolean
  validFrom: string
  validTo: string
}

export interface FiscalConfigDraft {
  satProductServiceCode: string
  satUnitCode: string
  satTaxObjectCode: string
  defaultInvoiceDescription: string
  validFrom: string
  validTo: string
  taxRules: TaxRuleDraft[]
}

export interface TaxRuleWriteDto {
  tax_kind: TaxKind
  sat_tax_code: string
  factor_type: FactorType
  rate_or_quota?: string
  is_active: boolean
  valid_from: string
  valid_to?: string
}

export interface FiscalConfigWriteDto {
  sat_product_service_code: string
  sat_unit_code: string
  sat_tax_object_code: string
  default_invoice_description?: string
  valid_from: string
  valid_to?: string
  expected_version?: number
  tax_rules: TaxRuleWriteDto[]
}

export interface FiscalConfig {
  serviceId: string
  satProductServiceCode: string
  satUnitCode: string
  satTaxObjectCode: string
  defaultInvoiceDescription: string
  fiscalValidatedAt: string
  validFrom: string
  validTo: string
  version: number
}

export interface FiscalConfigDto {
  service_id: string
  sat_product_service_code: string
  sat_unit_code: string
  sat_tax_object_code: string
  default_invoice_description?: string
  fiscal_validated_at: string
  valid_from: string
  valid_to?: string
  version: number
}

export function fromFiscalConfigDto(dto: FiscalConfigDto): FiscalConfig {
  return {
    serviceId: dto.service_id,
    satProductServiceCode: dto.sat_product_service_code,
    satUnitCode: dto.sat_unit_code,
    satTaxObjectCode: dto.sat_tax_object_code,
    defaultInvoiceDescription: dto.default_invoice_description ?? '',
    fiscalValidatedAt: dto.fiscal_validated_at,
    validFrom: dto.valid_from,
    validTo: dto.valid_to ?? '',
    version: dto.version,
  }
}

export const MAX_TAX_RULES = 20

const SAT_PRODUCT_PATTERN = /^[0-9]{8}$/
const SAT_TAX_OBJECT_PATTERN = /^[0-9]{2}$/
const SAT_TAX_CODE_PATTERN = /^[0-9]{3}$/
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export type FiscalDraftErrors = Partial<Record<keyof FiscalConfigDraft, string>>

function validateTaxRule(rule: TaxRuleDraft): string | null {
  if (!SAT_TAX_CODE_PATTERN.test(rule.satTaxCode)) {
    return 'Cada impuesto necesita una clave SAT de 3 dígitos.'
  }
  if (!DATE_PATTERN.test(rule.validFrom)) {
    return 'Cada impuesto necesita una fecha de inicio válida.'
  }
  if (rule.validTo && rule.validTo < rule.validFrom) {
    return 'La vigencia de un impuesto no puede terminar antes de empezar.'
  }
  if (rule.factorType !== 'Exento' && !rule.rateOrQuota.trim()) {
    return 'Los impuestos con factor Tasa o Cuota necesitan tasa o cuota.'
  }
  return null
}

export function validateFiscalDraft(draft: FiscalConfigDraft): FiscalDraftErrors {
  const errors: FiscalDraftErrors = {}

  if (!SAT_PRODUCT_PATTERN.test(draft.satProductServiceCode)) {
    errors.satProductServiceCode = 'La clave de producto o servicio SAT tiene 8 dígitos.'
  }
  const unitCode = draft.satUnitCode.trim()
  if (!unitCode || unitCode.length > 10) {
    errors.satUnitCode = 'La clave de unidad SAT tiene entre 1 y 10 caracteres.'
  }
  if (!SAT_TAX_OBJECT_PATTERN.test(draft.satTaxObjectCode)) {
    errors.satTaxObjectCode = 'La clave de objeto de impuesto SAT tiene 2 dígitos.'
  }
  if (draft.defaultInvoiceDescription.trim().length > 1000) {
    errors.defaultInvoiceDescription = 'La descripción de factura no puede pasar de 1000 caracteres.'
  }
  if (!DATE_PATTERN.test(draft.validFrom)) {
    errors.validFrom = 'La vigencia necesita una fecha de inicio válida.'
  }
  if (draft.validTo) {
    if (!DATE_PATTERN.test(draft.validTo)) {
      errors.validTo = 'La fecha de fin no es válida.'
    } else if (draft.validTo < draft.validFrom) {
      errors.validTo = 'La vigencia no puede terminar antes de empezar.'
    }
  }

  if (draft.taxRules.length === 0) {
    errors.taxRules = 'Agrega al menos un impuesto.'
  } else if (draft.taxRules.length > MAX_TAX_RULES) {
    errors.taxRules = `No puedes registrar más de ${MAX_TAX_RULES} impuestos.`
  } else {
    const ruleError = draft.taxRules.map(validateTaxRule).find((message) => message !== null)
    if (ruleError) errors.taxRules = ruleError
  }

  return errors
}

export function toFiscalConfigWriteDto(
  draft: FiscalConfigDraft,
  expectedVersion?: number,
): FiscalConfigWriteDto {
  const invoiceDescription = draft.defaultInvoiceDescription.trim()
  return {
    sat_product_service_code: draft.satProductServiceCode.trim(),
    sat_unit_code: draft.satUnitCode.trim(),
    sat_tax_object_code: draft.satTaxObjectCode.trim(),
    ...(invoiceDescription ? { default_invoice_description: invoiceDescription } : {}),
    valid_from: draft.validFrom,
    ...(draft.validTo ? { valid_to: draft.validTo } : {}),
    ...(expectedVersion !== undefined ? { expected_version: expectedVersion } : {}),
    tax_rules: draft.taxRules.map((rule) => ({
      tax_kind: rule.taxKind,
      sat_tax_code: rule.satTaxCode,
      factor_type: rule.factorType,
      ...(rule.rateOrQuota.trim() ? { rate_or_quota: rule.rateOrQuota.trim() } : {}),
      is_active: rule.isActive,
      valid_from: rule.validFrom,
      ...(rule.validTo ? { valid_to: rule.validTo } : {}),
    })),
  }
}

/**
 * 412 arrives when the version travelled in `If-Match`, 409 when it travelled in the
 * body. Same cause, so the UI treats both as "your copy is stale".
 */
export function isVersionConflict(error: unknown): boolean {
  if (!isApiError(error)) return false
  return error.code === 'PRECONDITION_FAILED' || error.code === 'VERSION_CONFLICT'
}

export function serviceErrorMessage(error: unknown): string {
  if (!isApiError(error)) return 'Algo salió mal. Inténtalo de nuevo.'

  if (isVersionConflict(error)) {
    return 'Alguien más actualizó este servicio. Recarga la lista y vuelve a intentarlo.'
  }

  if (error.code === 'VALIDATION_ERROR' || error.status === 400) {
    return error.detail ?? 'Revisa los datos del servicio: algún campo no es válido.'
  }

  if (error.code === 'FORBIDDEN') {
    return 'Tu rol no tiene permiso para administrar el catálogo de servicios.'
  }

  if (error.code === 'RESOURCE_NOT_FOUND') {
    return 'Este servicio ya no existe. Recarga la lista.'
  }

  if (error.code === 'RATE_LIMITED') {
    const wait = error.retryAfterSeconds ? `${error.retryAfterSeconds} segundos` : 'unos minutos'
    return `Demasiados intentos. Espera ${wait} e inténtalo de nuevo.`
  }

  if (error.code === 'DEPENDENCY_UNAVAILABLE') {
    return 'El validador fiscal no está disponible por ahora. Inténtalo más tarde.'
  }

  if (error.code === 'NETWORK' || error.code === 'TIMEOUT') {
    return 'No pudimos conectar con el servidor. Revisa tu conexión.'
  }

  if (error.status >= 500) {
    return 'El servicio no está disponible por ahora. Inténtalo más tarde.'
  }

  return 'Algo salió mal. Inténtalo de nuevo.'
}
