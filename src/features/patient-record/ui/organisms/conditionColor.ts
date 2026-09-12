import type { Condition } from '../../domain/odontogram'

/** CSS custom property holding the fill for a condition. */
export function conditionColor(condition: Condition | undefined): string {
  return condition ? `var(--color-tooth-${condition})` : 'var(--color-tooth-sano)'
}

export function conditionBorder(condition: Condition | undefined): string {
  if (!condition) return 'var(--color-border-strong)'
  if (condition === 'ausente') return 'var(--color-tooth-ausente-line)'
  return `var(--color-tooth-${condition})`
}
