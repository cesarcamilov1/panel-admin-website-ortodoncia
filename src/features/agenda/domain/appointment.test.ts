import { describe, expect, it } from 'vitest'
import { allowedTransitions, requiresTransitionReason, toAgendaWindow } from './appointment'

describe('appointment workflow contract', () => {
  it('only exposes backend-supported state transitions', () => {
    expect(allowedTransitions('PENDING')).toEqual(['CONFIRMED', 'CANCELLED'])
    expect(allowedTransitions('CONFIRMED')).toEqual(['ARRIVED', 'CANCELLED', 'NO_SHOW'])
    expect(allowedTransitions('ARRIVED')).toEqual(['IN_PROGRESS', 'CANCELLED'])
    expect(allowedTransitions('IN_PROGRESS')).toEqual(['COMPLETED'])
    expect(allowedTransitions('COMPLETED')).toEqual([])
  })

  it('requires a reason for the cancellation and no-show actions', () => {
    expect(requiresTransitionReason('CANCELLED')).toBe(true)
    expect(requiresTransitionReason('NO_SHOW')).toBe(true)
    expect(requiresTransitionReason('CONFIRMED')).toBe(false)
  })

  it('builds an RFC3339 seven-day window from a local agenda date', () => {
    const window = toAgendaWindow(new Date(2026, 8, 14, 14, 23), 7)
    expect(window.from).toMatch(/^2026-09-14T/)
    expect(Number.isNaN(new Date(window.from).valueOf())).toBe(false)
    expect(new Date(window.to).valueOf() - new Date(window.from).valueOf()).toBe(7 * 24 * 60 * 60 * 1000)
  })
})
