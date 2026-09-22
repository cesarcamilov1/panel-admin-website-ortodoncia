import { describe, expect, it } from 'vitest'
import { ApiError } from '../../../shared/api/problem'
import {
  billingErrorMessage,
  canRequestBillingCancellation,
  canRequestBillingEmail,
  canRequestBillingReplacement,
  isExactFiscalDecimal,
  legalBillingActions,
} from './billing'

const issued = {
  id: 'd',
  patientId: 'p',
  type: 'I' as const,
  status: 'ISSUED' as const,
  total: '1.000000',
  version: 1,
  cfdiUuid: '',
  lastErrorCode: '',
  files: { xml: false, pdf: false, ack: false },
}

describe('billing domain safeguards', () => {
  it('keeps money as server decimal strings and exposes only candidate requests whose status and type are supported', () => {
    expect(isExactFiscalDecimal('100.000001')).toBe(true)
    expect(isExactFiscalDecimal('100.01')).toBe(false)
    expect(legalBillingActions(issued)).toEqual(['cancel', 'replace', 'send-email', 'reconcile'])
    expect(legalBillingActions({ ...issued, type: 'P' })).toEqual(['cancel', 'send-email', 'reconcile'])
    expect(legalBillingActions({ ...issued, status: 'CANCEL_FAILED' })).toEqual(['cancel', 'reconcile'])
    expect(legalBillingActions({ ...issued, status: 'QUEUED' })).toEqual([])
  })

  it('treats replacement, cancellation, and email as server-validated candidate requests', () => {
    expect(canRequestBillingReplacement(issued)).toBe(true)
    expect(canRequestBillingReplacement({ ...issued, type: 'P' })).toBe(false)
    expect(canRequestBillingEmail(issued)).toBe(true)
    expect(canRequestBillingEmail({ ...issued, status: 'CANCEL_FAILED' })).toBe(false)
    expect(canRequestBillingCancellation(issued)).toBe(true)
    expect(canRequestBillingCancellation({ ...issued, status: 'CANCEL_FAILED' })).toBe(true)
    expect(canRequestBillingCancellation({ ...issued, status: 'CANCELLED' })).toBe(false)
  })

  it('keeps fiscal rejections visible without pretending that a request succeeded', () => {
    expect(billingErrorMessage(new ApiError({ status: 422, code: 'VALIDATION_ERROR', detail: 'Falta un requisito.' }))).toBe('Falta un requisito.')
    expect(billingErrorMessage(new ApiError({ status: 422, code: 'REPLACEMENT_UNAVAILABLE' }))).toMatch(/estado fiscal actual/i)
    expect(billingErrorMessage(new ApiError({ status: 409, code: 'FISCAL_CONFLICT' }))).toMatch(/recargá el detalle/i)
    expect(billingErrorMessage(new ApiError({ status: 412, code: 'PRECONDITION_FAILED' }))).toMatch(/acciones quedan bloqueadas/i)
  })

  it('gives actionable MFA guidance without claiming an automatic bypass', () => {
    expect(billingErrorMessage(new ApiError({ status: 403, code: 'RECENT_MFA_REQUIRED' }))).toMatch(/ingresá nuevamente.*no se realizó ningún bypass/i)
  })
})
