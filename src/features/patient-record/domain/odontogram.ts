export const SURFACES = ['V', 'M', 'O', 'D', 'L'] as const
export type Surface = (typeof SURFACES)[number]

export const CONDITIONS = [
  'sano',
  'caries',
  'obturacion',
  'sellador',
  'fractura',
  'corona',
  'endodoncia',
  'implante',
  'ausente',
] as const
export type Condition = (typeof CONDITIONS)[number]

/** Conditions that affect the whole piece instead of one surface. */
const WHOLE_TOOTH: readonly Condition[] = ['corona', 'endodoncia', 'implante', 'ausente']

export type OdontogramMarks = Record<string, Condition>

export interface Finding {
  key: string
  tooth: number
  label: string
  detail: string
  condition: Condition
}

export const UPPER_PERMANENT = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28]
export const LOWER_PERMANENT = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38]
export const UPPER_PRIMARY = [55, 54, 53, 52, 51, 61, 62, 63, 64, 65]
export const LOWER_PRIMARY = [85, 84, 83, 82, 81, 71, 72, 73, 74, 75]

export const CONDITION_LABELS: Record<Condition, string> = {
  sano: 'Sano',
  caries: 'Caries',
  obturacion: 'Obturación',
  sellador: 'Sellador',
  fractura: 'Fractura',
  corona: 'Corona',
  endodoncia: 'Endodoncia',
  implante: 'Implante',
  ausente: 'Ausente',
}

/** Index after which the arch is split at the midline. */
export function quadrantGapIndex(arch: readonly number[]): number {
  return arch.length / 2 - 1
}

function isUpper(tooth: number): boolean {
  return (tooth >= 11 && tooth <= 28) || (tooth >= 51 && tooth <= 65)
}

export function surfaceName(tooth: number, surface: Surface): string {
  switch (surface) {
    case 'V':
      return 'Vestibular'
    case 'M':
      return 'Mesial'
    case 'D':
      return 'Distal'
    case 'L':
      return isUpper(tooth) ? 'Palatino' : 'Lingual'
    default:
      return 'Oclusal'
  }
}

export function isWholeToothCondition(condition: Condition): boolean {
  return WHOLE_TOOTH.includes(condition)
}

function withoutTooth(marks: OdontogramMarks, tooth: number): OdontogramMarks {
  const next: OdontogramMarks = {}
  for (const [key, value] of Object.entries(marks)) {
    if (!key.startsWith(`${tooth}:`)) next[key] = value
  }
  return next
}

/** Pure transition: returns the marks after painting `condition` on a surface. */
export function applyCondition(
  marks: OdontogramMarks,
  tooth: number,
  surface: Surface,
  condition: Condition,
): OdontogramMarks {
  if (condition === 'sano') return withoutTooth(marks, tooth)

  if (isWholeToothCondition(condition)) {
    const cleared = withoutTooth(marks, tooth)
    if (marks[`${tooth}:ALL`] === condition) return cleared
    return { ...cleared, [`${tooth}:ALL`]: condition }
  }

  const next = { ...marks }
  delete next[`${tooth}:ALL`]
  const key = `${tooth}:${surface}`
  if (marks[key] === condition) {
    delete next[key]
    return next
  }
  return { ...next, [key]: condition }
}

export function surfaceCondition(
  marks: OdontogramMarks,
  tooth: number,
  surface: Surface,
): Condition | undefined {
  return marks[`${tooth}:ALL`] ?? marks[`${tooth}:${surface}`]
}

export function isToothMissing(marks: OdontogramMarks, tooth: number): boolean {
  return marks[`${tooth}:ALL`] === 'ausente'
}

export function isToothMarked(marks: OdontogramMarks, tooth: number): boolean {
  return Object.keys(marks).some((key) => key.startsWith(`${tooth}:`))
}

export function listFindings(marks: OdontogramMarks): Finding[] {
  return Object.entries(marks)
    .map(([key, condition]) => {
      const [rawTooth, rawSurface] = key.split(':')
      const tooth = Number(rawTooth)
      const where =
        rawSurface === 'ALL' ? 'Pieza completa' : surfaceName(tooth, rawSurface as Surface)
      return {
        key,
        tooth,
        label: `Diente ${tooth}`,
        detail: `${where} · ${CONDITION_LABELS[condition]}`,
        condition,
      }
    })
    .sort((a, b) => a.tooth - b.tooth || a.key.localeCompare(b.key))
}

export function removeFinding(marks: OdontogramMarks, key: string): OdontogramMarks {
  const next = { ...marks }
  delete next[key]
  return next
}
