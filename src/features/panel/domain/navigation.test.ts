import { describe, expect, it } from 'vitest'
import {
  NAV_GROUPS,
  SECTION_TITLES,
  isNavItemActive,
  sectionFromPath,
  sectionPath,
} from './navigation'

describe('navigation catalog', () => {
  it('groups every section exactly once', () => {
    const ids = NAV_GROUPS.flatMap((group) => group.items.map((item) => item.id))
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain('inicio')
    expect(ids).toContain('facturacion')
  })

  it('titles every navigable section', () => {
    const ids = NAV_GROUPS.flatMap((group) => group.items.map((item) => item.id))
    for (const id of ids) {
      expect(SECTION_TITLES[id]).toBeTruthy()
    }
  })
})

describe('isNavItemActive', () => {
  it('marks the current section', () => {
    expect(isNavItemActive('agenda', 'agenda')).toBe(true)
    expect(isNavItemActive('agenda', 'pacientes')).toBe(false)
  })

  it('keeps Pacientes lit while a patient record is open', () => {
    expect(isNavItemActive('pacientes', 'ficha')).toBe(true)
  })
})

describe('routing helpers', () => {
  it('maps the dashboard to the root path', () => {
    expect(sectionPath('inicio')).toBe('/')
    expect(sectionFromPath('/')).toBe('inicio')
  })

  it('round-trips every other section', () => {
    expect(sectionPath('facturacion')).toBe('/facturacion')
    expect(sectionFromPath('/facturacion')).toBe('facturacion')
  })

  it('resolves a patient record path to the record section', () => {
    expect(sectionFromPath('/pacientes/EXP-0421')).toBe('ficha')
  })

  it('falls back to the dashboard for unknown paths', () => {
    expect(sectionFromPath('/nada')).toBe('inicio')
  })
})
