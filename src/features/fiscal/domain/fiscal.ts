import { isApiError } from '../../../shared/api/problem'

export interface FiscalData {
  patientId: string
  rfc: string
  legalName: string
  postalCode: string
  taxRegimeCode: string
  cfdiUseCode: string
  billingEmail: string
  createdAt: string
  updatedAt: string
  version: number
}

export interface FiscalDataDto {
  patient_id: string
  rfc: string
  legal_name: string
  fiscal_postal_code: string
  tax_regime_code: string
  default_cfdi_use_code: string
  billing_email?: string | null
  created_at: string
  updated_at: string
  version: number
}

export interface FiscalDraft {
  rfc: string
  legalName: string
  postalCode: string
  taxRegimeCode: string
  cfdiUseCode: string
  billingEmail: string
}

export type FiscalDraftErrors = Partial<Record<keyof FiscalDraft, string>>

export const EMPTY_FISCAL_DRAFT: FiscalDraft = { rfc: '', legalName: '', postalCode: '', taxRegimeCode: '', cfdiUseCode: '', billingEmail: '' }

function normalized(value: string): string { return value.normalize('NFC').trim() }
function unsafe(value: string): boolean {
  return Array.from(value).some((character) => /\p{Cc}/u.test(character) || (/\p{Cf}/u.test(character) && character !== '\u200c' && character !== '\u200d'))
}
function isEmail(value: string): boolean { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) }

export function fromFiscalDataDto(dto: FiscalDataDto): FiscalData {
  return { patientId: dto.patient_id, rfc: dto.rfc, legalName: dto.legal_name, postalCode: dto.fiscal_postal_code, taxRegimeCode: dto.tax_regime_code, cfdiUseCode: dto.default_cfdi_use_code, billingEmail: dto.billing_email ?? '', createdAt: dto.created_at, updatedAt: dto.updated_at, version: dto.version }
}

export function toFiscalDraft(value: FiscalData | null): FiscalDraft {
  return value ? { rfc: value.rfc, legalName: value.legalName, postalCode: value.postalCode, taxRegimeCode: value.taxRegimeCode, cfdiUseCode: value.cfdiUseCode, billingEmail: value.billingEmail } : EMPTY_FISCAL_DRAFT
}

export function toFiscalWriteDto(draft: FiscalDraft) {
  const email = normalized(draft.billingEmail)
  return { rfc: normalized(draft.rfc).toUpperCase(), legal_name: normalized(draft.legalName), fiscal_postal_code: normalized(draft.postalCode), tax_regime_code: normalized(draft.taxRegimeCode).toUpperCase(), default_cfdi_use_code: normalized(draft.cfdiUseCode).toUpperCase(), billing_email: email ? `${email.slice(0, email.lastIndexOf('@') + 1)}${email.slice(email.lastIndexOf('@') + 1).toLowerCase()}` : '' }
}

export function validateFiscalDraft(draft: FiscalDraft): FiscalDraftErrors {
  const value = toFiscalWriteDto(draft); const errors: FiscalDraftErrors = {}
  if (!/^[A-Z&Ñ]{3,4}[0-9]{6}[A-Z0-9]{3}$/.test(value.rfc)) errors.rfc = 'El RFC debe tener el formato fiscal válido.'
  if (!value.legal_name || Array.from(value.legal_name).length > 300 || unsafe(value.legal_name)) errors.legalName = 'La razón social es obligatoria y debe ser válida.'
  if (!/^\d{5}$/.test(value.fiscal_postal_code)) errors.postalCode = 'El código postal fiscal debe tener cinco dígitos.'
  if (!/^[A-Z0-9]{3}$/.test(value.tax_regime_code)) errors.taxRegimeCode = 'El régimen fiscal debe ser un código SAT de tres caracteres.'
  if (!/^[A-Z0-9]{3}$/.test(value.default_cfdi_use_code)) errors.cfdiUseCode = 'El uso CFDI debe ser un código SAT de tres caracteres.'
  if (value.billing_email && (value.billing_email.length > 254 || unsafe(value.billing_email) || !isEmail(value.billing_email))) errors.billingEmail = 'El correo de facturación no es válido.'
  return errors
}

export function canManageFiscalData(role: string): boolean { return role === 'OWNER_DENTIST' || role === 'BILLING' }

export function fiscalErrorMessage(error: unknown, operation: 'read' | 'write' | 'delete' = 'read'): string {
  if (!isApiError(error)) return 'No pudimos completar la operación fiscal. Intentá nuevamente.'
  if (error.code === 'PRECONDITION_FAILED' || error.code === 'VERSION_CONFLICT' || error.status === 412 || error.status === 409) return 'Los datos fiscales cambiaron en otra sesión. Se conservaron tus datos para que revises el estado actual.'
  if (error.code === 'FORBIDDEN') return operation === 'delete' ? 'La eliminación requiere una sesión con MFA reciente. Volvé a autenticarte y reintentá; no se realizó ningún bypass.' : 'Tu rol no tiene permiso para acceder o actualizar datos fiscales.'
  if (error.status >= 500 || error.code === 'DEPENDENCY_UNAVAILABLE') return 'El servicio fiscal no está disponible por ahora. Intentá nuevamente.'
  return error.detail ?? 'Revisá los datos fiscales e intentá nuevamente.'
}
