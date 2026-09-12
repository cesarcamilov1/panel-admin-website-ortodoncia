import { describe, expect, it } from 'vitest'
import {
  LOWER_PERMANENT,
  UPPER_PERMANENT,
  applyCondition,
  isWholeToothCondition,
  listFindings,
  quadrantGapIndex,
  surfaceCondition,
  surfaceName,
} from './odontogram'

describe('FDI arches', () => {
  it('lists sixteen permanent teeth per arch, right quadrant first', () => {
    expect(UPPER_PERMANENT).toHaveLength(16)
    expect(UPPER_PERMANENT[0]).toBe(18)
    expect(UPPER_PERMANENT[8]).toBe(21)
    expect(LOWER_PERMANENT[0]).toBe(48)
    expect(LOWER_PERMANENT[8]).toBe(31)
  })

  it('breaks the arch at the midline', () => {
    expect(quadrantGapIndex(UPPER_PERMANENT)).toBe(7)
  })
})

describe('surfaceName', () => {
  it('calls the inner surface palatal on upper teeth and lingual on lower ones', () => {
    expect(surfaceName(16, 'L')).toBe('Palatino')
    expect(surfaceName(46, 'L')).toBe('Lingual')
  })

  it('names the remaining surfaces', () => {
    expect(surfaceName(16, 'O')).toBe('Oclusal')
    expect(surfaceName(16, 'M')).toBe('Mesial')
  })
})

describe('applyCondition', () => {
  it('marks a single surface', () => {
    const marks = applyCondition({}, 16, 'O', 'caries')
    expect(marks['16:O']).toBe('caries')
  })

  it('toggles the same condition off when reapplied', () => {
    const marked = applyCondition({}, 16, 'O', 'caries')
    expect(applyCondition(marked, 16, 'O', 'caries')).toEqual({})
  })

  it('replaces a surface condition with a different one', () => {
    const marked = applyCondition({}, 16, 'O', 'caries')
    expect(applyCondition(marked, 16, 'O', 'obturacion')['16:O']).toBe('obturacion')
  })

  it('clears every surface when a whole-tooth condition is applied', () => {
    const marked = applyCondition(applyCondition({}, 16, 'O', 'caries'), 16, 'V', 'corona')
    expect(marked).toEqual({ '16:ALL': 'corona' })
  })

  it('drops the whole-tooth condition when a surface is marked again', () => {
    const crowned = applyCondition({}, 16, 'O', 'corona')
    const marked = applyCondition(crowned, 16, 'M', 'caries')
    expect(marked['16:ALL']).toBeUndefined()
    expect(marked['16:M']).toBe('caries')
  })

  it('erases a tooth with the healthy tool', () => {
    const crowned = applyCondition({}, 16, 'O', 'corona')
    expect(applyCondition(crowned, 16, 'O', 'sano')).toEqual({})
  })

  it('leaves the original marks untouched', () => {
    const marks = applyCondition({}, 16, 'O', 'caries')
    applyCondition(marks, 16, 'M', 'caries')
    expect(Object.keys(marks)).toEqual(['16:O'])
  })
})

describe('isWholeToothCondition', () => {
  it('separates whole-tooth conditions from surface ones', () => {
    expect(isWholeToothCondition('ausente')).toBe(true)
    expect(isWholeToothCondition('caries')).toBe(false)
  })
})

describe('surfaceCondition', () => {
  it('reads a whole-tooth condition from any surface', () => {
    const marks = applyCondition({}, 46, 'O', 'corona')
    expect(surfaceCondition(marks, 46, 'M')).toBe('corona')
  })

  it('returns undefined for an unmarked surface', () => {
    expect(surfaceCondition({}, 46, 'M')).toBeUndefined()
  })
})

describe('listFindings', () => {
  it('describes each mark for the findings panel', () => {
    const marks = applyCondition(applyCondition({}, 16, 'O', 'caries'), 46, 'O', 'corona')
    expect(listFindings(marks)).toEqual([
      { key: '16:O', tooth: 16, label: 'Diente 16', detail: 'Oclusal · Caries', condition: 'caries' },
      {
        key: '46:ALL',
        tooth: 46,
        label: 'Diente 46',
        detail: 'Pieza completa · Corona',
        condition: 'corona',
      },
    ])
  })

  it('sorts findings by tooth number', () => {
    const marks = applyCondition(applyCondition({}, 46, 'O', 'caries'), 16, 'O', 'caries')
    expect(listFindings(marks).map((finding) => finding.tooth)).toEqual([16, 46])
  })
})
