import { describe, expect, it } from 'vitest'
import {
  DAY_END_MINUTES,
  DAY_START_MINUTES,
  HOUR_HEIGHT,
  buildHourLabels,
  buildMonthGrid,
  slotPlacement,
  toMinutes,
} from './agenda'

describe('toMinutes', () => {
  it('converts a wall clock label into minutes past midnight', () => {
    expect(toMinutes('08:00')).toBe(480)
    expect(toMinutes('16:30')).toBe(990)
  })
})

describe('slotPlacement', () => {
  it('places the first slot of the day at the top of the grid', () => {
    expect(slotPlacement('08:00', 60)).toEqual({ top: 0, height: HOUR_HEIGHT })
  })

  it('offsets later slots by whole and half hours', () => {
    expect(slotPlacement('09:30', 30)).toEqual({
      top: HOUR_HEIGHT * 1.5,
      height: HOUR_HEIGHT / 2,
    })
  })

  it('never returns a height that escapes the grid', () => {
    const { top, height } = slotPlacement('19:00', 180)
    const gridHeight = ((DAY_END_MINUTES - DAY_START_MINUTES) / 60) * HOUR_HEIGHT
    expect(top + height).toBeLessThanOrEqual(gridHeight)
  })
})

describe('buildHourLabels', () => {
  it('labels every hour from opening to the last full hour', () => {
    const labels = buildHourLabels()
    expect(labels[0]).toBe('08:00')
    expect(labels.at(-1)).toBe('19:00')
    expect(labels).toHaveLength(12)
  })
})

describe('buildMonthGrid', () => {
  it('starts the grid on a Monday and covers the whole month', () => {
    const cells = buildMonthGrid(2026, 8)
    expect(cells).toHaveLength(35)
    expect(cells[0]).toEqual({ day: 31, inMonth: false })
    expect(cells[1]).toEqual({ day: 1, inMonth: true })
    expect(cells.filter((cell) => cell.inMonth)).toHaveLength(30)
  })
})
