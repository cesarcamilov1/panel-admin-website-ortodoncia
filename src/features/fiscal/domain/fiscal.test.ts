import { describe, expect, it } from 'vitest'
import { ApiError } from '../../../shared/api/problem'
import { EMPTY_FISCAL_DRAFT, fiscalErrorMessage, validateFiscalDraft } from './fiscal'

describe('fiscal validation', () => {
  it('normalizes RFC/catalog codes and accepts the backend DTO shape', () => {
    expect(validateFiscalDraft({ ...EMPTY_FISCAL_DRAFT, rfc: 'cosc8001137na', legalName: '  Persona física  ', postalCode: '01000', taxRegimeCode: '612', cfdiUseCode: 'g03', billingEmail: 'FACTURAS@EXAMPLE.MX' })).toEqual({})
  })

  it('rejects backend-invalid RFC, postal code, catalog, unsafe legal name, and email', () => {
    const invalid = { ...EMPTY_FISCAL_DRAFT, rfc: 'invalid', legalName: 'Nombre\u0000', postalCode: '1000', taxRegimeCode: '12', cfdiUseCode: 'TOOLONG', billingEmail: 'not-an-email' }
    expect(Object.keys(validateFiscalDraft(invalid))).toEqual(expect.arrayContaining(['rfc', 'legalName', 'postalCode', 'taxRegimeCode', 'cfdiUseCode', 'billingEmail']))
  })

  it('retains an actionable conflict message rather than hiding a version failure', () => {
    expect(fiscalErrorMessage(new ApiError({ status: 412, code: 'PRECONDITION_FAILED' }), 'write')).toMatch(/cambiaron en otra sesión/i)
  })
})
