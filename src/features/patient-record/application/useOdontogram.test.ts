import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useOdontogram } from './useOdontogram'

describe('useOdontogram', () => {
  it('starts on the caries tool with the seeded marks', () => {
    const { result } = renderHook(() => useOdontogram({ '16:O': 'caries' }))
    expect(result.current.tool).toBe('caries')
    expect(result.current.findings).toHaveLength(1)
  })

  it('paints the selected tool onto a surface', () => {
    const { result } = renderHook(() => useOdontogram({}))

    act(() => result.current.selectTool('obturacion'))
    act(() => result.current.paint(26, 'M'))

    expect(result.current.marks['26:M']).toBe('obturacion')
    expect(result.current.findings[0].detail).toBe('Mesial · Obturación')
  })

  it('removes a single finding', () => {
    const { result } = renderHook(() => useOdontogram({ '16:O': 'caries', '26:M': 'caries' }))

    act(() => result.current.removeFinding('16:O'))

    expect(result.current.findings.map((finding) => finding.key)).toEqual(['26:M'])
  })

  it('resets back to the seeded marks', () => {
    const seed = { '16:O': 'caries' } as const
    const { result } = renderHook(() => useOdontogram(seed))

    act(() => result.current.paint(26, 'M'))
    act(() => result.current.reset())

    expect(result.current.marks).toEqual(seed)
  })

  it('switches between permanent and primary dentition', () => {
    const { result } = renderHook(() => useOdontogram({}))
    expect(result.current.upper).toHaveLength(16)

    act(() => result.current.setDentition('primary'))

    expect(result.current.upper).toHaveLength(10)
    expect(result.current.upper[0]).toBe(55)
  })
})
