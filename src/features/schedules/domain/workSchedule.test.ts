import { describe, expect, it } from 'vitest'
import { ApiError } from '../../../shared/api/problem'
import {
  type WorkSchedule,
  type WorkScheduleDraft,
  type WorkScheduleDto,
  WEEKDAYS,
  byWeekdayThenStart,
  formatTimeRange,
  fromWorkScheduleDto,
  groupByWeekday,
  intervalLabel,
  scheduleErrorMessage,
  toWorkScheduleWriteDto,
  validateEffectiveRange,
  validateTimeOfDay,
  validateTimeRange,
  validateWorkScheduleDraft,
  validityLabel,
} from './workSchedule'

const PROVIDER = '22222222-2222-2222-2222-222222222222'
const LOCATION = '11111111-1111-1111-1111-111111111111'

const dto: WorkScheduleDto = {
  id: 'ws-1',
  location_id: LOCATION,
  provider_user_id: PROVIDER,
  weekday: 1,
  start_local_time: '09:00',
  end_local_time: '14:00',
  timezone: 'America/Mexico_City',
  effective_from: '2026-01-01',
  effective_to: '2026-12-31',
  interval_weeks: 2,
  is_active: true,
  created_at: '2026-01-01T15:00:00Z',
  updated_at: '2026-01-02T15:00:00Z',
}

function schedule(overrides: Partial<WorkSchedule> = {}): WorkSchedule {
  return { ...fromWorkScheduleDto(dto), ...overrides }
}

const draft: WorkScheduleDraft = {
  weekday: 3,
  startLocalTime: '08:30',
  endLocalTime: '13:00',
  effectiveFrom: '2026-10-01',
  effectiveTo: '',
  intervalWeeks: 1,
  locationId: '',
  isActive: true,
}

describe('WEEKDAYS', () => {
  it('is ISO: Monday is 1 and Sunday is 7, as the server compares it', () => {
    expect(WEEKDAYS).toHaveLength(7)
    expect(WEEKDAYS[0]).toMatchObject({ value: 1, label: 'Lunes' })
    expect(WEEKDAYS[6]).toMatchObject({ value: 7, label: 'Domingo' })
  })
})

describe('fromWorkScheduleDto', () => {
  it('maps every field the screen needs', () => {
    expect(fromWorkScheduleDto(dto)).toEqual({
      id: 'ws-1',
      locationId: LOCATION,
      providerUserId: PROVIDER,
      weekday: 1,
      startLocalTime: '09:00',
      endLocalTime: '14:00',
      timezone: 'America/Mexico_City',
      effectiveFrom: '2026-01-01',
      effectiveTo: '2026-12-31',
      intervalWeeks: 2,
      isActive: true,
    })
  })

  it('fills the optional fields the server may omit', () => {
    const partial: WorkScheduleDto = {
      ...dto,
      location_id: undefined,
      effective_to: undefined,
      interval_weeks: undefined,
    }

    expect(fromWorkScheduleDto(partial)).toMatchObject({
      locationId: '',
      effectiveTo: '',
      // The server defaults an absent interval to a weekly one; so do we.
      intervalWeeks: 1,
    })
  })
})

describe('toWorkScheduleWriteDto', () => {
  it('sends the provider and never the timezone, which the server owns', () => {
    const body = toWorkScheduleWriteDto(draft, PROVIDER)

    expect(body).toEqual({
      provider_user_id: PROVIDER,
      weekday: 3,
      start_local_time: '08:30',
      end_local_time: '13:00',
      effective_from: '2026-10-01',
      interval_weeks: 1,
      is_active: true,
    })
    expect(body).not.toHaveProperty('timezone')
  })

  it('includes the optional location and end date only when they were chosen', () => {
    const body = toWorkScheduleWriteDto(
      { ...draft, locationId: LOCATION, effectiveTo: '2027-03-31' },
      PROVIDER,
    )

    expect(body).toMatchObject({ location_id: LOCATION, effective_to: '2027-03-31' })
  })
})

describe('validateTimeOfDay', () => {
  it('accepts a 24-hour HH:MM value', () => {
    expect(validateTimeOfDay('09:05')).toBeNull()
    expect(validateTimeOfDay('23:59')).toBeNull()
  })

  it('rejects anything the server would not parse with 15:04', () => {
    expect(validateTimeOfDay('')).not.toBeNull()
    expect(validateTimeOfDay('9:00')).not.toBeNull()
    expect(validateTimeOfDay('24:00')).not.toBeNull()
    expect(validateTimeOfDay('09:60')).not.toBeNull()
    expect(validateTimeOfDay('09:00:00')).not.toBeNull()
  })
})

describe('validateTimeRange', () => {
  it('requires the end to be strictly after the start', () => {
    expect(validateTimeRange('09:00', '14:00')).toBeNull()
    expect(validateTimeRange('09:00', '09:00')).not.toBeNull()
    expect(validateTimeRange('14:00', '09:00')).not.toBeNull()
  })
})

describe('validateEffectiveRange', () => {
  it('requires a start date and an end that is not before it', () => {
    expect(validateEffectiveRange('2026-10-01', '')).toBeNull()
    expect(validateEffectiveRange('2026-10-01', '2026-10-01')).toBeNull()
    expect(validateEffectiveRange('', '')).not.toBeNull()
    expect(validateEffectiveRange('2026-10-01', '2026-09-30')).not.toBeNull()
    expect(validateEffectiveRange('01/10/2026', '')).not.toBeNull()
  })
})

describe('validateWorkScheduleDraft', () => {
  it('passes a complete draft', () => {
    expect(validateWorkScheduleDraft(draft)).toEqual({})
  })

  it('reports each broken field on its own key', () => {
    const errors = validateWorkScheduleDraft({
      ...draft,
      startLocalTime: '8:30',
      endLocalTime: '08:00',
      effectiveFrom: '',
    })

    expect(errors.startLocalTime).toBeTruthy()
    expect(errors.endLocalTime).toBeTruthy()
    expect(errors.effectiveFrom).toBeTruthy()
  })
})

describe('ordering and grouping', () => {
  const monday = schedule({ id: 'a', weekday: 1, startLocalTime: '16:00', endLocalTime: '20:00' })
  const mondayMorning = schedule({ id: 'b', weekday: 1, startLocalTime: '09:00' })
  const sunday = schedule({ id: 'c', weekday: 7, startLocalTime: '09:00' })

  it('sorts by weekday and then by start time', () => {
    expect(byWeekdayThenStart([sunday, monday, mondayMorning]).map((item) => item.id)).toEqual([
      'b',
      'a',
      'c',
    ])
  })

  it('groups every weekday, including the ones without ranges', () => {
    const groups = groupByWeekday([monday, mondayMorning])

    expect(groups[1].map((item) => item.id)).toEqual(['b', 'a'])
    expect(groups[4]).toEqual([])
    expect(Object.keys(groups)).toHaveLength(7)
  })
})

describe('labels', () => {
  it('formats a range with an en dash, like the rest of the panel', () => {
    expect(formatTimeRange(schedule())).toBe('09:00 – 14:00')
  })

  it('names the repetition interval', () => {
    expect(intervalLabel(1)).toBe('Cada semana')
    expect(intervalLabel(2)).toBe('Cada 2 semanas')
  })

  it('states the validity window in Spanish', () => {
    expect(validityLabel(schedule({ effectiveFrom: '2026-01-01', effectiveTo: '' }))).toBe(
      'Desde el 1 ene 2026',
    )
    expect(
      validityLabel(schedule({ effectiveFrom: '2026-01-01', effectiveTo: '2026-12-31' })),
    ).toBe('Del 1 ene 2026 al 31 dic 2026')
  })
})

describe('scheduleErrorMessage', () => {
  it('explains the overlap the server rejects with 409', () => {
    const message = scheduleErrorMessage(new ApiError({ status: 409, code: 'APPOINTMENT_SLOT_CONFLICT' }))

    expect(message).toMatch(/se encima|traslapa|superpone/i)
  })

  it('explains the role gate', () => {
    expect(scheduleErrorMessage(new ApiError({ status: 403, code: 'FORBIDDEN' }))).toMatch(
      /titular/i,
    )
  })

  it('prefers the server detail on a validation error', () => {
    const message = scheduleErrorMessage(
      new ApiError({ status: 400, code: 'VALIDATION_ERROR', detail: 'weekday inválido' }),
    )

    expect(message).toBe('weekday inválido')
  })

  it('has a message for a lost connection and for anything unknown', () => {
    expect(scheduleErrorMessage(new ApiError({ status: 0, code: 'NETWORK' }))).toMatch(/conexión/i)
    expect(scheduleErrorMessage(new Error('boom'))).toMatch(/Algo salió mal/i)
  })
})
