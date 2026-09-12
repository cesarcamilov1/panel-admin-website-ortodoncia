import { useCallback, useMemo, useState } from 'react'
import {
  LOWER_PERMANENT,
  LOWER_PRIMARY,
  UPPER_PERMANENT,
  UPPER_PRIMARY,
  applyCondition,
  listFindings,
  removeFinding as removeMark,
  type Condition,
  type OdontogramMarks,
  type Surface,
} from '../domain/odontogram'

export type Dentition = 'permanent' | 'primary'

export function useOdontogram(seed: OdontogramMarks) {
  const [marks, setMarks] = useState<OdontogramMarks>(seed)
  const [tool, setTool] = useState<Condition>('caries')
  const [dentition, setDentition] = useState<Dentition>('permanent')

  const paint = useCallback(
    (tooth: number, surface: Surface) => {
      setMarks((current) => applyCondition(current, tooth, surface, tool))
    },
    [tool],
  )

  const removeFinding = useCallback((key: string) => {
    setMarks((current) => removeMark(current, key))
  }, [])

  const reset = useCallback(() => setMarks(seed), [seed])

  const findings = useMemo(() => listFindings(marks), [marks])
  const upper = dentition === 'permanent' ? UPPER_PERMANENT : UPPER_PRIMARY
  const lower = dentition === 'permanent' ? LOWER_PERMANENT : LOWER_PRIMARY

  return {
    marks,
    tool,
    selectTool: setTool,
    dentition,
    setDentition,
    paint,
    removeFinding,
    reset,
    findings,
    upper,
    lower,
  }
}
