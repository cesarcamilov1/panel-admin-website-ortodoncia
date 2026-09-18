import { describe, expect, it } from 'vitest'
import { ApiError } from '../../../shared/api/problem'
import {
  BLOCK_TYPES,
  BLOCK_TYPE_LABELS,
  REASON_MAX_LENGTH,
  type ScheduleBlock,
  type ScheduleBlockDraft,
  type ScheduleBlockDto,
  blockErrorMessage,
  blockWindow,
  byStartsAt,
  formatBlockRange,
  fromScheduleBlockDto,
  toInstant,
  toLocalDateTime,
  toScheduleBlockWriteDto,
  validateScheduleBlockDraft,
} from './scheduleBlock'

const PROVIDER = '22222222-2222-2222-2222-222222222222'
const LOCATION = '11111111-1111-1111-1111-111111111111'

const dto: ScheduleBlockDto = {
  id: 'blk-1',
  location_id: LOCATION,
  provider_user_id: PROVIDER,
  starts_at: '2026-09-20T20:00:00Z',
  ends_at: '2026-09-20T22:30:00Z',
  block_type: 'VACATION',
  reason: 'Congreso',
  created_by: PROVIDER,
  created_at: '2026-09-01T10:00:00Z',
  updated_at: '2026-09-01T10:00:00Z',
}

function block(overrides: Partial<ScheduleBlock> = {}): ScheduleBlock {
  return { ...fromScheduleBlockDto(dto), ...overrides }
}

const draft: ScheduleBlockDraft = {
  blockType: 'MEAL',
  startsAt: '2026-09-21T14:00',
  endsAt: '2026-09-21T15:00',
  reason: 'Comida',
  locationId: '',
}

describe('block types', () => {
  it('offers exactly the six types the server accepts', () => {
    expect([...BLOCK_TYPES]).toEqual([
      'PERSONAL',
      'VACATION',
      'HOLIDAY',
      'MEAL',
      'MAINTENANCE',
      'OTHER',
    ])
    expect(BLOCK_TYPE_LABELS.MEAL).toBe('Comida')
  })
})

describe('fromScheduleBlockDto', () => {
  it('maps the row the list returns', () => {
    expect(fromScheduleBlockDto(dto)).toEqual({
      id: 'blk-1',
      locationId: LOCATION,
      providerUserId: PROVIDER,
      startsAt: '2026-09-20T20:00:00Z',
      endsAt: '2026-09-20T22:30:00Z',
      blockType: 'VACATION',
      reason: 'Congreso',
      createdBy: PROVIDER,
    })
  })

  it('tolerates the optional fields being absent', () => {
    expect(
      fromScheduleBlockDto({ ...dto, location_id: undefined, reason: undefined }),
    ).toMatchObject({ locationId: '', reason: '' })
  })

  it('keeps an unknown block type instead of dropping the row', () => {
    // block_type is a plain string on the response schema, not the write enum.
    expect(fromScheduleBlockDto({ ...dto, block_type: 'LEGACY' }).blockType).toBe('LEGACY')
  })
})

describe('toInstant / toLocalDateTime', () => {
  it('reads the form value as clinic wall time, not as browser local time', () => {
    // America/Mexico_City has been a fixed UTC-6 since 2022.
    expect(toInstant('2026-09-21T14:00')).toBe('2026-09-21T20:00:00.000Z')
  })

  it('round-trips an instant back into a datetime-local value', () => {
    expect(toLocalDateTime('2026-09-21T20:00:00Z')).toBe('2026-09-21T14:00')
    expect(toLocalDateTime(toInstant('2026-01-05T08:30'))).toBe('2026-01-05T08:30')
  })
})

describe('toScheduleBlockWriteDto', () => {
  it('converts the local form values into RFC3339 instants', () => {
    expect(toScheduleBlockWriteDto(draft, PROVIDER)).toEqual({
      provider_user_id: PROVIDER,
      starts_at: '2026-09-21T20:00:00.000Z',
      ends_at: '2026-09-21T21:00:00.000Z',
      block_type: 'MEAL',
      reason: 'Comida',
    })
  })

  it('omits the optional fields the server treats as absent', () => {
    const body = toScheduleBlockWriteDto({ ...draft, reason: '   ' }, PROVIDER)

    expect(body).not.toHaveProperty('reason')
    expect(body).not.toHaveProperty('location_id')
  })

  it('sends the location when one was chosen', () => {
    expect(toScheduleBlockWriteDto({ ...draft, locationId: LOCATION }, PROVIDER)).toMatchObject({
      location_id: LOCATION,
    })
  })
})

describe('validateScheduleBlockDraft', () => {
  it('passes a complete draft', () => {
    expect(validateScheduleBlockDraft(draft)).toEqual({})
  })

  it('requires both ends and a strictly positive range', () => {
    expect(validateScheduleBlockDraft({ ...draft, startsAt: '' }).startsAt).toBeTruthy()
    expect(validateScheduleBlockDraft({ ...draft, endsAt: '' }).endsAt).toBeTruthy()
    expect(
      validateScheduleBlockDraft({ ...draft, endsAt: '2026-09-21T14:00' }).endsAt,
    ).toBeTruthy()
  })

  it('bounds the reason exactly where the server does', () => {
    expect(validateScheduleBlockDraft({ ...draft, reason: 'a'.repeat(REASON_MAX_LENGTH) })).toEqual(
      {},
    )
    expect(
      validateScheduleBlockDraft({ ...draft, reason: 'a'.repeat(REASON_MAX_LENGTH + 1) }).reason,
    ).toBeTruthy()
  })
})

describe('blockWindow', () => {
  it('spans from the start of the reference day to the requested horizon', () => {
    const { from, to } = blockWindow(new Date('2026-09-21T18:00:00Z'), 30)

    expect(from).toBe('2026-09-21T06:00:00.000Z')
    expect(to).toBe('2026-10-21T06:00:00.000Z')
  })
})

describe('byStartsAt', () => {
  it('sorts chronologically', () => {
    const later = block({ id: 'later', startsAt: '2026-10-01T15:00:00Z' })
    const sooner = block({ id: 'sooner', startsAt: '2026-09-01T15:00:00Z' })

    expect(byStartsAt([later, sooner]).map((item) => item.id)).toEqual(['sooner', 'later'])
  })
})

describe('formatBlockRange', () => {
  it('shows one day once and the clinic-local hours', () => {
    expect(
      formatBlockRange(
        block({ startsAt: '2026-09-21T20:00:00Z', endsAt: '2026-09-21T21:00:00Z' }),
      ),
    ).toBe('21 sep 2026, 14:00 – 15:00')
  })

  it('shows both dates when the block crosses midnight', () => {
    expect(
      formatBlockRange(
        block({ startsAt: '2026-12-21T06:00:00Z', endsAt: '2027-01-05T06:00:00Z' }),
      ),
    ).toBe('21 dic 2026, 00:00 – 5 ene 2027, 00:00')
  })
})

describe('blockErrorMessage', () => {
  it('explains the booked appointment the server protects with 409', () => {
    expect(blockErrorMessage(new ApiError({ status: 409, code: 'APPOINTMENT_SLOT_CONFLICT' }))).toMatch(
      /cita/i,
    )
  })

  it('explains the role gate and keeps a fallback', () => {
    expect(blockErrorMessage(new ApiError({ status: 403, code: 'FORBIDDEN' }))).toMatch(/permiso/i)
    expect(blockErrorMessage(new Error('boom'))).toMatch(/Algo salió mal/i)
  })
})
