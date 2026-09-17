import { describe, expect, it } from 'vitest'
import { ApiError } from '../../../shared/api/problem'
import {
  type CatalogServiceDto,
  type ServiceDraft,
  DURATION_STEP_MINUTES,
  formatPrice,
  fromCatalogServiceDto,
  isVersionConflict,
  serviceErrorMessage,
  toFiscalConfigWriteDto,
  toServiceWriteDto,
  validateFiscalDraft,
  validateServiceCode,
  validateServiceDraft,
  validateServiceDuration,
  validateServiceName,
  validateServicePrice,
} from './service'

const dto: CatalogServiceDto = {
  id: '11111111-1111-1111-1111-111111111111',
  code: 'LIMP-01',
  name: 'Limpieza dental',
  duration_minutes: 45,
  default_price: '850.00',
  currency: 'MXN',
  is_active: true,
  created_at: '2026-01-10T15:00:00Z',
  updated_at: '2026-02-11T09:30:00Z',
  version: 3,
}

function draft(overrides: Partial<ServiceDraft> = {}): ServiceDraft {
  return {
    code: 'LIMP-01',
    name: 'Limpieza dental',
    description: '',
    durationMinutes: 45,
    defaultPrice: '850.00',
    isActive: true,
    ...overrides,
  }
}

describe('fromCatalogServiceDto', () => {
  it('maps the wire shape to the domain shape', () => {
    expect(fromCatalogServiceDto(dto)).toEqual({
      id: '11111111-1111-1111-1111-111111111111',
      code: 'LIMP-01',
      name: 'Limpieza dental',
      description: '',
      durationMinutes: 45,
      defaultPrice: '850.00',
      currency: 'MXN',
      isActive: true,
      createdAt: '2026-01-10T15:00:00Z',
      updatedAt: '2026-02-11T09:30:00Z',
      version: 3,
    })
  })

  it('keeps the price as the exact decimal string the server sent', () => {
    const mapped = fromCatalogServiceDto({ ...dto, default_price: '1234.567890' })
    expect(mapped.defaultPrice).toBe('1234.567890')
  })

  it('defaults an absent optional description to an empty string', () => {
    expect(fromCatalogServiceDto({ ...dto, description: undefined }).description).toBe('')
  })
})

describe('validateServiceCode', () => {
  it.each(['LIMP-01', 'A1', 'ORTO_BRACKETS', 'X0000000000'])('accepts %s', (code) => {
    expect(validateServiceCode(code)).toBeNull()
  })

  it.each([
    ['', 'empty'],
    ['A', 'single character'],
    ['limp-01', 'lowercase'],
    ['-LIMP', 'leading dash'],
    ['_LIMP', 'leading underscore'],
    ['LIMP 01', 'inner space'],
    ['LIMP.01', 'dot'],
    ['Á1', 'non-ascii'],
  ])('rejects %s (%s)', (code) => {
    expect(validateServiceCode(code)).not.toBeNull()
  })

  it('rejects a code longer than 50 characters', () => {
    expect(validateServiceCode('A'.repeat(51))).not.toBeNull()
    expect(validateServiceCode('A'.repeat(50))).toBeNull()
  })

  it('trims surrounding whitespace before validating', () => {
    expect(validateServiceCode('  LIMP-01  ')).toBeNull()
  })
})

describe('validateServiceName', () => {
  it('accepts a normal name', () => {
    expect(validateServiceName('Limpieza dental')).toBeNull()
  })

  it('rejects an empty or whitespace-only name', () => {
    expect(validateServiceName('')).not.toBeNull()
    expect(validateServiceName('   ')).not.toBeNull()
  })

  it('rejects a name longer than 200 characters', () => {
    expect(validateServiceName('a'.repeat(200))).toBeNull()
    expect(validateServiceName('a'.repeat(201))).not.toBeNull()
  })
})

describe('validateServiceDuration', () => {
  it.each([5, 45, 480])('accepts %i minutes', (minutes) => {
    expect(validateServiceDuration(minutes)).toBeNull()
  })

  it.each([0, 4, 7, 485, -5, 45.5, Number.NaN])('rejects %s minutes', (minutes) => {
    expect(validateServiceDuration(minutes)).not.toBeNull()
  })

  it('exposes the step the backend enforces', () => {
    expect(DURATION_STEP_MINUTES).toBe(5)
  })
})

describe('validateServicePrice', () => {
  it.each(['0', '850', '850.00', '1234.567890', '999999999999'])('accepts %s', (price) => {
    expect(validateServicePrice(price)).toBeNull()
  })

  it.each([
    ['', 'empty'],
    ['-10', 'negative'],
    ['00', 'leading zero'],
    ['0850', 'padded'],
    ['850.', 'trailing dot'],
    ['.50', 'no integer part'],
    ['850.1234567', 'too many decimals'],
    ['1000000000000', 'too many integer digits'],
    ['1,850.00', 'thousands separator'],
    ['8 50', 'inner whitespace'],
    ['MXN 850', 'currency prefix'],
  ])('rejects %s (%s)', (price) => {
    expect(validateServicePrice(price)).not.toBeNull()
  })

  it('trims surrounding whitespace before validating', () => {
    expect(validateServicePrice('  850.00  ')).toBeNull()
  })
})

describe('validateServiceDraft', () => {
  it('returns no field errors for a valid draft', () => {
    expect(validateServiceDraft(draft())).toEqual({})
  })

  it('collects every invalid field at once', () => {
    const errors = validateServiceDraft(
      draft({ code: 'bad code', name: '', durationMinutes: 7, defaultPrice: '-1' }),
    )
    expect(Object.keys(errors).sort()).toEqual(['code', 'defaultPrice', 'durationMinutes', 'name'])
  })

  it('rejects a description longer than 2000 characters', () => {
    expect(validateServiceDraft(draft({ description: 'a'.repeat(2001) })).description).toBeDefined()
  })
})

describe('toServiceWriteDto', () => {
  it('produces the write payload with MXN and trimmed strings', () => {
    expect(toServiceWriteDto(draft({ code: '  LIMP-01 ', name: ' Limpieza dental ' }))).toEqual({
      code: 'LIMP-01',
      name: 'Limpieza dental',
      duration_minutes: 45,
      default_price: '850.00',
      currency: 'MXN',
      is_active: true,
    })
  })

  it('omits an empty description instead of sending a blank string', () => {
    expect(toServiceWriteDto(draft({ description: '   ' }))).not.toHaveProperty('description')
  })

  it('includes a non-empty trimmed description', () => {
    expect(toServiceWriteDto(draft({ description: '  Profilaxis  ' })).description).toBe('Profilaxis')
  })
})

describe('formatPrice', () => {
  it('formats a decimal string as MXN currency without losing the cents', () => {
    expect(formatPrice('850.00')).toBe('$850.00')
    expect(formatPrice('1850.5')).toBe('$1,850.50')
    expect(formatPrice('0')).toBe('$0.00')
  })

  it('returns the raw value when it is not a parseable amount', () => {
    expect(formatPrice('n/a')).toBe('n/a')
  })
})

describe('validateFiscalDraft', () => {
  const fiscal = {
    satProductServiceCode: '86121600',
    satUnitCode: 'E48',
    satTaxObjectCode: '02',
    defaultInvoiceDescription: '',
    validFrom: '2026-01-01',
    validTo: '',
    taxRules: [
      {
        taxKind: 'TRANSFER' as const,
        satTaxCode: '002',
        factorType: 'Tasa' as const,
        rateOrQuota: '0.160000',
        isActive: true,
        validFrom: '2026-01-01',
        validTo: '',
      },
    ],
  }

  it('accepts a valid fiscal draft', () => {
    expect(validateFiscalDraft(fiscal)).toEqual({})
  })

  it('rejects SAT codes that do not match the required digit lengths', () => {
    expect(validateFiscalDraft({ ...fiscal, satProductServiceCode: '8612160' }).satProductServiceCode).toBeDefined()
    expect(validateFiscalDraft({ ...fiscal, satTaxObjectCode: '2' }).satTaxObjectCode).toBeDefined()
    expect(validateFiscalDraft({ ...fiscal, satUnitCode: '' }).satUnitCode).toBeDefined()
  })

  it('requires valid_from and rejects a valid_to before it', () => {
    expect(validateFiscalDraft({ ...fiscal, validFrom: '' }).validFrom).toBeDefined()
    expect(validateFiscalDraft({ ...fiscal, validTo: '2025-12-31' }).validTo).toBeDefined()
  })

  it('requires at least one tax rule and caps the list at twenty', () => {
    expect(validateFiscalDraft({ ...fiscal, taxRules: [] }).taxRules).toBeDefined()
    const many = Array.from({ length: 21 }, () => fiscal.taxRules[0])
    expect(validateFiscalDraft({ ...fiscal, taxRules: many }).taxRules).toBeDefined()
  })

  it('rejects a tax rule with a malformed SAT tax code', () => {
    const rules = [{ ...fiscal.taxRules[0], satTaxCode: '2' }]
    expect(validateFiscalDraft({ ...fiscal, taxRules: rules }).taxRules).toBeDefined()
  })

  it('requires a rate for Tasa and Cuota but not for Exento', () => {
    const tasa = [{ ...fiscal.taxRules[0], rateOrQuota: '' }]
    expect(validateFiscalDraft({ ...fiscal, taxRules: tasa }).taxRules).toBeDefined()
    const exento = [{ ...fiscal.taxRules[0], factorType: 'Exento' as const, rateOrQuota: '' }]
    expect(validateFiscalDraft({ ...fiscal, taxRules: exento })).toEqual({})
  })
})

describe('toFiscalConfigWriteDto', () => {
  it('maps the draft to the wire shape and drops empty optionals', () => {
    const payload = toFiscalConfigWriteDto({
      satProductServiceCode: '86121600',
      satUnitCode: 'E48',
      satTaxObjectCode: '02',
      defaultInvoiceDescription: '',
      validFrom: '2026-01-01',
      validTo: '',
      taxRules: [
        {
          taxKind: 'TRANSFER',
          satTaxCode: '002',
          factorType: 'Tasa',
          rateOrQuota: '0.160000',
          isActive: true,
          validFrom: '2026-01-01',
          validTo: '',
        },
      ],
    })

    expect(payload).toEqual({
      sat_product_service_code: '86121600',
      sat_unit_code: 'E48',
      sat_tax_object_code: '02',
      valid_from: '2026-01-01',
      tax_rules: [
        {
          tax_kind: 'TRANSFER',
          sat_tax_code: '002',
          factor_type: 'Tasa',
          rate_or_quota: '0.160000',
          is_active: true,
          valid_from: '2026-01-01',
        },
      ],
    })
  })
})

describe('isVersionConflict', () => {
  it('is true for both the If-Match and the body-version flavours', () => {
    expect(isVersionConflict(new ApiError({ status: 412, code: 'PRECONDITION_FAILED' }))).toBe(true)
    expect(isVersionConflict(new ApiError({ status: 409, code: 'VERSION_CONFLICT' }))).toBe(true)
  })

  it('is false for anything else', () => {
    expect(isVersionConflict(new ApiError({ status: 400, code: 'VALIDATION_ERROR' }))).toBe(false)
    expect(isVersionConflict(new Error('boom'))).toBe(false)
  })
})

describe('serviceErrorMessage', () => {
  it('explains a stale version as a reload-and-retry', () => {
    expect(serviceErrorMessage(new ApiError({ status: 412, code: 'PRECONDITION_FAILED' }))).toMatch(
      /recarga/i,
    )
  })

  it('explains forbidden, not found, validation and unavailable distinctly', () => {
    const forbidden = serviceErrorMessage(new ApiError({ status: 403, code: 'FORBIDDEN' }))
    const missing = serviceErrorMessage(new ApiError({ status: 404, code: 'RESOURCE_NOT_FOUND' }))
    const invalid = serviceErrorMessage(new ApiError({ status: 400, code: 'VALIDATION_ERROR' }))
    const down = serviceErrorMessage(new ApiError({ status: 503, code: 'DEPENDENCY_UNAVAILABLE' }))
    expect(new Set([forbidden, missing, invalid, down]).size).toBe(4)
  })

  it('surfaces the retry delay on rate limiting', () => {
    const message = serviceErrorMessage(
      new ApiError({ status: 429, code: 'RATE_LIMITED', retryAfterSeconds: 30 }),
    )
    expect(message).toContain('30')
  })

  it('falls back to a generic message for an unknown failure', () => {
    expect(serviceErrorMessage(new Error('boom'))).toMatch(/salió mal/i)
  })
})
