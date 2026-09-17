import { describe, expect, it } from 'vitest'
import { ApiError } from '../../../shared/api/problem'
import {
  type LocationDraft,
  type PracticeLocationDto,
  TRAVEL_BUFFER_MAX_MINUTES,
  byDefaultThenName,
  formatTravelBuffer,
  fromLocationDto,
  fromPracticeLocation,
  locationErrorMessage,
  serviceCoverageLabel,
  toLocationWriteDto,
  validateLocationAddress,
  validateLocationDraft,
  validateLocationName,
  validateTravelBuffer,
} from './location'

const dto: PracticeLocationDto = {
  id: '11111111-1111-1111-1111-111111111111',
  provider_user_id: '22222222-2222-2222-2222-222222222222',
  name: 'Sede Polanco',
  address: 'Av. Masaryk 111',
  is_active: true,
  is_default: true,
  all_services: false,
  travel_buffer_minutes: 30,
}

function draft(overrides: Partial<LocationDraft> = {}): LocationDraft {
  return { name: 'Sede Polanco', address: 'Av. Masaryk 111', travelBufferMinutes: 30, ...overrides }
}

describe('fromLocationDto', () => {
  it('maps the wire shape to the domain shape', () => {
    expect(fromLocationDto(dto)).toEqual({
      id: '11111111-1111-1111-1111-111111111111',
      providerUserId: '22222222-2222-2222-2222-222222222222',
      name: 'Sede Polanco',
      address: 'Av. Masaryk 111',
      isActive: true,
      isDefault: true,
      allServices: false,
      travelBufferMinutes: 30,
    })
  })

  it('tolerates an absent address', () => {
    expect(fromLocationDto({ ...dto, address: undefined }).address).toBe('')
  })
})

describe('fromPracticeLocation', () => {
  it('rebuilds an editable draft', () => {
    expect(fromPracticeLocation(fromLocationDto(dto))).toEqual({
      name: 'Sede Polanco',
      address: 'Av. Masaryk 111',
      travelBufferMinutes: 30,
    })
  })
})

describe('validateLocationName', () => {
  it('accepts a normal name', () => {
    expect(validateLocationName('Sede Polanco')).toBeNull()
  })

  it('rejects empty, whitespace-only and over-long names', () => {
    expect(validateLocationName('')).not.toBeNull()
    expect(validateLocationName('   ')).not.toBeNull()
    expect(validateLocationName('a'.repeat(200))).toBeNull()
    expect(validateLocationName('a'.repeat(201))).not.toBeNull()
  })
})

describe('validateLocationAddress', () => {
  it('accepts an empty address because the server marks it optional', () => {
    expect(validateLocationAddress('')).toBeNull()
  })

  it('rejects an address longer than 1000 characters', () => {
    expect(validateLocationAddress('a'.repeat(1000))).toBeNull()
    expect(validateLocationAddress('a'.repeat(1001))).not.toBeNull()
  })
})

describe('validateTravelBuffer', () => {
  it.each([0, 30, 1440])('accepts %i minutes', (minutes) => {
    expect(validateTravelBuffer(minutes)).toBeNull()
  })

  it.each([-1, 1441, 12.5, Number.NaN])('rejects %s', (minutes) => {
    expect(validateTravelBuffer(minutes)).not.toBeNull()
  })

  it('exposes the server ceiling', () => {
    expect(TRAVEL_BUFFER_MAX_MINUTES).toBe(1440)
  })
})

describe('validateLocationDraft', () => {
  it('returns no errors for a valid draft', () => {
    expect(validateLocationDraft(draft())).toEqual({})
  })

  it('collects every invalid field at once', () => {
    const errors = validateLocationDraft(
      draft({ name: '', address: 'a'.repeat(1001), travelBufferMinutes: -5 }),
    )
    expect(Object.keys(errors).sort()).toEqual(['address', 'name', 'travelBufferMinutes'])
  })
})

describe('toLocationWriteDto', () => {
  it('builds the write payload with the provider and trimmed strings', () => {
    expect(
      toLocationWriteDto(draft({ name: '  Sede Polanco ', address: ' Av. Masaryk 111 ' }), 'prov-1'),
    ).toEqual({
      provider_user_id: 'prov-1',
      name: 'Sede Polanco',
      address: 'Av. Masaryk 111',
      travel_buffer_minutes: 30,
    })
  })

  it('omits an empty address rather than sending a blank string', () => {
    expect(toLocationWriteDto(draft({ address: '  ' }), 'prov-1')).not.toHaveProperty('address')
  })
})

describe('byDefaultThenName', () => {
  it('mirrors the server ordering: default first, then name', () => {
    const rows = [
      fromLocationDto({ ...dto, id: 'b', name: 'Sede Roma', is_default: false }),
      fromLocationDto({ ...dto, id: 'c', name: 'Aguascalientes', is_default: false }),
      fromLocationDto({ ...dto, id: 'a', name: 'Zona Sur', is_default: true }),
    ]
    expect(byDefaultThenName(rows).map((row) => row.name)).toEqual([
      'Zona Sur',
      'Aguascalientes',
      'Sede Roma',
    ])
  })
})

describe('serviceCoverageLabel', () => {
  it('says every service when the location is unrestricted', () => {
    expect(serviceCoverageLabel({ allServices: true, enabledCount: 0 })).toMatch(/todos/i)
  })

  it('warns when a restricted location has no services at all', () => {
    expect(serviceCoverageLabel({ allServices: false, enabledCount: 0 })).toMatch(/sin servicios/i)
  })

  it('counts the enabled services, singular and plural', () => {
    expect(serviceCoverageLabel({ allServices: false, enabledCount: 1 })).toBe('1 servicio')
    expect(serviceCoverageLabel({ allServices: false, enabledCount: 4 })).toBe('4 servicios')
  })

  it('says only that the list is restricted when the count is unknown', () => {
    expect(serviceCoverageLabel({ allServices: false })).toBe('Lista restringida')
  })

  it('never renders a negative count as a number', () => {
    expect(serviceCoverageLabel({ allServices: false, enabledCount: -1 })).not.toMatch(/-1/)
  })
})

describe('formatTravelBuffer', () => {
  it('reads naturally for zero, minutes and hours', () => {
    expect(formatTravelBuffer(0)).toMatch(/sin traslado/i)
    expect(formatTravelBuffer(45)).toBe('45 min')
    expect(formatTravelBuffer(60)).toBe('1 h')
    expect(formatTravelBuffer(90)).toBe('1 h 30 min')
  })
})

describe('locationErrorMessage', () => {
  it('explains that only the titular dentist administers sedes', () => {
    expect(locationErrorMessage(new ApiError({ status: 403, code: 'FORBIDDEN' }))).toMatch(
      /titular|permiso/i,
    )
  })

  it('distinguishes not found, validation and unavailable', () => {
    const missing = locationErrorMessage(new ApiError({ status: 404, code: 'RESOURCE_NOT_FOUND' }))
    const invalid = locationErrorMessage(new ApiError({ status: 400, code: 'VALIDATION_ERROR' }))
    const down = locationErrorMessage(new ApiError({ status: 503, code: 'DEPENDENCY_UNAVAILABLE' }))
    expect(new Set([missing, invalid, down]).size).toBe(3)
  })

  it('reports a connection problem for network and timeout', () => {
    expect(locationErrorMessage(new ApiError({ status: 0, code: 'NETWORK' }))).toMatch(/conexión/i)
    expect(locationErrorMessage(new ApiError({ status: 0, code: 'TIMEOUT' }))).toMatch(/conexión/i)
  })

  it('falls back to a generic message for anything unknown', () => {
    expect(locationErrorMessage(new Error('boom'))).toMatch(/salió mal/i)
  })
})
